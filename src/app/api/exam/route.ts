import { makeExam } from "@/lib/puzzle";

export async function POST(req: Request) {
  const { seen } = await req.json().catch(() => ({}));
  const list = Array.isArray(seen) ? seen.filter((s): s is string => typeof s === "string") : [];
  return Response.json({ questions: makeExam(list) });
}
