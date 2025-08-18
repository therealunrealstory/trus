// netlify/functions/tg-file.js
export default async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("", {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "Content-Type",
        },
      });
    }
    const url = new URL(req.url);
    const filePath = url.searchParams.get("path");
    if (!filePath) return new Response("Bad request", { status: 400 });

    const token = process.env.TELEGRAM_NOWADAYS_BOT_TOKEN;
    if (!token) return new Response("Not configured", { status: 500 });

    const upstream = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    if (!upstream.ok) return new Response("Upstream error", { status: upstream.status });

    // Проксируем тело + контент-тайп, добавляем CORS и кэш
    const headers = new Headers(upstream.headers);
    headers.set("access-control-allow-origin", "*");
    if (!headers.has("cache-control")) {
      headers.set("cache-control", "public, max-age=31536000, immutable");
    }
    return new Response(upstream.body, { status: 200, headers });
  } catch (e) {
    console.error("tg-file error:", e);
    return new Response("server error", { status: 500 });
  }
};
