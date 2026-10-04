import { nextStep } from "@/lib/ai";
import { open, probe } from "@/lib/puzzle";
import { isBits } from "@/lib/rules";
import { isEvidenceList } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { token, history, score, probeIndex, hypothesis } = await req.json().catch(() => ({}));
  const p = open(token);
  if (!p || !isEvidenceList(history) || !Number.isInteger(probeIndex) || !Number.isInteger(score)) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const step = await nextStep(history, score, p.twistAt !== undefined, typeof hypothesis === "string" ? hypothesis : undefined);
    if (step.action === "probe" && !isBits(step.pattern)) step.action = "take_exam";
    const result = step.action === "probe" ? probe(p, step.pattern, probeIndex) : null;
    return Response.json({ step, result });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "The AI could not make a move. Check ANTHROPIC_API_KEY and the server log." }, { status: 502 });
  }
}
