// src/index.js — точка входа сервера
require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { initDB, Users, Workspaces, Accounts } = require("./db");
const { hashPassword } = require("./services/auth");
const { startScheduler } = require("./jobs/scheduler");
const { startAutoPoster } = require("./jobs/autoposter");

// ─── SEED TELEGRAM ACCOUNTS ───────────────────────────────────────────────────
async function seedAccounts() {
  // Находим workspace admin-а
  const admin = await Users.findByEmail(process.env.ADMIN_EMAIL || "amirmuxt12@gmail.com");
  if (!admin) return;
  const ws = await Workspaces.getByUserId(admin.id);
  if (!ws) return;

  const existing = await Accounts.getAll(ws.id);
  const existingHandles = existing.map(a => a.handle);

  const defaultAccounts = [
    {
      platform: "telegram", handle: "@sellforce_uz_academy",
      name: "Sellforce Academy", icon: "🎓", color: "#00d4aa",
      channel_id: "-1003711704639",
    },
    {
      platform: "telegram", handle: "@sellforce_uz_crm",
      name: "Sellforce / Систематизация бизнеса", icon: "📊", color: "#a78bfa",
      channel_id: "-1003715663210",
    },
    {
      platform: "telegram", handle: "@amir_sales_channel",
      name: "ПроПродажи | Sales with Amir", icon: "🏆", color: "#f0c040",
      channel_id: "-1002649517321",
    },
  ];

  for (const acc of defaultAccounts) {
    if (!existingHandles.includes(acc.handle)) {
      await Accounts.create(ws.id, acc);
      console.log("Seeded account: " + acc.handle);
    }
  }
}

const app  = express();
const PORT = process.env.PORT || 3001;

// Нужно для Railway/Heroku — они используют reverse proxy
app.set("trust proxy", 1);

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

// ─── HEALTH CHECK (отвечает сразу — до инициализации БД) ─────────────────────
app.get("/health", (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use("/auth",  require("./routes/auth"));
app.use("/api",   require("./routes/api"));
app.use("/admin", require("./routes/admin"));

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

// ─── START ────────────────────────────────────────────────────────────────────
async function start() {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET не задан!");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан!");
    process.exit(1);
  }

  // Запускаем HTTP-сервер СРАЗУ — Railway healthcheck пройдёт без ожидания БД
  app.listen(PORT, "0.0.0.0", () => {
    console.log("Server listening on port " + PORT);
  });

  // Инициализируем БД и admin асинхронно
  try {
    await initDB();

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
        console.log("Admin created: " + process.env.ADMIN_EMAIL);
      }
    }

    startScheduler();
    startAutoPoster();

    // Засеять аккаунты Telegram-каналов если их ещё нет
    await seedAccounts();

    console.log("DB ready, scheduler and autoposter started");
  } catch (err) {
    console.error("Init error:", err.message);
  }
}

start();
