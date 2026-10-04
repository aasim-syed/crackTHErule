"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PatternChip } from "@/components/Board";

const HeroScene = dynamic(() => import("@/components/HeroScene"), { ssr: false });

const LEVELS = [
  { id: "easy", blurb: "One or two switches matter.", dots: 1 },
  { id: "medium", blurb: "Counting, neighbours, if-then.", dots: 2 },
  { id: "hard", blurb: "Symmetry and sneaky combos.", dots: 3 },
] as const;

const STEPS = [
  { n: "01", title: "Test", body: "Flip any of the six switches and try the door. Every try costs a point, so make each one count." },
  { n: "02", title: "Theorize", body: "Is it about which switches? How many? Neighbours? Symmetry? Spot the pattern before the AI does." },
  { n: "03", title: "Prove it", body: "Take the exam: predict the door for 8 new patterns. Ace it to crack the rule. Miss one, +3 points." },
];

export default function Home() {
  const router = useRouter();
  const [twist, setTwist] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [demo, setDemo] = useState<{ bits: string; open: boolean }[]>([]);

  async function play(difficulty: string) {
    setLoading(difficulty);
    try {
      const res = await fetch("/api/puzzle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ difficulty, twist }) });
      const { token } = await res.json();
      router.push(`/play?p=${token}`);
    } catch {
      setLoading(null);
    }
  }

  return (
    <main className="w-full">
      {/* Hero */}
      <section className="relative h-[100svh] min-h-[620px] overflow-hidden">
        <HeroScene onStep={(bits, open) => setDemo((d) => [...d.slice(-3), { bits, open }])} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#070a16] from-25% via-[#070a16]/40 via-50% to-transparent md:bg-gradient-to-r md:from-[#070a16] md:from-0% md:via-[#070a16]/60 md:via-40% md:to-transparent" />

        <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <span className="text-lg font-black tracking-tight">
            CRACK <span className="text-amber-300">THE</span> RULE
          </span>
          <Link href="/create" className="rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold backdrop-blur hover:bg-white/10">
            Make a rule
          </Link>
        </nav>

        <div className="pointer-events-none relative z-10 mx-auto flex h-[calc(100%-76px)] max-w-6xl flex-col px-4 pb-10 pt-[6vh] md:justify-center md:pt-0">
          <div className="pointer-events-auto max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300/90 sm:text-sm">Six switches · one door · you vs AI</p>
            <h1 className="mt-4 text-6xl font-black leading-[0.9] tracking-tight sm:text-8xl">
              Crack
              <br />
              the <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">Rule.</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-white/75 sm:text-lg">
              A secret rule decides when the door opens. Experiment, form a theory, and prove it in fewer tries than the AI.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => play("medium")}
                disabled={loading !== null}
                className="rounded-xl bg-amber-300 px-7 py-3.5 font-bold text-slate-950 shadow-[0_0_40px] shadow-amber-300/30 transition hover:bg-amber-200 disabled:opacity-60"
              >
                {loading === "medium" ? "Opening…" : "Race the AI"}
              </button>
              <a href="#play" className="rounded-xl border border-white/20 px-6 py-3.5 font-semibold backdrop-blur hover:bg-white/10">
                Choose difficulty
              </a>
            </div>
          </div>

          <div className="mt-auto max-w-xl md:mt-12" aria-live="off">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">Live: testing a mystery rule</p>
            <div className="mt-2 flex min-h-[30px] flex-wrap gap-1.5">
              {demo.map((d, i) => (
                <PatternChip key={`${i}-${d.bits}`} bits={d.bits} open={d.open} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <h2 className="text-3xl font-black sm:text-5xl">How it works</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <span className="font-mono text-sm text-amber-300">{s.n}</span>
              <h3 className="mt-2 text-2xl font-bold">{s.title}</h3>
              <p className="mt-2 text-white/65">{s.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-white/60">
          You race an AI on the same rule. Its tries stay hidden until you finish, then you get to watch how it reasoned, guess by guess.
        </p>
      </section>

      {/* Play */}
      <section id="play" className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-20 sm:pb-28">
        <h2 className="text-3xl font-black sm:text-5xl">Pick your poison</h2>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => play(l.id)}
              disabled={loading !== null}
              className="group rounded-2xl border border-white/15 bg-white/[0.04] p-6 text-left transition hover:-translate-y-0.5 hover:border-amber-300/60 hover:bg-amber-300/5 disabled:opacity-50"
            >
              <span className="flex gap-1" aria-hidden>
                {[1, 2, 3].map((d) => (
                  <span key={d} className={`h-2 w-6 rounded-full ${d <= l.dots ? "bg-amber-300" : "bg-white/15"}`} />
                ))}
              </span>
              <span className="mt-4 block text-2xl font-bold capitalize">{loading === l.id ? "Loading…" : l.id}</span>
              <span className="mt-1 block text-sm text-white/60">{l.blurb}</span>
            </button>
          ))}
        </div>
        <label className="mt-5 flex w-fit cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={twist} onChange={(e) => setTwist(e.target.checked)} className="h-4 w-4 accent-fuchsia-400" />
          <span>
            <strong className="text-fuchsia-200">Twist mode</strong>
            <span className="text-white/60">: the rule secretly changes partway through. Who notices first?</span>
          </span>
        </label>
      </section>

      {/* Create */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-amber-300/25 bg-gradient-to-br from-amber-300/10 via-transparent to-fuchsia-500/10 p-8 sm:p-12">
          <h2 className="text-3xl font-black sm:text-4xl">Think you can stump the AI?</h2>
          <p className="mt-3 max-w-xl text-white/70">Invent a rule, get a link, send it to your friends. They race the AI to crack it, and nobody sees the answer until the end.</p>
          <Link href="/create" className="mt-6 inline-block rounded-xl bg-white px-6 py-3 font-bold text-slate-950 hover:bg-amber-100">
            Make a rule
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-white/40">Crack the Rule: a game about thinking like a scientist.</footer>
    </main>
  );
}
