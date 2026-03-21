// src/routes/auth.js — регистрация, логин, токены
const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { Users, Workspaces, RefreshTokens } = require("../db");
const {
  generateAccessToken, generateRefreshToken,
  verifyAccessToken, hashPassword, checkPassword, getRefreshExpiry,
} = require("../services/auth");

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Слишком много попыток, подождите 15 минут" } });

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: "Заполни все поля" });
    if (password.length < 8) return res.status(400).json({ error: "Пароль минимум 8 символов" });

    const existing = await Users.findByEmail(email);
    if (existing) return res.status(400).json({ error: "Email уже зарегистрирован" });

    const passwordHash = await hashPassword(password);
    const user = await Users.create({ email, passwordHash, name });
    await Workspaces.create(user.id, `${name}'s workspace`);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await RefreshTokens.create(user.id, refreshToken, getRefreshExpiry());

    const { password_hash, ...safeUser } = user;
    res.json({ accessToken, refreshToken, user: safeUser });
  } catch (err) {
    console.error("register:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /auth/login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Укажи email и пароль" });

    const user = await Users.findByEmail(email);
    if (!user) return res.status(401).json({ error: "Неверный email или пароль" });

    const ok = await checkPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Неверный email или пароль" });

    if (user.status === "blocked") return res.status(403).json({ error: "Аккаунт заблокирован" });

    await Users.updateLastLogin(user.id);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await RefreshTokens.create(user.id, refreshToken, getRefreshExpiry());

    const { password_hash, ...safeUser } = user;
    res.json({ accessToken, refreshToken, user: safeUser });
  } catch (err) {
    console.error("login:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /auth/refresh
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "Нет refresh токена" });

    const stored = await RefreshTokens.find(refreshToken);
    if (!stored) return res.status(401).json({ error: "Токен недействителен" });

    const user = await Users.findById(stored.user_id);
    if (!user) return res.status(401).json({ error: "Пользователь не найден" });

    await RefreshTokens.delete(refreshToken);
    const newAccess = generateAccessToken(user);
    const newRefresh = generateRefreshToken();
    await RefreshTokens.create(user.id, newRefresh, getRefreshExpiry());

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /auth/logout
router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await RefreshTokens.delete(refreshToken);
  res.json({ ok: true });
});

// GET /auth/me
router.get("/me", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Нет токена" });
    const payload = verifyAccessToken(auth.slice(7));
    if (!payload) return res.status(401).json({ error: "Токен истёк" });

    const user = await Users.findById(payload.userId);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });

    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router;
