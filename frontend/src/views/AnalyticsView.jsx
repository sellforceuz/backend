import React, { useState, useEffect } from 'react';
import { useI18n } from '../context/I18nContext';
import { useApi, API_URL } from '../hooks/useApi';
import { S } from '../utils/theme';
import { Badge } from '../components/Badge';

export function AnalyticsView({ toast, user }) {
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
