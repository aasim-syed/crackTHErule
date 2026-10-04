import { takeExam } from "@/lib/ai";
import { grade, makeExam, open } from "@/lib/puzzle";
import { isEvidenceList } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { token, history, probeIndex, hypothesis } = await req.json().catch(() => ({}));
  const p = open(token);
  if (!p || !isEvidenceList(history) || !Number.isInteger(probeIndex)) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const questions = makeExam(history.map((e) => e.bits));
    const { answers, commentary } = await takeExam(history, questions, p.twistAt !== undefined, String(hypothesis ?? ""));
    return Response.json({ questions, answers, commentary, ...grade(p, probeIndex, questions, answers) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "The AI could not take the exam. Check GROQ_API_KEY and the server log." }, { status: 502 });
  }
}
