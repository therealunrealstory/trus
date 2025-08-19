const { Pool } = require('pg');

const CONN = process.env.NETLIFY_DATABASE_URL_UNPOOLED || process.env.NETLIFY_DATABASE_URL;
const pool = CONN ? new Pool({
  connectionString: CONN,
  ssl: { rejectUnauthorized: false }
}) : null;

function sanitizeText(s, { max = 140 } = {}) {
  if (typeof s !== 'string') return '';
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/[<>]/g, ''); // убираем html
  if (s.length > max) s = s.slice(0, max);
  return s;
}

async function query(sql, params = []) {
  if (!pool) throw new Error('Database is not configured.');
  const client = await pool.connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}

module.exports = { query, sanitizeText };
