// src/index.js — точка входа сервера
require("dotenv").config();
console.log("[Startup] Loading modules...");
const express = require("express");
const cors    = require("cors");

let initDB, Users, Workspaces, Accounts, startScheduler, startAutoPoster, hashPassword;
try {
  ({ initDB, Users, Workspaces, Accounts } = require("./db"));
  console.log("[Startup] ✅ db.js loaded");
} catch (e) { console.error("[Startup] ❌ db.js failed:", e.message); process.exit(1); }

try {
  ({ hashPassword } = require("./services/auth"));
  console.log("[Startup] ✅ services/auth loaded");
} catch (e) { console.error("[Startup] ❌ services/auth failed:", e.message); process.exit(1); }

try {
  ({ startScheduler } = require("./jobs/scheduler"));
  console.log("[Startup] ✅ scheduler.js loaded");
} catch (e) { console.error("[Startup] ❌ scheduler.js failed:", e.message); process.exit(1); }

try {
  ({ startAutoPoster } = require("./jobs/autoposter"));
  console.log("[Startup] ✅ autoposter.js loaded");
} catch (e) { console.warn("[Startup] ⚠️ autoposter.js skipped:", e.message); startAutoPoster = () => {}; }



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

// ─── THREADS OAUTH CALLBACK (must be before /auth router) ────────────────────────────────
app.get("/auth/threads/callback", async (req, res) => {
  console.log("[Threads OAuth] callback hit, code:", req.query.code ? "present" : "missing");
  const { code } = req.query;
  if (!code) return res.send("<h2>❌ Код не найден</h2>");
  try {
    const fetch = require("node-fetch");
    const params = new URLSearchParams({
      client_id: "925519976744188",
      client_secret: process.env.THREADS_APP_SECRET || "",
      grant_type: "authorization_code",
      redirect_uri: "https://backend-production-49e4.up.railway.app/auth/threads/callback",
      code,
    });
    const r = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await r.json();
    console.log("[Threads OAuth] response:", JSON.stringify(data).slice(0, 200));
    if (data.error) return res.send(`<h2>❌ ${data.error.message}</h2><pre>${JSON.stringify(data,null,2)}</pre>`);
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Threads Token</title>
      <style>body{font-family:monospace;padding:32px;background:#0d1117;color:#e6edf3}
      .box{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:20px;margin:12px 0}
      h2{color:#00d4aa}.val{word-break:break-all;color:#79c0ff;margin-top:8px}</style></head>
      <body><h2>✅ Токен получен!</h2>
      <div class="box"><b>Threads User ID:</b><div class="val">${data.user_id}</div></div>
      <div class="box"><b>Access Token:</b><div class="val">${data.access_token}</div></div>
      <p>Скопируй оба значения и добавь аккаунт в SellForce</p></body></html>`);
  } catch (err) {
    console.error("[Threads OAuth] error:", err.message);
    res.send(`<h2>❌ Ошибка: ${err.message}</h2>`);
  }
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
try { app.use("/auth",  require("./routes/auth")); console.log("[Startup] ✅ auth routes"); }
catch (e) { console.error("[Startup] ❌ routes/auth failed:", e.message); }

try { app.use("/api",   require("./routes/api")); console.log("[Startup] ✅ api routes"); }
catch (e) { console.error("[Startup] ❌ routes/api failed:", e.message); }

try { app.use("/admin", require("./routes/admin")); console.log("[Startup] ✅ admin routes"); }
catch (e) { console.error("[Startup] ❌ routes/admin failed:", e.message); }


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
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("Server listening on port " + PORT);
  });

  // FIX #5: Graceful shutdown — корректное завершение при SIGTERM/SIGINT (Docker, Railway)
  function shutdown(signal) {
    console.log(`${signal} received, graceful shutdown...`);
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
    // Принудительный выход через 10 сек если сервер не закрылся
    setTimeout(() => { console.error("Forced exit"); process.exit(1); }, 10000);
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));

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
