// src/index.js — точка входа сервера
require("dotenv").config();
console.log("[Startup] Loading modules...");
const express = require("express");
const cors    = require("cors");

let initDB, Users, Workspaces, Accounts, startScheduler, startAutoPoster, hashPassword;
try {
  ({ initDB, Users, Workspaces, Accounts } = require("./db"));
  console.log("[Startup] ✅ db.js loaded");
} catch (e) { console.error("[Startup] ❌ db.js failed:", e.message); process.exit(1); }

try {
  ({ hashPassword } = require("./services/auth"));
  console.log("[Startup] ✅ services/auth loaded");
} catch (e) { console.error("[Startup] ❌ services/auth failed:", e.message); process.exit(1); }

try {
  ({ startScheduler } = require("./jobs/scheduler"));
  console.log("[Startup] ✅ scheduler.js loaded");
} catch (e) { console.error("[Startup] ❌ scheduler.js failed:", e.message); process.exit(1); }

try {
  ({ startAutoPoster } = require("./jobs/autoposter"));
  console.log("[Startup] ✅ autoposter.js loaded");
} catch (e) { console.warn("[Startup] ⚠️ autoposter.js skipped:", e.message); startAutoPoster = () => {}; }



// ─── SEED TELEGRAM ACCOUNTS ───────────────────────────────────────────────────
async function seedAccounts() {
  // Находим workspace admin-а
  const admin = await Users.findByEmail(process.env.ADMIN_EMAIL || "amirmuxt12@gmail.com");
  if (!admin) return;
  const ws = await Workspaces.getByUserId(admin.id);
  if (!ws) return;

  const existing = await Accounts.getAll(ws.id);
  const existingHandles = existing.map(a => a.handle);

  const defaultAccounts = [
    {
      platform: "telegram", handle: "@sellforce_uz_academy",
      name: "Sellforce Academy", icon: "🎓", color: "#00d4aa",
      channel_id: "-1003711704639",
    },
    {
      platform: "telegram", handle: "@sellforce_uz_crm",
      name: "Sellforce / Систематизация бизнеса", icon: "📊", color: "#a78bfa",
      channel_id: "-1003715663210",
    },
    {
      platform: "telegram", handle: "@amir_sales_channel",
      name: "ПроПродажи | Sales with Amir", icon: "🏆", color: "#f0c040",
      channel_id: "-1002649517321",
    },
  ];

  for (const acc of defaultAccounts) {
    if (!existingHandles.includes(acc.handle)) {
      await Accounts.create(ws.id, acc);
      console.log("Seeded account: " + acc.handle);
    }
  }
}

const app  = express();
const PORT = process.env.PORT || 3001;

