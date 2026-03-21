// src/services/auth.js — JWT + bcrypt
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET не задан в .env!");
  return secret;
}

const JWT_EXPIRES   = "15m";   // Access token — 15 минут
const REFRESH_DAYS  = 30;      // Refresh token — 30 дней

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, plan: user.plan },
    getSecret(),
    { expiresIn: JWT_EXPIRES }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function verifyAccessToken(token) {
  try { return jwt.verify(token, getSecret()); }
  catch { return null; }
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function checkPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function getRefreshExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_DAYS);
  return d;
}

module.exports = {
  generateAccessToken, generateRefreshToken,
  verifyAccessToken, hashPassword, checkPassword, getRefreshExpiry,
};
