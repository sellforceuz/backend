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
      // Логирование ошибки сохранено
      results.failed.push(platform);
      await Log.add(wid, "publish_fail", platform, `Пост #${post.id} [${platform}]: ${err.message}`);
      console.error(`❌ [${platform}] post #${post.id}:`, err.message);
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
    // Полная ошибка
    await Posts.markFailed(
      post.id,
      `Нет доступных платформ или ошибка публикации (упали: ${results.failed.join(", ")})`
    );
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
}

module.exports = { startScheduler };
