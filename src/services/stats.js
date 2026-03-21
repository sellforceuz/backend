// src/services/stats.js — сбор метрик постов из Telegram и Threads
const fetch = require("node-fetch");

const TG_BASE     = "https://api.telegram.org";
const THREADS_BASE = "https://graph.threads.net/v1.0";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Stats fetch timeout: ${url}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── TELEGRAM ─────────────────────────────────────────────────────────────────
// Примечание: стандартный Bot API не отдаёт просмотры конкретного сообщения
// (для этого нужен MTProto / Telegram Statistics). Вместо этого:
// 1. Получаем число подписчиков канала (рост аудитории = косвенный охват)
// 2. В будущем можно добавить forwardCount через getChatMessage если канал публичный
async function getTelegramChannelStats(chatId, botToken) {
  const token = botToken || process.env.TG_BOT_TOKEN;
  if (!token || !chatId) return null;

  try {
    const data = await fetchJson(
      `${TG_BASE}/bot${token}/getChatMemberCount`,
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }) }
    );
    if (!data.ok) return null;
    return { channel_members: data.result };
  } catch {
    return null;
  }
}

// ─── THREADS ──────────────────────────────────────────────────────────────────
// Meta Graph API: GET /{thread-media-id}/insights
// Метрики: views, likes, replies, reposts, quotes
async function getThreadsMetrics(threadsPostId, token) {
  if (!threadsPostId || !token) return null;

  try {
    const metrics = ["views", "likes", "replies", "reposts", "quotes"].join(",");
    const data = await fetchJson(
      `${THREADS_BASE}/${threadsPostId}/insights?metric=${metrics}&access_token=${token}`
    );

    if (data.error) {
      console.warn(`[Stats] Threads insights error: ${data.error.message}`);
      return null;
    }

    // Преобразуем массив {name, values} в плоский объект
    const result = {};
    for (const item of (data.data || [])) {
      const value = item.values?.[0]?.value ?? item.total_value?.value ?? 0;
      result[item.name] = value;
    }
    return result;
  } catch (err) {
    console.warn(`[Stats] Threads fetch error: ${err.message}`);
    return null;
  }
}

// ─── ГЛАВНАЯ ФУНКЦИЯ: обновить метрики одного поста ──────────────────────────
async function updatePostMetrics(post, pool) {
  const newMetrics = { ...(post.metrics || {}) };
  let updated = false;

  // Telegram — получаем статистику канала как прокси
  if (post.channel_id) {
    const tgStats = await getTelegramChannelStats(post.channel_id, post.acc_token);
    if (tgStats) {
      Object.assign(newMetrics, { telegram: tgStats });
      updated = true;
    }
  }

  // Threads — получаем реальные метрики поста
  if (post.threads_post_id && post.token) {
    const threadsMetrics = await getThreadsMetrics(post.threads_post_id, post.token);
    if (threadsMetrics) {
      Object.assign(newMetrics, { threads: threadsMetrics });
      updated = true;
    }
  }

  if (updated) {
    await pool.query(
      "UPDATE posts SET metrics=$2, last_stats_update=NOW() WHERE id=$1",
      [post.id, JSON.stringify(newMetrics)]
    );
    console.log(`[Stats] ✅ Метрики обновлены для поста #${post.id}`);
  }

  return newMetrics;
}

module.exports = { updatePostMetrics, getTelegramChannelStats, getThreadsMetrics };
