// src/services/autopilot.js — Автоматическая генерация и планирование постов
const fetch = require("node-fetch");
const { pool } = require("../db");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Временные слоты — «человеческое» время (Ташкент UTC+5)
const TIME_SLOTS = [
  { hour: 9,  minBase: 15 }, // 09:15 Утро
  { hour: 12, minBase: 45 }, // 12:45 Обед
  { hour: 16, minBase: 20 }, // 16:20 День
  { hour: 19, minBase: 10 }, // 19:10 Вечер
  { hour: 22, minBase: 5  }, // 22:05 Поздний вечер
];

const POST_FORMATS = [
  "Полезный совет или лайфхак",
  "Провокационный вопрос или спорное мнение для дискуссии",
  "Актуальная новость или тренд индустрии с твоим комментарием",
  "Личный инсайт, история или признание из практики",
  "Короткий юмор, мем в текстовом формате или самоирония",
];

// Генерирует scheduled_at с рандомизацией ±10 мин (UTC)
function getScheduledAt(timeStr, dateStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const rand = Math.floor(Math.random() * 21) - 10; // -10 .. +10
  const totalMin = m + rand;
  const minute = ((totalMin % 60) + 60) % 60;
  const hourOffset = Math.floor((m + rand) / 60);
  const hour = h + hourOffset - 5; // Ташкент UTC+5 → UTC
  return `${dateStr}T${String((hour + 24) % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`;
}

async function generateDailyPosts(account, count) {
  const apiKey = process.env.GROQ_API_KEY || process.env.GOOGLE_AI_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY не задан");

  const focus = account.content_focus || "бизнес, предпринимательство, СНГ";
  const { Posts } = require("../db");
  const topPosts = await Posts.getTopPerforming(account.id, 3);
  
  // Если постов много, зацикливаем форматы, чтобы хватило на всех
  const formats = [];
  for (let i = 0; i < count; i++) {
    formats.push(POST_FORMATS[i % POST_FORMATS.length]);
  }

  let platformRules = "";
  if (account.platform === "linkedin") {
    platformRules = `- Объем: от 1000 до 2500 символов (развернутые, полезные посты)
- Структура: короткие абзацы (1-2 предложения), много "воздуха" между строк (броэтри)
- Тон: профессиональный, инсайдерский опыт из бизнеса, кейсы, лидерство
- Завершение: сильный вопрос к коллегам/аудитории для дискуссии
- Эмодзи: очень мало, только для структуры списка`;
  } else if (account.platform === "threads") {
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

  const prompt = `Ты — эксперт-контент-маркетолог для платформы ${account.platform.toUpperCase()} (рынок СНГ).

Тематика аккаунта: "${focus}"
Аккаунт: ${account.name} (${account.handle})

${account.custom_prompt ? `ВАЖНОЕ ПРАВИЛО (СТИЛЬ И TONE OF VOICE):\n${account.custom_prompt}\n` : ""}
${topPosts && topPosts.length > 0 ? `🔥 Успешные примеры твоих прошлых постов, которые набрали много реакций:\n${topPosts.map((t, i) => `${i+1}. "${t}"`).join('\n')}\n👉 Проанализируй их структуру, тон и подачу. Опирайся на эту стилистику, чтобы новые посты тоже залетели на высокие охваты!\n` : ""}
Сгенерируй ${count} уникальных постов на сегодня. Каждый пост должен быть в СВОЁМ формате:
${formats.map((f, i) => `Пост ${i + 1}: ${f}`).join("\n")}

Правила для каждого поста (под формат ${account.platform}):
${platformRules}
- Без хэштегов
- Ментальность предпринимателей СНГ
- Только русский язык

Формат ответа — строго JSON:
{
  "posts": [
    {
      "text": "текст поста 1",
      "image_prompt": "english description of a high quality photo to accompany post 1 (IMPORTANT: specify 'no text, no letters, no typography' to prevent gibberish overlay), e.g. 'A modern businessman working on a laptop in a bright cafe, cinematic lighting, 8k resolution, photorealistic, no text'"
    },
    {
      "text": "текст поста 2",
      "image_prompt": "english description..."
    }
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
    // Получаем кастомные часы или используем стандартные
    const times = Array.isArray(account.autopilot_times) && account.autopilot_times.length > 0
      ? account.autopilot_times
      : ["09:00", "12:00", "16:00", "19:00", "22:00"];
      
    const posts = await generateDailyPosts(account, times.length);
    if (!posts.length) throw new Error("Нет постов от AI");

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const count = Math.min(posts.length, times.length);

    for (let i = 0; i < count; i++) {
      const text = posts[i]?.text;
      const imagePrompt = posts[i]?.image_prompt;
      if (!text || text.length < 20) continue;

      const scheduledAt = getScheduledAt(times[i], today);
      
      const pollKey = process.env.POLLINATIONS_API_KEY;
      const mediaUrl = imagePrompt 
        ? `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=1080&height=1080&model=flux${pollKey ? `&key=${pollKey}`:''}`
        : null;

      // Определяем платформы для публикации
      const platforms = account.platform === "threads"
        ? ["threads"]
        : account.platform === "telegram"
        ? ["telegram"]
        : [account.platform];

      await pool.query(
        `INSERT INTO posts (workspace_id, account_id, text, media_url, platforms, status, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6)`,
        [account.workspace_id, account.id, text, mediaUrl, JSON.stringify(platforms), scheduledAt]
      );

      console.log(`[Autopilot] ✅ Пост ${i + 1}/${count} запланирован на ${scheduledAt} (Media: ${!!mediaUrl})`);
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
