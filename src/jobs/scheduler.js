// src/jobs/scheduler.js — планировщик публикаций
const cron = require("node-cron");
const { Posts, Log, Usage } = require("../db");
const telegram = require("../services/telegram");
const threads  = require("../services/threads");

const delay = (ms) => new Promise(r => setTimeout(r, ms));
let isRunning = false;

async function publishPost(post) {
  const platforms = Array.isArray(post.platforms)
    ? post.platforms
    : JSON.parse(post.platforms || '["telegram"]');

  const wid = post.workspace_id;
  let success = false;

  for (const platform of platforms) {
    try {
      if (platform === "telegram" && post.channel_id) {
        await telegram.sendMessage(post.channel_id, post.text);
        await Log.add(wid, "publish_success", "telegram", `Пост #${post.id} → ${post.handle}`);
        success = true;

      } else if (platform === "threads" && post.token && post.threads_user_id) {
        await threads.publishPost(post.threads_user_id, post.token, post.text);
        await Log.add(wid, "publish_success", "threads", `Пост #${post.id} → ${post.handle}`);
        success = true;

      } else {
        await Log.add(wid, "publish_skip", platform, `Пост #${post.id}: нет токена/channel_id`);
      }

      await delay(1000);
    } catch (err) {
      // Логирование ошибки сохранено
      await Log.add(wid, "publish_fail", platform, `Пост #${post.id}: ${err.message}`);
      console.error(`❌ [${platform}] post #${post.id}:`, err.message);
      await delay(2000);
    }
  }

  if (success) {
    await Posts.markPublished(post.id);
    await Usage.increment(wid, "posts_sent");
    console.log(`✅ Пост #${post.id} опубликован`);
  } else {
    await Posts.markFailed(post.id, "Нет доступных платформ или ошибка публикации");
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

        // FIX #5: Батчевая обработка по 5 параллельно вместо поочерёдной
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
}

module.exports = { startScheduler };
