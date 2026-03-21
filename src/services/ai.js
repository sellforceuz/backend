// src/services/ai.js — AI генерация через Google Gemini
const fetch = require("node-fetch");

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

// FIX #2: Хелпер — fetch с таймаутом (AbortController)
async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Gemini: таймаут запроса (15 сек)");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function generatePost({ accountName, accountHandle, topic, tone, format, idea }) {
  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_KEY не задан в .env");

  const prompt = `Ты — эксперт по контент-маркетингу для Threads и Telegram (рынок СНГ).

Аккаунт: "${accountName}" (${accountHandle || ""})
Тема: "${topic}"
${idea ? `Идея/контекст: "${idea}"` : ""}
Тональность: ${tone || "авторская"}
Формат: ${format || "на выбор"}

Правила поста:
- До 500 символов (ограничение Threads)
- Первое предложение ОСТАНАВЛИВАЕТ скролл: провокация, цифра, боль, неожиданный факт
- Без хэштегов
- Заканчивается вопросом к аудитории или конкретным CTA
- Ментальность предпринимателей Узбекистана/СНГ
- Только русский язык

Верни ТОЛЬКО текст поста, без пояснений.`;

  const res = await fetchWithTimeout(
    `${GEMINI_URL}?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.9 },
      }),
    },
    15000 // 15 секунд
  );

  const data = await res.json();
  if (data.error) throw new Error(`Gemini: ${data.error.message}`);

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini вернул пустой ответ");

  // FIX: Защита от некачественной генерации — слишком короткий ответ бесполезен
  if (text.length < 30) throw new Error("Некачественная генерация AI: ответ слишком короткий");

  return text;
}

module.exports = { generatePost };
