// src/jobs/scheduler.js — планировщик публикаций
const cron = require("node-cron");
const { Posts, Log, Usage, pool } = require("../db");
const telegram = require("../services/telegram");
const threads  = require("../services/threads");
const { updatePostMetrics } = require("../services/stats");

const delay = (ms) => new Promise(r => setTimeout(r, ms));
let isRunning = false;

async function publishPost(post) {
  const platforms = Array.isArray(post.platforms)
    ? post.platforms
    : JSON.parse(post.platforms || '["telegram"]');

  const wid = post.workspace_id;

  // Отслеживаем результаты по каждой платформе + их IDs
  const results  = { success: [], failed: [] };
  let tgMessageId    = null;
  let threadsPostId  = null;

  for (const platform of platforms) {
    try {
      if (platform === "telegram" && post.channel_id) {
        const result = await telegram.sendMessage(post.channel_id, post.text);
        // Сохраняем ID сообщения из Telegram для аналитики
        tgMessageId = result?.message_id ? String(result.message_id) : null;
        await Log.add(wid, "publish_success", "telegram", `Пост #${post.id} → ${post.handle}`);
        results.success.push(platform);

      } else if (platform === "threads" && post.token && post.threads_user_id) {
        const result = await threads.publishPost(post.threads_user_id, post.token, post.text);
        // Сохраняем ID поста из Threads для аналитики
        threadsPostId = result?.post_id ? String(result.post_id) : null;
        await Log.add(wid, "publish_success", "threads", `Пост #${post.id} → ${post.handle}`);
        results.success.push(platform);

      } else {
        await Log.add(wid, "publish_skip", platform, `Пост #${post.id}: нет токена/channel_id`);
      }

      await delay(1000);
    } catch (err) {
      results.failed.push(platform);
      // Помечаем постоянные ошибки (не нужно повторять)
      if (err.permanent) results.permanentFail = true;
      const errMsg = err.message || "неизвестная ошибка";
      await Log.add(wid, "publish_fail", platform, `Пост #${post.id} [${platform}]: ${errMsg}`);
      console.error(`❌ [${platform}] post #${post.id}:`, errMsg);
      await delay(2000);
    }
  }

  // Сохраняем полученные IDs в БД (если есть)
  if (tgMessageId || threadsPostId) {
    await Posts.saveMessageIds(post.id, tgMessageId, threadsPostId);
  }

  // Статус зависит от комбинации успехов и ошибок
  if (results.success.length > 0 && results.failed.length > 0) {
    // Частичный успех — хотя бы одна платформа упала
    await pool.query(
      "UPDATE posts SET status='partially_failed', error_log=$2, updated_at=NOW() WHERE id=$1",
      [post.id, `Ошибка на платформах: ${results.failed.join(", ")}`]
    );
    await Usage.increment(wid, "posts_sent");
    console.log(`⚠️ Пост #${post.id} опубликован частично (упало: ${results.failed.join(", ")})`);

  } else if (results.success.length > 0) {
    // Полный успех
    await Posts.markPublished(post.id);
    await Usage.increment(wid, "posts_sent");
    console.log(`✅ Пост #${post.id} опубликован`);

  } else {
    // Полный провал
    // Если ошибка постоянная (токен умер, нет прав) — не повторять!
    if (results.permanentFail) {
      await Posts.markFailed(
        post.id,
        `Постоянная ошибка (code 100/190): токен Threads истёк или недостаточно прав. Обнови токен в настройках.`
      );
      console.log(`🔴 Пост #${post.id} — постоянная ошибка, повтор отключён`);
      return;
    }

    // Временная ошибка — экспоненциальный бэкбоф (1ч, 2ч, 4ч)
    const retryCount = (post.retry_count || 0) + 1;
    const backoffHours = Math.pow(2, retryCount - 1); // 1, 2, 4 часа
    if (retryCount <= 3) {
      const retryAt = new Date(Date.now() + backoffHours * 60 * 60 * 1000);
      await pool.query(
        `UPDATE posts SET status='scheduled', retry_count=$2, scheduled_at=$3,
         error_log=$4, updated_at=NOW() WHERE id=$1`,
        [post.id, retryCount, retryAt,
         `Попытка ${retryCount}/3 (через ${backoffHours}ч): ${results.failed.join(", ")}`]
      );
      console.log(`🔄 Пост #${post.id} — повтор #${retryCount}/3 через ${backoffHours}ч`);
    } else {
      await Posts.markFailed(
        post.id,
        `Исчерпаны все 3 попытки. Ошибка: ${results.failed.join(", ")}`
      );
      console.log(`❌ Пост #${post.id} — окончательный провал после 3 попыток`);
    }
  }
}

