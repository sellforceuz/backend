// src/routes/admin.js — управление платформой (только для adminов)
const express = require("express");
const router = express.Router();
const { Users, Workspaces } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { hashPassword } = require("../services/auth");

router.use(requireAuth, requireAdmin);

// GET /admin/users — все пользователи
router.get("/users", async (req, res) => {
  try {
    const users = await Users.getAll();
    // Убираем хеш пароля из ответа
    const safe = users.map(({ password_hash, ...u }) => u);
    res.json({ users: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admin/users/:id — обновить тариф или статус
router.patch("/users/:id", async (req, res) => {
  try {
    const { plan, status } = req.body;
    const targetId = parseInt(req.params.id);

    // Нельзя заблокировать самого себя
    if (status === "blocked" && targetId === req.user.userId) {
      return res.status(400).json({ error: "Нельзя заблокировать свой аккаунт" });
    }

    if (plan) await Users.updatePlan(targetId, plan);
    if (status) await Users.updateStatus(targetId, status);

    const user = await Users.findById(targetId);
    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/users — создать пользователя вручную
router.post("/users", async (req, res) => {
  try {
    const { email, password, name, plan = "starter", role = "user" } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: "Укажи email, password и name" });

    const existing = await Users.findByEmail(email);
    if (existing) return res.status(400).json({ error: "Email уже используется" });

    const passwordHash = await hashPassword(password);
    const user = await Users.create({ email, passwordHash, name, role, plan });
    await Workspaces.create(user.id, `${name}'s workspace`);

    const { password_hash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/stats — статистика платформы
router.get("/stats", async (req, res) => {
  try {
    const users = await Users.getAll();
    const stats = {
      total_users: users.length,
      active: users.filter(u => u.status === "active").length,
      trial: users.filter(u => u.status === "trial").length,
      blocked: users.filter(u => u.status === "blocked").length,
      plans: {
        starter: users.filter(u => u.plan === "starter").length,
        pro: users.filter(u => u.plan === "pro").length,
        agency: users.filter(u => u.plan === "agency").length,
      },
      total_posts: users.reduce((sum, u) => sum + (parseInt(u.total_posts) || 0), 0),
      total_accounts: users.reduce((sum, u) => sum + (parseInt(u.total_accounts) || 0), 0),
    };
    res.json({ stats, users: users.map(({ password_hash, ...u }) => u) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
