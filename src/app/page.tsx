"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Door, Switches } from "@/components/Board";

const LEVELS = [
  { id: "easy", blurb: "One or two switches matter." },
  { id: "medium", blurb: "Counting, neighbours, if-then." },
  { id: "hard", blurb: "Symmetry and sneaky combos." },
] as const;

export default function Home() {
  const router = useRouter();
  const [twist, setTwist] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function play(difficulty: string) {
    setLoading(difficulty);
    const res = await fetch("/api/puzzle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ difficulty, twist }) });
    const { token } = await res.json();
    router.push(`/play?p=${token}`);
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:py-20">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300/80">A game of experiments</p>
      <h1 className="mt-3 text-5xl font-black leading-none tracking-tight sm:text-7xl">
        Crack the
        <br />
        <span className="text-amber-300">Rule.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-white/70">
        Six switches. One door. A secret rule decides when it opens. Test patterns, form a theory, and prove it, in fewer tries than the AI.
      </p>

      <div className="mt-10 flex items-center gap-6" aria-hidden>
        <Switches bits="101100" small />
        <Door state="open" small />
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            onClick={() => play(l.id)}
            disabled={loading !== null}
            className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 text-left transition hover:border-amber-300/60 hover:bg-amber-300/5 disabled:opacity-50"
          >
            <span className="text-xl font-bold capitalize">{loading === l.id ? "Loading…" : l.id}</span>
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

      <div className="mt-12 rounded-2xl border border-white/10 p-5">
        <p className="font-semibold">Think you can stump the AI?</p>
        <p className="mt-1 text-sm text-white/60">Invent your own rule and send the link to friends. They race Claude to crack it.</p>
        <Link href="/create" className="mt-4 inline-block rounded-xl bg-white/10 px-5 py-2.5 font-semibold hover:bg-white/15">
          Make a rule
        </Link>
      </div>
    </main>
  );
}
