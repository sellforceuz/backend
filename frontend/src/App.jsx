// v2 — clean encoding fix 2026-03-24
import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
const DICTS = {
  ru: {
    generator: "Генератор",
    smart_replies: "Умные ответы",
    schedule: "Планировщик",
    analytics: "Аналитика",
    accounts: "Аккаунты",
    logs: "Логи",
    admin: "Администратор",
    lang_btn: "🇷🇺 RU",
    gen_err_topic: "Укажи тему поста",
    gen_success: "Пост сгенерирован!",
    gen_usage: "Генераций: ",
    gen_acc_label: "Аккаунт (необязательно)",
    gen_acc_none: "— Без привязки к аккаунту —",
    gen_topic_label: "Тема поста *",
    gen_topic_ph: "Например: почему клиенты уходят к конкурентам",
    gen_tone_label: "Тональность",
    gen_format_label: "Формат (необязательно)",
    gen_format_ph: "список, история, факт+мнение...",
    gen_idea_label: "Идея / контекст",
    gen_idea_ph: "Дополнительный контекст для AI...",
    gen_btn_load: "⏳ Генерирую...",
    gen_btn: "✨ Сгенерировать",
    gen_res_title: "Результат",
    gen_copy: "Копировать",
    gen_copied: "Скопировано!",
    gen_chars: "символов",
    gen_limit_warn: "⚠️ Превышает лимит Threads (500)",
    gen_empty: "Результат появится здесь",
    sch_title: "📅 Планировщик",
    sch_new_post: "Новый пост",
    sch_err_acc_text: "Выбери аккаунт и введи текст",
    sch_acc: "Аккаунт",
    sch_acc_none: "— Выбери аккаунт —",
    sch_date: "Дата",
    sch_time: "Время",
    sch_platforms: "Платформы",
    sch_text: "Текст поста",
    sch_text_ph: "Введи или вставь текст поста...",
    sch_btn_save: "📅 Запланировать",
    sch_btn_saving: "Сохраняю...",
    sch_btn_pub: "⚡ Опубликовать сейчас",
    sch_btn_pubing: "Публикую...",
    sch_success_plan: "Пост запланирован!",
    sch_success_pub: "✅ Опубликовано!",
    sch_warn_pub: "⚠️ Частично опубликовано — проверь логи",
    sch_queue: "Очередь постов",
    sch_del_failed: "Удалить все провальные посты?",
    sch_del_btn: "🗑 Удалить все ошибки",
    sch_deleted: "🗑 Удалено",
    sch_err_metrics: "Не удалось обновить метрики",
    sch_loading: "Загрузка...",
    sch_empty_queue: "Нет запланированных постов",
    sch_retry_plan: "🔄 Повтор запланирован через 1 мин!",
    sch_retry_btn: "↩ Повторить",
    status_pub: "Опубликован",
    status_sch: "Запланирован",
    status_err: "Ошибка",
    status_part_err: "Частичная ошибка",
    acc_title: "📱 Аккаунты",
    acc_connect_threads: "🧵 Подключить Threads через Meta",
    acc_connect_linkedin: "💼 Подключить LinkedIn",
    acc_add_manual: "+ Добавить вручную",
    acc_new: "Новый аккаунт",
    acc_platform: "Платформа",
    acc_name: "Название аккаунта",
    acc_icon: "Иконка (emoji)",
    acc_token_tg: "Bot Token (опционально)",
    acc_token_other: "Access Token",
    acc_threads_hint: "ℹ️ Рекомендуем использовать кнопку «Давай Meta выше — токен сохранится автоматически на 60 дней».",
    acc_threads_hint2: "Мануально можно вставить токен ниже (1 час):",
    acc_save: "Сохранить",
    acc_cancel: "Отмена",
    acc_empty: "Нет добавленных аккаунтов",
    acc_status_active: "Токен активен",
    acc_status_end: "Истёк",
    acc_status_days: "Срок: {days} дн.",
    acc_ap_on: "Автопилот ВКЛ",
    acc_ap_off: "Автопилот ВЫКЛ",
    acc_ap_settings: "⚙️ Настройки Автопилота",
    acc_ap_enable: "Включить автопилот",
    acc_ap_desc: "5 постов в день автоматически",
    acc_ap_focus: "О чём ваш блог? (темы, стиль, ключевые слова)",
    acc_ap_prompt: "Стиль AI (Tone of Voice)",
    acc_ap_schedule: "📅 Система генерирует 5 постов в день: 09:00, 12:00, 16:00, 19:00, 22:00 (Ташкент ±15 мин)",
    acc_ap_save: "💾 Сохранить",
    acc_ap_saving: "Сохраняю...",
    acc_ap_run: "🚀 Запустить сейчас",
    acc_ap_running: "Генерирую...",
    an_title: "📈 Аналитика постов",
    an_pdf: "📄 Скачать PDF-отчёт",
    an_pdf_lock: "🔒 PDF-отчёт (Agency)",
    an_empty: "Нет опубликованных постов. Метрики появятся после первой публикации.",
    an_wait_metrics: "Метрики ещё не собраны",
    an_updated: "Обновлено:",
    log_title: "📊 Логи активности",
    log_loading: "Загрузка...",
    log_empty: "Нет записей в логах",
    adm_title: "⚙️ Администратор",
    adm_users: "Пользователей",
    adm_active: "Активных",
    adm_trial: "На триале",
    adm_posts: "Всего постов",
    adm_table: "Пользователи",
    sr_title: "💬 Умные ответы",
    sr_desc: "Вставьте текст поста, чтобы получить 3 варианта комментария для Threads. Безопасный ручной режим.",
    sr_acc_label: "Аккаунт (Стиль ответов)",
    sr_acc_none: "🤖 Без индивидуального стиля",
    sr_text_label: "Текст поста для ответа",
    sr_text_ph: "Вставьте текст или мысль поста...",
    sr_btn: "Сгенерировать 3 варианта",
    sr_btn_load: "Генерация ответа...",
    sr_copied: "Скопировано!",
    sr_copy: "Копировать",
    side_ai: "AI Автопостинг",
    side_lang: "Язык / Til:",
    side_logout: "Выйти"
  },
  uz: {
    generator: "Generator",
    smart_replies: "Aqlli javoblar",
    schedule: "Rejalashtiruvchi",
    analytics: "Analitika",
    accounts: "Akkauntlar",
    logs: "Jurnallar",
    admin: "Administrator",
    lang_btn: "🇺🇿 UZ",
    gen_err_topic: "Mavzuni kiriting",
    gen_success: "Post yaratildi!",
    gen_usage: "Yaratilgan: ",
    gen_acc_label: "Akkaunt (ixtiyoriy)",
    gen_acc_none: "— Akkauntsiz —",
    gen_topic_label: "Post mavzusi *",
    gen_topic_ph: "Masalan: nega mijozlar raqobatchilarga ketadi",
    gen_tone_label: "Ohang",
    gen_format_label: "Format (ixtiyoriy)",
    gen_format_ph: "ro'yxat, hikoya, fakt+fikr...",
    gen_idea_label: "G'oya / kontekst",
    gen_idea_ph: "AI uchun qo'shimcha kontekst...",
    gen_btn_load: "⏳ Yaratilmoqda...",
    gen_btn: "✨ Yaratish",
    gen_res_title: "Natija",
    gen_copy: "Nusxalash",
    gen_copied: "Nusxalandi!",
    gen_chars: "belgi",
    gen_limit_warn: "⚠️ Threads limitidan oshdi (500)",
    gen_empty: "Natija shu yerda chiqadi",
    sch_title: "📅 Rejalashtiruvchi",
    sch_new_post: "Yangi post",
    sch_err_acc_text: "Akkauntni tanlang va matn kiriting",
    sch_acc: "Akkaunt",
    sch_acc_none: "— Akkauntni tanlang —",
    sch_date: "Sana",
    sch_time: "Vaqt",
    sch_platforms: "Platformalar",
    sch_text: "Post matni",
    sch_text_ph: "Post matnini kiriting yoki joylang...",
    sch_btn_save: "📅 Rejalashtirish",
    sch_btn_saving: "Saqlanmoqda...",
    sch_btn_pub: "⚡ Hozir nashr qilish",
    sch_btn_pubing: "Nashr qilinmoqda...",
    sch_success_plan: "Post rejalashtirildi!",
    sch_success_pub: "✅ Nashr qilindi!",
    sch_warn_pub: "⚠️ Qisman nashr qilindi — jurnallarni tekshiring",
    sch_queue: "Postlar navbati",
    sch_del_failed: "Barcha xatolarni o'chirib tashlaysizmi?",
    sch_del_btn: "🗑 Barcha xatolarni o'chirish",
    sch_deleted: "🗑 O'chirildi",
    sch_err_metrics: "Ko'rsatkichlarni yangilab bo'lmadi",
    sch_loading: "Yuklanmoqda...",
    sch_empty_queue: "Rejalashtirilgan postlar yo'q",
    sch_retry_plan: "🔄 Takrorlash 1 daqiqadan so'ng rejalashtirildi!",
    sch_retry_btn: "↩ Takrorlash",
    status_pub: "Nashr qilindi",
    status_sch: "Rejalashtirildi",
    status_err: "Xato",
    status_part_err: "Qisman xato",
    acc_title: "📱 Akkauntlar",
    acc_connect_threads: "🧵 Meta orqali Threads ulash",
    acc_connect_linkedin: "💼 LinkedIn ulash",
    acc_add_manual: "+ Qo'lda qo'shish",
    acc_new: "Yangi akkaunt",
    acc_platform: "Platforma",
    acc_name: "Akkaunt nomi",
    acc_icon: "Ikonka (emoji)",
    acc_token_tg: "Bot Token (ixtiyoriy)",
    acc_token_other: "Access Token",
    acc_threads_hint: "ℹ️ Yuqoridagi Meta tugmasidan foydalanishni tavsiya qilamiz.",
    acc_threads_hint2: "Qo'lda quyida tokenni kiritishingiz mumkin (1 soat):",
    acc_save: "Saqlash",
    acc_cancel: "Bekor qilish",
    acc_empty: "Akkauntlar qo'shilmagan",
    acc_status_active: "Token faol",
    acc_status_end: "Muddati tugagan",
    acc_status_days: "Muddat: {days} kun",
    acc_ap_on: "Avtopilot YONIQ",
    acc_ap_off: "Avtopilot O'CHIRILGAN",
    acc_ap_settings: "⚙️ Avtopilot sozlamalari",
    acc_ap_enable: "Avtopilotni yoqish",
    acc_ap_desc: "Kunda 5 ta post avtomatik",
    acc_ap_focus: "Blogingiz nima haqida? (mavzular, uslub, kalit so'zlar)",
    acc_ap_prompt: "AI Uslubi (Tone of Voice)",
    acc_ap_schedule: "📅 Tizim kunda 5 ta post yaratadi: 09:00, 12:00, 16:00, 19:00, 22:00",
    acc_ap_save: "💾 Saqlash",
    acc_ap_saving: "Saqlanmoqda...",
    acc_ap_run: "🚀 Hozir ishga tushirish",
    acc_ap_running: "Yaratilmoqda...",
    an_title: "📈 Postlar analitikasi",
    an_pdf: "📄 PDF-hisobot yuklash",
    an_pdf_lock: "🔒 PDF-hisobot (Agency)",
    an_empty: "Nashr qilingan postlar yo'q.",
    an_wait_metrics: "Metrikalar hali yig'ilmadi",
    an_updated: "Yangilandi:",
    log_title: "📊 Faollik jurnali",
    log_loading: "Yuklanmoqda...",
    log_empty: "Jurnalda yozuvlar yo'q",
    adm_title: "⚙️ Administrator",
    adm_users: "Jami foydalanuvchilar",
    adm_active: "Faol",
    adm_trial: "Sinov muddatida",
    adm_posts: "Jami postlar",
    adm_table: "Foydalanuvchilar",
    sr_title: "💬 Aqlli javoblar",
    sr_desc: "Threads uchun 3 xil variantda javob olish.",
    sr_acc_label: "Akkaunt (Javob uslubi)",
    sr_acc_none: "🤖 Uslubsiz",
    sr_text_label: "Javob berish uchun post matni",
    sr_text_ph: "Post yoki fikrni joylang...",
    sr_btn: "3 variant yaratish",
    sr_btn_load: "Javob yaratilmoqda...",
    sr_copied: "Nusxalandi!",
    sr_copy: "Nusxalash",
    side_ai: "AI Avtoposting",
    side_lang: "Til / Til:",
    side_logout: "Chiqish"
  }
};

