import { open } from "@/lib/puzzle";
import { describe } from "@/lib/rules";

export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));
  const p = open(token);
  if (!p) return Response.json({ error: "Bad request" }, { status: 400 });
  return Response.json({ rules: p.rules.map(describe), twistAt: p.twistAt ?? null });
}
