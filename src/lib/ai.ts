import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";
import type { Evidence } from "./types";
import { EXAM_PENALTY, EXAM_SIZE } from "./puzzle";

// Free-tier Groq allows ~8k tokens/minute, so keep moves lean and wait out 429s.
const client = new Groq({ maxRetries: 6 }); // reads GROQ_API_KEY
const MODEL = process.env.AI_MODEL ?? "openai/gpt-oss-120b";

const SYSTEM = `You are playing "Crack the Rule", a live game watched by an audience, against a human opponent.

There is a row of 6 switches, numbered 1 to 6 from left to right, and a door. A hidden rule decides whether the door opens, based only on the current on/off pattern of the switches. Patterns are written as 6 characters, switch 1 first: "1" = on, "0" = off. Example: "100001" means only switches 1 and 6 are on.

The rule may involve particular switches, how many switches are on, whether that number is even, neighbouring switches, mirror symmetry, or AND / OR / XOR / IF-THEN combinations of those ideas. It is deterministic: the same pattern always gives the same result (unless the twist described below happens).

Each turn you either:
- probe: set a pattern and try the door. Every probe costs 1 point. Lower total score wins.
- take_exam: when you think you know the rule, you will be shown ${EXAM_SIZE} patterns and must predict each one. All correct = you win. Any mistake costs ${EXAM_PENALTY} points and reveals the right answers, then you keep playing.

Play like a sharp scientist: choose probes that split your remaining hypotheses, avoid probes whose outcome you can already predict, and take the exam as soon as you are genuinely confident. Don't waste points on certainty you already have, and don't gamble on the exam too early.

Your "commentary" is shown live to the audience: one or two short, lively sentences in first person about what you're testing and why. No markdown.`;

const TWIST = `\n\nTWIST MODE IS ON: at some unknown point the hidden rule will silently change to a different rule. If a new result contradicts what an earlier result implied, suspect the twist, trust recent evidence, and re-test.`;

const Step = z.object({
  commentary: z.string(),
  hypothesis: z.string().describe("Your current best guess at the rule, in plain words, or 'no idea yet'."),
  confidence: z.enum(["low", "medium", "high"]),
  action: z.enum(["probe", "take_exam"]),
  pattern: z.string().describe("6-character pattern of 0s and 1s to probe. Use '000000' if taking the exam."),
  prediction: z.enum(["open", "closed", "unsure"]).describe("What you expect the door to do for this probe."),
});
export type AiStep = z.infer<typeof Step>;

const Exam = z.object({
  answers: z.array(z.enum(["open", "closed"])).describe("One answer per exam pattern, in order."),
  commentary: z.string(),
});

function formatEvidence(history: Evidence[]): string {
  if (history.length === 0) return "No evidence yet. This is your first move.";
  const lines = history
    .map((e, i) => `${i + 1}. ${e.bits} -> ${e.open ? "OPEN" : "closed"}${e.source === "exam" ? " (revealed by a failed exam)" : ""}`)
    .join("\n");
  return `${lines}

Quick notes (computed from the list above; use them, but think for yourself):
${summarize(history)}`;
}

/** The patterns a person would spot by eyeballing their log. Cheap tokens, big help at low reasoning effort. */
function summarize(history: Evidence[]): string {
  const opens = history.filter((e) => e.open).map((e) => e.bits);
  const closeds = history.filter((e) => !e.open).map((e) => e.bits);
  const count = (b: string) => b.split("").filter((c) => c === "1").length;
  const sw = (idx: number[]) => (idx.length ? idx.map((i) => i + 1).join(", ") : "none");
  const notes: string[] = [];
  if (opens.length) {
    const always = (v: string) => [0, 1, 2, 3, 4, 5].filter((i) => opens.every((b) => b[i] === v));
    notes.push(`- Switches ON in every OPEN result: ${sw(always("1"))}`);
    notes.push(`- Switches OFF in every OPEN result: ${sw(always("0"))}`);
    notes.push(`- Number of switches on in OPEN results: ${[...new Set(opens.map(count))].sort().join(", ")}`);
  } else notes.push("- The door has not opened yet.");
  if (closeds.length) notes.push(`- Number of switches on in closed results: ${[...new Set(closeds.map(count))].sort().join(", ")}`);
  const seen = new Map<string, boolean>();
  for (const e of history) {
    if (seen.has(e.bits) && seen.get(e.bits) !== e.open) notes.push(`- CONTRADICTION: ${e.bits} gave different results at different times.`);
    seen.set(e.bits, e.open);
  }
  return notes.join("\n");
}

async function call<T extends z.ZodType>(schema: T, twist: boolean, user: string, attempt = 0): Promise<z.infer<T>> {
  try {
    return await request(schema, twist, user);
  } catch (err) {
    // The model occasionally emits empty/invalid JSON; one retry almost always fixes it.
    const badJson = err instanceof Groq.BadRequestError || err instanceof SyntaxError || err instanceof z.ZodError;
    if (badJson && attempt === 0) return call(schema, twist, user, 1);
    throw err;
  }
}

async function request<T extends z.ZodType>(schema: T, twist: boolean, user: string): Promise<z.infer<T>> {
  const completion = await client.chat.completions.create({
    model: MODEL,
    reasoning_effort: (process.env.AI_REASONING as "low" | "medium" | "high") ?? "low",
    max_completion_tokens: 3000,
    response_format: {
      type: "json_schema",
      json_schema: { name: "move", schema: z.toJSONSchema(schema) as Record<string, unknown>, strict: true },
    },
    messages: [
      { role: "system", content: SYSTEM + (twist ? TWIST : "") },
      { role: "user", content: user },
    ],
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("The model returned an empty move.");
  return schema.parse(JSON.parse(text));
}

export async function nextStep(history: Evidence[], score: number, twist: boolean, lastHypothesis?: string) {
  const user = `Evidence so far (score: ${score} points):\n${formatEvidence(history)}\n\n${
    lastHypothesis ? `Your previous hypothesis: ${lastHypothesis}\n\n` : ""
  }Choose your next move.`;
  return call(Step, twist, user);
}

export async function takeExam(history: Evidence[], questions: string[], twist: boolean, hypothesis: string) {
  const user = `Evidence so far:\n${formatEvidence(history)}\n\nYour hypothesis: ${hypothesis}\n\nEXAM - predict the door for each pattern, in order:\n${questions
    .map((q, i) => `${i + 1}. ${q}`)
    .join("\n")}`;
  const out = await call(Exam, twist, user);
  const answers = questions.map((_, i) => out.answers[i] === "open");
  return { answers, commentary: out.commentary };
}
