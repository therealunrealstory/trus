// netlify/functions/news2.js
import { query, cors } from "./_db.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions"; // Corrected endpoint
const MODEL = "gpt-4o-mini"; // Using a more modern and cost-effective model

function mapChannel(param) {
  const p = (param || "now").toLowerCase();
  if (p === "nico")    return process.env.TG_NICO_CHANNEL     || "TheRealUnrealStoryNico";
  if (p === "reports") return process.env.TG_REPORTS_CHANNEL  || "Reports";
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

  const payload = {
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are a professional translator. Translate the user's message from English to ${target}. Output ONLY the translation. Preserve line breaks, punctuation, emojis and URLs exactly.`
      },
      { role: "user", content: text }
    ],
    temperature: 0.2
  };

  try{
    const r = await fetch(OPENAI_URL, {
      method:"POST",
      headers:{ "content-type":"application/json", "authorization":`Bearer ${key}` },
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    const out = j?.choices?.[0]?.message?.content?.trim() || "";

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
    const before = url.searchParams.get("before") ? Number(url.search_params.get("before")) : null;
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

    const postIds = posts.rows.map(r => r.id);

    // ОПТИМИЗАЦИЯ: Получаем все доступные переводы одним запросом
    const translations = await query(
      `SELECT post_id, text_tr, provider
       FROM public.tg_translations
       WHERE post_id = ANY($1::bigint[]) AND lang=$2`,
      [postIds, lang]
    );
    const translationsMap = new Map(translations.rows.map(t => [String(t.post_id), t]));

    // Получаем все медиа одним запросом
    const media = await query(
      `SELECT id, post_id FROM public.tg_media WHERE post_id = ANY($1::bigint[])`,
      [postIds]
    );
    const mediaByPost = new Map();
    for (const m of media.rows) {
      const arr = mediaByPost.get(m.post_id) || [];
      arr.push(m.id);
      mediaByPost.set(m.post_id, arr);
    }
    
    // Ограничиваем время на выполнение НОВЫХ переводов, чтобы избежать таймаута
    const functionStartTime = Date.now();
    const TIME_LIMIT_MS = 8000; // Оставляем запас в 2 секунды

    const items = [];
    for (const p of posts.rows) {
      let text_tr = p.text_src || "";
      let provider = "none";
      let translation_pending = false;

      if (lang !== "en" && p.text_src) {
        const cached = translationsMap.get(String(p.id));
        if (cached) {
          text_tr = cached.text_tr || text_tr;
          provider = cached.provider || "none";
        } else {
          // Если перевода нет в кэше, проверяем, есть ли время его сделать
          if (Date.now() - functionStartTime < TIME_LIMIT_MS) {
            const tr = await translateOnce(p.text_src, lang);
            if (tr && tr.out) {
              text_tr = tr.out;
              provider = tr.provider;
              // Сохраняем в фоне, не дожидаясь окончания записи
              query(
                `INSERT INTO public.tg_translations (post_id, lang, text_tr, provider)
                 VALUES ($1,$2,$3,$4)
                 ON CONFLICT (post_id, lang)
                 DO UPDATE SET text_tr=EXCLUDED.text_tr, provider=EXCLUDED.provider`,
                [p.id, lang, text_tr, provider]
              ).catch(e => console.error("Failed to save translation:", e));
            } else {
              translation_pending = true; // API не ответил, попробуем позже
            }
          } else {
            translation_pending = true; // Время вышло, откладываем перевод
          }
        }
      }

      items.push({
        id: String(p.id),
        message_id: String(p.message_id),
        date: p.date,
        link: p.link,
        text: p.text_src || "",
        text_tr: translation_pending ? (p.text_src || "") : text_tr,
        lang_out: lang,
        provider,
        translation_pending, // Флаг для фронтенда
        media: (mediaByPost.get(p.id) || []).map(id => ({
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