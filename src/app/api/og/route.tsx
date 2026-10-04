import { ogCard } from "@/lib/og-card";
import { open } from "@/lib/puzzle";

// Preview card for a challenge link. Shows who made it and how hard it is, never the rule.
export async function GET(req: Request) {
  const puzzle = open(new URL(req.url).searchParams.get("p"));
  if (!puzzle) {
    return await ogCard({
      eyebrow: "A secret rule is waiting",
      title: "Can you crack it?",
      subtitle: "Race an AI to figure out what opens the door.",
    });
  }
  const pills = [{ text: puzzle.difficulty === "custom" ? "Custom rule" : puzzle.difficulty, color: "#fcd34d" }];
  if (puzzle.twistAt !== undefined) pills.push({ text: "Twist mode", color: "#f0abfc" });
  const image = await ogCard({
    eyebrow: puzzle.author ? `${puzzle.author} made a secret rule` : "You've been challenged",
    title: "Can you crack it faster than the AI?",
    subtitle: "Six switches, one door, a point per try.",
    pills,
    open: false,
  });
  // A token's contents never change, so its card can be cached forever.
  image.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return image;
}
