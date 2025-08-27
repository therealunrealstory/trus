// netlify/functions/diag-openai.js
import { cors } from "./_db.js";

export default async (req) => {
  try {
    if (req.method !== "GET") return cors({ error: "method_not_allowed" }, 405);
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token || token !== process.env.ADMIN_SECRET) return cors({ error: "forbidden" }, 403);

    const hasKey = !!process.env.OPENAI_API_KEY;
    if (!hasKey) return cors({ ok: false, reason: "OPENAI_API_KEY is missing" });

    // Лёгкий "пинг" Responses API (не делаем перевод реального текста)
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({ model: "gpt-5-nano", input: "ping" })
    });
    const j = await r.json();

    return cors({ ok: true, status: r.status, output_text: j.output_text ?? null });
  } catch (e) {
    console.error("diag-openai error:", e);
    return cors({ ok: false, error: String(e.message || e) }, 500);
  }
};