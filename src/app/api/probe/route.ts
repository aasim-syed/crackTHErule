import { open, probe } from "@/lib/puzzle";
import { isBits } from "@/lib/rules";

export async function POST(req: Request) {
  const { token, bits, probeIndex } = await req.json().catch(() => ({}));
  const p = open(token);
  if (!p || !isBits(bits) || !Number.isInteger(probeIndex)) return Response.json({ error: "Bad request" }, { status: 400 });
  return Response.json({ open: probe(p, bits, probeIndex) });
}
