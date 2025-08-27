// netlify/functions/news2.js
import { query, cors } from "./_db.js";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5-nano";

function mapChannel(param) {
  const p = (param || "now").toLowerCase();
  if (p === "nico") return process.env.TG_NICO_CHANNEL || "TheRealUnrealStoryNico";
  return process.env.TG_CHANNEL || "TheRealUnrealStoryNow";
}

async function translateOnce(text, lang) {
  if (!text || !lang || lang === "en") return { out: text, provider: "none" };

  const payload = {
    model: MODEL,
    input: [
      { role: "system",
        content:
          `You are a professional translator into ${lang}. ` +
          `Translate from English to ${lang}. Preserve original line breaks, punctuation, emojis and URLs. ` +
          `Return translation only.` },
      { role: "user", content: text }
    ],
    temperature: 0
  };

  const r = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const j = await r.json();
  const out = j.output_text || j.content?.[0]?.text || j.choices?.[0]?.message?.content || text;
  return { out, provider: `openai:${MODEL}` };
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const lang   = (url.searchParams.get("lang") || "en").toLowerCase();
    const limit  = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);
    const before = url.searchParams.get("before") ? Number(url.searchParams.get("before")) : null;
    const channelName = mapChannel(url.searchParams.get("channel")); // env-ник канала

    // 1) Посты
    const posts = await query(
      `
      SELECT id, channel, message_id, date, link, text_src
      FROM public.tg_posts
      WHERE channel = $1 AND hidden = false
        ${before ? "AND message_id < $3" : ""}
      ORDER BY date DESC
      LIMIT $2
      `,
      before ? [channelName, limit, before] : [channelName, limit]
    );

    if (!posts.rows.length) {
      return cors({ channel: channelName, lang, items: [] });
    }

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
          provider = got.rows[0].provider;
        } else {
          const tr = await translateOnce(p.text_src, lang); // в OpenAI уходит ТОЛЬКО текст
          await query(
            `INSERT INTO public.tg_translations (post_id, lang, text_tr, provider)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (post_id, lang) DO NOTHING`,
            [p.id, lang, tr.out, tr.provider]
          );
          text_tr = tr.out;
          provider = tr.provider;
        }
      }

      const mediaArr = (mediaByPost.get(p.id) || []).map(m => ({
        id: m.id,
        thumbUrl: `/.netlify/functions/tg-file?id=${m.id}&v=thumb`,
        fullUrl:  `/.netlify/functions/tg-file?id=${m.id}&v=full`
      }));

      items.push({
        id: p.id,
        message_id: p.message_id,
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
