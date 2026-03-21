// src/services/threads.js — публикация в Threads через Meta Graph API
const fetch = require("node-fetch");

const BASE = "https://graph.threads.net/v1.0";

async function publishPost(userId, token, text) {
  if (!token || !userId) throw new Error("Нет токена или userId для Threads");

  // Шаг 1: Создать черновик
  const containerRes = await fetch(`${BASE}/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "TEXT", text, access_token: token }),
  });
  const container = await containerRes.json();
  if (container.error) throw new Error(`Threads container: ${container.error.message}`);

  // Небольшая пауза (Threads рекомендует ~2 сек для TEXT)
  await new Promise(r => setTimeout(r, 2000));

  // Шаг 2: Опубликовать
  const publishRes = await fetch(`${BASE}/${userId}/threads_publish`, {
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
    const res = await fetch(
      `${BASE}/${userId}?fields=id,username,followers_count&access_token=${token}`
    );
    return await res.json();
  } catch { return null; }
}

module.exports = { publishPost, getProfile };
