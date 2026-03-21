// src/services/telegram.js — отправка сообщений через Telegram Bot API
const fetch = require("node-fetch");

function getBotToken() {
  return process.env.TG_BOT_TOKEN;
}

// FIX #1: Хелпер — fetch с таймаутом (AbortController)
async function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Отправить сообщение в канал/чат
async function sendMessage(chatId, text, botToken) {
  const token = botToken || getBotToken();
  if (!token) throw new Error("TG_BOT_TOKEN не задан");

  const res = await fetchWithTimeout(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    },
    10000 // 10 секунд
  );

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram: ${data.description}`);
  return data.result;
}

// Получить количество участников
async function getMemberCount(chatId, botToken) {
  const token = botToken || getBotToken();
  try {
    const res = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/getChatMemberCount`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      },
      10000
    );
    const data = await res.json();
    return data.ok ? data.result : 0;
  } catch {
    return 0;
  }
}

module.exports = { sendMessage, getMemberCount };