// ─── ОБНОВЛЕНИЕ СТАТИСТИКИ ────────────────────────────────────────────────────
async function updateAllStats() {
  console.log("[Stats] 📊 Запуск обновления метрик...");
  try {
    // Последние 30 постов за 3 дня со статусом published или partially_failed
    const r = await pool.query(`
      SELECT p.*, a.token, a.channel_id, a.threads_user_id AS acc_threads_user_id
      FROM posts p
      JOIN accounts a ON a.id = p.account_id
      WHERE p.status IN ('published', 'partially_failed')
        AND p.created_at >= NOW() - INTERVAL '3 days'
      ORDER BY p.created_at DESC
      LIMIT 30
    `);

    const posts = r.rows;
    if (posts.length === 0) {
      console.log("[Stats] Нет постов для обновления");
      return;
    }

    console.log(`[Stats] Обновляем метрики для ${posts.length} постов...`);
    for (const post of posts) {
      try {
        // Совмещаем поля аккаунта с полями поста
        await updatePostMetrics({
          ...post,
          acc_token: post.token,
        }, pool);
      } catch (err) {
        console.warn(`[Stats] ⚠️ Пост #${post.id}: ${err.message}`);
      }
      // Пауза 2 сек между постами — защита от лимитов API
      await delay(2000);
    }
    console.log("[Stats] ✅ Обновление метрик завершено");
  } catch (err) {
    console.error("[Stats] ❌ Ошибка:", err.message);
  }
}

function startScheduler() {
  console.log("🕐 Планировщик запущен");

  cron.schedule("* * * * *", async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      const due = await Posts.getDue();
      if (due.length > 0) {
        console.log(`📤 Публикуем ${due.length} пост(ов)`);

        // Батчевая обработка по 5 параллельно
        const BATCH_SIZE = 5;
        for (let i = 0; i < due.length; i += BATCH_SIZE) {
          const batch = due.slice(i, i + BATCH_SIZE);
          await Promise.allSettled(batch.map(post => publishPost(post)));
          if (i + BATCH_SIZE < due.length) await delay(1000);
        }
      }
    } catch (err) {
      console.error("❌ Scheduler:", err.message);
    } finally {
      isRunning = false;
    }
  });

  // Обновление статистики каждые 4 часа
  cron.schedule("0 */4 * * *", () => updateAllStats(), { timezone: "UTC" });

  // ─── АВТОПИЛОТ: ежедневная генерация постов в 00:05 UTC (05:05 Ташкент) ────
  cron.schedule("5 0 * * *", async () => {
    console.log("[Autopilot] ⏰ Запуск ежедневной генерации контента (00:05 UTC)");
    try {
      const { runAutopilotForAll } = require("../services/autopilot");
      await runAutopilotForAll();
    } catch (err) {
      console.error("[Autopilot] ❌ Ошибка cron:", err.message);
    }
  }, { timezone: "UTC" });

  // ─── АВТО-РЕТРАЙ: каждый час пробуем повторить упавшие посты ────────────────
  cron.schedule("0 * * * *", async () => {
    console.log("[Retry] 🔄 Проверка упавших постов для авто-повтора...");
    try {
      const { rows } = await pool.query(`
        SELECT p.*, a.token, a.channel_id, a.threads_user_id, a.handle, a.platform as acc_platform
        FROM posts p
        JOIN accounts a ON a.id = p.account_id
        WHERE p.status IN ('failed', 'partially_failed')
          AND p.created_at >= NOW() - INTERVAL '24 hours'
          AND COALESCE(p.retry_count, 0) < 3
          AND (p.error_log IS NULL OR p.error_log NOT LIKE '%code 100%' AND p.error_log NOT LIKE '%code 190%' AND p.error_log NOT LIKE '%постоянная%')
        LIMIT 20
      `);

      if (!rows.length) {
        console.log("[Retry] Нет постов для авто-повтора");
        return;
      }

      console.log(`[Retry] Найдено ${rows.length} постов для повтора`);
      const retryAt = new Date(Date.now() + 5 * 60 * 1000); // +5 минут

      for (const post of rows) {
        const newCount = (post.retry_count || 0) + 1;
        await pool.query(
          `UPDATE posts SET status='scheduled', retry_count=$2, scheduled_at=$3,
           error_log=CONCAT(error_log, ' | Авто-повтор #', $2), updated_at=NOW()
           WHERE id=$1`,
          [post.id, newCount, retryAt]
        );
        console.log(`[Retry] Пост #${post.id} → повтор #${newCount}/3 в ${retryAt.toISOString()}`);
      }

      // ─── Очистка "осиротевших" постов (аккаунт удалён) ──────────────────────
      const orphaned = await pool.query(`
        UPDATE posts SET status='failed',
          error_log='Аккаунт удалён — обнови аккаунт и создай новые посты',
          updated_at=NOW()
        FROM accounts a
        WHERE posts.account_id = a.id
          AND a.is_active = false
          AND posts.status = 'scheduled'
        RETURNING posts.id
      `);
      if (orphaned.rowCount > 0) {
        console.log(`[Retry] ♻️ Помечено ${orphaned.rowCount} постов без активного аккаунта`);
      }
    } catch (err) {
      console.error("[Retry] ❌ Ошибка:", err.message);
    }
  }, { timezone: "UTC" });
}

module.exports = { startScheduler };
