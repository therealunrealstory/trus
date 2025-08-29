// /netlify/functions/translate-ping.js
const OPENAI_URL = 'https://api.openai.com/v1/responses';

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) };
    }

    // защита эндпоинта
    const auth = event.headers.authorization || '';
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    if (!token || token !== process.env.ADMIN_SECRET) {
      return { statusCode: 403, body: JSON.stringify({ error: 'forbidden' }) };
    }

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch {}
    const text = (body.text || '').toString();
    const lang = (body.lang || 'ru').toLowerCase();
    if (!text) return { statusCode: 400, body: JSON.stringify({ error: 'text_required' }) };

    const payload = {
      model: 'gpt-5-nano',
      input: [
        {
          role: 'system',
          content: `You are a professional translator into ${lang}. Translate the user's text from English to ${lang}. Preserve line breaks, punctuation, emojis and URLs. Return translation only.`
        },
        { role: 'user', content: text }
      ],
      temperature: 0
    };

    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const j = await r.json();
    const out = j.output_text || j.content?.[0]?.text || j.choices?.[0]?.message?.content || '';

    return {
      statusCode: 200,
      headers: { 'content-type':'application/json', 'cache-control':'no-store' },
      body: JSON.stringify({ ok: true, lang, translation: out, model: 'gpt-5-nano' })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'translate_failed', message: String(e.message||e) }) };
  }
};