// src/services/ai.js — AI генерация через Groq (бесплатный, быстрый)
const fetch = require("node-fetch");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function generatePost({ accountName, accountHandle, platform = "telegram", topic, tone, format, idea, customPrompt, topPosts = [] }) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GOOGLE_AI_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY не задан в Railway");

  let platformRules = "";
  if (platform === "linkedin") {
    platformRules = `- Объем: от 1000 до 2500 символов (развернутые, полезные посты)
- Структура: короткие абзацы (1-2 предложения), много "воздуха" между строк (броэтри)
- Тон: профессиональный, инсайдерский опыт из бизнеса, кейсы, лидерство
- Завершение: сильный вопрос к коллегам/аудитории для дискуссии
- Эмодзи: очень мало, только для структуры списка`;
  } else if (platform === "threads") {
    platformRules = `- Объем: строго до 500 символов (короткий и хлесткий формат)
- Хук: первое предложение останавливает скролл (провокация, боль, неожиданный факт)
- Структура: 1-3 коротких абзаца
- Тон: разговорный, прямой, микро-инсайт "без воды", может быть слегка провокационным`;
  } else {
    // telegram
    platformRules = `- Объем: 700–1500 символов (полноценный авторский пост)
- Структура: цепляющий заголовок, основная мысль, буллиты (списки), вывод
- Тон: живой, личный блог, связь с комьюнити
- Завершение: призыв к действию, реакциям или вопрос`;
  }

  const prompt = `Ты — эксперт по контент-маркетингу для платформы ${platform.toUpperCase()} (рынок СНГ).

Аккаунт: "${accountName}" (${accountHandle || ""})
Тема: "${topic}"
${idea ? `Идея/контекст: "${idea}"` : ""}
Тональность: ${tone || "авторская"}
Формат: ${format || "на выбор"}

${customPrompt ? `ВАЖНОЕ ПРАВИЛО (СТИЛЬ И TONE OF VOICE):\n${customPrompt}\n` : ""}
${topPosts && topPosts.length > 0 ? `🔥 Успешные примеры твоих прошлых постов, которые набрали много реакций:\n${topPosts.map((t, i) => `${i+1}. "${t}"`).join('\n')}\n👉 Проанализируй их структуру, тон и подачу. Опирайся на эту стилистику, чтобы новый пост тоже залетел на высокие охваты!\n` : ""}
Правила поста для ${platform}:
${platformRules}
- Без хэштегов
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

async function generateCommentVariants(postText, focus = "предпринимательство, бизнес, СНГ", customPrompt = null) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GOOGLE_AI_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY не задан");

  const prompt = `Ты — эксперт по контент-маркетингу для Threads (рынок СНГ).
Тематика аккаунта: "${focus}"

${customPrompt ? `ВАЖНОЕ ПРАВИЛО (СТИЛЬ И TONE OF VOICE ТВОЕГО АККАУНТА):\n${customPrompt}\n` : ""}
Тебе дали текст поста:
"${postText}"

Сгенерируй 3 РАЗНЫХ варианта комментария к этому посту:
1. Экспертный — показывает твою осведомленность и ценность, без явной рекламы.
2. Вовлекающий — дружелюбный комментарий, который обязательно заканчивается открытым вопросом к автору.
3. Провокационный (Режим спора) — мягко оспаривающий мысль или показывающий альтернативный, "непопулярный" взгляд (чтобы вызвать дискуссию).

Ограничения:
- Только русский язык!
- До 300 символов каждый вариант
- Без хэштегов
- Максимально "человечный" стиль, без сложных слов.
- Возвращай строго JSON!

Формат ответа строго JSON:
{
  "expert": "текст",
  "engaging": "текст",
  "provocative": "текст"
}`;

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
        max_tokens: 800,
        temperature: 0.85,
        response_format: { type: "json_object" }
      }),
      signal: controller.signal,
    });

    const data = await res.json();
    if (data.error) throw new Error(`AI: ${data.error.message}`);

    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error("AI вернул пустой ответ");

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI не вернул JSON: " + raw.substring(0, 100));
    
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return [
        { type: "Экспертный", text: parsed.expert || "" },
        { type: "Вовлекающий", text: parsed.engaging || "" },
        { type: "Провокационный", text: parsed.provocative || "" }
      ];
    } catch (e) {
      throw new Error("AI вернул невалидный JSON: " + e.message);
    }
  } catch (err) {
    if (err.name === "AbortError") throw new Error("AI: таймаут запроса (15 сек)");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { generatePost, generateCommentVariants };
