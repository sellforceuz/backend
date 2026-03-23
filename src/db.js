// src/db.js — PostgreSQL: схема БД и все модели данных
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => console.error("❌ PostgreSQL error:", err.message));

// ─── ИНИЦИАЛИЗАЦИЯ ТАБЛИЦ ─────────────────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        email         TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name          TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'user',
        plan          TEXT NOT NULL DEFAULT 'starter',
        status        TEXT NOT NULL DEFAULT 'trial',
        trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        last_login    TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id           SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        platform     TEXT NOT NULL,
        handle       TEXT NOT NULL,
        name         TEXT NOT NULL,
        color        TEXT DEFAULT '#00d4aa',
        icon         TEXT DEFAULT '📱',
        token        TEXT,
        channel_id   TEXT,
        threads_user_id TEXT,
        is_active    BOOLEAN DEFAULT true,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS posts (
        id           SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        text         TEXT NOT NULL,
        platforms    JSONB NOT NULL DEFAULT '["telegram"]',
        status       TEXT NOT NULL DEFAULT 'scheduled',
        scheduled_at TIMESTAMPTZ NOT NULL,
        published_at TIMESTAMPTZ,
        error_log    TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS usage (
        id           SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        month        TEXT NOT NULL,
        generations  INTEGER DEFAULT 0,
        posts_sent   INTEGER DEFAULT 0,
        UNIQUE(workspace_id, month)
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id           SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        type         TEXT NOT NULL,
        platform     TEXT,
        message      TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ БД: таблицы готовы");

    // Добавляем новые колонки аналитики (IF NOT EXISTS — безопасно для существующей БД)
    await client.query(`
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS tg_message_id TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS threads_post_id TEXT;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT '{}';
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS last_stats_update TIMESTAMPTZ;
      ALTER TABLE posts ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active';
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN DEFAULT false;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS content_focus TEXT;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS daily_post_count INTEGER DEFAULT 5;
    `);

  } finally {
    client.release();
  }
}

// ─── ЛИМИТЫ ТАРИФОВ ───────────────────────────────────────────────────────────
const PLAN_LIMITS = {
  starter: { accounts: 3,  postsPerDay: 2,  generationsPerMonth: 200  },
  pro:     { accounts: 6,  postsPerDay: 5,  generationsPerMonth: 600  },
  agency:  { accounts: 20, postsPerDay: 15, generationsPerMonth: 2000 },
};

// ─── USERS ────────────────────────────────────────────────────────────────────
const Users = {
  findByEmail: async (email) => {
    const r = await pool.query("SELECT * FROM users WHERE email=$1", [email.toLowerCase()]);
    return r.rows[0] || null;
  },
  findById: async (id) => {
    const r = await pool.query("SELECT * FROM users WHERE id=$1", [id]);
    return r.rows[0] || null;
  },
  create: async ({ email, passwordHash, name, role = "user", plan = "starter" }) => {
    const r = await pool.query(
      "INSERT INTO users (email,password_hash,name,role,plan) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [email.toLowerCase(), passwordHash, name, role, plan]
    );
    return r.rows[0];
  },
  updateLastLogin: (id) => pool.query("UPDATE users SET last_login=NOW() WHERE id=$1", [id]),
  updatePlan: (id, plan) => pool.query("UPDATE users SET plan=$2 WHERE id=$1", [id, plan]),
  updateStatus: (id, status) => pool.query("UPDATE users SET status=$2 WHERE id=$1", [id, status]),
  getAll: async () => {
    const r = await pool.query(`
      SELECT u.*, w.id as workspace_id,
        (SELECT COUNT(*) FROM posts p WHERE p.workspace_id=w.id) as total_posts,
        (SELECT COUNT(*) FROM accounts a WHERE a.workspace_id=w.id) as total_accounts
      FROM users u LEFT JOIN workspaces w ON w.user_id=u.id
      ORDER BY u.created_at DESC
    `);
    return r.rows;
  },
};

// ─── WORKSPACES ───────────────────────────────────────────────────────────────
const Workspaces = {
  create: async (userId, name) => {
    const r = await pool.query(
      "INSERT INTO workspaces (user_id,name) VALUES ($1,$2) RETURNING *",
      [userId, name]
    );
    return r.rows[0];
  },
  getByUserId: async (userId) => {
    const r = await pool.query("SELECT * FROM workspaces WHERE user_id=$1", [userId]);
    return r.rows[0] || null;
  },
};

