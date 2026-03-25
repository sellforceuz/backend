import React, { useState, useEffect } from 'react';
import { useI18n } from '../context/I18nContext';
import { useApi } from '../hooks/useApi';
import { S } from '../utils/theme';
import { Badge } from '../components/Badge';

export function LogsView() {
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
