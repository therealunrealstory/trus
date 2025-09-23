// netlify/functions/news2.js

// ... (translateOnce и другие функции остаются без изменений) ...

export default async (req) => {
  try {
    const url = new URL(req.url);
    const lang = (url.searchParams.get("lang") || "en").toLowerCase();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);
    const before = url.searchParams.get("before") ? Number(url.searchParams.get("before")) : null;
    const channelName = mapChannel(url.searchParams.get("channel"));

    // Запрашиваем посты
    const posts = await query(
      `SELECT id, channel, message_id, date, link, text_src
       FROM public.tg_posts
       WHERE lower(channel) = lower($1) AND coalesce(hidden,false)=false
         ${before ? "AND message_id < $3" : ""}
       ORDER BY date DESC
       LIMIT $2`,
      before ? [channelName, limit, before] : [channelName, limit]
    );

    if (!posts.rows.length) return cors({ channel: channelName, lang, items: [] });

    const postIds = posts.rows.map(p => p.id);
    
    // Запрашиваем существующие переводы для этих постов и нужного языка
    const translations = await query(
      `SELECT post_id, text_tr, provider
       FROM public.tg_translations
       WHERE post_id = ANY($1::bigint[]) AND lang=$2`,
      [postIds, lang]
    );
    const translationsMap = new Map(translations.rows.map(t => [String(t.post_id), t]));

    // Запрашиваем медиафайлы
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
    
    // Вводим ограничение по времени на выполнение переводов
    const functionStartTime = Date.now();
    const TIME_LIMIT_MS = 8000; // Оставляем 2 секунды запаса до таймаута Netlify

    const items = [];
    for (const p of posts.rows) {
      let text_tr = p.text_src || "";
      let provider = "none";
      let translation_pending = false;

      if (lang !== "en" && p.text_src) {
        const cached = translationsMap.get(String(p.id));
        if (cached) {
          // Перевод уже есть в базе
          text_tr = cached.text_tr || text_tr;
          provider = cached.provider || "none";
        } else {
          // Перевода нет. Попробуем перевести, если есть время.
          if (Date.now() - functionStartTime < TIME_LIMIT_MS) {
            const tr = await translateOnce(p.text_src, lang);
            if (tr && tr.out) {
              text_tr = tr.out;
              provider = tr.provider;
              // Сохраняем в базу данных (не блокируем ответ)
              query(
                `INSERT INTO public.tg_translations (post_id, lang, text_tr, provider)
                 VALUES ($1,$2,$3,$4)
                 ON CONFLICT (post_id, lang)
                 DO UPDATE SET text_tr=EXCLUDED.text_tr, provider=EXCLUDED.provider`,
                [p.id, lang, text_tr, provider]
              ).catch(e => console.error("Failed to save translation:", e));
            } else {
              // API не вернул перевод, считаем, что он в процессе
              translation_pending = true;
            }
          } else {
            // Время вышло, помечаем, что перевод нужен, но не выполняем сейчас
            translation_pending = true;
          }
        }
      }

      items.push({
        id: String(p.id),
        message_id: String(p.message_id),
        date: p.date,
        link: p.link,
        text: p.text_src || "",
        text_tr: translation_pending ? (p.text_src || "") : text_tr, // Если в процессе, показываем оригинал
        lang_out: lang,
        provider,
        translation_pending, // Новый флаг для фронтенда
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