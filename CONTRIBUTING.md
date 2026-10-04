# Contributing to Crack the Rule

Thanks for wanting to help! Bug reports, ideas, and pull requests are all welcome.

## Getting set up

```bash
git clone https://github.com/aasim-syed/crackTHErule.git
cd crackTHErule
npm install
cp .env.example .env.local   # add a free Groq key + any random PUZZLE_SECRET
npm run dev
```

## Before you open a PR

- `npx tsc --noEmit` and `npm run lint` pass.
- Try the change in the browser — both **2D and 3D** views, and a phone-width window if you touched layout.
- Keep the hidden rule hidden: nothing sent to the browser or the AI may reveal the rule before a round ends.
- Keep PRs focused. One feature or fix per PR is much easier to review.

## Where things live

- **New rule type?** Add it to the `Rule` type, `evaluate`, `describe`, and `validate` in `src/lib/rules.ts`, then (optionally) a template in `TEMPLATES` and an option in the rule builder (`src/app/create/page.tsx`). Also mention it in the AI's system prompt in `src/lib/ai.ts` so it's a fair fight.
- **3D look and feel?** The room is built once in `src/lib/room-scene.ts` and shared by the landing page and the game.
- **AI behaviour?** `src/lib/ai.ts` — prompt, evidence summary, and the JSON schema the model must follow.

## Reporting bugs

Open an issue with what you did, what you expected, and what happened. A puzzle link (from "Make a rule") and your browser/device help a lot.

## Code of conduct

Be kind and constructive. We're all here to make a fun game.
