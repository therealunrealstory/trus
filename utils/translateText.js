// utils/translateText.js
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Перевод текста через OpenAI Responses API.
 * @param {string} text - исходный текст (EN)
 * @param {string} lang - целевой язык (например: "es", "de", "pt", "it", "ru", "fr", "ar", "cn")
 * @returns {Promise<{text: string, provider: string}>}
 */
export async function translateText(text, lang) {
  if (!text || !lang || lang.toLowerCase() === "en") {
    return { text: text || "", provider: "none" };
  }

  // для человекочитаемого имени языка
  const LANG_NAMES = { ru:"Russian", es:"Spanish", pt:"Portuguese", fr:"French", it:"Italian", de:"German", cn:"Chinese", ar:"Arabic" };
  const targetName = LANG_NAMES[lang.toLowerCase()] || lang;

  const systemPrompt =
    `You are a professional translator. Translate the user's message into ${targetName}. ` +
    `Keep punctuation, hashtags, emojis, URLs and line breaks. Do not add explanations. ` +
    `Return ONLY the translated text. If the source already looks like ${targetName}, return it unchanged.`;

  const resp = await client.responses.create({
    model: "gpt-5-nano",
    input: [
      { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
      { role: "user",   content: [{ type: "input_text", text }] }
    ],
    // max_output_tokens: 400, // можно добавить лимит при желании
  });

  const out = (resp.output_text || "").trim();
  return { text: out, provider: "openai:gpt-5-nano" };
}
