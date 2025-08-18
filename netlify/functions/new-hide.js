// netlify/functions/news-hide.js
import { query, cors } from "./_db.js";

export default async (req) => {
  if (req.method === "OPTIONS") return cors({}, 204);
  if (req.method !== "POST") return cors({ error: "method not allowed" }, 405);

  // Используем общий секрет (или создайте отдельный NEWS_ADMIN_SECRET)
  const expected = process.env.TG_NOWADAYS_WEBHOOK_SECRET;
  const url = new URL(req.url);
  const secret = req.headers.get("x-admin-secret") || url.searchParams.get("secret");
  if (!expected || secret !== expected) return cors({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const { chat_id, message_id, link, hidden = true } = body;

  let where = "", params = [];
  if (chat_id && message_id) {
    where = "chat_id = $2 and message_id = $3";
    params = [!!hidden, chat_id, message_id];
  } else if (link) {
    where = "link = $2";
    params = [!!hidden, link];
  } else {
    return cors({ error: "bad request" }, 400);
  }

  await query(`update tg_posts set is_deleted = $1 where ${where}`, params);
  return cors({ ok: true });
};
