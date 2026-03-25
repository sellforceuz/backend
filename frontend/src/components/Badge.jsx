import React from 'react';

export function Badge({ label, color = "#00d4aa" }) {
  return <span style={{ background: color + "22", color, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{label}</span>;
}
