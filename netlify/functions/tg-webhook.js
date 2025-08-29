import { query, cors } from "./_db.js";

/** Получить file_path по file_id (без раскрытия токена наружу) */
async function getFilePath(file_id) {
  try {
    const token = process.env.TELEGRAM_NOWADAYS_BOT_TOKEN;
    if (!token) return null;
    const r = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(file_id)}`
    );
    if (!r.ok) return null;
    const j = await r.json();
    return j?.ok && j?.result?.file_path ? j.result.file_path : null;
  } catch {
    return null;
  }
}

/**
 * Telegram webhook handler:
 * - принимает channel_post
 * - проверяет секрет (query ?secret=... ИЛИ header x-telegram-bot-api-secret-token)
 * - пишет в tg_posts (text/caption + media)
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

    // --- медиа (обрабатываем фото; при желании можно расширить на video/animation/document)
    let media_type = null;
    let media_path = null;

    if (Array.isArray(post.photo) && post.photo.length) {
      // Берём самое большое фото (последний элемент массива)
      const best = post.photo[post.photo.length - 1];
      const file_path = await getFilePath(best.file_id);
      if (file_path) {
        media_type = "photo";
        media_path = file_path; // путь без токена
      }
    } else if (post.document && /^image\\//i.test(post.document.mime_type || "")) {
      // Изображение прислано как документ
      const file_path = await getFilePath(post.document.file_id);
      if (file_path) {
        media_type = "photo";
        media_path = file_path;
      }
    }

    await query(
      `insert into tg_posts (chat_id, message_id, date, username, text, link, media_type, media_path)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (chat_id, message_id) do update
         set date = excluded.date,
             username = excluded.username,
             text = excluded.text,
             link = excluded.link,
             media_type = excluded.media_type,
             media_path = excluded.media_path`,
      [chat_id, message_id, date, username, text, link, media_type, media_path]
    );

    return cors({ ok: true });
  } catch (e) {
    console.error("tg-webhook error:", e);
    return cors({ error: "server error" }, 500);
  }
};
