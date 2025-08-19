'use strict';

const { Pool } = require('pg');

// --- DB pool (Variant B: try DATABASE_URL, then Netlify aliases)
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false },
});

// --- tiny helpers
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};
const json = (data, status = 200, extra = {}) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...extra },
  body: JSON.stringify(data),
});
const bad = (msg, status = 400) => json({ error: msg }, status);
const parseNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// --- soft in-memory rate-limit (best-effort in serverless)
const RL = new Map(); // ip -> { count, ts }
const hit = (ip, limit = 20, windowMs = 60_000) => {
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
const getIP = (evt) =>
  (evt.headers?.['x-client-ip'] ||
    evt.headers?.['client-ip'] ||
    (evt.headers?.['x-forwarded-for'] || '').split(',')[0].trim() ||
    evt.headers?.['x-real-ip'] ||
    'unknown');

// --- handler
exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 204, headers: CORS, body: '' };
    }

    if (event.httpMethod === 'GET') {
      // pagination
      let limit = Math.max(1, Math.min(500, parseNum(event.queryStringParameters?.limit, 200)));
      let offset = Math.max(0, parseNum(event.queryStringParameters?.offset, 0));

      const { rows } = await pool.query(
        `select name from hearts
         order by ts desc
         limit $1 offset $2`,
        [limit, offset]
      );
      // client ждет массив объектов с полем name
      return json(rows, 200);
    }

    if (event.httpMethod === 'POST') {
      const ip = getIP(event);
      if (!hit(ip, 20, 60_000)) return bad('Too many requests, please slow down.', 429);

      let payload;
      try {
        payload = JSON.parse(event.body || '{}');
      } catch {
        return bad('Invalid JSON.');
      }

      // name — опционально
      let name = (payload.name ?? '').toString().trim();
      if (name.length > 80) return bad('Name is too long (max 80).');

      const { rows } = await pool.query(
        `insert into hearts(name) values ($1) returning id`,
        [name || null]
      );

      return json({ ok: true, id: rows[0]?.id ?? null }, 201);
    }

    return bad('Method not allowed.', 405);
  } catch (err) {
    console.error('hearts error:', err);
    return bad('Server error.', 500);
  }
};
