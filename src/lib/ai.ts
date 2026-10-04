import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Evidence } from "./types";
import { EXAM_PENALTY, EXAM_SIZE } from "./puzzle";

const client = new Anthropic();
const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

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
  return history
    .map((e, i) => `${i + 1}. ${e.bits} -> ${e.open ? "OPEN" : "closed"}${e.source === "exam" ? " (revealed by a failed exam)" : ""}`)
    .join("\n");
}

async function call<T extends z.ZodType>(schema: T, twist: boolean, user: string): Promise<z.infer<T>> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    system: [{ type: "text", text: SYSTEM + (twist ? TWIST : ""), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined this request.");
  if (!response.parsed_output) throw new Error("The model returned an unreadable move.");
  return response.parsed_output as z.infer<T>;
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
