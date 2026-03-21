// src/services/threads.js — публикация в Threads через Meta Graph API
const fetch = require("node-fetch");

const BASE = "https://graph.threads.net/v1.0";

// FIX: AbortController-based fetch с таймаутом
async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Threads: таймаут запроса");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Обменять краткосрочный токен (1 час) на долгосрочный (60 дней)
// Требует: THREADS_APP_SECRET в .env
async function exchangeLongLivedToken(shortToken) {
  const appSecret = process.env.THREADS_APP_SECRET;
  if (!appSecret) throw new Error("THREADS_APP_SECRET не задан в .env");

  const url = `${BASE}/access_token?` + new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: appSecret,
    access_token: shortToken,
  });

  const res = await fetchWithTimeout(url, {}, 12000);
  const data = await res.json();

  if (data.error) throw new Error(`Threads token exchange: ${data.error.message}`);
  if (!data.access_token) throw new Error("Threads: не получен long-lived token");

  // Считаем дату истечения (Meta даёт expires_in в секундах, обычно ~5184000 = 60 дней)
  const expiresAt = new Date(Date.now() + (data.expires_in || 5_184_000) * 1000);
  return { access_token: data.access_token, expires_at: expiresAt };
}

// Обновить долгосрочный токен (за 5-10 дней до истечения)
async function refreshLongLivedToken(longToken) {
  const url = `${BASE}/refresh_access_token?` + new URLSearchParams({
    grant_type: "th_refresh_token",
    access_token: longToken,
  });

  const res = await fetchWithTimeout(url, {}, 12000);
  const data = await res.json();

  if (data.error) throw new Error(`Threads token refresh: ${data.error.message}`);
  const expiresAt = new Date(Date.now() + (data.expires_in || 5_184_000) * 1000);
  return { access_token: data.access_token, expires_at: expiresAt };
}

// Верифицировать токен — получаем профиль через /me (стандартный endpoint)
async function verifyThreadsToken(userId, token) {
  const res = await fetchWithTimeout(
    `${BASE}/me?fields=id,username,threads_profile_picture_url&access_token=${token}`,
    {},
    10000
  );
  const data = await res.json();
  if (data.error) throw new Error(`Threads: ${data.error.message} (проверь User ID и Access Token)`);
  return { username: data.username, id: data.id };
}

async function publishPost(userId, token, text) {
  if (!token || !userId) throw new Error("Нет токена или userId для Threads");

  // Шаг 1: Создать черновик
  const containerRes = await fetchWithTimeout(`${BASE}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "TEXT", text, access_token: token }),
  });
  const container = await containerRes.json();
  if (container.error) throw new Error(`Threads container: ${container.error.message}`);

  // Небольшая пауза (Threads рекомендует ~2 сек для TEXT)
  await new Promise(r => setTimeout(r, 2000));

  // Шаг 2: Опубликовать
  const publishRes = await fetchWithTimeout(`${BASE}/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: token }),
  });
  const published = await publishRes.json();
  if (published.error) throw new Error(`Threads publish: ${published.error.message}`);

  return { post_id: published.id };
}

async function getProfile(userId, token) {
  try {
    const res = await fetchWithTimeout(
      `${BASE}/${userId}?fields=id,username,followers_count&access_token=${token}`
    );
    return await res.json();
  } catch { return null; }
}

module.exports = { publishPost, getProfile, exchangeLongLivedToken, refreshLongLivedToken, verifyThreadsToken };
