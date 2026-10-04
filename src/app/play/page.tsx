import type { Metadata } from "next";
import Link from "next/link";
import Game from "@/components/Game";
import { open } from "@/lib/puzzle";

export async function generateMetadata({ searchParams }: PageProps<"/play">): Promise<Metadata> {
  const { p } = await searchParams;
  const puzzle = typeof p === "string" ? open(p) : null;
  if (!puzzle || typeof p !== "string") return { title: "Crack the Rule" };
  const title = puzzle.author ? `${puzzle.author}'s secret rule · Crack the Rule` : "A secret rule · Crack the Rule";
  const description = "Can you crack it faster than the AI? Six switches, one door, every try costs a point.";
  const image = { url: `/api/og?p=${encodeURIComponent(p)}`, width: 1200, height: 630, alt: "A Crack the Rule challenge" };
  return {
    title,
    description,
    openGraph: { title, description, images: [image], url: `/play?p=${encodeURIComponent(p)}` },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

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
