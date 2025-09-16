// netlify/functions/glocal-token.js
import crypto from "node:crypto";

const MODE = process.env.SMGL_MODE || "demo";
const API_ORIGIN = MODE === "live" ? "https://proxy.smart-glocal.com" : "https://demo.smart-glocal.com";
const PROJECT = process.env.SMGL_PROJECT_ID;
const PRIVATE_PEM = (process.env.SMGL_PRIVATE_KEY_PEM || "").replace(/\\n/g, "\n");

function signBody(bodyStr){
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(bodyStr);
  signer.end();
  const sig = signer.sign(PRIVATE_PEM);
  return sig.toString("base64");
}

async function smglFetch(path, bodyObj, idemKey){
  const body = bodyObj ? JSON.stringify(bodyObj) : "{}";
  const res = await fetch(`${API_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-PARTNER-PROJECT": PROJECT,
      "X-PARTNER-SIGN": signBody(body),
      ...(idemKey ? { "X-PARTNER-IDEMPOTENCY-KEY": idemKey } : {})
    },
    body
  });
  const json = await res.json().catch(()=> ({}));
  if (!res.ok || json.status === "error") {
    const msg = json?.error?.description || `SmartGlocal API error: ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// Netlify handler
export default async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { amount, currency, metadata, locale, showRecurrent } = JSON.parse(req.body||"{}");
    const _amount = Number.isFinite(amount) ? Math.round(amount * 100) : null; // USD cents
    const _currency = (currency || process.env.SMGL_DEFAULT_CURRENCY || "usd").toLowerCase();
    const _locale = ["en","ru"].includes((locale||"").toLowerCase()) ? locale.toLowerCase() : (process.env.SMGL_DEFAULT_LOCALE||"en");

    // 1) создаём session
    const idem = crypto.randomUUID();
    const sessionReq = {
      // можно создать без деталей и передать позже, но для донатов удобно фиксировать сумму сразу
      amount_details: _amount ? { amount: _amount, currency: _currency } : undefined,
      metadata: metadata || "donation"
    };
    const s = await smglFetch("/api/v1/session/create", sessionReq, idem);
    const sessionId = s?.session?.id;

    // 2) получаем public token для payment-form widget
    const tokenReq = {
      acquiring_widget: {
        session_id: sessionId,
        locale: _locale,
        // чекбокс «I agree to recurrent payments»
        ...(showRecurrent ? { show_recurrent_checkbox: "true" } : {})
      }
    };
    const t = await smglFetch("/api/v1/token", tokenReq);

    res.status(200).json({ public_token: t.public_token, session_id: sessionId, mode: MODE });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
