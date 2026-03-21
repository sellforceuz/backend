// src/services/ai.js — AI генерация через Google Gemini SDK
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generatePost({ accountName, accountHandle, topic, tone, format, idea }) {
  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_KEY не задан в .env");

  const genAI = new GoogleGenerativeAI(apiKey);

  // Пробуем модели по приоритету
  const models = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];
  let lastError = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });

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

      const result = await model.generateContent(prompt);
      const text = result.response.text()?.trim();

      if (!text || text.length < 30) throw new Error("Пустой ответ от AI");

      console.log(`[AI] Успешно сгенерировано через ${modelName}`);
      return text;

    } catch (err) {
      console.warn(`[AI] Модель ${modelName} не сработала: ${err.message}`);
      lastError = err;
      // Если это не quota ошибка — пробуем следующую модель
      // Если quota — тоже пробуем следующую
    }
  }

  throw new Error(`Gemini: ${lastError?.message || "все модели недоступны"}`);
}

module.exports = { generatePost };
