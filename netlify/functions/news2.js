// /.netlify/functions/news2.js
import { query, cors } from "./_db.js";

/** Каналы: короткое имя → username в Telegram */
const CH = {
  now:  "TheRealUnrealStoryNow",
  nico: "TheRealUnrealStoryNico",
};

/** Нормализуем код языка: EN/CN/AR и т.п. */
function normLang(raw) {
  const L = String(raw || "EN").trim().toUpperCase();
  if (L === "CN") return "ZH";     // китайский
  return L;
}

/** Перевод через OpenAI Responses API (gpt-5-nano) */
async function translateWithOpenAI(text, targetLang) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !text || targetLang === "EN") return null;

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        // Никаких разметок и объяснений — только перевод
        input:
          `Translate from English to ${targetLang}. ` +
          `Keep URLs, emoji and line breaks. Respond with translation text only.\n\n` +
          text,
      }),
    });
    const j = await r.json();
    const out = (j && (j.output_text || "").trim()) || "";
    if (!out) return null;
    return { text: out, provider: "openai:gpt-5-nano" };
  } catch (e) {
    console.error("openai translate error:", e);
    return null;
  }
}

export default async (req) => {
  try {
    const url   = new URL(req.url);
    const key   = String(url.searchParams.get("channel") || "now").toLowerCase();
    const channel = CH[key] || key; // разрешаем и полное имя
    const langU = normLang(url.searchParams.get("lang"));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));

    // 1) Берём последние посты
    const posts = await query(
      `select p.id, p.message_id, p.date, p.link, p.text_src, p.lang_src
         from public.tg_posts p
        where p.channel = $1 and coalesce(p.hidden,false) = false
        order by p.date desc
        limit $2`,
      [channel, limit]
    );

    const items = [];
    for (const row of posts.rows) {
      const pid = row.id;

      // 2) Медиа
      const mm = await query(
        `select kind, file_path_thumb, file_path_full
           from public.tg_media
          where post_id = $1
          order by id asc`,
        [pid]
      );
      const media = mm.rows
        .map(m => ({
          kind: m.kind,
          thumb: m.file_path_thumb
            ? `/.netlify/functions/tg-file?path=${encodeURIComponent(m.file_path_thumb)}&v=thumb`
            : null,
          full: m.file_path_full
            ? `/.netlify/functions/tg-file?path=${encodeURIComponent(m.file_path_full)}`
            : null,
        }))
        .filter(x => !!x.thumb);

      // 3) Перевод (кэшируем в tg_translations)
      let text_tr = row.text_src || "";
      let provider = null;

      if (langU !== "EN") {
        const langDb = langU.toLowerCase();
        const tr = await query(
          `select text_tr, provider from public.tg_translations
            where post_id = $1 and lang = $2
            limit 1`,
          [pid, langDb]
        );
        if (tr.rows.length) {
          text_tr = tr.rows[0].text_tr || text_tr;
          provider = tr.rows[0].provider || null;
        } else {
          const tt = await translateWithOpenAI(row.text_src || "", langU);
          if (tt && tt.text) {
            text_tr = tt.text;
            provider = tt.provider;
            await query(
              `insert into public.tg_translations (post_id, lang, text_tr, provider)
                   values ($1,$2,$3,$4)
              on conflict (post_id, lang)
              do update set text_tr = excluded.text_tr, provider = excluded.provider`,
              [pid, langDb, text_tr, provider]
            );
          }
        }
      }

      items.push({
        id: String(pid),
        message_id: String(row.message_id),
        date: row.date,
        link: row.link,
        text: row.text_src || "",
        text_tr,
        lang_out: langU.toLowerCase(),
        provider,
        media,
      });
    }

    return cors({ channel, lang: langU.toLowerCase(), items });
  } catch (e) {
    console.error("news2 error:", e);
    return cors({ error: "server error" }, 500);
  }
};
