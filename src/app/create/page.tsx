"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Switches } from "@/components/Board";
import { allAssignments, describe, evaluate, isPlayable, sameBehaviour, toBits, type Rule } from "@/lib/rules";

type CondKind = "on" | "off" | "count" | "even" | "odd" | "adjacent" | "no-adjacent" | "symmetric";
type Cond = { kind: CondKind; i: number; cmp: "eq" | "ge" | "le"; n: number };
type Combo = "none" | "and" | "or" | "xor" | "implies";
type Draft = { a: Cond; combo: Combo; b: Cond };

const KINDS: { id: CondKind; label: string }[] = [
  { id: "on", label: "Switch # is ON" },
  { id: "off", label: "Switch # is OFF" },
  { id: "count", label: "Number of switches ON" },
  { id: "even", label: "An even number are ON" },
  { id: "odd", label: "An odd number are ON" },
  { id: "adjacent", label: "Two neighbours are both ON" },
  { id: "no-adjacent", label: "No two neighbours are both ON" },
  { id: "symmetric", label: "Pattern is a mirror image" },
];

const COMBOS: { id: Combo; label: string }[] = [
  { id: "none", label: "just this" },
  { id: "and", label: "AND" },
  { id: "or", label: "OR" },
  { id: "xor", label: "exactly one of (XOR)" },
  { id: "implies", label: "IF first, THEN" },
];

function condRule(c: Cond): Rule {
  switch (c.kind) {
    case "on":
      return { op: "on", i: c.i };
    case "off":
      return { op: "not", a: { op: "on", i: c.i } };
    case "count":
      return { op: "count", cmp: c.cmp, n: c.n };
    case "even":
      return { op: "even" };
    case "odd":
      return { op: "not", a: { op: "even" } };
    case "adjacent":
      return { op: "adjacent" };
    case "no-adjacent":
      return { op: "not", a: { op: "adjacent" } };
    case "symmetric":
      return { op: "symmetric" };
  }
}

function draftRule(d: Draft): Rule {
  const a = condRule(d.a);
  return d.combo === "none" ? a : { op: d.combo, a, b: condRule(d.b) };
}

const defaultCond = (kind: CondKind, i = 0): Cond => ({ kind, i, cmp: "eq", n: 3 });

