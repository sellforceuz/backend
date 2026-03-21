// src/services/autopilot.js — Автоматическая генерация и планирование постов
const fetch = require("node-fetch");
const { pool } = require("../db");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Временные слоты для 5 постов в день (Ташкент UTC+5)
const TIME_SLOTS = [
  { hour: 9,  minBase: 0  },  // 09:00-10:00 Утро
  { hour: 12, minBase: 0  },  // 12:00-13:00 Обед
  { hour: 16, minBase: 0  },  // 16:00-17:00 День
  { hour: 19, minBase: 0  },  // 19:00-20:00 Вечер
  { hour: 22, minBase: 0  },  // 22:00-23:30 Поздний вечер
];

const POST_FORMATS = [
  "Полезный совет или лайфхак",
  "Провокационный вопрос или спорное мнение для дискуссии",
  "Актуальная новость или тренд индустрии с твоим комментарием",
  "Личный инсайт, история или признание из практики",
  "Короткий юмор, мем в текстовом формате или самоирония",
];

// Генерирует scheduled_at с рандомизацией ±15 мин (UTC)
function getScheduledAt(slot, dateStr) {
  const rand = Math.floor(Math.random() * 31) - 15; // -15 .. +15
  const totalMin = slot.minBase + rand;
  const minute = ((totalMin % 60) + 60) % 60;
  const hourOffset = Math.floor((slot.minBase + rand) / 60);
  const hour = slot.hour + hourOffset - 5; // Ташкент UTC+5 → UTC
  return `${dateStr}T${String((hour + 24) % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`;
}

// Генерирует 5 постов для аккаунта через Groq
async function generateDailyPosts(account) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GOOGLE_AI_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY не задан");

  const focus = account.content_focus || "бизнес, предпринимательство, СНГ";
  const count = account.daily_post_count || 5;
  const formats = POST_FORMATS.slice(0, count);

  const prompt = `Ты — эксперт-контент-маркетолог для Threads и Telegram (рынок СНГ).

Тематика аккаунта: "${focus}"
Аккаунт: ${account.name} (${account.handle})

Сгенерируй ${count} уникальных постов на сегодня. Каждый пост должен быть в СВОЁМ формате:
${formats.map((f, i) => `Пост ${i + 1}: ${f}`).join("\n")}

Правила для каждого поста:
- До 500 символов (ограничение Threads)
- Первое предложение цепляет: цифра, провокация, боль или неожиданный факт
- Без хэштегов
- Заканчивается вопросом к аудитории или CTA
- Ментальность предпринимателей Узбекистана/СНГ
- Только русский язык

Формат ответа — строго JSON:
{
  "posts": [
    {"text": "текст поста 1"},
    {"text": "текст поста 2"},
    {"text": "текст поста 3"},
    {"text": "текст поста 4"},
    {"text": "текст поста 5"}
  ]
}

Верни ТОЛЬКО JSON, без пояснений.`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 3000,
      temperature: 0.85,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(`Groq: ${data.error.message}`);

  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Groq вернул пустой ответ");

  // Парсим JSON из ответа
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Groq не вернул JSON");
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.posts || [];
}

// Основная функция автопилота — запускается для одного аккаунта
async function runDailyAutopilot(account) {
  console.log(`[Autopilot] Запуск для аккаунта: ${account.name} (${account.platform})`);

  try {
    const posts = await generateDailyPosts(account);
    if (!posts.length) throw new Error("Нет постов от AI");

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const count = Math.min(posts.length, TIME_SLOTS.length);

    for (let i = 0; i < count; i++) {
      const text = posts[i]?.text;
      if (!text || text.length < 20) continue;

      const scheduledAt = getScheduledAt(TIME_SLOTS[i], today);

      // Определяем платформы для публикации
      const platforms = account.platform === "threads"
        ? ["threads"]
        : account.platform === "telegram"
        ? ["telegram"]
        : [account.platform];

      await pool.query(
        `INSERT INTO posts (workspace_id, account_id, text, platforms, status, scheduled_at)
         VALUES ($1, $2, $3, $4, 'scheduled', $5)`,
        [account.workspace_id, account.id, text, JSON.stringify(platforms), scheduledAt]
      );

      console.log(`[Autopilot] ✅ Пост ${i + 1}/${count} запланирован на ${scheduledAt}`);
    }

    console.log(`[Autopilot] ✅ Аккаунт ${account.name}: ${count} постов запланировано`);
    return { success: true, postsCreated: count };
  } catch (err) {
    console.error(`[Autopilot] ❌ Ошибка для ${account.name}:`, err.message);
    return { success: false, error: err.message };
  }
}

// Запускает автопилот для всех включённых аккаунтов
async function runAutopilotForAll() {
  console.log("[Autopilot] 🚀 Запуск ежедневной генерации контента...");
  try {
    const { rows: accounts } = await pool.query(
      "SELECT a.*, w.id as workspace_id FROM accounts a JOIN workspaces w ON a.workspace_id = w.id WHERE a.autopilot_enabled = true AND a.is_active = true"
    );

    if (!accounts.length) {
      console.log("[Autopilot] Нет аккаунтов с включённым автопилотом");
      return;
    }

    for (const account of accounts) {
      await runDailyAutopilot(account);
    }
    console.log(`[Autopilot] ✅ Завершено для ${accounts.length} аккаунтов`);
  } catch (err) {
    console.error("[Autopilot] ❌ Общая ошибка:", err.message);
  }
}

module.exports = { runDailyAutopilot, runAutopilotForAll };
