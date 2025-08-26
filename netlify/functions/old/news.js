'use strict';

const { Pool } = require('pg');

// ----- DB pool (Variant B: DATABASE_URL → NETLIFY_* fallbacks)
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false },
});

// ----- helpers
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};
const json = (data, status = 200, extra = {}) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    // кэш для CDN/браузера (клиент у вас всё равно запрашивает no-store)
    'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=600',
    ...CORS,
    ...extra,
  },
  body: JSON.stringify(data),
});
const bad = (msg, status = 400) => json({ error: msg }, status);
const parseNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// мягкий лимит на частые запросы (best-effort, в памяти)
const RL = new Map();
const getIP = (evt) =>
  (evt.headers?.['x-client-ip'] ||
    evt.headers?.['client-ip'] ||
    (evt.headers?.['x-forwarded-for'] || '').split(',')[0].trim() ||
    evt.headers?.['x-real-ip'] ||
    'unknown');
const hit = (ip, limit = 120, windowMs = 60_000) => {
  const now = Date.now();
  const cur = RL.get(ip) || { count: 0, ts: now };
  if (now - cur.ts > windowMs) {
    RL.set(ip, { count: 1, ts: now });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  RL.set(ip, cur);
  return true;
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS, body: '' };
    }
    if (event.httpMethod !== 'GET') {
      return bad('Method not allowed.', 405);
    }

    // rate-limit
    const ip = getIP(event);
    if (!hit(ip)) return bad('Too many requests, please slow down.', 429);

    const qs = event.queryStringParameters || {};

    // пагинация + простые фильтры
    const limit = Math.max(1, Math.min(100, parseNum(qs.limit, 30)));
    const offset = Math.max(0, parseNum(qs.offset, 0));
    const since = qs.since ? new Date(qs.since) : null; // ISO строка или число мс
    const q = (qs.q || '').toString().trim();

    // формируем where
    const where = ['is_deleted = false'];
    const params = [];
    if (since && !Number.isNaN(since.getTime())) {
      params.push(since.toISOString());
      where.push(`date > $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(text ILIKE $${params.length} OR username ILIKE $${params.length})`);
    }

    params.push(limit);
    params.push(offset);

    const sql = `
      SELECT date, text, link, media_type, media_path
        FROM tg_posts
       WHERE ${where.join(' AND ')}
       ORDER BY date DESC
       LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const { rows } = await pool.query(sql, params);

    // отдаем как ожидает фронт (index.html): [{ date, text, link, media_type, media_path }]
    // дату приведём к ISO-строке для предсказуемости
    const out = rows.map((r) => ({
      date: r.date ? new Date(r.date).toISOString() : null,
      text: r.text || null,
      link: r.link || null,
      media_type: r.media_type || null,
      media_path: r.media_path || null,
    }));

    return json(out, 200);
  } catch (err) {
    console.error('news error:', err);
    return bad('Server error.', 500);
  }
};
