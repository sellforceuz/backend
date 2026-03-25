// src/routes/api.js — основные API для пользователей
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { Accounts, Posts, Usage, Log, PLAN_LIMITS, pool } = require("../db");
const { requireAuth, checkLimit } = require("../middleware/auth");
const { generatePost, generateCommentVariants } = require("../services/ai");
const telegram = require("../services/telegram");
const threads  = require("../services/threads");

// ─── FIX #4: Rate limiter для всех /api эндпоинтов (30 req/мин) ──────────────
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много запросов — подождите минуту" },
});

// ─── FIX #4: Жёсткий лимит на генерацию AI (10 req/мин) ─────────────────────
const generateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком частая генерация — подождите минуту" },
});

router.use(requireAuth);
router.use(apiLimiter);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const VALID_PLATFORMS = ["telegram", "threads"];

// FIX #2: Валидация и санитизация платформ
function sanitizePlatforms(platforms) {
  const arr = Array.isArray(platforms) ? platforms : ["telegram"];
  const clean = arr.filter(p => VALID_PLATFORMS.includes(p));
  return clean.length > 0 ? clean : ["telegram"];
}

// FIX #1: Проверка, что account_id принадлежит текущему workspace
async function getOwnedAccount(workspaceId, accountId) {
  const accounts = await Accounts.getAll(workspaceId);
  return accounts.find(a => a.id === parseInt(accountId)) || null;
}

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
    if (!VALID_PLATFORMS.includes(platform)) return res.status(400).json({ error: "Платформа должна быть telegram или threads" });

    let finalToken = token || null;
    let tokenExpiresAt = null;
    let verifiedInfo = null;

    // ── Верификация и подготовка токенов ──────────────────────────────────────
    if (platform === "telegram" && channel_id) {
      // Верифицируем через getChat — сразу узнаём об ошибке до сохранения
      try {
        verifiedInfo = await telegram.verifyTelegram(channel_id, token || undefined);
      } catch (err) {
        return res.status(400).json({ error: `Ошибка верификации Telegram: ${err.message}` });
      }
    }

    if (platform === "threads" && token && threads_user_id) {
      // Верифицируем токен
      try {
        verifiedInfo = await threads.verifyThreadsToken(threads_user_id, token);
      } catch (err) {
        return res.status(400).json({ error: `Ошибка верификации Threads: ${err.message}` });
      }
      // Обмениваем краткосрочный токен на 60-дневный
      if (process.env.THREADS_APP_SECRET) {
        try {
          const exchanged = await threads.exchangeLongLivedToken(token);
          finalToken = exchanged.access_token;
          tokenExpiresAt = exchanged.expires_at;
        } catch (err) {
          console.warn("Token exchange failed, saving original:", err.message);
          // Сохраняем оригинальный токен если обмен не удался
        }
      }
    }

    const accountData = {
      platform, handle, name,
      color: color || "#00d4aa",
      icon: icon || "📱",
      token: finalToken,
      channel_id: channel_id || null,
      threads_user_id: threads_user_id || null,
      token_expires_at: tokenExpiresAt,
      account_status: "active",
      custom_prompt: req.body.custom_prompt || null,
    };

    const account = await Accounts.create(req.workspaceId, accountData);
    await Log.add(req.workspaceId, "account_added", platform,
      `Аккаунт ${handle} добавлен${verifiedInfo ? ` (${verifiedInfo.title || verifiedInfo.username})` : ""}`);

    res.json({ account, verified: verifiedInfo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/accounts/:id
router.put("/accounts/:id", async (req, res) => {
  try {
    // FIX #1: Проверяем владение аккаунтом перед обновлением
    const owned = await getOwnedAccount(req.workspaceId, req.params.id);
    if (!owned) return res.status(404).json({ error: "Аккаунт не найден" });

    const account = await Accounts.update(req.params.id, req.workspaceId, req.body);
    res.json({ account });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/accounts/:id
router.delete("/accounts/:id", async (req, res) => {
  try {
    // FIX #1: Проверяем владение аккаунтом перед удалением
    const owned = await getOwnedAccount(req.workspaceId, req.params.id);
    if (!owned) return res.status(404).json({ error: "Аккаунт не найден" });

    await Accounts.delete(req.params.id, req.workspaceId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts/:id/trigger-autopilot — ручной запуск автопилота для теста
router.post("/accounts/:id/trigger-autopilot", async (req, res) => {
  try {
    const owned = await getOwnedAccount(req.workspaceId, req.params.id);
    if (!owned) return res.status(404).json({ error: "Аккаунт не найден" });

    const { runDailyAutopilot } = require("../services/autopilot");
    const result = await runDailyAutopilot({ ...owned, workspace_id: req.workspaceId });
    res.json(result);
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
    const { account_id, text, media_url, platforms, scheduled_at } = req.body;
    if (!account_id || !text || !scheduled_at) return res.status(400).json({ error: "Укажи account_id, text и scheduled_at" });

    // FIX #2: Валидация длины текста
    if (text.length > 4000) return res.status(400).json({ error: "Текст не может превышать 4000 символов" });

    // FIX #1: Проверяем, что аккаунт принадлежит пользователю
    const account = await getOwnedAccount(req.workspaceId, account_id);
    if (!account) return res.status(404).json({ error: "Аккаунт не найден или не принадлежит вашему workspace" });

    // FIX #2: Санитизация платформ
    const cleanPlatforms = sanitizePlatforms(platforms);

    // Валидация даты
    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) return res.status(400).json({ error: "Некорректная дата scheduled_at" });

    const post = await Posts.create(req.workspaceId, { account_id, text, media_url, platforms: cleanPlatforms, scheduled_at });
    res.json({ post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts/publish-now — немедленная публикация
router.post("/posts/publish-now", async (req, res) => {
  try {
    const { account_id, text, media_url, platforms } = req.body;
    if (!account_id || !text) return res.status(400).json({ error: "Укажи account_id и text" });

    // FIX #2: Валидация длины
    if (text.length > 4000) return res.status(400).json({ error: "Текст не может превышать 4000 символов" });

    // FIX #1: Проверяем владение аккаунтом
    const account = await getOwnedAccount(req.workspaceId, account_id);
    if (!account) return res.status(404).json({ error: "Аккаунт не найден" });

    const results = [];
    // FIX #2: Санитизация платформ
    const plats = sanitizePlatforms(platforms);

    for (const platform of plats) {
      try {
        if (platform === "telegram" && account.channel_id) {
          if (media_url) {
            await telegram.sendPhoto(account.channel_id, media_url, text);
          } else {
            await telegram.sendMessage(account.channel_id, text);
          }
          results.push({ platform, ok: true });
        } else if (platform === "threads" && account.token && account.threads_user_id) {
          await threads.publishPost(account.threads_user_id, account.token, text, media_url);
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

// DELETE /api/posts/failed — удалить все провальные посты (ДОЛЖНО БЫТЬ ДО /posts/:id !)
router.delete("/posts/failed", async (req, res) => {
  try {
    const r = await pool.query(
      `DELETE FROM posts WHERE workspace_id=$1 AND status IN ('failed','partially_failed') RETURNING id`,
      [req.workspaceId]
    );
    res.json({ ok: true, deleted: r.rowCount });
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

// POST /api/posts/:id/retry — повторить публикацию провального поста
router.post("/posts/:id/retry", async (req, res) => {
  try {
    const retryAt = new Date(Date.now() + 60 * 1000);
    await pool.query(
      `UPDATE posts SET status='scheduled', retry_count=0, scheduled_at=$2,
       error_log=NULL, updated_at=NOW()
       WHERE id=$1 AND workspace_id=$3`,
      [req.params.id, retryAt, req.workspaceId]
    );
    res.json({ ok: true, retryAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate — AI генерация поста
router.post("/generate", generateLimiter, checkLimit("generation"), async (req, res) => {
  try {
    const { account_id, topic, tone, format, idea } = req.body;
    if (!topic) return res.status(400).json({ error: "Укажи тему (topic)" });

    // FIX #2: Валидация длины темы и идеи
    if (topic.length > 500) return res.status(400).json({ error: "Тема не может превышать 500 символов" });
    if (idea && idea.length > 1000) return res.status(400).json({ error: "Контекст не может превышать 1000 символов" });

    const accounts = await Accounts.getAll(req.workspaceId);
    const account = accounts.find(a => a.id === parseInt(account_id));

    const text = await generatePost({
      accountName: account?.name || "Мой аккаунт",
      accountHandle: account?.handle || "",
      topic, tone, format, idea,
      customPrompt: account?.custom_prompt || null,
    });

    await Usage.increment(req.workspaceId, "generations");
    await Log.add(req.workspaceId, "ai_generate", "gemini", `Тема: ${topic}`);

    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/comments/generate — AI генерация комментариев-вариантов
router.post("/comments/generate", generateLimiter, checkLimit("generation"), async (req, res) => {
  try {
    const { text, focus, account_id } = req.body;
    if (!text) return res.status(400).json({ error: "Укажи текст поста (text)" });
    if (text.length > 2000) return res.status(400).json({ error: "Текст поста слишком длинный" });

    let customPrompt = null;
    let fallbackFocus = focus;
    if (account_id) {
      const accounts = await Accounts.getAll(req.workspaceId);
      const acc = accounts.find(a => a.id === parseInt(account_id));
      if (acc) {
        customPrompt = acc.custom_prompt || null;
        if (acc.content_focus) fallbackFocus = acc.content_focus;
      }
    }

    const variants = await generateCommentVariants(text, fallbackFocus, customPrompt);

    await Usage.increment(req.workspaceId, "generations");
    await Log.add(req.workspaceId, "ai_comment", "gemini", `Сгенерированы комментарии умных ответов`);

    res.json({ variants });
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

// GET /api/posts/:id/stats — получить (и при необходимости обновить) метрики поста
router.get("/posts/:id/stats", async (req, res) => {
  try {
    const { pool } = require("../db");
    const { updatePostMetrics } = require("../services/stats");

    const r = await pool.query(`
      SELECT p.*, a.token, a.channel_id, a.threads_user_id
      FROM posts p
      JOIN accounts a ON a.id = p.account_id
      WHERE p.id = $1 AND p.workspace_id = $2
    `, [req.params.id, req.workspaceId]);

    const post = r.rows[0];
    if (!post) return res.status(404).json({ error: "Пост не найден" });

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const needsUpdate = !post.last_stats_update || new Date(post.last_stats_update) < thirtyMinAgo;

    let metrics = post.metrics || {};
    if (needsUpdate && post.status !== "scheduled") {
      metrics = await updatePostMetrics({ ...post, acc_token: post.token }, pool);
    }

    res.json({
      id: post.id,
      status: post.status,
      tg_message_id: post.tg_message_id,
      threads_post_id: post.threads_post_id,
      metrics,
      last_stats_update: post.last_stats_update,
      refreshed: needsUpdate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/posts/stats — аналитика: последние посты с метриками или по датам
router.get("/posts/stats", async (req, res) => {
  try {
    const { pool } = require("../db");
    const { startDate, endDate } = req.query;

    let query = `
      SELECT
        p.id, p.text, p.status, p.platforms,
        p.tg_message_id, p.threads_post_id, p.metrics,
        p.scheduled_at, p.published_at, p.error_log, p.created_at,
        a.handle, a.name AS account_name, a.platform AS account_platform,
        a.color, a.icon
      FROM posts p
      JOIN accounts a ON a.id = p.account_id
      WHERE p.workspace_id = $1
    `;
    const params = [req.workspaceId];
    
    if (startDate) {
      params.push(startDate);
      query += ` AND p.scheduled_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND p.scheduled_at <= $${params.length}`;
    }
    
    query += ` ORDER BY p.scheduled_at DESC LIMIT 500`;

    const r = await pool.query(query, params);
    res.json({ posts: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
