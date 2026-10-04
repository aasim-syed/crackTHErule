"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Evidence } from "@/lib/types";
import { Door, PatternChip, Switches } from "./Board";

const PENALTY = 3;
const AI_GIVE_UP_SCORE = 40;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

type Status = "playing" | "exam" | "cracked" | "gave-up";

type AiEntry = Evidence & { prediction?: "open" | "closed" | "unsure"; commentary?: string };

type AiState = {
  history: AiEntry[];
  probes: number;
  penalty: number;
  status: Status | "thinking" | "error";
  commentary: string;
  hypothesis: string;
  confidence: string;
  pending?: { bits: string; prediction: string };
  error?: string;
};

type Meta = { twist: boolean; difficulty: string; author?: string };

export default function Game({ token, meta }: { token: string; meta: Meta }) {
  const [started, setStarted] = useState(false);

  // --- Human side ---
  const [bits, setBits] = useState("000000");
  const [lastProbe, setLastProbe] = useState<{ bits: string; open: boolean } | null>(null);
  const [history, setHistory] = useState<Evidence[]>([]);
  const [penalty, setPenalty] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [busy, setBusy] = useState(false);
  const [exam, setExam] = useState<{ questions: string[]; answers: (boolean | null)[]; result?: { truth: boolean[]; correct: boolean[]; passed: boolean } } | null>(null);
  const probes = history.filter((e) => e.source === "probe").length;
  const score = probes + penalty;

  // --- AI side ---
  const [ai, setAi] = useState<AiState>({ history: [], probes: 0, penalty: 0, status: "playing", commentary: "", hypothesis: "", confidence: "" });
  const aiRunning = useRef(false);
  const aiScore = ai.probes + ai.penalty;
  const aiDone = ai.status === "cracked" || ai.status === "gave-up";
  const humanDone = status === "cracked" || status === "gave-up";

  const [reveal, setReveal] = useState<{ rules: string[]; twistAt: number | null } | null>(null);
  const [copied, setCopied] = useState(false);

  async function runAi(initial: AiState) {
    if (aiRunning.current) return;
    aiRunning.current = true;
    const s: AiState = { ...initial, status: "thinking", error: undefined };
    const publish = () => setAi({ ...s, history: [...s.history] });
    publish();
    try {
      while (s.probes + s.penalty < AI_GIVE_UP_SCORE) {
        s.status = "thinking";
        s.pending = undefined;
        publish();
        const evidence = s.history.map(({ bits, open, source }) => ({ bits, open, source }));
        const { step, result } = await post<{
          step: { commentary: string; hypothesis: string; confidence: string; action: string; pattern: string; prediction: "open" | "closed" | "unsure" };
          result: boolean | null;
        }>("/api/ai/step", { token, history: evidence, score: s.probes + s.penalty, probeIndex: s.probes, hypothesis: s.hypothesis });
        s.commentary = step.commentary;
        s.hypothesis = step.hypothesis;
        s.confidence = step.confidence;

        if (step.action === "probe" && result !== null) {
          s.status = "playing";
          s.pending = { bits: step.pattern, prediction: step.prediction };
          publish();
          await sleep(1100);
          s.history.push({ bits: step.pattern, open: result, source: "probe", prediction: step.prediction, commentary: step.commentary });
          s.probes += 1;
          s.pending = undefined;
          publish();
          await sleep(500);
          continue;
        }

        s.status = "exam";
        publish();
        const ex = await post<{ questions: string[]; answers: boolean[]; truth: boolean[]; correct: boolean[]; passed: boolean; commentary: string }>(
          "/api/ai/exam",
          { token, history: evidence, probeIndex: s.probes, hypothesis: s.hypothesis },
        );
        s.commentary = ex.commentary;
        if (ex.passed) {
          s.status = "cracked";
          publish();
          return;
        }
        s.penalty += PENALTY;
        ex.questions.forEach((q, i) => {
          if (!ex.correct[i]) s.history.push({ bits: q, open: ex.truth[i], source: "exam" });
        });
        s.commentary = `Failed the exam (${ex.correct.filter((c) => !c).length} wrong, +${PENALTY}). ${ex.commentary}`;
        publish();
        await sleep(1500);
      }
      s.status = "gave-up";
      s.commentary = "I'm out of ideas. This rule beat me.";
      publish();
    } catch (err) {
      s.status = "error";
      s.error = err instanceof Error ? err.message : String(err);
      publish();
    } finally {
      aiRunning.current = false;
    }
  }

  function start() {
    setStarted(true);
    void runAi(ai);
  }

  function toggle(i: number) {
    setBits((b) => b.slice(0, i) + (b[i] === "1" ? "0" : "1") + b.slice(i + 1));
  }

  async function tryDoor() {
    setBusy(true);
    try {
      const { open } = await post<{ open: boolean }>("/api/probe", { token, bits, probeIndex: probes });
      setLastProbe({ bits, open });
      setHistory((h) => [...h, { bits, open, source: "probe" }]);
    } finally {
      setBusy(false);
    }
  }

  async function startExam() {
    setBusy(true);
    try {
      const { questions } = await post<{ questions: string[] }>("/api/exam", { seen: history.map((e) => e.bits) });
      setExam({ questions, answers: questions.map(() => null) });
      setStatus("exam");
    } finally {
      setBusy(false);
    }
  }

  async function submitExam() {
    if (!exam || exam.answers.some((a) => a === null)) return;
    setBusy(true);
    try {
      const result = await post<{ truth: boolean[]; correct: boolean[]; passed: boolean }>("/api/grade", {
        token,
        probeIndex: probes,
        questions: exam.questions,
        answers: exam.answers,
      });
      setExam({ ...exam, result });
      if (!result.passed) {
        setPenalty((p) => p + PENALTY);
        setHistory((h) => [...h, ...exam.questions.flatMap((q, i) => (result.correct[i] ? [] : [{ bits: q, open: result.truth[i], source: "exam" as const }]))]);
      }
    } finally {
      setBusy(false);
    }
  }

  function closeExam() {
    setStatus(exam?.result?.passed ? "cracked" : "playing");
    setExam(null);
  }

  useEffect(() => {
    if (!humanDone || !aiDone) return;
    post<{ rules: string[]; twistAt: number | null }>("/api/reveal", { token }).then(setReveal, () => {});
  }, [humanDone, aiDone, token]);

  const doorState = lastProbe && lastProbe.bits === bits ? (lastProbe.open ? "open" : "closed") : "untested";
  const showAiDetails = humanDone;

  let verdict = "";
  if (humanDone && aiDone) {
    if (status === "gave-up" && ai.status === "gave-up") verdict = "Nobody cracked it. Diabolical rule.";
    else if (status === "gave-up") verdict = `The AI wins with ${aiScore} points.`;
    else if (ai.status === "gave-up") verdict = `You win! The AI gave up; you cracked it in ${score}.`;
    else if (score < aiScore) verdict = `You beat the AI! ${score} vs ${aiScore}.`;
    else if (score > aiScore) verdict = `The AI wins, ${aiScore} vs your ${score}.`;
    else verdict = `Dead heat: ${score} each.`;
  }

  async function share() {
    const url = window.location.href;
    const text =
      status === "cracked"
        ? `I cracked this secret rule in ${score} points${aiDone && ai.status === "cracked" ? ` (the AI needed ${aiScore})` : ""}. Can you beat it?`
        : "Can you crack this secret rule faster than an AI?";
    try {
      if (navigator.share) await navigator.share({ title: "Crack the Rule", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-lg font-black tracking-tight">
          CRACK <span className="text-amber-300">THE</span> RULE
        </Link>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/15 px-3 py-1 capitalize">{meta.difficulty}</span>
          {meta.author && <span className="rounded-full border border-white/15 px-3 py-1">Rule by {meta.author}</span>}
          {meta.twist && <span className="rounded-full border border-fuchsia-400/50 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-200">Twist: the rule secretly changes once</span>}
        </div>
      </header>

      {!started && (
        <div className="mb-6 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-5 sm:p-6">
          <h1 className="text-xl font-bold sm:text-2xl">A secret rule decides when the door opens.</h1>
          <p className="mt-2 max-w-2xl text-white/70">
            Flip switches and try the door. Each try costs 1 point. When you think you&apos;ve got it, take the exam: predict 8 patterns. Ace it to win; a
            mistake costs {PENALTY} points. You&apos;re racing an AI on the same rule, so lowest score wins.
          </p>
          <button onClick={start} className="mt-4 rounded-xl bg-amber-300 px-6 py-3 font-bold text-slate-950 hover:bg-amber-200">
            Start the race
          </button>
        </div>
      )}

      {verdict && (
        <div className="mb-6 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-5 sm:p-6">
          <p className="text-2xl font-black sm:text-3xl">{verdict}</p>
          {reveal && (
            <div className="mt-3 space-y-1 text-white/80">
              <p>
                The rule was: <strong className="text-amber-200">{reveal.rules[0]}</strong>
              </p>
              {reveal.rules[1] && (
                <p>
                  Twist after try #{reveal.twistAt}: <strong className="text-fuchsia-200">{reveal.rules[1]}</strong>
                </p>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={share} className="rounded-xl bg-amber-300 px-5 py-2.5 font-bold text-slate-950 hover:bg-amber-200">
              {copied ? "Link copied!" : "Challenge a friend"}
            </button>
            <Link href="/" className="rounded-xl border border-white/20 px-5 py-2.5 font-semibold hover:bg-white/5">
              New rule
            </Link>
            <Link href="/create" className="rounded-xl border border-white/20 px-5 py-2.5 font-semibold hover:bg-white/5">
              Make your own rule
            </Link>
          </div>
        </div>
      )}

      <div className={`grid gap-6 lg:grid-cols-[1.3fr_1fr] ${started ? "" : "pointer-events-none opacity-40"}`}>
        {/* Human */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/60">You</h2>
            <Score value={score} status={status} />
          </div>
          <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8">
            <Switches bits={bits} onToggle={toggle} disabled={humanDone || status === "exam"} />
            <Door state={doorState} />
          </div>
          {!humanDone && (
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                onClick={tryDoor}
                disabled={busy || status === "exam"}
                className="rounded-xl bg-amber-300 px-6 py-3 font-bold text-slate-950 hover:bg-amber-200 disabled:opacity-50"
              >
                Try the door (+1)
              </button>
              <button
                onClick={startExam}
                disabled={busy || status === "exam" || history.length === 0}
                className="rounded-xl border border-emerald-400/60 px-5 py-3 font-semibold text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-40"
              >
                I&apos;ve cracked it
              </button>
              <button onClick={() => setStatus("gave-up")} className="px-3 py-3 text-sm text-white/50 hover:text-white">
                Give up
              </button>
            </div>
          )}
          <Log entries={history} empty="Your tries will appear here." />
        </section>

        {/* AI */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-sky-300/80">AI</h2>
            <Score value={aiScore} status={ai.status} />
          </div>

          {!showAiDetails ? (
            <div className="mt-5">
              <p className="text-sm text-white/60">
                {ai.status === "thinking" && "Thinking…"}
                {ai.status === "playing" && started && `Testing pattern #${ai.probes + 1}…`}
                {ai.status === "exam" && "Taking the exam!"}
                {ai.status === "cracked" && "Cracked it. Can you beat that score?"}
                {ai.status === "gave-up" && "Gave up."}
                {ai.status === "error" && <span className="text-rose-300">{ai.error}</span>}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5" aria-label="AI tries (hidden until you finish)">
                {ai.history.map((e, i) => (
                  <span key={i} className={`h-3 w-3 rounded-full ${e.source === "exam" ? "bg-fuchsia-400/60" : "bg-sky-300/60"}`} />
                ))}
              </div>
              <p className="mt-4 text-xs text-white/40">The AI&apos;s tries and reasoning stay hidden until you finish, so no copying.</p>
            </div>
          ) : (
            <div className="mt-5">
              {ai.pending && (
                <div className="mb-4 flex items-center gap-4">
                  <Switches bits={ai.pending.bits} small />
                  <span className="text-sm text-white/60">
                    predicts <strong className="text-white">{ai.pending.prediction}</strong>
                  </span>
                </div>
              )}
              {ai.commentary && (
                <blockquote className="rounded-xl border border-sky-300/30 bg-sky-300/5 p-3 text-sm text-sky-50">{ai.commentary}</blockquote>
              )}
              {ai.hypothesis && (
                <p className="mt-3 text-sm text-white/70">
                  Theory: <span className="text-white">{ai.hypothesis}</span> <span className="text-white/40">({ai.confidence} confidence)</span>
                </p>
              )}
              {ai.status === "error" && <p className="mt-3 text-sm text-rose-300">{ai.error}</p>}
              <Log
                entries={ai.history}
                empty={ai.status === "thinking" ? "Thinking…" : "No tries yet."}
                annotate={(e) => {
                  const a = e as AiEntry;
                  if (!a.prediction || a.source === "exam") return undefined;
                  if (a.prediction === "unsure") return "guessed: ?";
                  return (a.prediction === "open") === a.open ? "predicted ✓" : "surprised ✗";
                }}
              />
            </div>
          )}
          {ai.status === "error" && (
            <button onClick={() => runAi(ai)} className="mt-3 rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/5">
              Retry AI
            </button>
          )}
        </section>
      </div>

      {exam && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Exam">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-slate-900 p-5 sm:p-6">
            <h2 className="text-xl font-bold">The exam</h2>
            <p className="mt-1 text-sm text-white/60">Will the door open? Get all {exam.questions.length} right to crack it.</p>
            <ul className="mt-4 space-y-2">
              {exam.questions.map((q, i) => {
                const r = exam.result;
                return (
                  <li key={q} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-2">
                    <Switches bits={q} small />
                    <div className="flex gap-1">
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          disabled={!!r}
                          onClick={() => setExam({ ...exam, answers: exam.answers.map((a, j) => (j === i ? v : a)) })}
                          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                            exam.answers[i] === v ? (v ? "bg-emerald-400 text-slate-950" : "bg-rose-400 text-slate-950") : "bg-white/10 text-white/70"
                          }`}
                        >
                          {v ? "Open" : "Locked"}
                        </button>
                      ))}
                      {r && <span className="w-6 text-center text-lg">{r.correct[i] ? "✓" : "✗"}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
            {!exam.result ? (
              <button
                onClick={submitExam}
                disabled={busy || exam.answers.some((a) => a === null)}
                className="mt-5 w-full rounded-xl bg-amber-300 py-3 font-bold text-slate-950 disabled:opacity-40"
              >
                Submit answers
              </button>
            ) : (
              <div className="mt-5">
                <p className={`text-lg font-bold ${exam.result.passed ? "text-emerald-300" : "text-rose-300"}`}>
                  {exam.result.passed ? `Cracked it! Final score: ${score}` : `Not quite: +${PENALTY} points. The correct answers were added to your log.`}
                </p>
                <button onClick={closeExam} className="mt-3 w-full rounded-xl bg-white/10 py-3 font-semibold hover:bg-white/15">
                  {exam.result.passed ? "See results" : "Keep testing"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Score({ value, status }: { value: number; status: string }) {
  return (
    <div className="text-right">
      <span className="font-mono text-2xl font-black">{value}</span>
      <span className="ml-1 text-xs text-white/50">pts</span>
      {status === "cracked" && <span className="ml-2 rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs text-emerald-200">cracked</span>}
      {status === "gave-up" && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">gave up</span>}
    </div>
  );
}

function Log({ entries, empty, annotate }: { entries: Evidence[]; empty: string; annotate?: (e: Evidence) => string | undefined }) {
  return (
    <div className="mt-6">
      {entries.length === 0 ? (
        <p className="text-sm text-white/40">{empty}</p>
      ) : (
        <ol className="flex flex-col-reverse gap-1.5">
          {entries.map((e, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-6 text-right font-mono text-xs text-white/30">{i + 1}</span>
              <PatternChip bits={e.bits} open={e.open} note={e.source === "exam" ? "from exam" : annotate?.(e)} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
