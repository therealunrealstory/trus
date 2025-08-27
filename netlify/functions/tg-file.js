// netlify/functions/tg-file.js
// Прокси к файлам Telegram. Определяет токен по каналу поста.

import { query } from "./_db.js";

function pickTokenByChannel(channel) {
  const ch = (channel || '').toLowerCase();
  if (ch === (process.env.TG_CHANNEL || '').toLowerCase())      return process.env.TG_BOT_TOKEN;
  if (ch === (process.env.TG_NICO_CHANNEL || '').toLowerCase()) return process.env.TG_NICO_BOT_TOKEN;
  return process.env.TG_BOT_TOKEN; // fallback
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const id = Number(url.searchParams.get('id') || 0);
    const variant = (url.searchParams.get('v') || url.searchParams.get('variant') || 'thumb').toLowerCase();

    if (!id) {
      return new Response('bad_request', { status: 400, headers: { 'content-type': 'text/plain' } });
    }

    const { rows } = await query(
      `SELECT m.file_path_thumb, m.file_path_full, p.channel
         FROM public.tg_media m
         JOIN public.tg_posts p ON p.id = m.post_id
        WHERE m.id = $1`,
      [id]
    );
    if (!rows.length) return new Response('not_found', { status: 404 });

    const row = rows[0];
    const path = variant === 'full' ? row.file_path_full : row.file_path_thumb;
    if (!path) return new Response('no_path', { status: 404 });

    const token = pickTokenByChannel(row.channel);
    const tgUrl = `https://api.telegram.org/file/bot${token}/${path}`;

    const r = await fetch(tgUrl);
    if (!r.ok) return new Response('tg_fetch_failed', { status: 502 });

    const buf = await r.arrayBuffer();
    const headers = new Headers({
      'Content-Type': r.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, immutable'
    });
    return new Response(Buffer.from(buf), { status: 200, headers });
  } catch (e) {
    console.error('tg-file error:', e);
    return new Response('internal', { status: 500 });
  }
};