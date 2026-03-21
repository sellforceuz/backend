// src/middleware/auth.js — проверка JWT и прав
const { verifyAccessToken } = require("../services/auth");
const { Workspaces, Usage, PLAN_LIMITS } = require("../db");

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Нет токена" });

  const token = auth.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) return res.status(401).json({ error: "Токен недействителен или истёк" });

  const workspace = await Workspaces.getByUserId(payload.userId);
  req.user = payload;
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
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireAuth, requireAdmin, checkLimit };
