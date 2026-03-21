// src/middleware/auth.js — проверка JWT и прав
const { verifyAccessToken } = require("../services/auth");
const { Workspaces, Usage, PLAN_LIMITS, Users, pool } = require("../db");

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Нет токена" });

  const token = auth.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) return res.status(401).json({ error: "Токен недействителен или истёк" });

  // FIX #7: Проверяем статус пользователя — заблокированный не получает доступ
  const user = await Users.findById(payload.userId);
  if (!user || user.status === "blocked") {
    return res.status(403).json({ error: "Аккаунт заблокирован или не найден" });
  }

  const workspace = await Workspaces.getByUserId(payload.userId);
  req.user = { ...payload, status: user.status, plan: user.plan };
  req.workspaceId = workspace?.id;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Нет доступа" });
  next();
}

function checkLimit(limitType) {
  return async (req, res, next) => {
    try {
      const usage = await Usage.getMonth(req.workspaceId);
      const limits = PLAN_LIMITS[req.user.plan] || PLAN_LIMITS.starter;

      if (limitType === "generation") {
        if (usage.generations >= limits.generationsPerMonth) {
          return res.status(429).json({ error: `Лимит генераций (${limits.generationsPerMonth}/мес) исчерпан` });
        }
      }

      // FIX #6: Проверка лимита постов в день
      if (limitType === "post") {
        const today = new Date().toISOString().slice(0, 10);
        const r = await pool.query(
          "SELECT COUNT(*) FROM posts WHERE workspace_id=$1 AND created_at::date=$2",
          [req.workspaceId, today]
        );
        const count = parseInt(r.rows[0].count, 10);
        if (count >= limits.postsPerDay) {
          return res.status(429).json({ error: `Лимит постов (${limits.postsPerDay}/день) исчерпан` });
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireAuth, requireAdmin, checkLimit };
