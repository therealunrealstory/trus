// netlify/functions/diag-translate.js
import { cors } from "./_db.js";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-5-nano";

const LANG_NAME = {
  en:"English", ru:"Russian", es:"Spanish", pt:"Portuguese",
  fr:"French",  it:"Italian", de:"German",
  cn:"Chinese (Simplified)", zh:"Chinese (Simplified)", ar:"Arabic",
};

export default async (req) => {
  try {
    if (req.method === "OPTIONS") return cors({}, 204);
    if (req.method !== "POST")   return cors({ error: "method_not_allowed" }, 405);

    // защита — нужен ADMIN_SECRET
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token || token !== process.env.ADMIN_SECRET) return cors({ error: "forbidden" }, 403);

    const body = await req.json().catch(()=> ({}));
    const text = String(body.text || "");
    const lang = String(body.lang || "es").toLowerCase();
    const target = LANG_NAME[lang] || lang;

    if (!process.env.OPENAI_API_KEY) return cors({ error: "no_openai_key" }, 500);
    if (!text) return cors({ error: "empty_text" }, 400);

    // ВАЖНО: type = input_text
    const payload = {
      model: MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
`You are a professional translator.
Translate strictly from English to ${target}.
Output ONLY the translation in ${target} (no quotes, no explanations).
Preserve line breaks, punctuation, emojis and URLs exactly.`
            }
          ]
        },
        { role: "user", content: [ { type: "input_text", text } ] }
      ],
      temperature: 0
    };

    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const j = await r.json();

    // Надёжный парсинг
    let out = "";
    if (typeof j.output_text === "string") out = j.output_text.trim();
    else if (Array.isArray(j.output)) {
      out = j.output.flatMap(x => (x?.content||[]).map(p => p?.text||"")).join("").trim();
    } else if (Array.isArray(j.content)) {
      out = j.content.map(c => c?.text || "").join("").trim();
    } else if (j?.choices?.[0]?.message?.content) {
      out = String(j.choices[0].message.content).trim();
    }

    return cors({ ok: r.ok, status: r.status, model: MODEL, target, output_text: out, raw: j });
  } catch (e) {
    console.error("diag-translate error:", e);
    return cors({ ok:false, error: String(e?.message || e) }, 500);
  }
};
