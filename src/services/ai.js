// src/services/ai.js — AI генерация через Groq (бесплатный, быстрый)
const fetch = require("node-fetch");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function generatePost({ accountName, accountHandle, topic, tone, format, idea }) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GOOGLE_AI_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY не задан в Railway");

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.9,
      }),
      signal: controller.signal,
    });

    const data = await res.json();

    if (data.error) throw new Error(`AI: ${data.error.message}`);

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text || text.length < 30) throw new Error("AI вернул пустой ответ");

    return text;
  } catch (err) {
    if (err.name === "AbortError") throw new Error("AI: таймаут запроса (15 сек)");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { generatePost };
