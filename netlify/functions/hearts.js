import { query, cors } from "./_db.js";

export default async (req) => {
  if (req.method === "OPTIONS") return cors({}, 204);

  if (req.method === "GET") {
    const { rows } = await query(
      "select name, ts from hearts order by ts desc"
    );
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

