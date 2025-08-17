import { query, cors } from "./_db.js";

export default async (req) => {
  if (req.method === "OPTIONS") return cors({}, 204);

  if (req.method === "GET") {
    const url = new URL(req.url);
    const hasLimit = url.searchParams.has("limit") || url.searchParams.has("offset");
    if (hasLimit) {
      const limit  = Math.min(Math.max(parseInt(url.searchParams.get("limit")  || "200", 10), 1), 1000);
      const offset = Math.max(parseInt(url.searchParams.get("offset") || "0",   10), 0);
      const { rows } = await query(
        "select name, ts from hearts order by ts desc limit $1 offset $2",
        [limit, offset]
      );
      return cors(rows);
    }
    // без параметров — вернуть все
    const { rows } = await query("select name, ts from hearts order by ts desc");
    return cors(rows);
  }

  if (req.method === "POST") {
    const { name } = await req.json().catch(() => ({}));
    const n = (name || "Anon").toString().slice(0, 80);
    await query("insert into hearts(name) values($1)", [n]);
    return cors({ ok: true });
  }

  return cors({ error: "Method not allowed" }, 405);
};
