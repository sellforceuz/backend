export const S = {
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
