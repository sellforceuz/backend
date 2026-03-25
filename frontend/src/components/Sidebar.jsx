import React from 'react';
import { S } from '../utils/theme';
import { useI18n } from '../context/I18nContext';

export function Sidebar({ user, active, onNav, onLogout, isMobile, isOpen, onClose }) {
  const { t, lang, changeLang } = useI18n();

  const items = [
    { id: "schedule", icon: "🗓️", label: t("schedule") },
    { id: "smart_replies", icon: "💬", label: t("smart_replies") },
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
