// netlify/functions/glocal-webhook.js
import crypto from "node:crypto";

// Получите публичный ключ Smart Glocal (demo/live) из их документации
// и положите в переменные окружения:
const SMGL_PUBLIC_KEY_PEM = (process.env.SMGL_PUBLIC_KEY_PEM || "").replace(/\\n/g, "\n");

export const config = { path: "/.netlify/functions/glocal-webhook" };

export default async (req, res) => {
  try {
    // получаем сырой текст тела
    const raw = req.body || "";
    const sig = req.headers["x-partner-sign"];
    if (!sig) return res.status(400).send("no signature");

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(raw);
    verifier.end();
    const ok = verifier.verify(SMGL_PUBLIC_KEY_PEM, Buffer.from(sig, "base64"));
    if (!ok) return res.status(401).send("bad signature");

    const data = JSON.parse(raw || "{}");

    // интересует webhook типа payment_finished
    if (data?.type === "payment_finished") {
      const pm = data?.session?.acquiring_payments?.[0];
      if (pm?.status === "succeeded") {
        // TODO: записать в вашу систему (метрика, письмо, обновление "Reporting")
        console.log("Donation OK:", data.session.id, pm.id);
      }
    }

    // В любом случае ответьте 200 OK
    res.status(200).send("ok");
  } catch (e) {
    res.status(200).send("ok"); // даже при ошибках — чтобы не повторяли бесконечно
  }
};
