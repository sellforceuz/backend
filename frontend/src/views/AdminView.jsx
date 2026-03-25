import React, { useState, useEffect } from 'react';
import { useI18n } from '../context/I18nContext';
import { useApi } from '../hooks/useApi';
import { S } from '../utils/theme';
import { Badge } from '../components/Badge';
import { StatCard } from '../components/StatCard';

export function AdminView({ toast }) {
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
