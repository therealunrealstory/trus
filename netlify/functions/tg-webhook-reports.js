// netlify/functions/tg-webhook-reports.js
import { query, cors } from "./_db.js";

const CHANNEL_ENV = (process.env.TG_REPORTS_CHANNEL || "").toLowerCase();

/** Получить file_path по file_id для REPORTS-бота */
async function getFilePath(file_id) {
  try {
    const token = process.env.TG_REPORTS_BOT_TOKEN;
    if (!token) return null;
    const r = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file_id })
    });
    const j = await r.json();
    return j?.ok && j?.result?.file_path ? j.result.file_path : null;
  } catch {
    return null;
  }
}

function pickPhotoSizes(arr = []) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a,b)=> (a.width*a.height)-(b.width*b.height));
  return { thumb: sorted[0], full: sorted[sorted.length - 1] };
}

export default async (req) => {
  try {
    if (req.method === "OPTIONS") return cors({}, 204);
    if (req.method !== "POST")   return cors({ ok: true });

    // Проверка секрета из заголовка
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (!process.env.TG_REPORTS_WEBHOOK_SECRET || secretHeader !== process.env.TG_REPORTS_WEBHOOK_SECRET) {
      return cors({ error: "forbidden" }, 403);
    }

    const update = await req.json();
    const post = update.channel_post || update.edited_channel_post;
    if (!post || !post.chat) return cors({ ok: true });

    const chat = post.chat;
    const chatUsername = (chat.username || "").toLowerCase();
    const chatIdStr = String(chat.id || "");

    // Выберем "ключ канала", который запишем в БД (и будем им же матчить картинки/токены)
    let channelKey = CHANNEL_ENV || chatUsername || chatIdStr;
    // Если задан TG_REPORTS_CHANNEL — фильтруем чужие каналы
    if (CHANNEL_ENV) {
      const same =
        channelKey === CHANNEL_ENV ||
        chatUsername === CHANNEL_ENV ||
        chatIdStr.toLowerCase() === CHANNEL_ENV;
      if (!same) return cors({ ok: true, skip: "other_channel" });
    }

    console.log("reports chat id:", chatIdStr, "username:", chatUsername || "(none)");

    const message_id = post.message_id;
    const date = new Date((post.date || 0) * 1000).toISOString();
    const text_src = post.text || post.caption || "";

    // приватный канал — ссылку не сохраняем
    const link = null;

    // upsert поста
    const { rows } = await query(
      `INSERT INTO public.tg_posts (channel, message_id, date, link, text_src, updated_at)
       VALUES ($1,$2,$3,$4,$5,now())
       ON CONFLICT (channel, message_id)
       DO UPDATE SET text_src = EXCLUDED.text_src, date = EXCLUDED.date, updated_at = now()
       RETURNING id`,
      [channelKey, message_id, date, link, text_src]
    );
    const post_id = rows[0].id;

    // --- МЕДИА ---
    let inserted = false;

    // 1) Фото (Telegram сжимает, берём превью и «лучшее»)
    if (Array.isArray(post.photo) && post.photo.length) {
      const sel = pickPhotoSizes(post.photo);
      if (sel) {
        const [pth, pfull] = await Promise.all([
          getFilePath(sel.thumb.file_id),
          getFilePath(sel.full.file_id)
        ]);
        await query(`DELETE FROM public.tg_media WHERE post_id=$1`, [post_id]);
        await query(
          `INSERT INTO public.tg_media
             (post_id, kind, file_id_thumb, file_id_full, file_path_thumb, file_path_full, width, height)
           VALUES ($1,'photo',$2,$3,$4,$5,$6,$7)`,
          [post_id, sel.thumb.file_id, sel.full.file_id, pth, pfull, sel.full.width, sel.full.height]
        );
        inserted = true;
      }
    }

    // 2) Документ-изображение (если присылают «как файл»)
    if (!inserted && post.document && /^image\//i.test(post.document.mime_type || "")) {
      const fidFull  = post.document.file_id;
      const fidThumb = post.document.thumb?.file_id || fidFull;

      const [pth, pfull] = await Promise.all([
        getFilePath(fidThumb),
        getFilePath(fidFull)
      ]);

      await query(`DELETE FROM public.tg_media WHERE post_id=$1`, [post_id]);
      await query(
        `INSERT INTO public.tg_media
           (post_id, kind, file_id_thumb, file_id_full, file_path_thumb, file_path_full, width, height)
         VALUES ($1,'photo',$2,$3,$4,$5,$6,$7)`,
        [post_id, fidThumb, fidFull, pth, pfull, post.document.thumb?.width || null, post.document.thumb?.height || null]
      );
      inserted = true;
    }

    return cors({ ok: true, media: inserted ? 'saved' : 'none' });
  } catch (e) {
    console.error("tg-webhook-reports error:", e);
    return cors({ error: "server error" }, 500);
  }
};