import React, { useState } from 'react';
import { S } from '../utils/theme';
import { API_URL } from '../hooks/useApi';

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");

  async function handle(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const body = isRegister ? { email, password, name } : { email, password };
      const res = await fetch(API_URL + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ ...S.center, background: "radial-gradient(ellipse at center, #0d1f2d 0%, #060b10 70%)" }}>
      <div style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
          <div style={{ ...S.h1, fontSize: 28 }}>SellForce AI</div>
          <div style={{ ...S.muted, marginTop: 6 }}>Автопостинг в Threads и Telegram</div>
        </div>

        <div style={S.card}>
          <div style={{ ...S.h3, marginBottom: 24, textAlign: "center" }}>
            {isRegister ? "Создать аккаунт" : "Вход в систему"}
          </div>

          <form onSubmit={handle}>
            <div style={{ ...S.col, ...S.gap(16) }}>
              {isRegister && (
                <div>
                  <label style={S.label}>Имя</label>
                  <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="Алибек Юсупов" required />
                </div>
              )}
              <div>
                <label style={S.label}>Email</label>
                <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div>
                <label style={S.label}>Пароль</label>
                <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Минимум 8 символов" required />
              </div>

              {error && <div style={{ color: "#f85149", fontSize: 13, textAlign: "center" }}>{error}</div>}

              <button type="submit" style={{ ...S.btnPrimary, width: "100%", opacity: loading ? 0.7 : 1 }} disabled={loading}>
                {loading ? "Загрузка..." : isRegister ? "Зарегистрироваться" : "Войти"}
              </button>
            </div>
          </form>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button onClick={() => { setIsRegister(!isRegister); setError(""); }} style={{ ...S.btnGhost, border: "none", fontSize: 13 }}>
              {isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
