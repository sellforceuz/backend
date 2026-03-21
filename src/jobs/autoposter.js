// src/jobs/autoposter.js — Автоматическая генерация и публикация постов
const cron   = require("node-cron");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { sendMessage } = require("../services/telegram");
const { db } = require("../db");

// ─── КОНФИГУРАЦИЯ КАНАЛОВ ─────────────────────────────────────────────────────
const CHANNELS = [
  {
    id: "academy",
    title: "Sellforce Academy",
    handle: "@sellforce_uz_academy",
    telegram_id: "-1003711704639",
    emoji: "🎓",
    active: true,
    persona: `Ты — эксперт по продажам с 10+ годами опыта на рынке СНГ.
Пишешь для Telegram-канала "Sellforce Academy" — канала о продажах и переговорах.
Твоя аудитория: менеджеры по продажам, руководители отделов продаж, предприниматели из Узбекистана и СНГ.`,
    topics: [
      "Как закрыть клиента который говорит 'мне надо подумать'",
      "Техника активного слушания в продажах",
      "Как правильно работать с возражением 'это дорого'",
      "5 ошибок менеджера на первой встрече с клиентом",
      "Как выстроить доверие с клиентом за 5 минут",
      "Сила паузы в переговорах",
      "Как делать follow-up после встречи чтобы клиент купил",
      "Техника SPIN в продажах: объяснение простым языком",
      "Как продавать по телефону когда клиент холодный",
      "Самопрезентация продавца: что говорить в первые 30 секунд",
      "Язык тела в переговорах: как читать клиента",
      "Upsell и Cross-sell: как увеличить средний чек",
      "Как работать с клиентом который торгуется на каждом шагу",
      "Психология покупателя: почему люди покупают",
      "Скрипт холодного звонка который реально работает",
      "Как продавать дорогие продукты без скидок",
      "Тайм-менеджмент продавца: как успевать больше",
      "Как узнать реальное возражение клиента",
      "Сторителлинг в продажах: продавай историями",
      "Как переключить клиента с цены на ценность",
    ],
  },
  {
    id: "crm",
    title: "Sellforce CRM — Систематизация бизнеса",
    handle: "@sellforce_uz_crm",
    telegram_id: "-1003715663210",
    emoji: "📊",
    active: true,
    persona: `Ты — бизнес-консультант и эксперт по систематизации бизнеса с опытом построения отделов продаж.
Пишешь для Telegram-канала "Sellforce / Систематизация бизнеса".
Твоя аудитория: предприниматели, владельцы бизнеса, коммерческие директора из Узбекистана и СНГ.`,
    topics: [
      "Где твой бизнес теряет деньги прямо сейчас",
      "Как построить отдел продаж с нуля за 30 дней",
      "CRM: почему 80% компаний внедряют неправильно",
      "KPI для менеджеров по продажам: что реально измерять",
      "Как автоматизировать рутину и освободить 3 часа в день",
      "Почему клиенты уходят к конкурентам (честный разбор)",
      "Воронка продаж: как найти узкое место и исправить",
      "Как масштабировать бизнес не нанимая больше людей",
      "Система мотивации отдела продаж без повышения зарплат",
      "Онбординг новых менеджеров: как сократить с 3 месяцев до 2 недель",
      "Как перестать тушить пожары и начать управлять",
      "Бизнес-процессы: зачем они нужны и как описать",
      "Ошибки при масштабировании которые стоят миллионы",
      "Как увеличить выручку без привлечения новых клиентов",
      "Почему ваша конверсия не растёт даже при больших вложениях",
      "Делегирование: почему владельцы боятся и что с этим делать",
      "Аналитика продаж: 5 цифр которые должен знать каждый руководитель",
      "Как перевести отдел продаж на удалёнку без потери результата",
      "Найм и увольнение в отделе продаж: честно о главном",
      "Топ-5 инструментов автоматизации для малого бизнеса",
    ],
  },
];

