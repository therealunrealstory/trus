// netlify/functions/db-migrate.js
// Создаёт таблицы tg_posts, tg_media, tg_translations и индексы.
// Запуск: POST с заголовком Authorization: Bearer <ADMIN_SECRET>
// Опционально: ?drop=1 — предварительно удалит старые таблицы.

import { query } from "./_db.js";

const CREATE_SQL = [
  // tg_posts
  `CREATE TABLE IF NOT EXISTS public.tg_posts (
     id BIGSERIAL PRIMARY KEY,
     channel TEXT NOT NULL,
     message_id BIGINT NOT NULL,
     date TIMESTAMPTZ NOT NULL,
     link TEXT NOT NULL,
     text_src TEXT,
     lang_src TEXT DEFAULT 'en',
     hidden BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tg_posts_unique_msg_idx ON public.tg_posts (channel, message_id);`,
  `CREATE INDEX IF NOT EXISTS tg_posts_date_desc_idx ON public.tg_posts (date DESC);`,
  `CREATE INDEX IF NOT EXISTS tg_posts_hidden_idx ON public.tg_posts (hidden);`,

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

const DROP_SQL = [
  `DROP TABLE IF EXISTS public.tg_translations CASCADE;`,
  `DROP TABLE IF EXISTS public.tg_media CASCADE;`,
  `DROP TABLE IF EXISTS public.tg_posts CASCADE;`
];

export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("method_not_allowed", { status: 405 });
    }
    // защита
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";
    if (!token || token !== process.env.ADMIN_SECRET) {
      return new Response("forbidden", { status: 403 });
    }

    const url = new URL(req.url);
    const drop = (url.searchParams.get("drop") || "").toLowerCase();
    const ops = [];

    if (drop === "1" || drop === "true") {
      for (const sql of DROP_SQL) {
        await query(sql);
        ops.push(sql);
      }
    }
    for (const sql of CREATE_SQL) {
      await query(sql);
      ops.push(sql);
    }

    return new Response(
      JSON.stringify({ ok: true, statements: ops.length }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e) {
    console.error("db-migrate error", e);
    return new Response(
      JSON.stringify({ error: "db_migrate_failed", message: String(e.message || e) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
