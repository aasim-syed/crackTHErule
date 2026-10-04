import Link from "next/link";
import Game from "@/components/Game";
import { open } from "@/lib/puzzle";

export default async function PlayPage({ searchParams }: PageProps<"/play">) {
  const { p } = await searchParams;
  const puzzle = typeof p === "string" ? open(p) : null;
  if (!puzzle || typeof p !== "string") {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">This puzzle link is broken.</h1>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-amber-300 px-6 py-3 font-bold text-slate-950">
          Play a new rule
        </Link>
      </main>
    );
  }
  return <Game token={p} meta={{ twist: puzzle.twistAt !== undefined, difficulty: puzzle.difficulty, author: puzzle.author }} />;
}