// ─── AI ГЕНЕРАЦИЯ ─────────────────────────────────────────────────────────────
async function generatePost(channel, topic) {
  if (!process.env.GOOGLE_AI_KEY) throw new Error("GOOGLE_AI_KEY не задан");

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const tone = Math.random() > 0.5 ? "провокационный, с острым заголовком" : "экспертный, с практическими советами";
  const format = Math.random() > 0.5 ? "нумерованный список с пояснениями" : "история или кейс с выводом";

  const prompt = `${channel.persona}

ЗАДАЧА: Напиши Telegram-пост на тему: "${topic}"

ТРЕБОВАНИЯ:
- Стиль: ${tone}
- Формат: ${format}
- Длина: 800–1500 символов (оптимально для Telegram)
- Начни с цепляющего заголовка или первой строки без вводных слов
- Используй эмодзи умеренно (2–4 штуки)
- Заканчивай мощным выводом или вопросом к аудитории
- Пиши на русском языке
- Не упоминай что это написал AI
- Не используй хэштеги если это не органично

ВАЖНО: Пост должен давать реальную ценность, а не быть общими словами.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// ─── ПУБЛИКАЦИЯ В TELEGRAM ────────────────────────────────────────────────────
async function publishToChannel(channel, text) {
  await sendMessage(channel.telegram_id, text);
  console.log(`[AutoPoster] ✅ Опубликовано в ${channel.handle}`);

  // Логируем в БД если доступна
  try {
    await db.query(
      `INSERT INTO activity_log (user_id, type, message, platform) 
       VALUES (1, 'auto_publish', $1, 'telegram')`,
      [`Авто-пост в ${channel.title}: ${text.slice(0, 60)}...`]
    );
  } catch (e) {
    // не критично если логирование упало
  }
}

// ─── ВЫБОР ТЕМЫ БЕЗ ПОВТОРОВ ─────────────────────────────────────────────────
const usedTopics = {};

function pickTopic(channel) {
  if (!usedTopics[channel.id]) usedTopics[channel.id] = [];

  // Если все темы использованы — сбрасываем
  if (usedTopics[channel.id].length >= channel.topics.length) {
    usedTopics[channel.id] = [];
  }

  const available = channel.topics.filter(t => !usedTopics[channel.id].includes(t));
  const topic = available[Math.floor(Math.random() * available.length)];
  usedTopics[channel.id].push(topic);
  return topic;
}

// ─── ОСНОВНАЯ ФУНКЦИЯ ПОСТИНГА ────────────────────────────────────────────────
async function runAutoPosting() {
  const activeChannels = CHANNELS.filter(c => c.active);
  console.log(`[AutoPoster] 🚀 Запуск для ${activeChannels.length} каналов`);

  let consecutiveQuotaErrors = 0; // FIX: счётчик подряд идущих 429

  for (const channel of activeChannels) {
    // FIX: Если 3 подряд — прекращаем всю джобу
    if (consecutiveQuotaErrors >= 3) {
      const msg = "Критическая ошибка лимитов AI, автопостинг приостановлен";
      console.error(`[AutoPoster] ❌ ${msg}`);
      try {
        await db.query(
          `INSERT INTO activity_log (user_id, type, message, platform)
           VALUES (1, 'auto_error', $1, 'system')`,
          [msg]
        );
      } catch (_) {}
      break;
    }

    try {
      const topic = pickTopic(channel);
      console.log(`[AutoPoster] Генерирую пост для ${channel.handle}: "${topic}"`);

      const text = await generatePost(channel, topic);

      // Успешная генерация — сбрасываем счётчик
      consecutiveQuotaErrors = 0;

      await publishToChannel(channel, text);

      // Пауза между публикациями — защита от лимитов Telegram
      await new Promise(r => setTimeout(r, 3000));

    } catch (err) {
      console.error(`[AutoPoster] ❌ Ошибка для ${channel.handle}:`, err.message);

      // FIX: Определяем — это 429 / quota exceeded?
      const is429 = err.message.toLowerCase().includes("429") ||
                    err.message.toLowerCase().includes("quota") ||
                    err.message.toLowerCase().includes("too many") ||
                    err.message.toLowerCase().includes("rate limit") ||
                    err.message.toLowerCase().includes("таймаут");

      if (is429) {
        consecutiveQuotaErrors++;
        // Пауза 30–60 секунд перед следующим каналом
        const pauseSec = 30 + Math.floor(Math.random() * 30);
        console.log(`[AutoPoster] ⏳ Пауза ${pauseSec}с из-за лимитов AI (ошибка ${consecutiveQuotaErrors}/3)`);
        await new Promise(r => setTimeout(r, pauseSec * 1000));
      } else {
        // Обычная ошибка — короткая пауза и идём к следующему каналу
        consecutiveQuotaErrors = 0;
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
}

// ─── ЗАПУСК ПЛАНИРОВЩИКА ─────────────────────────────────────────────────────
function startAutoPoster() {
  if (!process.env.GOOGLE_AI_KEY || !process.env.TG_BOT_TOKEN) {
    console.log("[AutoPoster] ⚠️ GOOGLE_AI_KEY или TG_BOT_TOKEN не задан — автопостинг отключён");
    return;
  }

  // 9:00 и 18:00 по Ташкенту (UTC+5) = 4:00 и 13:00 UTC
  cron.schedule("0 4 * * *",  () => runAutoPosting(), { timezone: "UTC" });
  cron.schedule("0 13 * * *", () => runAutoPosting(), { timezone: "UTC" });

  console.log("[AutoPoster] ✅ Автопостинг запущен: 09:00 и 18:00 (Ташкент)");
}

module.exports = { startAutoPoster, runAutoPosting, CHANNELS };
