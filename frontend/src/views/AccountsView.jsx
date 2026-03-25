import React, { useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { useApi, API_URL } from '../hooks/useApi';
import { S } from '../utils/theme';
import { Badge } from '../components/Badge';

// ─── TOKEN STATUS HELPER ──────────────────────────────────────────
function getTokenStatus(account) {
  if (account.platform === "telegram") return "active"; 
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
export function AccountsView({ accounts, setAccounts, toast }) {
  const { t } = useI18n();
  const api = useApi();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ platform: "telegram", handle: "", name: "", color: "#00d4aa", icon: "📱", token: "", channel_id: "", threads_user_id: "" });
  const [autopilotOpen, setAutopilotOpen] = useState({}); 
  const [autopilotForms, setAutopilotForms] = useState({}); 
  const [savingAutopilot, setSavingAutopilot] = useState({});
  const [triggeringAutopilot, setTriggeringAutopilot] = useState({});

  function getAutopilotForm(a) {
    return autopilotForms[a.id] || { 
      autopilot_enabled: a.autopilot_enabled || false, 
      content_focus: a.content_focus || "", 
      custom_prompt: a.custom_prompt || "",
      autopilot_times: Array.isArray(a.autopilot_times) ? a.autopilot_times : ["09:00", "12:00", "16:00", "19:00", "22:00"]
    };
  }

  async function save(e) {
    e.preventDefault();
    try {
      const data = await api.post("/api/accounts", form);
      setAccounts(prev => [...prev, data.account]);
      setAdding(false);
      setForm({ platform: "telegram", handle: "", name: "", color: "#00d4aa", icon: "📱", token: "", channel_id: "", threads_user_id: "" });
      toast.show(t("sch_success_plan") ? "Аккаунт добавлен!" : "Аккаунт добавлен!"); 
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
        autopilot_times: f.autopilot_times,
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

              {isApOpen && (
                <div style={{ marginTop: 12, padding: 14, background: "#0d1117", borderRadius: 10, border: "1px solid #21262d" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "#e6edf3" }}>{t("acc_ap_settings")}</div>

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

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ ...S.label, fontSize: 12 }}>{t("acc_ap_focus")}</label>
                    <textarea
                      style={{ ...S.textarea, minHeight: 70, fontSize: 12 }}
                      value={apf.content_focus}
                      onChange={e => setAutopilotForms(s => ({ ...s, [a.id]: { ...apf, content_focus: e.target.value } }))}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ ...S.label, fontSize: 12 }}>{t("acc_ap_prompt")}</label>
                    <textarea
                      style={{ ...S.textarea, minHeight: 70, fontSize: 12 }}
                      value={apf.custom_prompt}
                      onChange={e => setAutopilotForms(s => ({ ...s, [a.id]: { ...apf, custom_prompt: e.target.value } }))}
                    />
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e6edf3", marginBottom: 8 }}>
                    Расписание постов ({apf.autopilot_times.length} в день)
                  </div>
                  <div style={{ ...S.row, gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    {apf.autopilot_times.map((time, idx) => (
                      <div key={idx} style={{ ...S.row, background: "#161b22", padding: "4px 8px", borderRadius: 6, border: "1px solid #30363d" }}>
                        <input 
                          type="time" 
                          value={time}
                          onChange={(e) => {
                            const newTimes = [...apf.autopilot_times];
                            newTimes[idx] = e.target.value;
                            setAutopilotForms(s => ({ ...s, [a.id]: { ...apf, autopilot_times: newTimes } }));
                          }}
                          style={{ background: "transparent", border: "none", color: "#e6edf3", fontSize: 13, outline: "none" }}
                        />
                        <button 
                          onClick={() => {
                            const newTimes = apf.autopilot_times.filter((_, i) => i !== idx);
                            setAutopilotForms(s => ({ ...s, [a.id]: { ...apf, autopilot_times: newTimes } }));
                          }}
                          style={{ background: "none", border: "none", color: "#f85149", cursor: "pointer", fontSize: 14, padding: "0 4px" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {apf.autopilot_times.length < 10 && (
                      <button
                        onClick={() => {
                          setAutopilotForms(s => ({ ...s, [a.id]: { ...apf, autopilot_times: [...apf.autopilot_times, "12:00"] } }));
                        }}
                        style={{ ...S.btnGhost, padding: "4px 8px", fontSize: 12 }}
                      >
                        + Добавить время
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 12 }}>
                    Система генерирует посты по указанным часам (±10 мин для реалистичности).
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
