import { grade, open, EXAM_SIZE } from "@/lib/puzzle";
import { isBits } from "@/lib/rules";

export async function POST(req: Request) {
  const { token, probeIndex, questions, answers } = await req.json().catch(() => ({}));
  const p = open(token);
  const ok =
    p &&
    Number.isInteger(probeIndex) &&
    Array.isArray(questions) &&
    questions.length === EXAM_SIZE &&
    questions.every(isBits) &&
    Array.isArray(answers) &&
    answers.length === EXAM_SIZE &&
    answers.every((a) => typeof a === "boolean");
  if (!ok) return Response.json({ error: "Bad request" }, { status: 400 });
  return Response.json(grade(p, probeIndex, questions, answers));
}
