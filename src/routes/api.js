// src/routes/api.js — основные API для пользователей
const express = require("express");
const router = express.Router();
const { Accounts, Posts, Usage, Log, PLAN_LIMITS } = require("../db");
const { requireAuth, checkLimit } = require("../middleware/auth");
const { generatePost } = require("../services/ai");
const telegram = require("../services/telegram");
const threads = require("../services/threads");

router.use(requireAuth);

// GET /api/accounts
router.get("/accounts", async (req, res) => {
  try {
    const accounts = await Accounts.getAll(req.workspaceId);
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts
router.post("/accounts", async (req, res) => {
  try {
    const limits = PLAN_LIMITS[req.user.plan] || PLAN_LIMITS.starter;
    const existing = await Accounts.getAll(req.workspaceId);
    if (existing.length >= limits.accounts) {
      return res.status(429).json({ error: `Лимит аккаунтов (${limits.accounts}) для вашего тарифа` });
    }

    const { platform, handle, name, color, icon, token, channel_id, threads_user_id } = req.body;
    if (!platform || !handle || !name) return res.status(400).json({ error: "Укажи platform, handle и name" });

    const account = await Accounts.create(req.workspaceId, { platform, handle, name, color, icon, token, channel_id, threads_user_id });
    await Log.add(req.workspaceId, "account_added", platform, `Аккаунт ${handle} добавлен`);
    res.json({ account });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/accounts/:id
router.put("/accounts/:id", async (req, res) => {
  try {
    const account = await Accounts.update(req.params.id, req.workspaceId, req.body);
    res.json({ account });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/accounts/:id
router.delete("/accounts/:id", async (req, res) => {
  try {
    await Accounts.delete(req.params.id, req.workspaceId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/posts
router.get("/posts", async (req, res) => {
  try {
    const posts = await Posts.getByWorkspace(req.workspaceId);
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts — создать и запланировать пост
router.post("/posts", async (req, res) => {
  try {
    const { account_id, text, platforms, scheduled_at } = req.body;
    if (!account_id || !text || !scheduled_at) return res.status(400).json({ error: "Укажи account_id, text и scheduled_at" });

    const post = await Posts.create(req.workspaceId, { account_id, text, platforms, scheduled_at });
    res.json({ post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts/publish-now — немедленная публикация
router.post("/posts/publish-now", async (req, res) => {
  try {
    const { account_id, text, platforms } = req.body;
    if (!account_id || !text) return res.status(400).json({ error: "Укажи account_id и text" });

    const accounts = await Accounts.getAll(req.workspaceId);
    const account = accounts.find(a => a.id === parseInt(account_id));
    if (!account) return res.status(404).json({ error: "Аккаунт не найден" });

    const results = [];
    const plats = platforms || ["telegram"];

    for (const platform of plats) {
      try {
        if (platform === "telegram" && account.channel_id) {
          await telegram.sendMessage(account.channel_id, text);
          results.push({ platform, ok: true });
        } else if (platform === "threads" && account.token && account.threads_user_id) {
          await threads.publishPost(account.threads_user_id, account.token, text);
          results.push({ platform, ok: true });
        } else {
          results.push({ platform, ok: false, error: "Нет токена или channel_id" });
        }
      } catch (err) {
        results.push({ platform, ok: false, error: err.message });
      }
    }

    await Usage.increment(req.workspaceId, "posts_sent");
    await Log.add(req.workspaceId, "publish_now", plats.join(","), `Опубликовано в ${account.handle}`);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/posts/:id
router.delete("/posts/:id", async (req, res) => {
  try {
    await Posts.delete(req.params.id, req.workspaceId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate — AI генерация поста
router.post("/generate", checkLimit("generation"), async (req, res) => {
  try {
    const { account_id, topic, tone, format, idea } = req.body;
    if (!topic) return res.status(400).json({ error: "Укажи тему (topic)" });

    const accounts = await Accounts.getAll(req.workspaceId);
    const account = accounts.find(a => a.id === parseInt(account_id));

    const text = await generatePost({
      accountName: account?.name || "Мой аккаунт",
      accountHandle: account?.handle || "",
      topic, tone, format, idea,
    });

    await Usage.increment(req.workspaceId, "generations");
    await Log.add(req.workspaceId, "ai_generate", "gemini", `Тема: ${topic}`);

    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage
router.get("/usage", async (req, res) => {
  try {
    const usage = await Usage.getMonth(req.workspaceId);
    const limits = PLAN_LIMITS[req.user.plan] || PLAN_LIMITS.starter;
    res.json({ usage, limits, plan: req.user.plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/logs
router.get("/logs", async (req, res) => {
  try {
    const logs = await Log.recent(req.workspaceId);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/posts/stats — аналитика: последние 50 постов с ID и метриками
router.get("/posts/stats", async (req, res) => {
  try {
    const { pool } = require("../db");
    const r = await pool.query(`
      SELECT
        p.id, p.text, p.status, p.platforms,
        p.tg_message_id, p.threads_post_id, p.metrics,
        p.scheduled_at, p.published_at, p.error_log, p.created_at,
        a.handle, a.name AS account_name, a.platform AS account_platform,
        a.color, a.icon
      FROM posts p
      JOIN accounts a ON a.id = p.account_id
      WHERE p.workspace_id = $1
      ORDER BY p.created_at DESC
      LIMIT 50
    `, [req.workspaceId]);
    res.json({ posts: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

