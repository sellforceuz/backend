import React, { useState, useEffect } from 'react';

export function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, background: type === "success" ? "#00d4aa22" : "#f8514922", border: `1px solid ${type === "success" ? "#00d4aa" : "#f85149"}`, color: type === "success" ? "#00d4aa" : "#f85149", padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14, maxWidth: 340 }}>
      {message}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = (message, type = "success") => setToast({ message, type, id: Date.now() });
  const clear = () => setToast(null);
  return { toast, show, clear };
}
