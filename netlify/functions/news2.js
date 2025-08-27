// netlify/functions/news2.js
import { query, cors } from "./_db.js";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5-nano";

function mapChannel(param) {
  const p = (param || "now").toLowerCase();
  if (p === "nico") return process.env.TG_NICO_CHANNEL || "TheRealUnrealStoryNico";
  return process.env.TG_CHANNEL || "TheRealUnrealStoryNow";
}

const LANG_NAME = {
  en:"English", ru:"Russian", es:"Spanish", pt:"Portuguese",
  fr:"French",  it:"Italian", de:"German",
  cn:"Chinese (Simplified)", zh:"Chinese (Simplified)", ar:"Arabic",
};
const langName = (code) => LANG_NAME[String(code||"en").toLowerCase()] || code;

const norm = (s) => String(s||"").trim().replace(/\s+/g," ").toLowerCase();

async function translateOnce(text, langCode) {
  const lc = String(langCode||"en").toLowerCase();
  if (!text || lc === "en") return null;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const target = langName(lc);

  // ВАЖНО: type = input_text
  const payload = {
    model: MODEL,
    input: [
      {
        role: "system",
        content: [
          { type:"input_text", text:
`You are a professional translator.
Translate the user's message from English to ${target}.
Output ONLY the translation in ${target} (no extra words).
Preserve line breaks, punctuation, emojis and URLs exactly.`}
        ]
      },
      { role: "user", content: [ { type:"input_text", text } ] }
    ],
    temperature: 0
  };

  try{
    const r = await fetch(OPENAI_URL, {
      method:"POST",
      headers:{
        "content-type":"application/json",
        "authorization":`Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });
    const j = await r.json();

    let out = "";
    if (typeof j.output_text === "string") out = j.output_text.trim();
    else if (Array.isArray(j.output)) {
      out = j.output.flatMap(x => (x?.content||[]).map(p => p?.text||"")).join("").trim();
    } else if (Array.isArray(j.content)) {
      out = j.content.map(c => c?.text || "").join("").trim();
    } else if (j?.choices?.[0]?.message?.content) {
      out = String(j.choices[0].message.content).trim();
    }

    if (!out || norm(out) === norm(text)) return null;
    return { out, provider: `openai:${MODEL}` };
  }catch(e){
    console.error("openai translate error:", e);
    return null;
  }
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    const lang   = (url.searchParams.get("lang") || "en").toLowerCase();
    const limit  = Math.min(parseInt(url.searchParams.get("limit") || "20",10), 50);
    const before = url.searchParams.get("before") ? Number(url.searchParams.get("before")) : null;
    const channelName = mapChannel(url.searchParams.get("channel"));

    const posts = await query(
      `
      SELECT id, channel, message_id, date, link, text_src
      FROM public.tg_posts
      WHERE lower(channel) = lower($1) AND coalesce(hidden,false)=false
        ${before ? "AND message_id < $3" : ""}
      ORDER BY date DESC
      LIMIT $2
      `,
      before ? [channelName, limit, before] : [channelName, limit]
    );
    if (!posts.rows.length) return cors({ channel: channelName, lang, items: [] });

    const ids = posts.rows.map(r => r.id);
    const media = await query(
      `SELECT id, post_id FROM public.tg_media WHERE post_id = ANY($1::bigint[])`,
      [ids]
    );
    const byPost = new Map();
    for (const m of media.rows) {
      const arr = byPost.get(m.post_id) || [];
      arr.push(m.id);
      byPost.set(m.post_id, arr);
    }

    const items = [];
    for (const p of posts.rows) {
      let text_tr = p.text_src || "";
      let provider = "none";

      if (lang !== "en" && p.text_src) {
        const cached = await query(
          `SELECT text_tr, provider FROM public.tg_translations WHERE post_id=$1 AND lang=$2`,
          [p.id, lang]
        );
        if (cached.rows.length) {
          text_tr = cached.rows[0].text_tr || text_tr;
          provider = cached.rows[0].provider || "none";
        } else {
          const tr = await translateOnce(p.text_src, lang);
          if (tr && tr.out) {
            text_tr = tr.out;
            provider = tr.provider;
            await query(
              `INSERT INTO public.tg_translations (post_id, lang, text_tr, provider)
               VALUES ($1,$2,$3,$4)
               ON CONFLICT (post_id, lang)
               DO UPDATE SET text_tr=EXCLUDED.text_tr, provider=EXCLUDED.provider`,
              [p.id, lang, text_tr, provider]
            );
          }
        }
      }

      items.push({
        id: String(p.id),
        message_id: String(p.message_id),
        date: p.date,
        link: p.link,
        text: p.text_src || "",
        text_tr,
        lang_out: lang,
        provider,
        media: (byPost.get(p.id) || []).map(id => ({
          id,
          thumbUrl: `/.netlify/functions/tg-file?id=${id}&v=thumb`,
          fullUrl:  `/.netlify/functions/tg-file?id=${id}&v=full`,
        })),
      });
    }

    return cors({ channel: channelName, lang, items });
  } catch (e) {
    console.error("news2 error:", e);
    return cors({ error: "news_failed" }, 500);
  }
};
