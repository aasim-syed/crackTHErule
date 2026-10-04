# Crack the Rule

Six switches, one door, a secret rule. Players test patterns, form a theory, then prove it on an 8-question exam, racing an AI on the same rule. Lowest score wins (1 point per try, +3 per failed exam).

- **Play**: easy / medium / hard random rules, optional **twist mode** (the rule silently changes once).
- **Make a rule**: build a rule, get a challenge link, send it to friends. The rule is AES-GCM encrypted inside the link, so the URL doesn't reveal it and the server stays stateless.
- **No copying**: the AI's tries and reasoning stay hidden until you finish, then you can watch its whole thought process.

## Run locally

```bash
cp .env.example .env.local   # fill in GROQ_API_KEY and PUZZLE_SECRET
npm install
npm run dev                  # http://localhost:3000
```

## Deploy

Works on Vercel as-is. Set `GROQ_API_KEY` and `PUZZLE_SECRET` in the project's environment variables. Changing `PUZZLE_SECRET` invalidates every existing share link.

## Layout

- `src/lib/rules.ts`: rule language, evaluator, generator by difficulty
- `src/lib/puzzle.ts`: encrypted puzzle tokens, twist timing, exam grading
- `src/lib/ai.ts`: AI opponent via Groq (gpt-oss-120b) (structured output: commentary, hypothesis, next probe, prediction)
- `src/app/api/*`: stateless route handlers
- `src/components/Game.tsx`: the race screen

## Known limits

- Scores are tracked client-side, so a determined player can cheat. Fine for a party game; add server sessions before any leaderboard.
- Each AI move is one Groq call (a fraction of a cent). Add rate limiting before a public launch.