function CondEditor({ value, onChange }: { value: Cond; onChange: (c: Cond) => void }) {
  const select = "rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={select} value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value as CondKind })} aria-label="Condition">
        {KINDS.map((k) => (
          <option key={k.id} value={k.id}>
            {k.label}
          </option>
        ))}
      </select>
      {(value.kind === "on" || value.kind === "off") && (
        <select className={select} value={value.i} onChange={(e) => onChange({ ...value, i: Number(e.target.value) })} aria-label="Switch number">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <option key={i} value={i}>
              Switch {i + 1}
            </option>
          ))}
        </select>
      )}
      {value.kind === "count" && (
        <>
          <select className={select} value={value.cmp} onChange={(e) => onChange({ ...value, cmp: e.target.value as Cond["cmp"] })} aria-label="Comparison">
            <option value="eq">is exactly</option>
            <option value="ge">is at least</option>
            <option value="le">is at most</option>
          </select>
          <select className={select} value={value.n} onChange={(e) => onChange({ ...value, n: Number(e.target.value) })} aria-label="Count">
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

function RuleEditor({ title, value, onChange }: { title: string; value: Draft; onChange: (d: Draft) => void }) {
  const rule = draftRule(value);
  const table = allAssignments().map((s) => ({ bits: toBits(s), open: evaluate(rule, s) }));
  const opens = table.filter((t) => t.open);
  const playable = isPlayable(rule);
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-1 text-sm text-white/60">The door opens when…</p>
      <div className="mt-4 space-y-3">
        <CondEditor value={value.a} onChange={(a) => onChange({ ...value, a })} />
        <select
          className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm font-semibold text-amber-200"
          value={value.combo}
          onChange={(e) => onChange({ ...value, combo: e.target.value as Combo })}
          aria-label="Combine with"
        >
          {COMBOS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        {value.combo !== "none" && <CondEditor value={value.b} onChange={(b) => onChange({ ...value, b })} />}
      </div>
      <p className="mt-4 rounded-lg bg-black/20 p-3 text-sm">
        <span className="text-white/50">Rule: </span>
        {describe(rule)}
      </p>
      <p className={`mt-3 text-sm ${playable ? "text-white/70" : "text-rose-300"}`}>
        Opens for {opens.length} of 64 patterns.
        {!playable && " Too easy: the door is almost always open or almost always locked."}
      </p>
      {opens.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Example patterns that open the door">
          {opens.slice(0, 4).map((t) => (
            <Switches key={t.bits} bits={t.bits} small />
          ))}
        </div>
      )}
    </section>
  );
}

export default function CreatePage() {
  const [main, setMain] = useState<Draft>({ a: defaultCond("on", 1), combo: "and", b: defaultCond("off", 4) });
  const [twistOn, setTwistOn] = useState(false);
  const [twist, setTwist] = useState<Draft>({ a: defaultCond("count"), combo: "none", b: defaultCond("on") });
  const [author, setAuthor] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const mainRule = useMemo(() => draftRule(main), [main]);
  const twistRule = useMemo(() => draftRule(twist), [twist]);
  const valid = isPlayable(mainRule) && (!twistOn || (isPlayable(twistRule) && !sameBehaviour(mainRule, twistRule)));

  async function create() {
    setError("");
    const res = await fetch("/api/puzzle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rule: mainRule, twist: twistOn, twistRule: twistOn ? twistRule : undefined, author }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setLink(`${window.location.origin}/play?p=${data.token}`);
  }

  async function copy() {
    await navigator.clipboard.writeText(`I made a secret rule. Can you crack it faster than an AI? ${link}`);
    setCopied(true);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <Link href="/" className="text-lg font-black tracking-tight">
        CRACK <span className="text-amber-300">THE</span> RULE
      </Link>
      <h1 className="mt-6 text-3xl font-black sm:text-4xl">Make a rule. Stump the AI.</h1>
      <p className="mt-2 text-white/70">Your friends race the AI to crack it. Nobody sees the rule until the round is over.</p>

      <div className="mt-8 space-y-5">
        <RuleEditor title="Your secret rule" value={main} onChange={(d) => { setMain(d); setLink(""); }} />

        <label className="flex w-fit cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={twistOn} onChange={(e) => { setTwistOn(e.target.checked); setLink(""); }} className="h-4 w-4 accent-fuchsia-400" />
          <span>
            <strong className="text-fuchsia-200">Add a twist</strong>
            <span className="text-white/60">: secretly switch to a second rule after 6 tries.</span>
          </span>
        </label>
        {twistOn && <RuleEditor title="The twist rule" value={twist} onChange={(d) => { setTwist(d); setLink(""); }} />}
        {twistOn && sameBehaviour(mainRule, twistRule) && <p className="text-sm text-rose-300">The twist rule behaves exactly like the first one.</p>}

        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={30}
          placeholder="Your name (optional)"
          className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2.5 sm:w-72"
          aria-label="Your name"
        />

        {!link ? (
          <button onClick={create} disabled={!valid} className="block rounded-xl bg-amber-300 px-6 py-3 font-bold text-slate-950 hover:bg-amber-200 disabled:opacity-40">
            Get challenge link
          </button>
        ) : (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-4">
            <p className="font-semibold">Your challenge link is ready.</p>
            <p className="mt-2 break-all font-mono text-xs text-white/70">{link}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button onClick={copy} className="rounded-xl bg-amber-300 px-5 py-2.5 font-bold text-slate-950">
                {copied ? "Copied!" : "Copy link"}
              </button>
              <a href={link} className="rounded-xl border border-white/20 px-5 py-2.5 font-semibold hover:bg-white/5">
                Play it yourself
              </a>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>
    </main>
  );
}
