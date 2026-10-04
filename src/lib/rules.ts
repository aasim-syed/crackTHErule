// Rule language for the 6-switch door. Pure and shared by server and client
// (the client only uses it in the creator screen, never with a hidden rule).

export const N = 6;

export type Rule =
  | { op: "on"; i: number } // switch i (0-based) is on
  | { op: "not"; a: Rule }
  | { op: "and" | "or" | "xor" | "implies"; a: Rule; b: Rule }
  | { op: "count"; cmp: "eq" | "ge" | "le"; n: number } // number of switches on
  | { op: "even" } // an even number of switches are on
  | { op: "adjacent" } // at least two neighbouring switches are both on
  | { op: "symmetric" }; // the pattern reads the same left-to-right and right-to-left

export type Switches = boolean[];

export function evaluate(r: Rule, s: Switches): boolean {
  switch (r.op) {
    case "on":
      return s[r.i];
    case "not":
      return !evaluate(r.a, s);
    case "and":
      return evaluate(r.a, s) && evaluate(r.b, s);
    case "or":
      return evaluate(r.a, s) || evaluate(r.b, s);
    case "xor":
      return evaluate(r.a, s) !== evaluate(r.b, s);
    case "implies":
      return !evaluate(r.a, s) || evaluate(r.b, s);
    case "count": {
      const c = s.filter(Boolean).length;
      return r.cmp === "eq" ? c === r.n : r.cmp === "ge" ? c >= r.n : c <= r.n;
    }
    case "even":
      return s.filter(Boolean).length % 2 === 0;
    case "adjacent":
      return s.some((v, i) => i > 0 && v && s[i - 1]);
    case "symmetric":
      return s.every((v, i) => v === s[N - 1 - i]);
  }
}

export function allAssignments(): Switches[] {
  return Array.from({ length: 1 << N }, (_, m) =>
    Array.from({ length: N }, (_, i) => Boolean((m >> i) & 1)),
  );
}

export function truthTable(r: Rule): boolean[] {
  return allAssignments().map((s) => evaluate(r, s));
}

export function describe(r: Rule): string {
  switch (r.op) {
    case "on":
      return `switch ${r.i + 1} is on`;
    case "not":
      return r.a.op === "on" ? `switch ${r.a.i + 1} is off` : `NOT (${describe(r.a)})`;
    case "and":
      return `${describe(r.a)} AND ${describe(r.b)}`;
    case "or":
      return `${describe(r.a)} OR ${describe(r.b)}`;
    case "xor":
      return `exactly one of: (${describe(r.a)}), (${describe(r.b)})`;
    case "implies":
      return `if ${describe(r.a)}, then ${describe(r.b)}`;
    case "count":
      return `${r.cmp === "eq" ? "exactly" : r.cmp === "ge" ? "at least" : "at most"} ${r.n} switch${r.n === 1 ? " is" : "es are"} on`;
    case "even":
      return "an even number of switches are on";
    case "adjacent":
      return "two neighbouring switches are both on";
    case "symmetric":
      return "the pattern is a mirror image (palindrome)";
  }
}

const MAX_DEPTH = 4;

export function validate(x: unknown, depth = 0): x is Rule {
  if (depth > MAX_DEPTH || typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  const int = (v: unknown, lo: number, hi: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
  switch (r.op) {
    case "on":
      return int(r.i, 0, N - 1);
    case "not":
      return validate(r.a, depth + 1);
    case "and":
    case "or":
    case "xor":
    case "implies":
      return validate(r.a, depth + 1) && validate(r.b, depth + 1);
    case "count":
      return ["eq", "ge", "le"].includes(r.cmp as string) && int(r.n, 0, N);
    case "even":
    case "adjacent":
    case "symmetric":
      return true;
    default:
      return false;
  }
}

/** Rules that are almost always open or almost always closed are no fun. */
export function isPlayable(r: Rule): boolean {
  const trues = truthTable(r).filter(Boolean).length;
  return trues >= 6 && trues <= 58;
}

export function sameBehaviour(a: Rule, b: Rule): boolean {
  const ta = truthTable(a);
  return truthTable(b).every((v, i) => v === ta[i]);
}

export type Difficulty = "easy" | "medium" | "hard";

type Rng = () => number;
const pick = <T,>(rng: Rng, xs: T[]): T => xs[Math.floor(rng() * xs.length)];
const sw = (rng: Rng): Rule => ({ op: "on", i: Math.floor(rng() * N) });
const twoSw = (rng: Rng): [Rule, Rule] => {
  const i = Math.floor(rng() * N);
  const j = (i + 1 + Math.floor(rng() * (N - 1))) % N;
  return [
    { op: "on", i },
    { op: "on", i: j },
  ];
};
const off = (r: Rule): Rule => ({ op: "not", a: r });

const TEMPLATES: Record<Difficulty, ((rng: Rng) => Rule)[]> = {
  easy: [
    (rng) => sw(rng),
    (rng) => ({ op: "count", cmp: "eq", n: pick(rng, [2, 3, 4]) }),
    (rng) => {
      const [a, b] = twoSw(rng);
      return { op: "and", a, b: off(b) };
    },
    (rng) => {
      const [a, b] = twoSw(rng);
      return { op: "or", a, b };
    },
  ],
  medium: [
    (rng) => ({ op: "count", cmp: pick(rng, ["ge", "le"] as const), n: pick(rng, [2, 3, 4]) }),
    () => ({ op: "even" }),
    () => ({ op: "adjacent" }),
    (rng) => {
      const [a, b] = twoSw(rng);
      return { op: "xor", a, b };
    },
    (rng) => {
      const [a, b] = twoSw(rng);
      return { op: "implies", a, b };
    },
    (rng) => ({ op: "and", a: sw(rng), b: { op: "count", cmp: "le", n: pick(rng, [2, 3]) } }),
  ],
  hard: [
    () => ({ op: "symmetric" }),
    () => off({ op: "adjacent" }),
    (rng) => ({ op: "and", a: { op: "adjacent" }, b: off(sw(rng)) }),
    (rng) => ({ op: "xor", a: { op: "even" }, b: sw(rng) }),
    (rng) => {
      const [a, b] = twoSw(rng);
      return { op: "or", a: { op: "and", a, b }, b: { op: "count", cmp: "ge", n: 5 } };
    },
    (rng) => ({ op: "and", a: { op: "count", cmp: "ge", n: pick(rng, [2, 3]) }, b: off({ op: "adjacent" }) }),
  ],
};

export function generate(difficulty: Difficulty, rng: Rng = Math.random, avoid?: Rule): Rule {
  for (;;) {
    const r = pick(rng, TEMPLATES[difficulty])(rng);
    if (isPlayable(r) && !(avoid && sameBehaviour(r, avoid))) return r;
  }
}

export const toBits = (s: Switches) => s.map((v) => (v ? "1" : "0")).join("");
export const fromBits = (b: string): Switches => b.split("").map((c) => c === "1");
export const isBits = (b: unknown): b is string => typeof b === "string" && /^[01]{6}$/.test(b);
