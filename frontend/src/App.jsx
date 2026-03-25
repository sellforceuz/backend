import React, { useState, useEffect } from 'react';
import { useWindowSize } from './hooks/useWindowSize';
import { useApi, API_URL } from './hooks/useApi';
import { useToast, Toast } from './hooks/useToast';
import { S } from './utils/theme';
import { I18nContext, I18nProvider, useI18n } from './context/I18nContext';

import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';

import { ContentHubView } from './views/ContentHubView';
import { SmartRepliesView } from './views/SmartRepliesView';
import { AnalyticsView } from './views/AnalyticsView';
import { AccountsView } from './views/AccountsView';
import { LogsView } from './views/LogsView';
import { AdminView } from './views/AdminView';

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

function AppContent() {
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [view, setView] = useState("schedule");
  const [accounts, setAccounts] = useState([]);
  const [usage, setUsage] = useState(null);
  const [limits, setLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toast = useToast();
  const api = useApi();
  const winW = useWindowSize();
  const isMobile = winW < 768;

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { setLoading(false); return; }
    api.get("/auth/me").then(d => {
      setUser(d.user);
    }).catch(() => {
      localStorage.clear();
    }).finally(() => setLoading(false));
  }, []);

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
    schedule: <ContentHubView accounts={accounts} usage={usage} limits={limits} toast={toast} user={user} />,
    smart_replies: <SmartRepliesView accounts={accounts} toast={toast} />,
    analytics: <AnalyticsView toast={toast} user={user} />,
    accounts: <AccountsView accounts={accounts} setAccounts={setAccounts} toast={toast} />,
    logs: <LogsView />,
    admin: <AdminView toast={toast} />,
  };

  const viewLabels = { schedule: t("schedule"), smart_replies: t("smart_replies"), analytics: t("analytics"), accounts: t("accounts"), logs: t("logs"), admin: t("admin") };

  return (
    <div style={{ ...S.page, minHeight: "100vh" }}>
      {toast.toast && <Toast key={toast.toast.id} message={toast.toast.message} type={toast.toast.type} onClose={toast.clear} />}

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
          {views[view] || views.schedule}
        </div>
      </div>

      {isMobile && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d1117", borderTop: "1px solid #21262d", display: "flex", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {[{ id: "schedule", icon: "🗓️" }, { id: "smart_replies", icon: "💬" }, { id: "analytics", icon: "📈" }, { id: "accounts", icon: "📱" }].map(item => (
            <button key={item.id} onClick={() => setView(item.id)} style={{ flex: 1, background: "none", border: "none", color: view === item.id ? "#00d4aa" : "#8b949e", fontSize: 22, padding: "12px 0 10px", cursor: "pointer", borderTop: view === item.id ? "2px solid #00d4aa" : "2px solid transparent", transition: "all .15s" }}>
              {item.icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}