const I18nContext = createContext();
export const useI18n = () => useContext(I18nContext);

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_URL = "https://backend-production-49e4.up.railway.app";

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  // Layout
  page: { minHeight: "100vh", background: "#060b10", color: "#e6edf3", fontFamily: "'DM Sans', sans-serif", padding: "0" },
  center: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" },
  col: { display: "flex", flexDirection: "column" },
  row: { display: "flex", flexDirection: "row", alignItems: "center" },
  gap: (n = 16) => ({ gap: n }),
  // Card
  card: { background: "#0d1117", border: "1px solid #21262d", borderRadius: 16, padding: 24 },
  cardHover: { background: "#0d1117", border: "1px solid #30363d", borderRadius: 16, padding: 24, cursor: "pointer", transition: "all .2s" },
  // Text
  h1: { fontSize: 32, fontWeight: 900, color: "#e6edf3", letterSpacing: -1 },
  h2: { fontSize: 22, fontWeight: 700, color: "#e6edf3" },
  h3: { fontSize: 16, fontWeight: 600, color: "#e6edf3" },
  muted: { fontSize: 13, color: "#8b949e" },
  label: { fontSize: 13, fontWeight: 600, color: "#8b949e", marginBottom: 6, display: "block" },
  // Form
  input: { width: "100%", background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "12px 14px", color: "#e6edf3", fontSize: 14, outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "12px 14px", color: "#e6edf3", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 120 },
  select: { width: "100%", background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: "12px 14px", color: "#e6edf3", fontSize: 14, outline: "none", boxSizing: "border-box" },
  // Buttons
  btnPrimary: { background: "linear-gradient(135deg,#00d4aa,#00a88a)", color: "#060b10", border: "none", borderRadius: 10, padding: "12px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "opacity .2s" },
  btnGhost: { background: "transparent", color: "#8b949e", border: "1px solid #30363d", borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  btnDanger: { background: "transparent", color: "#f85149", border: "1px solid #f85149", borderRadius: 10, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
};

// ─── HOOKS ───────────────────────────────────────────────────────────────────
function useWindowSize() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

// ─── API CLIENT ───────────────────────────────────────────────────────────────
function useApi() {
  const getToken = () => localStorage.getItem("accessToken");
  const getRefresh = () => localStorage.getItem("refreshToken");

  async function request(method, path, body, retry = true) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    };
    const res = await fetch(API_URL + path, opts);
    if (res.status === 401 && retry && getRefresh()) {
      const r = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: getRefresh() }),
      });
      if (r.ok) {
        const data = await r.json();
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        return request(method, path, body, false);
      }
      localStorage.clear();
      window.location.reload();
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка сервера");
    return data;
  }

  return {
    get: (p) => request("GET", p),
    post: (p, b) => request("POST", p, b),
    put: (p, b) => request("PUT", p, b),
    patch: (p, b) => request("PATCH", p, b),
    del: (p) => request("DELETE", p),
  };
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, background: type === "success" ? "#00d4aa22" : "#f8514922", border: `1px solid ${type === "success" ? "#00d4aa" : "#f85149"}`, color: type === "success" ? "#00d4aa" : "#f85149", padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14, maxWidth: 340 }}>
      {message}
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState(null);
  const show = (message, type = "success") => setToast({ message, type, id: Date.now() });
  const clear = () => setToast(null);
  return { toast, show, clear };
}