// Нужно для Railway/Heroku — они используют reverse proxy
app.set("trust proxy", 1);

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || "*").split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error("CORS blocked: " + origin));
  },
  credentials: true,
}));

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ─── HEALTH CHECK (отвечает сразу — до инициализации БД) ─────────────────────
app.get("/health", (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ─── THREADS OAUTH START ──────────────────────────────────────────────────────
// Принимает ?state=<jwt> от фронтенда, передаёт в Meta OAuth как state
app.get("/auth/threads/start", (req, res) => {
  const appId      = process.env.THREADS_APP_ID || "925519976744188";
  const backendUrl = process.env.BACKEND_URL || "https://backend-production-49e4.up.railway.app";
  const redirectUri = `${backendUrl}/auth/threads/callback`;
  const scope      = "threads_basic,threads_content_publish,threads_manage_insights";
  const state      = req.query.state || "nosession"; // JWT от пользователя
  const url = `https://www.threads.net/oauth/authorize?` + new URLSearchParams({
    client_id: appId, redirect_uri: redirectUri,
    scope, response_type: "code", state,
  });
  console.log("[Threads OAuth] 🔗 Starting OAuth for state:", state.slice(0, 20) + "...");
  res.redirect(url);
});

// ─── THREADS OAUTH CALLBACK — АВТОСОХРАНЕНИЕ АККАУНТА ────────────────────────
app.get("/auth/threads/callback", async (req, res) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || "https://magnificent-crumble-ca6996.netlify.app";
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    console.error("[Threads OAuth] ❌ User denied:", oauthError);
    return res.redirect(`${FRONTEND_URL}?threads_error=${encodeURIComponent(oauthError)}`);
  }
  if (!code) {
    return res.redirect(`${FRONTEND_URL}?threads_error=no_code`);
  }

  try {
    const fetch      = require("node-fetch");
    const { verifyAccessToken } = require("./services/auth");
    const { Workspaces, Accounts, pool } = require("./db");
    const { exchangeLongLivedToken } = require("./services/threads");

    const appId      = process.env.THREADS_APP_ID || "925519976744188";
    const appSecret  = process.env.THREADS_APP_SECRET || "";
    const backendUrl = process.env.BACKEND_URL || "https://backend-production-49e4.up.railway.app";
    const redirectUri = `${backendUrl}/auth/threads/callback`;

    // Шаг 1: Получаем краткосрочный токен (1 час)
    const tokenRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: appId, client_secret: appSecret,
        grant_type: "authorization_code", redirect_uri: redirectUri, code }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(`OAuth token: ${tokenData.error.message}`);

    const shortToken = tokenData.access_token;
    const userId     = String(tokenData.user_id);
    console.log("[Threads OAuth] ✅ Short token for user:", userId);

    // Шаг 2: Обмен на долгосрочный токен (60 дней)
    let finalToken = shortToken;
    let expiresAt  = null;
    if (appSecret) {
      const { access_token, expires_at } = await exchangeLongLivedToken(shortToken);
      finalToken = access_token;
      expiresAt  = expires_at;
      console.log("[Threads OAuth] ✅ Long-lived token (expires:", expires_at, ")");
    }

    // Шаг 3: Получаем профиль пользователя
    const profileRes = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${finalToken}`
    );
    const profile = await profileRes.json();
    const username = profile.username || `threads_${userId}`;
    console.log("[Threads OAuth] 👤 Profile:", username, "(", userId, ")");

    // Шаг 4: Определяем workspace из state (JWT)
    let workspaceId = null;
    const payload = state && state !== "nosession" ? verifyAccessToken(state) : null;
    if (payload?.userId) {
      const ws = await Workspaces.getByUserId(payload.userId);
      workspaceId = ws?.id;
    }

    if (!workspaceId) {
      // Fallback: ищем workspace по admin email
      const adminEmail = process.env.ADMIN_EMAIL || "amirmuxt12@gmail.com";
      const { Users } = require("./db");
      const admin = await Users.findByEmail(adminEmail);
      if (admin) {
        const ws = await Workspaces.getByUserId(admin.id);
        workspaceId = ws?.id;
      }
    }

    if (!workspaceId) throw new Error("Не удалось определить workspace");

    // Шаг 5: Сохраняем или обновляем аккаунт
    const existingRes = await pool.query(
      "SELECT id FROM accounts WHERE workspace_id=$1 AND platform='threads' AND threads_user_id=$2",
      [workspaceId, userId]
    );

    if (existingRes.rows.length > 0) {
      // Обновить существующий
      await pool.query(
        `UPDATE accounts SET token=$1, token_expires_at=$2, is_active=true,
         handle=$3, name=$4, updated_at=NOW()
         WHERE id=$5`,
        [finalToken, expiresAt, `@${username}`, username, existingRes.rows[0].id]
      );
      console.log("[Threads OAuth] 🔄 Updated existing account:", username);
    } else {
      // Создать новый (workspaceId отдельным параметром!)
      await Accounts.create(workspaceId, {
        platform: "threads",
        handle: `@${username}`, name: username,
        token: finalToken, threads_user_id: userId,
        icon: "🧵", color: "#000000",
        token_expires_at: expiresAt,
      });
      console.log("[Threads OAuth] ✅ Created new account:", username);
    }

    // Редиректим на фронтенд с успехом
    res.redirect(`${FRONTEND_URL}?threads_connected=1&username=${encodeURIComponent(username)}`);

  } catch (err) {
    console.error("[Threads OAuth] ❌ Error:", err.message);
    const FRONTEND_URL2 = process.env.FRONTEND_URL || "https://magnificent-crumble-ca6996.netlify.app";
    res.redirect(`${FRONTEND_URL2}?threads_error=${encodeURIComponent(err.message)}`);
  }
});


// ─── ROUTES ───────────────────────────────────────────────────────────────────
try { app.use("/auth",  require("./routes/auth")); console.log("[Startup] ✅ auth routes"); }
catch (e) { console.error("[Startup] ❌ routes/auth failed:", e.message); }

try { app.use("/api",   require("./routes/api")); console.log("[Startup] ✅ api routes"); }
catch (e) { console.error("[Startup] ❌ routes/api failed:", e.message); }

try { app.use("/admin", require("./routes/admin")); console.log("[Startup] ✅ admin routes"); }
catch (e) { console.error("[Startup] ❌ routes/admin failed:", e.message); }


// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

// ─── START ────────────────────────────────────────────────────────────────────
async function start() {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET не задан!");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан!");
    process.exit(1);
  }

  // Запускаем HTTP-сервер СРАЗУ — Railway healthcheck пройдёт без ожидания БД
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("Server listening on port " + PORT);
  });

  // FIX #5: Graceful shutdown — корректное завершение при SIGTERM/SIGINT (Docker, Railway)
  function shutdown(signal) {
    console.log(`${signal} received, graceful shutdown...`);
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
    // Принудительный выход через 10 сек если сервер не закрылся
    setTimeout(() => { console.error("Forced exit"); process.exit(1); }, 10000);
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

  // Инициализируем БД и admin асинхронно
  try {
    await initDB();

    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      const existing = await Users.findByEmail(process.env.ADMIN_EMAIL);
      if (!existing) {
        const passwordHash = await hashPassword(process.env.ADMIN_PASSWORD);
        const admin = await Users.create({
          email: process.env.ADMIN_EMAIL,
          passwordHash,
          name: "Admin",
          role: "admin",
          plan: "agency",
        });
        await Workspaces.create(admin.id, "Admin workspace");
        console.log("Admin created: " + process.env.ADMIN_EMAIL);
      }
    }

    startScheduler();
    startAutoPoster();

    // Засеять аккаунты Telegram-каналов если их ещё нет
    await seedAccounts();

    console.log("DB ready, scheduler and autoposter started");
  } catch (err) {
    console.error("Init error:", err.message);
  }
}

start();
