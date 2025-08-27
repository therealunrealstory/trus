// netlify/functions/tg-webhook-nico.js (NICO)
import { query, cors } from "./_db.js";

const CHANNEL = (process.env.TG_NICO_CHANNEL || "").toLowerCase();

async function getFilePath(file_id) {
  try {
    const token = process.env.TG_NICO_BOT_TOKEN;
    if (!token) return null;
    const r = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file_id })
    });
    const j = await r.json();
    return j?.ok && j?.result?.file_path ? j.result.file_path : null;
  } catch { return null; }
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

    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (!process.env.TG_NICO_WEBHOOK_SECRET || secretHeader !== process.env.TG_NICO_WEBHOOK_SECRET) {
      return cors({ error: "forbidden" }, 403);
    }

    const update = await req.json();
    const post = update.channel_post || update.edited_channel_post;
    if (!post || !post.chat || !post.chat.username) return cors({ ok: true });

    const username = String(post.chat.username).toLowerCase();
    if (CHANNEL && username !== CHANNEL) return cors({ ok: true, skip: "other_channel" });

    const message_id = post.message_id;
    const date = new Date((post.date || 0) * 1000).toISOString();
    const text_src = post.text || post.caption || '';
    const link = `https://t.me/${post.chat.username}/${message_id}`;

    const { rows } = await query(
      `INSERT INTO public.tg_posts (channel, message_id, date, link, text_src, updated_at)
       VALUES ($1,$2,$3,$4,$5,now())
       ON CONFLICT (channel, message_id)
       DO UPDATE SET text_src = EXCLUDED.text_src, date = EXCLUDED.date, updated_at = now()
       RETURNING id`,
      [post.chat.username, message_id, date, link, text_src]
    );
    const post_id = rows[0].id;

    if (Array.isArray(post.photo) && post.photo.length) {
      const { thumb, full } = pickPhotoSizes(post.photo);
      const [pth, pfull] = await Promise.all([
        getFilePath(thumb.file_id),
        getFilePath(full.file_id)
      ]);
      await query(`DELETE FROM public.tg_media WHERE post_id=$1`, [post_id]);
      await query(
        `INSERT INTO public.tg_media
           (post_id, kind, file_id_thumb, file_id_full, file_path_thumb, file_path_full, width, height)
         VALUES ($1,'photo',$2,$3,$4,$5,$6,$7)`,
        [post_id, thumb.file_id, full.file_id, pth, pfull, full.width, full.height]
      );
    }

    return cors({ ok: true });
  } catch (e) {
    console.error("tg-webhook(NICO) error:", e);
    return cors({ error: "server error" }, 500);
  }
};