// ─── BADGE ────────────────────────────────────────────────────────────────────
function Badge({ label, color = "#00d4aa" }) {
  return <span style={{ background: color + "22", color, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{label}</span>;
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }) {
  return (
    <div style={{ ...S.card, flex: 1 }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#e6edf3" }}>{value}</div>
      <div style={{ fontSize: 13, color: "#e6edf3", fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "#8b949e", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");

  async function handle(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const body = isRegister ? { email, password, name } : { email, password };
      const res = await fetch(API_URL + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ ...S.center, background: "radial-gradient(ellipse at center, #0d1f2d 0%, #060b10 70%)" }}>
      <div style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
          <div style={{ ...S.h1, fontSize: 28 }}>SellForce AI</div>
          <div style={{ ...S.muted, marginTop: 6 }}>Автопостинг в Threads и Telegram</div>
        </div>

        <div style={S.card}>
          <div style={{ ...S.h3, marginBottom: 24, textAlign: "center" }}>
            {isRegister ? "Создать аккаунт" : "Вход в систему"}
          </div>

          <form onSubmit={handle}>
            <div style={{ ...S.col, ...S.gap(16) }}>
              {isRegister && (
                <div>
                  <label style={S.label}>Имя</label>
                  <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="Алибек Юсупов" required />
                </div>
              )}
              <div>
                <label style={S.label}>Email</label>
                <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div>
                <label style={S.label}>Пароль</label>
                <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Минимум 8 символов" required />
              </div>

              {error && <div style={{ color: "#f85149", fontSize: 13, textAlign: "center" }}>{error}</div>}

              <button type="submit" style={{ ...S.btnPrimary, width: "100%", opacity: loading ? 0.7 : 1 }} disabled={loading}>
                {loading ? "Загрузка..." : isRegister ? "Зарегистрироваться" : "Войти"}
              </button>
            </div>
          </form>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button onClick={() => { setIsRegister(!isRegister); setError(""); }} style={{ ...S.btnGhost, border: "none", fontSize: 13 }}>
              {isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ user, active, onNav, onLogout, isMobile, isOpen, onClose }) {
  const { t, lang, changeLang } = useI18n();

  const items = [
    { id: "generator", icon: "✨", label: t("generator") },
    { id: "smart_replies", icon: "💬", label: t("smart_replies") },
    { id: "schedule", icon: "📅", label: t("schedule") },
    { id: "analytics", icon: "📈", label: t("analytics") },
    { id: "accounts", icon: "📱", label: t("accounts") },
    { id: "logs", icon: "📊", label: t("logs") },
    ...(user?.role === "admin" ? [{ id: "admin", icon: "⚙️", label: t("admin") }] : []),
  ];

  const handleNav = (id) => { onNav(id); if (isMobile && onClose) onClose(); };

  const navItem = (item) => (
    <div key={item.id} onClick={() => handleNav(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: isMobile ? "14px 20px" : "10px 20px", cursor: "pointer", background: active === item.id ? "#00d4aa15" : "transparent", borderLeft: active === item.id ? "3px solid #00d4aa" : "3px solid transparent", color: active === item.id ? "#00d4aa" : "#8b949e", fontWeight: active === item.id ? 700 : 500, fontSize: isMobile ? 15 : 14, transition: "all .15s" }}>
      <span style={{ fontSize: isMobile ? 18 : 14 }}>{item.icon}</span><span>{item.label}</span>
    </div>
  );

  const sidebarContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "16px 20px 16px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>⚡ SellForce</div>
          <div style={{ ...S.muted, fontSize: 12, marginTop: 2 }}>{t("side_ai")}</div>
        </div>
        {isMobile && <button onClick={onClose} style={{ background: "none", border: "none", color: "#8b949e", fontSize: 22, cursor: "pointer", padding: 4, lineHeight: 1 }}>✕</button>}
      </div>
      <div style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
        {items.map(navItem)}
      </div>
      <div style={{ padding: "16px 20px", borderTop: "1px solid #21262d" }}>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#8b949e" }}>{t("side_lang")}</div>
          <button onClick={() => changeLang(lang === 'ru' ? 'uz' : 'ru')} style={{ ...S.btnGhost, padding: "4px 10px", fontSize: 12 }}>{t('lang_btn')}</button>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 2 }}>{user?.name}</div>
        <div style={{ ...S.muted, fontSize: 11, marginBottom: 12 }}>{user?.plan?.toUpperCase()}</div>
        <button onClick={onLogout} style={{ ...S.btnGhost, fontSize: 12, padding: "6px 12px", width: "100%" }}>{t("side_logout")}</button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {isOpen && (
          <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 199, backdropFilter: "blur(2px)" }} />
        )}
        <div style={{ position: "fixed", top: 0, left: 0, height: "100vh", width: 270, background: "#0d1117", borderRight: "1px solid #21262d", zIndex: 200, transform: isOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.25s ease" }}>
          {sidebarContent}
        </div>
      </>
    );
  }

  return (
    <div style={{ width: 220, background: "#0d1117", borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", minHeight: "100vh", flexShrink: 0 }}>
      {sidebarContent}
    </div>
  );
}

// ─── GENERATOR VIEW ───────────────────────────────────────────────────────────
function GeneratorView({ accounts, usage, limits, toast }) {
  const { t } = useI18n();
  const api = useApi();
  const [accountId, setAccountId] = useState("");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("авторский");
  const [format, setFormat] = useState("");
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!topic) return toast.show(t("gen_err_topic"), "error");
    setLoading(true);
    try {
      const data = await api.post("/api/generate", { account_id: accountId ? parseInt(accountId) : null, topic, tone, format, idea });
      setResult(data.text);
      toast.show(t("gen_success"));
    } catch (err) {
      toast.show(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  const pct = limits ? Math.round((usage?.generations || 0) / limits.generationsPerMonth * 100) : 0;

  return (
    <div style={{ ...S.col, gap: 24 }}>
      <div style={{ ...S.row, justifyContent: "space-between" }}>
        <div style={S.h2}>{t("generator")}</div>
        <div style={{ ...S.card, padding: "10px 16px" }}>
          <span style={S.muted}>{t("gen_usage")}</span>
          <span style={{ fontWeight: 700, color: pct > 80 ? "#f85149" : "#00d4aa" }}>{usage?.generations || 0}/{limits?.generationsPerMonth || "?"}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={S.card}>
          <div style={{ ...S.col, gap: 16 }}>
            <div>
              <label style={S.label}>{t("gen_acc_label")}</label>
              <select style={S.select} value={accountId} onChange={e => setAccountId(e.target.value)}>
                <option value="">{t("gen_acc_none")}</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </div>

            <div>
              <label style={S.label}>{t("gen_topic_label")}</label>
              <input style={S.input} value={topic} onChange={e => setTopic(e.target.value)} placeholder={t("gen_topic_ph")} />
            </div>

            <div>
              <label style={S.label}>{t("gen_tone_label")}</label>
              <select style={S.select} value={tone} onChange={e => setTone(e.target.value)}>
                {["авторский", "провокационный", "экспертный", "дружеский", "жёсткий"].map(tn => <option key={tn}>{tn}</option>)}
              </select>
            </div>

            <div>
              <label style={S.label}>{t("gen_format_label")}</label>
              <input style={S.input} value={format} onChange={e => setFormat(e.target.value)} placeholder={t("gen_format_ph")} />
            </div>

            <div>
              <label style={S.label}>{t("gen_idea_label")}</label>
              <textarea style={{ ...S.textarea, minHeight: 80 }} value={idea} onChange={e => setIdea(e.target.value)} placeholder={t("gen_idea_ph")} />
            </div>

            <button onClick={generate} style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? t("gen_btn_load") : t("gen_btn")}
            </button>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 12 }}>
            <div style={S.h3}>{t("gen_res_title")}</div>
            {result && (
              <div style={{ ...S.row, gap: 8 }}>
                <button onClick={() => { navigator.clipboard.writeText(result); toast.show(t("gen_copied")); }} style={{ ...S.btnGhost, fontSize: 12, padding: "6px 12px" }}>{t("gen_copy")}</button>
              </div>
            )}
          </div>
          {result ? (
            <div>
              <div style={{ background: "#161b22", borderRadius: 12, padding: 16, fontSize: 15, lineHeight: 1.6, color: "#e6edf3", whiteSpace: "pre-wrap", border: "1px solid #30363d" }}>{result}</div>
              <div style={{ ...S.row, justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ ...S.muted, fontSize: 12 }}>{result.length} {t("gen_chars")}</span>
                {result.length > 500 && <span style={{ color: "#f85149", fontSize: 12 }}>{t("gen_limit_warn")}</span>}
              </div>
            </div>
          ) : (
            <div style={{ ...S.center, height: 200, color: "#30363d", fontSize: 40, flexDirection: "column", gap: 12 }}>
              <span>✨</span>
              <span style={{ fontSize: 13, color: "#8b949e" }}>{t("gen_empty")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SCHEDULE VIEW ────────────────────────────────────────────────────────────
function ScheduleView({ accounts, toast, user }) {
  const { t } = useI18n();
  const api = useApi();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [platforms, setPlatforms] = useState(["telegram"]);
  const [saving, setSaving] = useState(false);
  const [publishingNow, setPublishingNow] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get("/api/posts");
      setPosts(data.posts);
    } catch { } finally { setLoading(false); }
  }

  async function deleteAllFailed() {
    if (!window.confirm(t("sch_del_failed"))) return;
    try {
      const r = await api.del("/api/posts/failed");
      toast.show(`${t("sch_deleted")} ${r.deleted}`);
      load();
    } catch (err) { toast.show(err.message, "error"); }
  }

  async function schedule() {
    if (!accountId || !text) return toast.show(t("sch_err_acc_text"), "error");
    setSaving(true);
    try {
      await api.post("/api/posts", { account_id: parseInt(accountId), text, platforms, scheduled_at: `${date}T${time}:00+05:00` });
      toast.show(t("sch_success_plan"));
      setText(""); load();
    } catch (err) { toast.show(err.message, "error"); }
    finally { setSaving(false); }
  }

  // Обновить метрики поста принудительно
  async function refreshStats(postId) {
    try {
      const data = await api.get(`/api/posts/${postId}/stats`);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, metrics: data.metrics, last_stats_update: data.last_stats_update } : p));
    } catch { toast.show(t("sch_err_metrics"), "error"); }
  }

  async function publishNow() {
    if (!accountId || !text) return toast.show(t("sch_err_acc_text"), "error");
    setPublishingNow(true);
    try {
      const data = await api.post("/api/posts/publish-now", { account_id: parseInt(accountId), text, platforms });
      const allOk = data.results.every(r => r.ok);
      toast.show(allOk ? t("sch_success_pub") : t("sch_warn_pub"), allOk ? "success" : "error");
      setText("");
    } catch (err) { toast.show(err.message, "error"); }
    finally { setPublishingNow(false); }
  }

  const STATUS_COLORS = { published: "#00d4aa", scheduled: "#79c0ff", failed: "#f85149", partially_failed: "#f0722a" };
  const STATUS_LABELS = { published: t("status_pub"), scheduled: t("status_sch"), failed: t("status_err"), partially_failed: t("status_part_err") };

  return (
    <div style={{ ...S.col, gap: 24 }}>
      <div style={S.h2}>{t("sch_title")}</div>

      <div style={S.card}>
        <div style={{ ...S.h3, marginBottom: 16 }}>{t("sch_new_post")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ ...S.col, gap: 12 }}>
            <div>
              <label style={S.label}>{t("sch_acc")}</label>
              <select style={S.select} value={accountId} onChange={e => setAccountId(e.target.value)}>
                <option value="">{t("sch_acc_none")}</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </div>
            <div style={{ ...S.row, gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>{t("sch_date")}</label>
                <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>{t("sch_time")}</label>
                <input style={S.input} type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={S.label}>{t("sch_platforms")}</label>
              <div style={{ ...S.row, gap: 12 }}>
                {["telegram", "threads", "linkedin"].map(p => (
                  <label key={p} style={{ ...S.row, gap: 6, cursor: "pointer", fontSize: 13, color: "#e6edf3" }}>
                    <input type="checkbox" checked={platforms.includes(p)} onChange={e => setPlatforms(e.target.checked ? [...platforms, p] : platforms.filter(x => x !== p))} />
                    {p === "telegram" ? "✈️ Telegram" : p === "threads" ? "🧵 Threads" : "💼 LinkedIn"}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div style={{ ...S.col, gap: 12 }}>
            <div>
              <label style={S.label}>{t("sch_text")}</label>
              <textarea style={{ ...S.textarea, minHeight: 130 }} value={text} onChange={e => setText(e.target.value)} placeholder={t("sch_text_ph")} />
              <div style={{ ...S.row, justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 12, color: text.length > 500 ? "#f85149" : "#8b949e" }}>{text.length}/500</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ ...S.row, gap: 12, marginTop: 16 }}>
          <button onClick={schedule} style={{ ...S.btnPrimary, opacity: saving ? 0.7 : 1 }} disabled={saving}>
            {saving ? t("sch_btn_saving") : t("sch_btn_save")}
          </button>
          <button onClick={publishNow} style={{ ...S.btnGhost, opacity: publishingNow ? 0.7 : 1 }} disabled={publishingNow}>
            {publishingNow ? t("sch_btn_pubing") : t("sch_btn_pub")}
          </button>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 16 }}>
          <div style={S.h3}>{t("sch_queue")}</div>
          {posts.some(p => ["failed", "partially_failed"].includes(p.status)) && (
            <button onClick={deleteAllFailed} style={{ ...S.btnDanger, padding: "6px 12px", fontSize: 12 }}>{t("sch_del_btn")}</button>
          )}
        </div>
        {loading ? <div style={S.muted}>{t("sch_loading")}</div> : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "#8b949e" }}>{t("sch_empty_queue")}</div>
        ) : (
          <div style={{ ...S.col, gap: 8 }}>
            {posts.map(p => {
              const m = p.metrics || {};
              const isPartial = p.status === "partially_failed";
              return (
                <div key={p.id} style={{ ...S.row, justifyContent: "space-between", padding: "12px 16px", background: "#161b22", borderRadius: 10, gap: 12, borderLeft: isPartial ? "3px solid #f0722a" : "3px solid transparent" }}>
                  <div style={{ ...S.row, gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 20 }}>{p.icon || "📱"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#e6edf3", fontWeight: 600, marginBottom: 2 }}>{p.account_name}</div>
                      <div style={{ fontSize: 12, color: "#8b949e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.text}</div>
                      {/* Метрики */}
                      {Object.keys(m).length > 0 && (
                        <div style={{ ...S.row, gap: 12, marginTop: 5, flexWrap: "wrap" }}>
                          {m.telegram?.channel_members !== undefined && <span style={{ fontSize: 11, color: "#79c0ff" }} title="Подписчики канала">👥 {m.telegram.channel_members.toLocaleString()}</span>}
                          {m.threads?.likes !== undefined && <span style={{ fontSize: 11, color: "#f85149" }}>❤️ {m.threads.likes}</span>}
                          {m.threads?.replies !== undefined && <span style={{ fontSize: 11, color: "#00d4aa" }}>💬 {m.threads.replies}</span>}
                          {m.threads?.reposts !== undefined && <span style={{ fontSize: 11, color: "#d2a8ff" }}>🔄 {m.threads.reposts}</span>}
                        </div>
                      )}
                      {isPartial && p.error_log && <div style={{ fontSize: 11, color: "#f0722a", marginTop: 3 }}>⚠️ {p.error_log}</div>}
                    </div>
                  </div>
                  <div style={{ ...S.row, gap: 8, flexShrink: 0 }}>
                    <div title={p.error_log || undefined} style={{ cursor: p.error_log ? "help" : "default" }}>
                      <Badge label={STATUS_LABELS[p.status] || p.status} color={STATUS_COLORS[p.status] || "#8b949e"} />
                    </div>
                    <div style={{ fontSize: 12, color: "#8b949e" }}>{new Date(p.scheduled_at).toLocaleString("ru")}</div>
                    {(p.status === "published" || p.status === "partially_failed") && (
                      <button onClick={() => refreshStats(p.id)} title="Обновить метрики" style={{ ...S.btnGhost, padding: "4px 8px", fontSize: 12 }}>🔄</button>
                    )}
                    {(p.status === "failed" || p.status === "partially_failed") && (
                      <button onClick={async () => { await api.post(`/api/posts/${p.id}/retry`, {}); load(); toast.show(t("sch_retry_plan")); }} style={{ ...S.btnGhost, padding: "4px 8px", fontSize: 11, borderColor: "#f0722a", color: "#f0722a" }}>{t("sch_retry_btn")}</button>
                    )}
                    <button onClick={async () => { await api.del(`/api/posts/${p.id}`); load(); }} style={{ ...S.btnDanger, padding: "4px 8px", fontSize: 12 }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TOKEN STATUS HELPER ──────────────────────────────────────────
// Возвращает статус токена: 'active' | 'expiring' | 'expired'
function getTokenStatus(account) {
  if (account.platform === "telegram") return "active"; // TG токен не истекает
  if (!account.token_expires_at) return account.token ? "active" : "no_token";
  const exp = new Date(account.token_expires_at);
  const now = new Date();
  const daysLeft = Math.floor((exp - now) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return "expired";
  if (daysLeft < 7) return "expiring";
  return "active";
}

const TOKEN_STATUS_CONFIG = {
  active: { label: "Токен активен", color: "#00d4aa", icon: "✅" },
  expiring: { label: "Истекает скоро", color: "#f0722a", icon: "⚠️" },
  expired: { label: "Нужно обновить", color: "#f85149", icon: "🔴" },
  no_token: { label: "Без токена", color: "#8b949e", icon: "⚪" },
};

// ─── ACCOUNTS VIEW ────────────────────────────────────────────────────────────
function AccountsView({ accounts, setAccounts, toast }) {
  const { t } = useI18n();
  const api = useApi();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ platform: "telegram", handle: "", name: "", color: "#00d4aa", icon: "📱", token: "", channel_id: "", threads_user_id: "" });
  const [autopilotOpen, setAutopilotOpen] = useState({}); // id → boolean
  const [autopilotForms, setAutopilotForms] = useState({}); // id → {autopilot_enabled, content_focus}
  const [savingAutopilot, setSavingAutopilot] = useState({});
  const [triggeringAutopilot, setTriggeringAutopilot] = useState({});

  function getAutopilotForm(a) {
    return autopilotForms[a.id] || { autopilot_enabled: a.autopilot_enabled || false, content_focus: a.content_focus || "", custom_prompt: a.custom_prompt || "" };
  }

  async function save(e) {
    e.preventDefault();
    try {
      const data = await api.post("/api/accounts", form);
      setAccounts(prev => [...prev, data.account]);
      setAdding(false);
      setForm({ platform: "telegram", handle: "", name: "", color: "#00d4aa", icon: "📱", token: "", channel_id: "", threads_user_id: "" });
      toast.show(t("sch_success_plan") ? "Аккаунт добавлен!" : "Аккаунт добавлен!"); // generic
    } catch (err) { toast.show(err.message, "error"); }
  }

  async function remove(id) {
    if (!window.confirm("Удалить аккаунт?")) return;
    await api.del(`/api/accounts/${id}`);
    setAccounts(prev => prev.filter(a => a.id !== id));
    toast.show(t("sch_deleted") || "Удалено");
  }

  async function saveAutopilot(a) {
    setSavingAutopilot(s => ({ ...s, [a.id]: true }));
    try {
      const f = getAutopilotForm(a);
      await api.put(`/api/accounts/${a.id}`, {
        handle: a.handle, name: a.name, token: a.token,
        channel_id: a.channel_id, threads_user_id: a.threads_user_id,
        color: a.color, icon: a.icon,
        autopilot_enabled: f.autopilot_enabled,
        content_focus: f.content_focus,
        custom_prompt: f.custom_prompt,
      });
      setAccounts(prev => prev.map(acc => acc.id === a.id ? { ...acc, ...f } : acc));
      toast.show(f.autopilot_enabled ? "🤖 Автопилот включён!" : "Автопилот выключен");
    } catch (err) { toast.show(err.message, "error"); }
    setSavingAutopilot(s => ({ ...s, [a.id]: false }));
  }

  async function triggerAutopilot(a) {
    setTriggeringAutopilot(s => ({ ...s, [a.id]: true }));
    try {
      const result = await api.post(`/api/accounts/${a.id}/trigger-autopilot`, {});
      toast.show(result.postsCreated ? `✅ Создано ${result.postsCreated} постов!` : "⚠️ " + (result.error || "Ошибка"));
    } catch (err) { toast.show(err.message, "error"); }
    setTriggeringAutopilot(s => ({ ...s, [a.id]: false }));
  }

  return (
    <div style={{ ...S.col, gap: 24 }}>
      <div style={{ ...S.row, justifyContent: "space-between" }}>
        <div style={S.h2}>{t("acc_title")}</div>
        <div style={{ ...S.row, gap: 8 }}>
          <button
            onClick={() => {
              const token = localStorage.getItem("accessToken");
              window.location.href = `${API_URL}/auth/threads/start?state=${encodeURIComponent(token)}`;
            }}
            style={{ ...S.btnGhost, fontSize: 12, padding: "10px 16px", borderColor: "#444", display: "flex", alignItems: "center", gap: 6 }}
          >
            {t("acc_connect_threads")}
          </button>
          <button
            onClick={() => {
              const token = localStorage.getItem("accessToken");
              window.location.href = `${API_URL}/auth/linkedin/start?state=${encodeURIComponent(token)}`;
            }}
            style={{ ...S.btnGhost, fontSize: 12, padding: "10px 16px", borderColor: "#0077B5", color: "#0077B5", display: "flex", alignItems: "center", gap: 6 }}
          >
            {t("acc_connect_linkedin")}
          </button>
          <button onClick={() => setAdding(!adding)} style={S.btnPrimary}>{t("acc_add_manual")}</button>
        </div>
      </div>

      {adding && (
        <div style={S.card}>
          <div style={{ ...S.h3, marginBottom: 16 }}>{t("acc_new")}</div>
          <form onSubmit={save}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={S.label}>{t("acc_platform")}</label>
                <select style={S.select} value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                  <option value="telegram">✈️ Telegram</option>
                  <option value="threads">🧵 Threads</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Handle (@username)</label>
                <input style={S.input} value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} placeholder="@sellforce_uz" required />
              </div>
              <div>
                <label style={S.label}>{t("acc_name")}</label>
                <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="SellForce CRM" required />
              </div>
              <div>
                <label style={S.label}>{t("acc_icon")}</label>
                <input style={S.input} value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="📱" />
              </div>
              <div>
                <label style={S.label}>{form.platform === "telegram" ? t("acc_token_tg") : t("acc_token_other")}</label>
                {form.platform === "threads" ? (
                  <div style={{ background: "#00d4aa12", border: "1px solid #00d4aa44", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#00d4aa" }}>
                    {t("acc_threads_hint")}
                    <br /><span style={{ color: "#8b949e" }}>{t("acc_threads_hint2")}</span>
                  </div>
                ) : null}
                <input style={{ ...S.input, marginTop: form.platform === "threads" ? 8 : 0 }} value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))} placeholder={form.platform === "telegram" ? "Используется глобальный токен из .env" : "Вставь вручную EAAxxxxx... (необязательно)"} />
              </div>
              <div>
                <label style={S.label}>{form.platform === "telegram" ? "Channel ID" : "Threads User ID"}</label>
                <input style={S.input} value={form.platform === "telegram" ? form.channel_id : form.threads_user_id} onChange={e => setForm(f => form.platform === "telegram" ? { ...f, channel_id: e.target.value } : { ...f, threads_user_id: e.target.value })} placeholder={form.platform === "telegram" ? "-1001234567890" : "123456789"} />
              </div>
            </div>
            <div style={{ ...S.row, gap: 12, marginTop: 16 }}>
              <button type="submit" style={S.btnPrimary}>{t("acc_save")}</button>
              <button type="button" onClick={() => setAdding(false)} style={S.btnGhost}>{t("acc_cancel")}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {accounts.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", color: "#8b949e", padding: 40 }}>{t("acc_empty")}</div>
        ) : accounts.map(a => {
          const ts = getTokenStatus(a);
          const tsCfg = TOKEN_STATUS_CONFIG[ts];
          const daysLeft = a.token_expires_at
            ? Math.floor((new Date(a.token_expires_at) - Date.now()) / 86_400_000)
            : null;
          const apf = getAutopilotForm(a);
          const isApOpen = autopilotOpen[a.id];
          return (
            <div key={a.id} style={{ ...S.card, borderLeft: `4px solid ${a.color || "#00d4aa"}` }}>
              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ ...S.row, gap: 8 }}>
                  <span style={{ fontSize: 24 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
                    <div style={{ ...S.muted, fontSize: 12 }}>{a.handle}</div>
                  </div>
                </div>
                <div style={{ ...S.row, gap: 8 }}>
                  <Badge label={a.platform} color={a.platform === "telegram" ? "#229ed9" : "#000"} />
                  <button onClick={() => remove(a.id)} style={{ ...S.btnDanger, padding: "4px 8px", fontSize: 12 }}>✕</button>
                </div>
              </div>
              {/* Статус токена */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
                background: tsCfg.color + "18", borderRadius: 8, padding: "6px 10px"
              }}>
                <span style={{ fontSize: 14 }}>{tsCfg.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: tsCfg.color }}>
                  {ts === "active" ? t("acc_status_active") : tsCfg.label}
                </span>
                {daysLeft !== null && daysLeft >= 0 && (
                  <span style={{ ...S.muted, fontSize: 11, marginLeft: "auto" }}>{t("acc_status_days").replace("{days}", daysLeft)}</span>
                )}
                {daysLeft !== null && daysLeft < 0 && (
                  <span style={{ ...S.muted, fontSize: 11, marginLeft: "auto", color: "#f85149" }}>{t("acc_status_end")}</span>
                )}
              </div>
              <div style={{ ...S.muted, fontSize: 12, marginBottom: 12 }}>
                {a.channel_id && <div>Channel ID: {a.channel_id}</div>}
                {a.threads_user_id && <div>User ID: {a.threads_user_id}</div>}
                {a.token && <div>Токен: ••••••••{a.token.slice(-4)}</div>}
              </div>

              {/* Кнопка настроек автопилота */}
              <button
                onClick={() => setAutopilotOpen(s => ({ ...s, [a.id]: !s[a.id] }))}
                style={{
                  ...S.btnGhost, width: "100%", fontSize: 12, padding: "8px",
                  borderColor: a.autopilot_enabled ? "#00d4aa" : "#30363d",
                  color: a.autopilot_enabled ? "#00d4aa" : "#8b949e"
                }}
              >
                🤖 {a.autopilot_enabled ? t("acc_ap_on") : t("acc_ap_off")} {isApOpen ? "▲" : "▼"}
              </button>

              {/* Панель автопилота */}
              {isApOpen && (
                <div style={{ marginTop: 12, padding: 14, background: "#0d1117", borderRadius: 10, border: "1px solid #21262d" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#e6edf3" }}>{t("acc_ap_settings")}</div>

                  {/* Toggle */}
                  <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>{t("acc_ap_enable")}</div>
                      <div style={{ fontSize: 11, color: "#8b949e" }}>{t("acc_ap_desc")}</div>
                    </div>
                    <div
                      onClick={() => setAutopilotForms(s => ({ ...s, [a.id]: { ...apf, autopilot_enabled: !apf.autopilot_enabled } }))}
                      style={{
                        width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                        background: apf.autopilot_enabled ? "#00d4aa" : "#30363d",
                        position: "relative", transition: "background .2s", flexShrink: 0
                      }}
                    >
                      <div style={{
                        position: "absolute", top: 3, left: apf.autopilot_enabled ? 22 : 2,
                        width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s"
                      }} />
                    </div>
                  </div>

                  {/* Content Focus */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ ...S.label, fontSize: 12 }}>{t("acc_ap_focus")}</label>
                    <textarea
                      style={{ ...S.textarea, minHeight: 70, fontSize: 12 }}
                      value={apf.content_focus}
                      onChange={e => setAutopilotForms(s => ({ ...s, [a.id]: { ...apf, content_focus: e.target.value } }))}
                    />
                  </div>

                  {/* Custom Prompt */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ ...S.label, fontSize: 12 }}>{t("acc_ap_prompt")}</label>
                    <textarea
                      style={{ ...S.textarea, minHeight: 70, fontSize: 12 }}
                      value={apf.custom_prompt}
                      onChange={e => setAutopilotForms(s => ({ ...s, [a.id]: { ...apf, custom_prompt: e.target.value } }))}
                    />
                  </div>

                  <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 12 }}>
                    {t("acc_ap_schedule")}
                  </div>

                  <div style={{ ...S.row, gap: 8 }}>
                    <button
                      onClick={() => saveAutopilot(a)}
                      disabled={savingAutopilot[a.id]}
                      style={{ ...S.btnPrimary, flex: 1, fontSize: 12, padding: "9px", opacity: savingAutopilot[a.id] ? 0.7 : 1 }}
                    >
                      {savingAutopilot[a.id] ? t("acc_ap_saving") : t("acc_ap_save")}
                    </button>
                    <button
                      onClick={() => triggerAutopilot(a)}
                      disabled={triggeringAutopilot[a.id]}
                      style={{ ...S.btnGhost, flex: 1, fontSize: 12, padding: "9px", opacity: triggeringAutopilot[a.id] ? 0.7 : 1 }}
                    >
                      {triggeringAutopilot[a.id] ? t("acc_ap_running") : t("acc_ap_run")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ANALYTICS VIEW ───────────────────────────────────────────────────────────
function AnalyticsView({ toast, user }) {
  const { t } = useI18n();
  const api = useApi();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAgency = user?.plan === "agency";

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchPosts = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (startDate) query.append("startDate", startDate);
    if (endDate) query.append("endDate", endDate + "T23:59:59.999Z");

    api.get(`/api/posts/stats?${query.toString()}`)
      .then(d => setPosts(d.posts))
      .catch(err => toast.show(err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPosts();
  }, [startDate, endDate]);

  function handlePrint() {
    if (!isAgency) {
      toast.show("Эта функция доступна только в тарифе Agency. Улучшите ваш план, чтобы генерировать отчеты для клиентов.", "error");
      return;
    }
    document.getElementById("sf-print-style")?.remove();
    const style = document.createElement("style");
    style.id = "sf-print-style";
    style.textContent = `@media print { body > #root > * { display: none !important; } #sf-print-report { display: block !important; position: fixed; top: 0; left: 0; width: 100%; padding: 32px; background: white; color: black; } } @page { margin: 15mm; }`;
    document.head.appendChild(style);
    document.getElementById("sf-print-report").style.display = "block";
    window.print();
    window.onafterprint = () => {
      document.getElementById("sf-print-style")?.remove();
      const el = document.getElementById("sf-print-report");
      if (el) el.style.display = "none";
      window.onafterprint = null;
    };
  }

  const published = posts.filter(p => ["published", "partially_failed"].includes(p.status));

  return (
    <div style={{ ...S.col, gap: 24 }}>
      {/* Скрытый блок для PDF-печати */}
      <div id="sf-print-report" style={{ display: "none" }}>
        <div style={{ fontFamily: "Arial, sans-serif", color: "#000" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid #000" }}>
            <span style={{ fontSize: 36, fontWeight: 900 }}>⚡</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 22 }}>SellForce AI — Отчёт по публикациям</div>
              <div style={{ color: "#666", fontSize: 13 }}>{user?.name} · Период: {startDate ? new Date(startDate).toLocaleDateString("ru") : ""} — {endDate ? new Date(endDate).toLocaleDateString("ru") : ""}</div>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f4f4f4" }}>
                {["Дата", "Платформа", "Аккаунт", "Текст (50 симв.)", "❤️ Лайки", "👥 Подписчики"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", border: "1px solid #ddd", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {published.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9f9f9" }}>
                  <td style={{ padding: "6px 10px", border: "1px solid #ddd" }}>{new Date(p.published_at || p.created_at).toLocaleDateString("ru")}</td>
                  <td style={{ padding: "6px 10px", border: "1px solid #ddd" }}>{p.account_platform}</td>
                  <td style={{ padding: "6px 10px", border: "1px solid #ddd" }}>{p.account_name}</td>
                  <td style={{ padding: "6px 10px", border: "1px solid #ddd" }}>{p.text?.slice(0, 50)}{p.text?.length > 50 ? "..." : ""}</td>
                  <td style={{ padding: "6px 10px", border: "1px solid #ddd", textAlign: "center" }}>{p.metrics?.threads?.likes ?? "—"}</td>
                  <td style={{ padding: "6px 10px", border: "1px solid #ddd", textAlign: "center" }}>{p.metrics?.telegram?.channel_members?.toLocaleString() ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 20, fontSize: 11, color: "#aaa", textAlign: "center" }}>Сгенерировано платформой SellForce AI</div>
        </div>
      </div>

      <div style={{ ...S.row, justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={S.h2}>{t("an_title")}</div>
        <div style={{ ...S.row, gap: 12 }}>
          <input 
            type="date" 
            style={{ ...S.input, width: "auto", padding: "8px 12px", fontSize: 13 }} 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
          />
          <span style={{ color: "#8b949e" }}>—</span>
          <input 
            type="date" 
            style={{ ...S.input, width: "auto", padding: "8px 12px", fontSize: 13 }} 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
          />
          {isAgency ? (
            <button onClick={handlePrint} style={S.btnPrimary}>{t("an_pdf")}</button>
          ) : (
            <button disabled title="Доступно только на тарифе Agency" style={{ ...S.btnGhost, opacity: 0.45, cursor: "not-allowed" }}>{t("an_pdf_lock")}</button>
          )}
        </div>
      </div>

      {loading ? <div style={S.muted}>{t("log_loading")}</div> : posts.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", color: "#8b949e", padding: 40 }}>{t("an_empty")}</div>
      ) : (
        <div style={{ ...S.col, gap: 10 }}>
          {posts.map(p => {
            const m = p.metrics || {};
            const isPartial = p.status === "partially_failed";
            const sc = isPartial ? "#f0722a" : p.status === "published" ? "#00d4aa" : "#8b949e";
            return (
              <div key={p.id} style={{ ...S.card, borderLeft: `4px solid ${p.color || sc}` }}>
                <div style={{ ...S.row, gap: 12, justifyContent: "space-between" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...S.row, gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 18 }}>{p.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{p.account_name}</span>
                      <Badge label={isPartial ? "Частичная ошибка" : p.status} color={sc} />
                      <span style={{ ...S.muted, fontSize: 11 }}>{new Date(p.published_at || p.created_at).toLocaleString("ru")}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#8b949e", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.text}</div>
                    <div style={{ ...S.row, gap: 16, flexWrap: "wrap" }}>
                      {m.telegram?.channel_members !== undefined && <span style={{ fontSize: 12, color: "#79c0ff" }} title="Подписчики канала">👥 {m.telegram.channel_members.toLocaleString()}</span>}
                      {m.threads?.views !== undefined && <span style={{ fontSize: 12, color: "#8b949e" }}>👁 {m.threads.views.toLocaleString()}</span>}
                      {m.threads?.likes !== undefined && <span style={{ fontSize: 12, color: "#f85149" }}>❤️ {m.threads.likes}</span>}
                      {m.threads?.replies !== undefined && <span style={{ fontSize: 12, color: "#00d4aa" }}>💬 {m.threads.replies}</span>}
                      {m.threads?.reposts !== undefined && <span style={{ fontSize: 12, color: "#d2a8ff" }}>🔄 {m.threads.reposts}</span>}
                      {Object.keys(m).length === 0 && <span style={{ ...S.muted, fontSize: 12 }}>{t("an_wait_metrics")}</span>}
                    </div>
                    {isPartial && p.error_log && <div style={{ marginTop: 6, fontSize: 11, color: "#f0722a" }}>⚠️ {p.error_log}</div>}
                  </div>
                  {p.last_stats_update && (
                    <div style={{ ...S.muted, fontSize: 10, textAlign: "right", flexShrink: 0 }}>{t("an_updated")}<br />{new Date(p.last_stats_update).toLocaleString("ru")}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── LOGS VIEW ────────────────────────────────────────────────────────────────
function LogsView() {
  const { t } = useI18n();
  const api = useApi();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/logs").then(d => setLogs(d.logs)).catch(() => { }).finally(() => setLoading(false));
  }, []);

  const TYPE_COLORS = { publish_success: "#00d4aa", publish_fail: "#f85149", ai_generate: "#79c0ff", account_added: "#d2a8ff", publish_now: "#00d4aa", publish_skip: "#8b949e" };

  return (
    <div style={{ ...S.col, gap: 20 }}>
      <div style={S.h2}>{t("log_title")}</div>
      <div style={S.card}>
        {loading ? <div style={S.muted}>{t("log_loading")}</div> : logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "#8b949e" }}>{t("log_empty")}</div>
        ) : (
          <div style={{ ...S.col, gap: 0 }}>
            {logs.map((l, i) => (
              <div key={l.id} style={{ ...S.row, gap: 12, padding: "10px 0", borderBottom: i < logs.length - 1 ? "1px solid #21262d" : "none" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: TYPE_COLORS[l.type] || "#8b949e", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: "#e6edf3" }}>{l.message}</span>
                  {l.platform && <Badge label={l.platform} color={TYPE_COLORS[l.type] || "#8b949e"} />}
                </div>
                <div style={{ fontSize: 11, color: "#8b949e", flexShrink: 0 }}>{new Date(l.created_at).toLocaleString("ru")}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
function AdminView({ toast }) {
  const { t } = useI18n();
  const api = useApi();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/stats").then(d => { setStats(d.stats); setUsers(d.users); }).catch(err => toast.show(err.message, "error")).finally(() => setLoading(false));
  }, []);

  async function updateUser(id, data) {
    try {
      await api.patch(`/admin/users/${id}`, data);
      setUsers(us => us.map(u => u.id === id ? { ...u, ...data } : u));
      toast.show("Обновлено!");
    } catch (err) { toast.show(err.message, "error"); }
  }

  if (loading) return <div style={S.muted}>{t("log_loading")}</div>;

  return (
    <div style={{ ...S.col, gap: 24 }}>
      <div style={S.h2}>{t("adm_title")}</div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <StatCard icon="👥" label={t("adm_users")} value={stats.total_users} />
          <StatCard icon="✅" label={t("adm_active")} value={stats.active} />
          <StatCard icon="⏳" label={t("adm_trial")} value={stats.trial} />
          <StatCard icon="📤" label={t("adm_posts")} value={stats.total_posts} />
        </div>
      )}

      <div style={S.card}>
        <div style={{ ...S.h3, marginBottom: 16 }}>{t("adm_table")}</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#8b949e", borderBottom: "1px solid #21262d" }}>
                {["Имя", "Email", "Тариф", "Статус", "Постов", "Действия"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: "1px solid #21262d" }}>
                  <td style={{ padding: "10px 12px" }}>{u.name}</td>
                  <td style={{ padding: "10px 12px", color: "#8b949e" }}>{u.email}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <select style={{ ...S.select, width: "auto", padding: "4px 8px", fontSize: 12 }} value={u.plan} onChange={e => updateUser(u.id, { plan: e.target.value })}>
                      {["starter", "pro", "agency"].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge label={u.status} color={u.status === "active" ? "#00d4aa" : u.status === "blocked" ? "#f85149" : "#79c0ff"} />
                  </td>
                  <td style={{ padding: "10px 12px", color: "#8b949e" }}>{u.total_posts || 0}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <button onClick={() => updateUser(u.id, { status: u.status === "blocked" ? "active" : "blocked" })}
                      style={{ ...S.btnDanger, fontSize: 11, padding: "4px 10px" }}>
                      {u.status === "blocked" ? "Разблок." : "Блок."}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── SMART REPLIES VIEW ───────────────────────────────────────────────────────
function SmartRepliesView({ accounts, toast }) {
  const { t } = useI18n();
  const api = useApi();
  const [accountId, setAccountId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState([]);

  async function generate() {
    if (!text) return toast.show("Вставьте текст поста", "error");
    setLoading(true);
    setVariants([]);
    try {
      const data = await api.post("/api/comments/generate", { text, account_id: accountId ? parseInt(accountId) : null });
      setVariants(data.variants || []);
      toast.show(t("sr_title"));
    } catch (err) {
      toast.show(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function copyText(str) {
    navigator.clipboard.writeText(str);
    toast.show(t("sr_copied"));
  }

  return (
    <div style={{ ...S.col, gap: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={S.h2}>{t("sr_title")}</div>
      <div style={S.muted}>
        {t("sr_desc")}
      </div>

      <div style={S.card}>
        {accounts && accounts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={S.label}>{t("sr_acc_label")}</label>
            <select style={S.select} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">{t("sr_acc_none")}</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name} ({a.platform})</option>)}
            </select>
          </div>
        )}

        <label style={S.label}>{t("sr_text_label")}</label>
        <textarea
          style={{ ...S.textarea, minHeight: 100, marginBottom: 16 }}
          placeholder={t("sr_text_ph")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={generate}
          style={{ ...S.btnPrimary, width: "100%", opacity: loading ? 0.7 : 1 }}
          disabled={loading}
        >
          {loading ? t("sr_btn_load") : t("sr_btn")}
        </button>
      </div>

      {variants.length > 0 && (
        <div style={{ ...S.col, gap: 16 }}>
          {variants.map((v, i) => (
            <div key={i} style={S.card}>
              <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, color: "#00d4aa" }}>{v.type}</span>
                <button onClick={() => copyText(v.text)} style={{ ...S.btnGhost, padding: "4px 12px", fontSize: 12 }}>
                  {t("sr_copy")}
                </button>
              </div>
              <div style={{ color: "#e6edf3", whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>{v.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [lang, setLang] = useState(localStorage.getItem("sf_lang") || "ru");
  const changeLang = (l) => { setLang(l); localStorage.setItem("sf_lang", l); };
  const t = useCallback((key) => DICTS[lang]?.[key] || DICTS.ru[key] || key, [lang]);

  const [user, setUser] = useState(null);
  const [view, setView] = useState("generator");
  const [accounts, setAccounts] = useState([]);
  const [usage, setUsage] = useState(null);
  const [limits, setLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toast = useToast();
  const api = useApi();
  const winW = useWindowSize();
  const isMobile = winW < 768;

  // Проверяем сессию
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { setLoading(false); return; }
    api.get("/auth/me").then(d => {
      setUser(d.user);
    }).catch(() => {
      localStorage.clear();
    }).finally(() => setLoading(false));
  }, []);

  // Обработка редиректа после Threads/LinkedIn OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("threads_connected")) {
      const username = params.get("username") || "Threads";
      setTimeout(() => toast.show(`✅ @${username} подключён через Meta! Токен на 60 дней.`), 800);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("threads_error")) {
      setTimeout(() => toast.show(`❌ Ошибка: ${decodeURIComponent(params.get("threads_error"))}`, "error"), 800);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("linkedin_connected")) {
      const username = params.get("username") || "LinkedIn";
      setTimeout(() => toast.show(`✅ ${username} подключён через LinkedIn!`), 800);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("linkedin_error")) {
      setTimeout(() => toast.show(`❌ LinkedIn: ${decodeURIComponent(params.get("linkedin_error"))}`, "error"), 800);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Загрузка данных после логина
  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get("/api/accounts").then(d => setAccounts(d.accounts)),
      api.get("/api/usage").then(d => { setUsage(d.usage); setLimits(d.limits); }),
    ]).catch(() => { });
  }, [user]);

  function handleLogin(u) {
    setUser(u);
  }

  function handleLogout() {
    const refreshToken = localStorage.getItem("refreshToken");
    fetch(`${API_URL}/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) });
    localStorage.clear();
    setUser(null);
  }

  if (loading) return (
    <div style={{ ...S.center, background: "#060b10" }}>
      <div style={{ textAlign: "center", color: "#8b949e" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <div>Загрузка...</div>
      </div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const views = {
    generator: <GeneratorView accounts={accounts} usage={usage} limits={limits} toast={toast} />,
    smart_replies: <SmartRepliesView accounts={accounts} toast={toast} />,
    schedule: <ScheduleView accounts={accounts} toast={toast} user={user} />,
    analytics: <AnalyticsView toast={toast} user={user} />,
    accounts: <AccountsView accounts={accounts} setAccounts={setAccounts} toast={toast} />,
    logs: <LogsView />,
    admin: <AdminView toast={toast} />,
  };

  const viewLabels = { generator: t("generator"), smart_replies: t("smart_replies"), schedule: t("schedule"), analytics: t("analytics"), accounts: t("accounts"), logs: t("logs"), admin: t("admin") };

  return (
    <I18nContext.Provider value={{ lang, changeLang, t }}>
      <div style={{ ...S.page, minHeight: "100vh" }}>
        {toast.toast && <Toast key={toast.toast.id} message={toast.toast.message} type={toast.toast.type} onClose={toast.clear} />}

      {/* Mobile header */}
      {isMobile && (
        <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#0d1117", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", padding: "12px 16px", gap: 12 }}>
          <button onClick={() => setMobileOpen(true)} style={{ background: "none", border: "none", color: "#e6edf3", fontSize: 22, cursor: "pointer", padding: 4, lineHeight: 1 }}>☰</button>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e6edf3" }}>{viewLabels[view] || "SellForce"}</div>
          <div style={{ marginLeft: "auto", fontSize: 13, color: "#00d4aa", fontWeight: 600 }}>⚡ SellForce</div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <Sidebar user={user} active={view} onNav={setView} onLogout={handleLogout} isMobile={isMobile} isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div style={{ flex: 1, padding: isMobile ? "16px 12px 80px" : 32, minHeight: "100vh", overflow: "auto", maxWidth: isMobile ? "100%" : undefined }}>
          {views[view] || views.generator}
        </div>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d1117", borderTop: "1px solid #21262d", display: "flex", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {[{ id: "generator", icon: "✨" }, { id: "smart_replies", icon: "💬" }, { id: "schedule", icon: "📅" }, { id: "analytics", icon: "📈" }, { id: "accounts", icon: "📱" }].map(item => (
            <button key={item.id} onClick={() => setView(item.id)} style={{ flex: 1, background: "none", border: "none", color: view === item.id ? "#00d4aa" : "#8b949e", fontSize: 22, padding: "12px 0 10px", cursor: "pointer", borderTop: view === item.id ? "2px solid #00d4aa" : "2px solid transparent", transition: "all .15s" }}>
              {item.icon}
            </button>
          ))}
        </div>
      )}
      </div>
    </I18nContext.Provider>
  );
}