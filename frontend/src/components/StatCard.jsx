import React from 'react';
import { S } from '../utils/theme';

export function StatCard({ icon, label, value, sub }) {
  return (
    <div style={{ ...S.card, flex: 1 }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#e6edf3" }}>{value}</div>
      <div style={{ fontSize: 13, color: "#e6edf3", fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "#8b949e", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
