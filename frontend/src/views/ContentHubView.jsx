import React, { useState, useEffect } from 'react';
import { useI18n } from '../context/I18nContext';
import { useApi } from '../hooks/useApi';
import { S } from '../utils/theme';
import { Badge } from '../components/Badge';

export function ContentHubView({ accounts, usage, limits, toast, user }) {
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

  // AI Settings
  const [isAiMode, setIsAiMode] = useState(false);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("авторский");
  const [format, setFormat] = useState("");
  const [idea, setIdea] = useState("");
  const [generating, setGenerating] = useState(false);

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

  async function generateAI() {
    if (!topic) return toast.show(t("gen_err_topic"), "error");
    setGenerating(true);
    try {
      const data = await api.post("/api/generate", { account_id: accountId ? parseInt(accountId) : null, topic, tone, format, idea });
      setText(data.text);
      setIsAiMode(false);
      toast.show(t("gen_success"));
    } catch (err) {
      toast.show(err.message, "error");
    } finally {
      setGenerating(false);
    }
  }

  const STATUS_COLORS = { published: "#00d4aa", scheduled: "#79c0ff", failed: "#f85149", partially_failed: "#f0722a" };
  const STATUS_LABELS = { published: t("status_pub"), scheduled: t("status_sch"), failed: t("status_err"), partially_failed: t("status_part_err") };
  const pct = limits ? Math.round((usage?.generations || 0) / limits.generationsPerMonth * 100) : 0;

  return (
    <div style={{ ...S.col, gap: 24 }}>
      <div style={{ ...S.row, justifyContent: "space-between" }}>
        <div style={S.h2}>Контент Хаб</div>
        <div style={{ ...S.card, padding: "10px 16px" }}>
          <span style={S.muted}>{t("gen_usage")}</span>
          <span style={{ fontWeight: 700, color: pct > 80 ? "#f85149" : "#00d4aa" }}>{usage?.generations || 0}/{limits?.generationsPerMonth || "?"}</span>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 16 }}>
          <div style={S.h3}>{t("sch_new_post")}</div>
          <button 
            onClick={() => setIsAiMode(!isAiMode)} 
            style={{ ...S.btnGhost, borderColor: isAiMode ? "#00d4aa" : "#30363d", color: isAiMode ? "#00d4aa" : "#8b949e", padding: "6px 12px", fontSize: 13 }}
          >
            ✨ AI Генератор
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isAiMode ? "1fr 1fr" : "1fr", gap: 16 }}>
          
          {isAiMode && (
            <div style={{ ...S.col, gap: 12, paddingRight: 16, borderRight: "1px solid #21262d" }}>
              <div>
                <label style={S.label}>{t("gen_topic_label")}</label>
                <input style={S.input} value={topic} onChange={e => setTopic(e.target.value)} placeholder={t("gen_topic_ph")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
              </div>
              <div>
                <label style={S.label}>{t("gen_idea_label")}</label>
                <textarea style={{ ...S.textarea, minHeight: 60 }} value={idea} onChange={e => setIdea(e.target.value)} placeholder={t("gen_idea_ph")} />
              </div>
              <button onClick={generateAI} style={{ ...S.btnPrimary, opacity: generating ? 0.7 : 1, marginTop: 4 }} disabled={generating}>
                {generating ? t("gen_btn_load") : "✨ Сгенерировать текст"}
              </button>
            </div>
          )}

          <div style={{ ...S.col, gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={S.label}>{t("sch_acc")}</label>
                <select style={S.select} value={accountId} onChange={e => setAccountId(e.target.value)}>
                  <option value="">{t("sch_acc_none")}</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>{t("sch_date")}</label>
                <input style={S.input} type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
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
            <div>
              <label style={S.label}>{t("sch_text")}</label>
              <textarea style={{ ...S.textarea, minHeight: 130 }} value={text} onChange={e => setText(e.target.value)} placeholder={t("sch_text_ph")} />
              <div style={{ ...S.row, justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 12, color: text.length > 500 ? "#f85149" : "#8b949e" }}>{text.length}/500</span>
              </div>
            </div>
          </div>

        </div>
        <div style={{ ...S.row, gap: 12, marginTop: 16, justifyContent: isAiMode ? "flex-end" : "flex-start" }}>
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
