// src/services/telegram.js — отправка сообщений через Telegram Bot API
const fetch = require("node-fetch");

function getBotToken() {
  return process.env.TG_BOT_TOKEN;
}

// Отправить сообщение в канал/чат
async function sendMessage(chatId, text, botToken) {
  const token = botToken || getBotToken();
  if (!token) throw new Error("TG_BOT_TOKEN не задан");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram: ${data.description}`);
  return data.result;
}

// Получить количество участников
async function getMemberCount(chatId, botToken) {
  const token = botToken || getBotToken();
  const res = await fetch(`https://api.telegram.org/bot${token}/getChatMemberCount`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
  });
  const data = await res.json();
  return data.ok ? data.result : 0;
}

module.exports = { sendMessage, getMemberCount };
