// netlify/functions/db-migrate.js
import { query } from "./_db.js";

// Набор idempotent-стейтментов — можно запускать повторно
const SQL = [
  // tg_posts: недостающие поля
  `ALTER TABLE public.tg_posts ADD COLUMN IF NOT EXISTS lang_src   TEXT        DEFAULT 'en';`,
  `ALTER TABLE public.tg_posts ADD COLUMN IF NOT EXISTS hidden     BOOLEAN     DEFAULT FALSE;`,
  `ALTER TABLE public.tg_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();`,
  `ALTER TABLE public.tg_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();`,

  // Уникальность (как уникальный индекс — безопаснее, чем CONSTRAINT IF NOT EXISTS)
  `CREATE UNIQUE INDEX IF NOT EXISTS tg_posts_unique_msg_idx ON public.tg_posts (channel, message_id);`,

  // Индексы
  `CREATE INDEX IF NOT EXISTS tg_posts_date_desc_idx ON public.tg_posts (date DESC);`,
  `CREATE INDEX IF NOT EXISTS tg_posts_hidden_idx     ON public.tg_posts (hidden);`,

  // tg_media
  `CREATE TABLE IF NOT EXISTS public.tg_media (
     id BIGSERIAL PRIMARY KEY,
     post_id BIGINT NOT NULL REFERENCES public.tg_posts(id) ON DELETE CASCADE,
     kind TEXT NOT NULL,
     file_id_thumb TEXT,
     file_id_full  TEXT,
     file_path_thumb TEXT,
     file_path_full  TEXT,
     width INTEGER,
     height INTEGER,
     created_at TIMESTAMPTZ DEFAULT now()
   );`,
  `CREATE INDEX IF NOT EXISTS tg_media_post_idx ON public.tg_media (post_id);`,

  // tg_translations
  `CREATE TABLE IF NOT EXISTS public.tg_translations (
     id BIGSERIAL PRIMARY KEY,
     post_id BIGINT NOT NULL REFERENCES public.tg_posts(id) ON DELETE CASCADE,
     lang TEXT NOT NULL,
     text_tr TEXT NOT NULL,
     provider TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT now()
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tg_tr_unique_idx ON public.tg_translations (post_id, lang);`
];

export default async (req) => {
  try {
    if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

    // защита: только с твоим ADMIN_SECRET
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token || token !== process.env.ADMIN_SECRET) return new Response("forbidden", { status: 403 });

    for (const sql of SQL) {
      await query(sql);
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    console.error("db-migrate error", e);
    return new Response(JSON.stringify({ error: "db_migrate_failed", message: String(e.message || e) }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};