import { query, cors } from "./_db.js";

/** GET /news?limit=30 — последние N постов из БД */
export default async (req) => {
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);
    const { rows } = await query(
      `select chat_id, message_id, date, username, text, link, media_type, media_path
       from tg_posts
       order by date desc
       limit $1`,
      [limit]
    );
    return cors(rows);
  } catch (e) {
    console.error("news error:", e);
    return cors({ error: "server error" }, 500);
  }
};
