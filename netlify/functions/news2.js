// netlify/functions/news2.js
import { query, cors } from "./_db.js";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5-nano";

// Мэппинг кодов на названия языков — Responses лучше реагирует на full names
const LANG_NAME = {
  en: "English",
  ru: "Russian",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  it: "Italian",
  de: "German",
  cn: "Chinese (Simplified)",
  zh: "Chinese (Simplified)",
  ar: "Arabic",
};

function mapChannel(param) {
  const p = (param || "now").toLowerCase();
  if (p === "nico") return process.env.TG_NICO_CHANNEL || "TheRealUnrealStoryNico";
  return process.env.TG_CHANNEL || "TheRealUnrealStoryNow";
}

function langName(code) {
  const c = String(code || "en").toLowerCase();
  return LANG_NAME[c] || c;
}

// Нормализатор для грубого сравнения “тот же текст?”
function normalize(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function translateOnce(text, langCode) {
  const target = langName(langCode);
  if (!text || !langCode || String(langCode).toLowerCase() === "en") {
    return null; // не переводим
  }
  if (!process.env.OPENAI_API_KEY) return null;

  const prompt =
    `Translate the following text from English to ${target}. ` +
    `Keep original line breaks, punctuation, emojis and URLs. ` +
    `Respond with the translation only, no comments.\n\n` +
    text;

  const r = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      temperature: 0,
    }),
  });

  const j = await r.json();
  const out =
    (j && (j.output_text || "").trim()) ||
    (j?.content?.[0]?.text || "").trim() ||
    (j?.choices?.[0]?.message?.content || "").trim();

  // если пусто или фактически тот же текст — считаем, что перевод не удался
  if (!out || normalize(out) === normalize(text)) return null;

  return { out, provider: `openai:${MODEL}` };
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const lang   = (url.searchParams.get("lang") || "en").toLowerCase();
    const limit  = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);
    const before = url.searchParams.get("before") ? Number(url.searchParams.get("before")) : null;
    const channelName = mapChannel(url.searchParams.get("channel"));

    // 1) Посты
    const posts = await query(
      `
      SELECT id, channel, message_id, date, link, text_src
      FROM public.tg_posts
      WHERE lower(channel) = lower($1) AND hidden = false
        ${before ? "AND message_id < $3" : ""}
      ORDER BY date DESC
      LIMIT $2
      `,
      before ? [channelName, limit, before] : [channelName, limit]
    );

    if (!posts.rows.length) return cors({ channel: channelName, lang, items: [] });

    // 2) Медиа
    const ids = posts.rows.map(r => r.id);
    const media = await query(
      `SELECT id, post_id FROM public.tg_media WHERE post_id = ANY($1::bigint[])`,
      [ids]
    );
    const mediaByPost = new Map();
    for (const m of media.rows) {
      const arr = mediaByPost.get(m.post_id) || [];
      arr.push({ id: m.id });
      mediaByPost.set(m.post_id, arr);
    }

    // 3) Переводы (кэш)
    const items = [];
    for (const p of posts.rows) {
      let text_tr = p.text_src || "";
      let provider = "none";

      if (lang !== "en" && p.text_src) {
        const got = await query(
          `SELECT text_tr, provider FROM public.tg_translations WHERE post_id=$1 AND lang=$2`,
          [p.id, lang]
        );
        if (got.rows.length) {
          text_tr = got.rows[0].text_tr;
          provider = got.rows[0].provider || "none";
        } else {
          const tr = await translateOnce(p.text_src, lang);
          if (tr && tr.out) {
            text_tr = tr.out;
            provider = tr.provider;
            await query(
              `INSERT INTO public.tg_translations (post_id, lang, text_tr, provider)
               VALUES ($1,$2,$3,$4)
               ON CONFLICT (post_id, lang)
               DO UPDATE SET text_tr = EXCLUDED.text_tr, provider = EXCLUDED.provider`,
              [p.id, lang, text_tr, provider]
            );
          }
        }
      }

      const mediaArr = (mediaByPost.get(p.id) || []).map(m => ({
        id: m.id,
        thumbUrl: `/.netlify/functions/tg-file?id=${m.id}&v=thumb`,
        fullUrl:  `/.netlify/functions/tg-file?id=${m.id}&v=full`
      }));

      items.push({
        id: String(p.id),
        message_id: String(p.message_id),
        date: p.date,
        link: p.link,
        text: p.text_src || "",
        text_tr,
        lang_out: lang,
        provider,
        media: mediaArr
      });
    }

    return cors({ channel: channelName, lang, items });
  } catch (e) {
    console.error("news2 error:", e);
    return cors({ error: "news_failed" }, 500);
  }
};