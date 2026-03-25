import React, { useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { useApi } from '../hooks/useApi';
import { S } from '../utils/theme';

export function SmartRepliesView({ accounts, toast }) {
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
