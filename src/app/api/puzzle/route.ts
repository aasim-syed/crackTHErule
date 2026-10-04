import { seal } from "@/lib/puzzle";
import { generate, isPlayable, sameBehaviour, validate, type Difficulty } from "@/lib/rules";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const twist = body.twist === true;

  if (body.rule !== undefined) {
    // Creator-made puzzle.
    if (!validate(body.rule) || !isPlayable(body.rule)) {
      return Response.json({ error: "That rule is invalid or the door would almost always be open (or closed)." }, { status: 400 });
    }
    const rules = [body.rule];
    if (twist) {
      if (!validate(body.twistRule) || !isPlayable(body.twistRule) || sameBehaviour(body.rule, body.twistRule)) {
        return Response.json({ error: "The twist rule must be valid, playable and behave differently from the first rule." }, { status: 400 });
      }
      rules.push(body.twistRule);
    }
    const author = typeof body.author === "string" ? body.author.trim().slice(0, 30) || undefined : undefined;
    return Response.json({ token: seal({ rules, twistAt: twist ? 6 : undefined, difficulty: "custom", author }) });
  }

  const difficulty: Difficulty = DIFFICULTIES.includes(body.difficulty) ? body.difficulty : "medium";
  const first = generate(difficulty);
  const rules = twist ? [first, generate(difficulty, Math.random, first)] : [first];
  // The twist lands somewhere after the player has had time to form a theory.
  const twistAt = twist ? 5 + Math.floor(Math.random() * 3) : undefined;
  return Response.json({ token: seal({ rules, twistAt, difficulty }) });
}
