// src/services/threads.js — публикация в Threads через Meta Graph API
const fetch = require("node-fetch");

const BASE = "https://graph.threads.net/v1.0";

// Постоянная ошибка — повтор бесполезен (код 100=неверные права/токен, 190=истёк, 200=недостаточно прав)
class ThreadsPermanentError extends Error {
  constructor(message, code) {
    super(message);
    this.permanent = true;
    this.metaCode = code;
  }
}

// Коды META которые не надо повторять (токен умер / нет прав)
const PERMANENT_CODES = new Set([100, 190, 200, 10, 803]);

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

  // Очистка текста
  const cleanText = (text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Валидация — текст обязателен для TEXT постов
  if (!cleanText) throw new Error("Threads: текст поста не может быть пустым");

  console.log(`[Threads] 🚀 Публикуем для User ID: ${userId} | Токен: ...${token.slice(-8)} | Текст: ${cleanText.slice(0,50)}...`);

  // Шаг 1: Создаём НОВЫЙ контейнер (всегда с нуля, без кэша)
  const containerParams = new URLSearchParams({
    media_type: "TEXT",
    text: cleanText,
    access_token: token,
  });
  const containerUrl = `${BASE}/${userId}/threads`;
  console.log(`[Threads] 📦 Создаём контейнер: POST ${containerUrl}`);

  const containerRes = await fetchWithTimeout(
    containerUrl,
    { method: "POST", body: containerParams },
    12000
  );
  const container = await containerRes.json();

  if (container.error) {
    const code = container.error.code;
    console.error(`[Threads] ❌ Ошибка контейнера (code ${code}):`, container.error.message);
    console.error(`[Threads] ℹ️  User ID ${userId} — это ID аккаунта, не контейнера`);
    if (code === 100 || code === 190) {
      console.error(`[Threads] ⚠️  Code ${code} = токен истёк или нет прав threads_content_publish`);
    }
    const msg = `Threads container: ${container.error.message} (code: ${code})`;
    if (PERMANENT_CODES.has(code)) throw new ThreadsPermanentError(msg, code);
    throw new Error(msg);
  }
  if (!container.id) {
    console.error(`[Threads] ❌ Контейнер создан но без ID. Ответ:`, JSON.stringify(container));
    throw new Error("Threads: не получен ID контейнера");
  }

  // container.id — это НОВЫЙ уникальный ContainerID (не UserID!)
  console.log(`[Threads] ✅ Новый Container ID: ${container.id} (User ID: ${userId})`);

  // Пауза 2 сек (Threads требует перед publish)
  await new Promise(r => setTimeout(r, 2000));

  // Шаг 2: Публикуем по Container ID
  const publishParams = new URLSearchParams({
    creation_id: container.id,
    access_token: token,
  });
  const publishRes = await fetchWithTimeout(
    `${BASE}/${userId}/threads_publish`,
    { method: "POST", body: publishParams },
    12000
  );
  const published = await publishRes.json();

  if (published.error) {
    const code = published.error.code;
    console.error(`[Threads] ❌ Ошибка публикации (code ${code}):`, published.error.message);
    const msg = `Threads publish: ${published.error.message} (code: ${code})`;
    if (PERMANENT_CODES.has(code)) throw new ThreadsPermanentError(msg, code);
    throw new Error(msg);
  }

  console.log(`[Threads] 🎉 Опубликовано! Post ID: ${published.id} | Container был: ${container.id}`);
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
