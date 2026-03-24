// v2 — clean encoding fix 2026-03-24
import React, { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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
function Sidebar({ user, active, onNav, onLogout }) {
  const items = [
    { id: "generator", icon: "✨", label: "Генератор" },
    { id: "schedule", icon: "📅", label: "Планировщик" },
    { id: "analytics", icon: "📈", label: "Аналитика" },
    { id: "accounts", icon: "📱", label: "Аккаунты" },
    { id: "logs", icon: "📊", label: "Логи" },
    ...(user?.role === "admin" ? [{ id: "admin", icon: "⚙️", label: "Администратор" }] : []),
  ];

  return (
    <div style={{ width: 220, background: "#0d1117", borderRight: "1px solid #21262d", display: "flex", flexDirection: "column", minHeight: "100vh", padding: "20px 0" }}>
      <div style={{ padding: "0 20px 24px", borderBottom: "1px solid #21262d" }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>⚡ SellForce</div>
        <div style={{ ...S.muted, fontSize: 12, marginTop: 2 }}>AI Автопостинг</div>
      </div>

      <div style={{ flex: 1, padding: "12px 0" }}>
        {items.map(item => (
          <div key={item.id} onClick={() => onNav(item.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", cursor: "pointer", background: active === item.id ? "#00d4aa15" : "transparent", borderLeft: active === item.id ? "3px solid #00d4aa" : "3px solid transparent", color: active === item.id ? "#00d4aa" : "#8b949e", fontWeight: active === item.id ? 700 : 500, fontSize: 14, transition: "all .15s" }}>
            <span>{item.icon}</span><span>{item.label}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "16px 20px", borderTop: "1px solid #21262d" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 2 }}>{user?.name}</div>
        <div style={{ ...S.muted, fontSize: 11, marginBottom: 12 }}>{user?.plan?.toUpperCase()}</div>
        <button onClick={onLogout} style={{ ...S.btnGhost, fontSize: 12, padding: "6px 12px", width: "100%" }}>Выйти</button>
      </div>
    </div>
  );
}

// ─── GENERATOR VIEW ───────────────────────────────────────────────────────────
function GeneratorView({ accounts, usage, limits, toast }) {
  const api = useApi();
  const [accountId, setAccountId] = useState("");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("авторский");
  const [format, setFormat] = useState("");
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!topic) return toast.show("Укажи тему поста", "error");
    setLoading(true);
    try {
      const data = await api.post("/api/generate", { account_id: accountId ? parseInt(accountId) : null, topic, tone, format, idea });
      setResult(data.text);
      toast.show("Пост сгенерирован!");
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
        <div style={S.h2}>✨ AI Генератор</div>
        <div style={{ ...S.card, padding: "10px 16px" }}>
          <span style={S.muted}>Генераций: </span>
          <span style={{ fontWeight: 700, color: pct > 80 ? "#f85149" : "#00d4aa" }}>{usage?.generations || 0}/{limits?.generationsPerMonth || "?"}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={S.card}>
          <div style={{ ...S.col, gap: 16 }}>
            <div>
              <label style={S.label}>Аккаунт (необязательно)</label>
              <select style={S.select} value={accountId} onChange={e => setAccountId(e.target.value)}>
                <option value="">— Без привязки к аккаунту —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </div>

            <div>
              <label style={S.label}>Тема поста *</label>
              <input style={S.input} value={topic} onChange={e => setTopic(e.target.value)} placeholder="Например: почему клиенты уходят к конкурентам" />
            </div>

            <div>
              <label style={S.label}>Тональность</label>
              <select style={S.select} value={tone} onChange={e => setTone(e.target.value)}>
                {["авторский", "провокационный", "экспертный", "дружеский", "жёсткий"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label style={S.label}>Формат (необязательно)</label>
              <input style={S.input} value={format} onChange={e => setFormat(e.target.value)} placeholder="список, история, факт+мнение..." />
            </div>

            <div>
              <label style={S.label}>Идея / контекст</label>
              <textarea style={{ ...S.textarea, minHeight: 80 }} value={idea} onChange={e => setIdea(e.target.value)} placeholder="Дополнительный контекст для AI..." />
            </div>

            <button onClick={generate} style={{ ...S.btnPrimary, opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? "⏳ Генерирую..." : "✨ Сгенерировать"}
            </button>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 12 }}>
            <div style={S.h3}>Результат</div>
            {result && (
              <div style={{ ...S.row, gap: 8 }}>
                <button onClick={() => { navigator.clipboard.writeText(result); toast.show("Скопировано!"); }} style={{ ...S.btnGhost, fontSize: 12, padding: "6px 12px" }}>Копировать</button>
              </div>
            )}
          </div>
          {result ? (
            <div>
              <div style={{ background: "#161b22", borderRadius: 12, padding: 16, fontSize: 15, lineHeight: 1.6, color: "#e6edf3", whiteSpace: "pre-wrap", border: "1px solid #30363d" }}>{result}</div>
              <div style={{ ...S.row, justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ ...S.muted, fontSize: 12 }}>{result.length} символов</span>
                {result.length > 500 && <span style={{ color: "#f85149", fontSize: 12 }}>⚠️ Превышает лимит Threads (500)</span>}
              </div>
            </div>
          ) : (
            <div style={{ ...S.center, height: 200, color: "#30363d", fontSize: 40, flexDirection: "column", gap: 12 }}>
              <span>✨</span>
              <span style={{ fontSize: 13, color: "#8b949e" }}>Результат появится здесь</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SCHEDULE VIEW ────────────────────────────────────────────────────────────
function ScheduleView({ accounts, toast, user }) {
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
    if (!window.confirm("Удалить все провальные посты?")) return;
    try {
      const r = await api.del("/api/posts/failed");
      toast.show(`🗑 Удалено ${r.deleted} постов`);
      load();
    } catch (err) { toast.show(err.message, "error"); }
  }

  async function schedule() {
    if (!accountId || !text) return toast.show("Выбери аккаунт и введи текст", "error");
    setSaving(true);
    try {
      await api.post("/api/posts", { account_id: parseInt(accountId), text, platforms, scheduled_at: `${date}T${time}:00+05:00` });
      toast.show("Пост запланирован!");
      setText(""); load();
    } catch (err) { toast.show(err.message, "error"); }
    finally { setSaving(false); }
  }

  // Обновить метрики поста принудительно
  async function refreshStats(postId) {
    try {
      const data = await api.get(`/api/posts/${postId}/stats`);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, metrics: data.metrics, last_stats_update: data.last_stats_update } : p));
    } catch { toast.show("Не удалось обновить метрики", "error"); }
  }

  async function publishNow() {
    if (!accountId || !text) return toast.show("Выбери аккаунт и введи текст", "error");
    setPublishingNow(true);
    try {
      const data = await api.post("/api/posts/publish-now", { account_id: parseInt(accountId), text, platforms });
      const allOk = data.results.every(r => r.ok);
      toast.show(allOk ? "✅ Опубликовано!" : "⚠️ Частично опубликовано — проверь логи", allOk ? "success" : "error");
      setText("");
    } catch (err) { toast.show(err.message, "error"); }
    finally { setPublishingNow(false); }
  }

  const STATUS_COLORS = { published: "#00d4aa", scheduled: "#79c0ff", failed: "#f85149", partially_failed: "#f0722a" };
  const STATUS_LABELS = { published: "Опубликован", scheduled: "Запланирован", failed: "Ошибка", partially_failed: "Частичная ошибка" };

  return (
    <div style={{ ...S.col, gap: 24 }}>
      <div style={S.h2}>📅 Планировщик</div>

      <div style={S.card}>
        <div style={{ ...S.h3, marginBottom: 16 }}>Новый пост</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ ...S.col, gap: 12 }}>
            <div>
              <label style={S.label}>Аккаунт</label>
              <select style={S.select} value={accountId} onChange={e => setAccountId(e.target.value)}>
                <option value="">— Выбери аккаунт —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </div>
            <div style={{ ...S.row, gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Дата</label>
                <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Время</label>
                <input style={S.input} type="time" value={time} onChange={e => setTime(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={S.label}>Платформы</label>
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
              <label style={S.label}>Текст поста</label>
              <textarea style={{ ...S.textarea, minHeight: 130 }} value={text} onChange={e => setText(e.target.value)} placeholder="Введи или вставь текст поста..." />
              <div style={{ ...S.row, justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 12, color: text.length > 500 ? "#f85149" : "#8b949e" }}>{text.length}/500</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ ...S.row, gap: 12, marginTop: 16 }}>
          <button onClick={schedule} style={{ ...S.btnPrimary, opacity: saving ? 0.7 : 1 }} disabled={saving}>
            {saving ? "Сохраняю..." : "📅 Запланировать"}
          </button>
          <button onClick={publishNow} style={{ ...S.btnGhost, opacity: publishingNow ? 0.7 : 1 }} disabled={publishingNow}>
            {publishingNow ? "Публикую..." : "⚡ Опубликовать сейчас"}
          </button>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 16 }}>
          <div style={S.h3}>Очередь постов</div>
          {posts.some(p => ["failed", "partially_failed"].includes(p.status)) && (
            <button onClick={deleteAllFailed} style={{ ...S.btnDanger, padding: "6px 12px", fontSize: 12 }}>🗑 Удалить все ошибки</button>
          )}
        </div>
        {loading ? <div style={S.muted}>Загрузка...</div> : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "#8b949e" }}>Нет запланированных постов</div>
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
                      <button onClick={async () => { await api.post(`/api/posts/${p.id}/retry`, {}); load(); toast.show("🔄 Повтор запланирован через 1 мин!"); }} style={{ ...S.btnGhost, padding: "4px 8px", fontSize: 11, borderColor: "#f0722a", color: "#f0722a" }}>↩ Повторить</button>
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
  const api = useApi();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ platform: "telegram", handle: "", name: "", color: "#00d4aa", icon: "📱", token: "", channel_id: "", threads_user_id: "" });
  const [autopilotOpen, setAutopilotOpen] = useState({}); // id → boolean
  const [autopilotForms, setAutopilotForms] = useState({}); // id → {autopilot_enabled, content_focus}
  const [savingAutopilot, setSavingAutopilot] = useState({});
  const [triggeringAutopilot, setTriggeringAutopilot] = useState({});

  function getAutopilotForm(a) {
    return autopilotForms[a.id] || { autopilot_enabled: a.autopilot_enabled || false, content_focus: a.content_focus || "" };
  }

  async function save(e) {
    e.preventDefault();
    try {
      const data = await api.post("/api/accounts", form);
      setAccounts(prev => [...prev, data.account]);
      setAdding(false);
      setForm({ platform: "telegram", handle: "", name: "", color: "#00d4aa", icon: "📱", token: "", channel_id: "", threads_user_id: "" });
      toast.show("Аккаунт добавлен!");
    } catch (err) { toast.show(err.message, "error"); }
  }

  async function remove(id) {
    if (!window.confirm("Удалить аккаунт?")) return;
    await api.del(`/api/accounts/${id}`);
    setAccounts(prev => prev.filter(a => a.id !== id));
    toast.show("Аккаунт удалён");
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
        <div style={S.h2}>📱 Аккаунты</div>
        <div style={{ ...S.row, gap: 8 }}>
          <button
            onClick={() => {
              const token = localStorage.getItem("accessToken");
              window.location.href = `${API_URL}/auth/threads/start?state=${encodeURIComponent(token)}`;
            }}
            style={{ ...S.btnGhost, fontSize: 12, padding: "10px 16px", borderColor: "#444", display: "flex", alignItems: "center", gap: 6 }}
          >
            🧵 Подключить Threads через Meta
          </button>
          <button
            onClick={() => {
              const token = localStorage.getItem("accessToken");
              window.location.href = `${API_URL}/auth/linkedin/start?state=${encodeURIComponent(token)}`;
            }}
            style={{ ...S.btnGhost, fontSize: 12, padding: "10px 16px", borderColor: "#0077B5", color: "#0077B5", display: "flex", alignItems: "center", gap: 6 }}
          >
            💼 Подключить LinkedIn
          </button>
          <button onClick={() => setAdding(!adding)} style={S.btnPrimary}>+ Добавить вручную</button>
        </div>
      </div>

      {adding && (
        <div style={S.card}>
          <div style={{ ...S.h3, marginBottom: 16 }}>Новый аккаунт</div>
          <form onSubmit={save}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={S.label}>Платформа</label>
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
                <label style={S.label}>Название аккаунта</label>
                <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="SellForce CRM" required />
              </div>
              <div>
                <label style={S.label}>Иконка (emoji)</label>
                <input style={S.input} value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="📱" />
              </div>
              <div>
                <label style={S.label}>{form.platform === "telegram" ? "Bot Token (опционально)" : "Access Token"}</label>
                {form.platform === "threads" ? (
                  <div style={{ background: "#00d4aa12", border: "1px solid #00d4aa44", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#00d4aa" }}>
                    ℹ️ Рекомендуем использовать кнопку «Давай Meta выше — токен сохранится автоматически на 60 дней».
                    <br /><span style={{ color: "#8b949e" }}>Мануально можно вставить токен ниже (1 час):</span>
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
              <button type="submit" style={S.btnPrimary}>Сохранить</button>
              <button type="button" onClick={() => setAdding(false)} style={S.btnGhost}>Отмена</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {accounts.length === 0 ? (
          <div style={{ ...S.card, textAlign: "center", color: "#8b949e", padding: 40 }}>Нет добавленных аккаунтов</div>
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
                <span style={{ fontSize: 12, fontWeight: 600, color: tsCfg.color }}>{tsCfg.label}</span>
                {daysLeft !== null && daysLeft >= 0 && (
                  <span style={{ ...S.muted, fontSize: 11, marginLeft: "auto" }}>Срок: {daysLeft} дн.</span>
                )}
                {daysLeft !== null && daysLeft < 0 && (
                  <span style={{ ...S.muted, fontSize: 11, marginLeft: "auto", color: "#f85149" }}>Истёк</span>
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
                🤖 {a.autopilot_enabled ? "Автопилот ВКЛ" : "Автопилот ВЫКЛ"} {isApOpen ? "▲" : "▼"}
              </button>

              {/* Панель автопилота */}
              {isApOpen && (
                <div style={{ marginTop: 12, padding: 14, background: "#0d1117", borderRadius: 10, border: "1px solid #21262d" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#e6edf3" }}>⚙️ Настройки Автопилота</div>

                  {/* Toggle */}
                  <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3" }}>Включить автопилот</div>
                      <div style={{ fontSize: 11, color: "#8b949e" }}>5 постов в день автоматически</div>
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
                    <label style={{ ...S.label, fontSize: 12 }}>О чём ваш блог? (темы, стиль, ключевые слова)</label>
                    <textarea
                      style={{ ...S.textarea, minHeight: 70, fontSize: 12 }}
                      value={apf.content_focus}
                      onChange={e => setAutopilotForms(s => ({ ...s, [a.id]: { ...apf, content_focus: e.target.value } }))}
                      placeholder="Например: B2B продажи в Узбекистане, CRM системы, автоматизация бизнеса, кейсы клиентов..."
                    />
                  </div>

                  <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 12 }}>
                    📅 Система генерирует 5 постов в день: 09:00, 12:00, 16:00, 19:00, 22:00 (Ташкент ±15 мин)
                  </div>

                  <div style={{ ...S.row, gap: 8 }}>
                    <button
                      onClick={() => saveAutopilot(a)}
                      disabled={savingAutopilot[a.id]}
                      style={{ ...S.btnPrimary, flex: 1, fontSize: 12, padding: "9px", opacity: savingAutopilot[a.id] ? 0.7 : 1 }}
                    >
                      {savingAutopilot[a.id] ? "Сохраняю..." : "💾 Сохранить"}
                    </button>
                    <button
                      onClick={() => triggerAutopilot(a)}
                      disabled={triggeringAutopilot[a.id]}
                      style={{ ...S.btnGhost, flex: 1, fontSize: 12, padding: "9px", opacity: triggeringAutopilot[a.id] ? 0.7 : 1 }}
                    >
                      {triggeringAutopilot[a.id] ? "Генерирую..." : "🚀 Запустить сейчас"}
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
  const api = useApi();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAgency = user?.plan === "agency";

  useEffect(() => {
    api.get("/api/posts/stats")
      .then(d => setPosts(d.posts))
      .catch(err => toast.show(err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

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
              <div style={{ color: "#666", fontSize: 13 }}>{user?.name} · Период: последние 30 дней · {new Date().toLocaleDateString("ru")}</div>
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

      <div style={{ ...S.row, justifyContent: "space-between" }}>
        <div style={S.h2}>📈 Аналитика постов</div>
        {isAgency ? (
          <button onClick={handlePrint} style={S.btnPrimary}>📄 Скачать PDF-отчёт</button>
        ) : (
          <button disabled title="Доступно только на тарифе Agency" style={{ ...S.btnGhost, opacity: 0.45, cursor: "not-allowed" }}>🔒 PDF-отчёт (Agency)</button>
        )}
      </div>

      {loading ? <div style={S.muted}>Загрузка...</div> : posts.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", color: "#8b949e", padding: 40 }}>Нет опубликованных постов. Метрики появятся после первой публикации.</div>
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
                      {Object.keys(m).length === 0 && <span style={{ ...S.muted, fontSize: 12 }}>Метрики ещё не собраны (обновятся в течение 4 ч.)</span>}
                    </div>
                    {isPartial && p.error_log && <div style={{ marginTop: 6, fontSize: 11, color: "#f0722a" }}>⚠️ {p.error_log}</div>}
                  </div>
                  {p.last_stats_update && (
                    <div style={{ ...S.muted, fontSize: 10, textAlign: "right", flexShrink: 0 }}>Обновлено:<br />{new Date(p.last_stats_update).toLocaleString("ru")}</div>
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
  const api = useApi();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/logs").then(d => setLogs(d.logs)).catch(() => { }).finally(() => setLoading(false));
  }, []);

  const TYPE_COLORS = { publish_success: "#00d4aa", publish_fail: "#f85149", ai_generate: "#79c0ff", account_added: "#d2a8ff", publish_now: "#00d4aa", publish_skip: "#8b949e" };

  return (
    <div style={{ ...S.col, gap: 20 }}>
      <div style={S.h2}>📊 Логи активности</div>
      <div style={S.card}>
        {loading ? <div style={S.muted}>Загрузка...</div> : logs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "#8b949e" }}>Нет записей в логах</div>
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

  if (loading) return <div style={S.muted}>Загрузка...</div>;

  return (
    <div style={{ ...S.col, gap: 24 }}>
      <div style={S.h2}>⚙️ Администратор</div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <StatCard icon="👥" label="Всего пользователей" value={stats.total_users} />
          <StatCard icon="✅" label="Активных" value={stats.active} />
          <StatCard icon="⏳" label="На триале" value={stats.trial} />
          <StatCard icon="📤" label="Всего постов" value={stats.total_posts} />
        </div>
      )}

      <div style={S.card}>
        <div style={{ ...S.h3, marginBottom: 16 }}>Пользователи</div>
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

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("generator");
  const [accounts, setAccounts] = useState([]);
  const [usage, setUsage] = useState(null);
  const [limits, setLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const api = useApi();

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
    schedule: <ScheduleView accounts={accounts} toast={toast} user={user} />,
    analytics: <AnalyticsView toast={toast} user={user} />,
    accounts: <AccountsView accounts={accounts} setAccounts={setAccounts} toast={toast} />,
    logs: <LogsView />,
    admin: <AdminView toast={toast} />,
  };

  return (
    <div style={{ ...S.page, ...S.row, alignItflex- start" }}>
  { toast.toast && <Toast key={toast.toast.ssage = { toast.toast.message } type={toast.toast.type} onClose={toast.clear} /> }
  <Sidebar user={user} active={view} onNaview} onLogout = { handleLogout } />
    <div style={{ flex: 1, padding: 32, minH "100vh", overflow: "auto" }}>
      {views[view] || views.generator}
    </div>
    </div >
  );
}