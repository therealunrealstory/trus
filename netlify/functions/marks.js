import { query, cors } from "./_db.js";

export default async (req) => {
  if (req.method === "OPTIONS") return cors({}, 204);

  if (req.method === "GET") {
    const url = new URL(req.url);
    const hasLimit = url.searchParams.has("limit") || url.searchParams.has("offset");
    if (hasLimit) {
      const limit  = Math.min(Math.max(parseInt(url.searchParams.get("limit")  || "500", 10), 1), 5000);
      const offset = Math.max(parseInt(url.searchParams.get("offset") || "0",   10), 0);
      const { rows } = await query(
        "select name, message, lat, lon, ts from marks order by ts desc limit $1 offset $2",
        [limit, offset]
      );
      return cors(rows);
    }
    // без параметров — вернуть все
    const { rows } = await query(
      "select name, message, lat, lon, ts from marks order by ts desc"
    );
    return cors(rows);
  }

  if (req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    const name = (b.name || null)?.toString().slice(0, 80);
    const message = (b.message || "").toString().slice(0, 240);
    const lat = Number(b.lat), lon = Number(b.lon);
    if (!message || Number.isNaN(lat) || Number.isNaN(lon)) {
      return cors({ error: "Bad request" }, 400);
    }
    await query(
      "insert into marks(name, message, lat, lon) values($1,$2,$3,$4)",
      [name, message, lat, lon]
    );
    return cors({ ok: true });
  }

  return cors({ error: "Method not allowed" }, 405);
};
