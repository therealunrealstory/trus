import { query, cors } from "./_db.js";

/**
 * Telegram webhook handler:
 * - принимает channel_post
 * - проверяет секрет (и через query, и через заголовок)
 * - пишет в tg_posts
 */
export default async (req) => {
  try {
    if (req.method === "OPTIONS") return cors({}, 204);
    if (req.method !== "POST") return cors({ ok: true });

    const url = new URL(req.url);
    const secretQuery = url.searchParams.get("secret");
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    const expected = process.env.TG_NOWADAYS_WEBHOOK_SECRET;
    if (!expected || (secretQuery !== expected && secretHeader !== expected)) {
      return cors({ error: "forbidden" }, 403);
    }

    const update = await req.json();
    const post = update.channel_post;
    if (!post) return cors({ ok: true });

    const chat = post.chat || {};
    const chat_id = chat.id || null;
    const username = chat.username || null;

    const message_id = post.message_id;
    const date = new Date((post.date || 0) * 1000).toISOString();
    const text = post.text || post.caption || "";
    const link = username ? `https://t.me/${username}/${message_id}` : null;

    await query(
      `insert into tg_posts (chat_id, message_id, date, username, text, link)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (chat_id, message_id) do nothing`,
      [chat_id, message_id, date, username, text, link]
    );

    return cors({ ok: true });
  } catch (e) {
    console.error("tg-webhook error:", e);
    return cors({ error: "server error" }, 500);
  }
};