// ─── ACCOUNTS ─────────────────────────────────────────────────────────────────
const Accounts = {
  getAll: async (workspaceId) => {
    const r = await pool.query(
      "SELECT * FROM accounts WHERE workspace_id=$1 AND is_active=true ORDER BY created_at ASC",
      [workspaceId]
    );
    return r.rows;
  },
  create: async (workspaceId, data) => {
    const r = await pool.query(
      `INSERT INTO accounts (workspace_id,platform,handle,name,color,icon,token,channel_id,threads_user_id,token_expires_at,account_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [workspaceId, data.platform, data.handle, data.name,
       data.color || "#00d4aa", data.icon || "📱",
       data.token || null, data.channel_id || null,
       data.threads_user_id || null,
       data.token_expires_at || null,
       data.account_status || "active"]
    );
    return r.rows[0];
  },
  update: async (id, workspaceId, data) => {
    const r = await pool.query(
      `UPDATE accounts SET handle=$3,name=$4,token=$5,channel_id=$6,threads_user_id=$7,color=$8,icon=$9,
       autopilot_enabled=COALESCE($10, autopilot_enabled),
       content_focus=COALESCE($11, content_focus),
       daily_post_count=COALESCE($12, daily_post_count)
       WHERE id=$1 AND workspace_id=$2 RETURNING *`,
      [id, workspaceId, data.handle, data.name, data.token,
       data.channel_id, data.threads_user_id, data.color, data.icon,
       data.autopilot_enabled ?? null,
       data.content_focus ?? null,
       data.daily_post_count ?? null]
    );
    return r.rows[0];
  },
  delete: (id, workspaceId) =>
    pool.query("UPDATE accounts SET is_active=false WHERE id=$1 AND workspace_id=$2", [id, workspaceId]),
};

// ─── POSTS ────────────────────────────────────────────────────────────────────
const Posts = {
  getDue: async () => {
    const r = await pool.query(`
      SELECT p.*, a.token, a.channel_id, a.threads_user_id, a.handle,
             a.platform as acc_platform, a.is_active as acc_active
      FROM posts p
      JOIN accounts a ON a.id=p.account_id
      WHERE p.status='scheduled'
        AND p.scheduled_at <= NOW()
        AND a.is_active = true
      ORDER BY p.scheduled_at ASC
      LIMIT 50
    `);
    return r.rows;
  },
  getByWorkspace: async (workspaceId, limit = 50) => {
    const r = await pool.query(`
      SELECT p.*, a.handle, a.name as account_name, a.color, a.icon
      FROM posts p JOIN accounts a ON a.id=p.account_id
      WHERE p.workspace_id=$1
      ORDER BY p.scheduled_at DESC LIMIT $2
    `, [workspaceId, limit]);
    return r.rows;
  },
  create: async (workspaceId, data) => {
    const r = await pool.query(
      `INSERT INTO posts (workspace_id,account_id,text,platforms,scheduled_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [workspaceId, data.account_id, data.text,
       JSON.stringify(data.platforms || ["telegram"]), data.scheduled_at]
    );
    return r.rows[0];
  },
  markPublished: (id) =>
    pool.query("UPDATE posts SET status='published',published_at=NOW(),updated_at=NOW() WHERE id=$1", [id]),
  markFailed: (id, errorLog) =>
    pool.query("UPDATE posts SET status='failed',error_log=$2,updated_at=NOW() WHERE id=$1", [id, errorLog]),
  // Сохранить ID сообщений из соцсетей после публикации
  saveMessageIds: (id, tgMessageId, threadsPostId) =>
    pool.query(
      "UPDATE posts SET tg_message_id=COALESCE($2,tg_message_id), threads_post_id=COALESCE($3,threads_post_id), updated_at=NOW() WHERE id=$1",
      [id, tgMessageId || null, threadsPostId || null]
    ),
  delete: (id, workspaceId) =>
    pool.query("DELETE FROM posts WHERE id=$1 AND workspace_id=$2", [id, workspaceId]),
};

// ─── USAGE ────────────────────────────────────────────────────────────────────
const Usage = {
  getMonth: async (workspaceId) => {
    const month = new Date().toISOString().slice(0, 7);
    const r = await pool.query(
      "SELECT * FROM usage WHERE workspace_id=$1 AND month=$2",
      [workspaceId, month]
    );
    return r.rows[0] || { generations: 0, posts_sent: 0 };
  },
  increment: async (workspaceId, field) => {
    if (!["generations", "posts_sent"].includes(field)) throw new Error("Invalid field");
    const month = new Date().toISOString().slice(0, 7);
    await pool.query(
      `INSERT INTO usage (workspace_id,month,${field}) VALUES ($1,$2,1)
       ON CONFLICT (workspace_id,month) DO UPDATE SET ${field}=usage.${field}+1`,
      [workspaceId, month]
    );
  },
};

// ─── LOG ──────────────────────────────────────────────────────────────────────
const Log = {
  add: async (workspaceId, type, platform, message) => {
    await pool.query(
      "INSERT INTO activity_log (workspace_id,type,platform,message) VALUES ($1,$2,$3,$4)",
      [workspaceId, type, platform, message]
    );
  },
  recent: async (workspaceId, limit = 100) => {
    const r = await pool.query(
      "SELECT * FROM activity_log WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT $2",
      [workspaceId, limit]
    );
    return r.rows;
  },
};

// ─── REFRESH TOKENS ───────────────────────────────────────────────────────────
const RefreshTokens = {
  create: (userId, token, expiresAt) =>
    pool.query("INSERT INTO refresh_tokens (user_id,token,expires_at) VALUES ($1,$2,$3)", [userId, token, expiresAt]),
  find: async (token) => {
    const r = await pool.query("SELECT * FROM refresh_tokens WHERE token=$1 AND expires_at>NOW()", [token]);
    return r.rows[0] || null;
  },
  delete: (token) => pool.query("DELETE FROM refresh_tokens WHERE token=$1", [token]),
  deleteByUser: (userId) => pool.query("DELETE FROM refresh_tokens WHERE user_id=$1", [userId]),
};

module.exports = { pool, initDB, PLAN_LIMITS, Users, Workspaces, Accounts, Posts, Usage, Log, RefreshTokens };
