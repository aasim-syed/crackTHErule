import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { allAssignments, evaluate, fromBits, toBits, validate, type Difficulty, type Rule } from "./rules";

// A puzzle travels as an encrypted token so it can live in a share link and
// be checked by stateless serverless functions without exposing the rule.

export type Puzzle = {
  rules: Rule[]; // rules[1] is the twist rule, if any
  twistAt?: number; // the twist rule applies from this probe number onward (0-based)
  difficulty: Difficulty | "custom";
  author?: string;
};

export const EXAM_SIZE = 8;
export const EXAM_PENALTY = 3;

let warned = false;
function key(): Buffer {
  const secret = process.env.PUZZLE_SECRET;
  if (!secret && !warned) {
    warned = true;
    console.warn("PUZZLE_SECRET is not set; using an insecure development key.");
  }
  return createHash("sha256").update(secret ?? "dev-only-insecure-secret").digest();
}

export function seal(p: Puzzle): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(p), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function open(token: unknown): Puzzle | null {
  if (typeof token !== "string" || token.length > 4000) return null;
  try {
    const raw = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    const p = JSON.parse(json) as Puzzle;
    return Array.isArray(p.rules) && p.rules.every((r) => validate(r)) ? p : null;
  } catch {
    return null;
  }
}

export function activeRule(p: Puzzle, probeIndex: number): Rule {
  return p.twistAt !== undefined && p.rules[1] && probeIndex >= p.twistAt ? p.rules[1] : p.rules[0];
}

export function probe(p: Puzzle, bits: string, probeIndex: number): boolean {
  return evaluate(activeRule(p, probeIndex), fromBits(bits));
}

/** Random exam patterns, preferring ones the player has not already tested. */
export function makeExam(seen: string[]): string[] {
  const seenSet = new Set(seen);
  const pool = allAssignments().map(toBits);
  const fresh = pool.filter((b) => !seenSet.has(b));
  const source = fresh.length >= EXAM_SIZE ? fresh : pool;
  const out: string[] = [];
  while (out.length < EXAM_SIZE) {
    const b = source[Math.floor(Math.random() * source.length)];
    if (!out.includes(b)) out.push(b);
  }
  return out;
}

export function grade(p: Puzzle, probeIndex: number, questions: string[], answers: boolean[]) {
  const rule = activeRule(p, probeIndex);
  const truth = questions.map((q) => evaluate(rule, fromBits(q)));
  const correct = truth.map((t, i) => t === answers[i]);
  return { truth, correct, passed: correct.every(Boolean) };
}
