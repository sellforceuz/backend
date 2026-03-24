// src/services/linkedin.js — публикация в LinkedIn через API v2
const fetch = require("node-fetch");

const BASE = "https://api.linkedin.com/v2";

async function getProfile(token) {
  const res = await fetch(`${BASE}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.error) throw new Error(`LinkedIn profile: ${data.error}`);
  // sub = LinkedIn member URN id (e.g. "abc123")
  return { id: data.sub, name: data.name, email: data.email };
}

async function publishPost(personUrn, token, text) {
  if (!token || !personUrn) throw new Error("Нет токена или personUrn для LinkedIn");

  const cleanText = (text || "").trim();
  if (!cleanText) throw new Error("LinkedIn: текст поста не может быть пустым");

  console.log(`[LinkedIn] 🚀 Публикуем для URN: ${personUrn} | Текст: ${cleanText.slice(0, 50)}...`);

  const body = {
    author: `urn:li:person:${personUrn}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: cleanText },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const res = await fetch(`${BASE}/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  console.log(`[LinkedIn] 📬 Response ${res.status}:`, responseText.slice(0, 200));

  if (!res.ok) {
    const errData = JSON.parse(responseText || "{}");
    const msg = errData.message || errData.error || `HTTP ${res.status}`;
    throw new Error(`LinkedIn publish: ${msg}`);
  }

  const postId = res.headers.get("x-restli-id") || "unknown";
  console.log(`[LinkedIn] ✅ Опубликовано! Post ID: ${postId}`);
  return { post_id: postId };
}

module.exports = { publishPost, getProfile };
