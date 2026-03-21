// src/index.js — точка входа сервера
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { initDB, Users, Workspaces } = require("./db");
const { hashPassword } = require("./services/auth");
const { startScheduler } = require("./jobs/scheduler");

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || "*").split(",").map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error("CORS blocked: " + origin));
  },
  credentials: true,
}));

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use("/auth",  require("./routes/auth"));
app.use("/api",   require("./routes/api"));
app.use("/admin", require("./routes/admin"));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("❌", err.message);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

// ─── START ────────────────────────────────────────────────────────────────────
async function start() {
  // Проверяем обязательные переменные
  if (!process.env.JWT_SECRET) {
    console.error("❌ JWT_SECRET не задан! Добавь в .env");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL не задан! Добавь в .env");
    process.exit(1);
  }

  await initDB();

  // Создать admin-аккаунт если не существует
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const existing = await Users.findByEmail(process.env.ADMIN_EMAIL);
    if (!existing) {
      const passwordHash = await hashPassword(process.env.ADMIN_PASSWORD);
      const admin = await Users.create({
        email: process.env.ADMIN_EMAIL,
        passwordHash,
        name: "Admin",
        role: "admin",
        plan: "agency",
      });
      await Workspaces.create(admin.id, "Admin workspace");
      console.log(`✅ Admin создан: ${process.env.ADMIN_EMAIL}`);
    }
  }

  startScheduler();

  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`   Среда: ${process.env.NODE_ENV || "development"}`);
  });
}

start().catch(err => {
  console.error("❌ Ошибка запуска:", err);
  process.exit(1);
});
