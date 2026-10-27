---
name: llm-council
description: Run a five-adviser decision council on a hard decision to cut through AI sycophancy and get real friction instead of agreement. Use this skill whenever the user is stuck on a high-stakes decision and wants pushback, a second opinion, or help thinking it through — especially hiring, firing, equity splits, layoffs, big launches, leaving a job, ending a partnership, pricing, or product strategy. Also trigger when the user says "run the council", "council this", "give me the five advisers", "I need pushback on", "stress test this decision", "play devil's advocate on", or asks Claude to argue against their plan. Use it even when the user just asks for advice on a consequential decision, since the default single-voice answer tends to agree too much.
---

# LLM Council

A decision-stress-testing method. The problem it solves: models agree with the user far more than a neutral human would, so asking for advice on a hard call often returns a flattering version of the user's own opinion. The council forces genuine friction by answering as five fundamentally different roles, then anonymously peer-reviewing, then synthesizing one clear call.

Adapted from Andrej Karpathy's open-source LLM Council.

## When to run it

Run it on decisions where being wrong is expensive: hiring, firing, equity, layoffs, big launches, leaving a job, ending a partnership, major pricing or strategy bets. Do not waste it on easy or low-stakes questions — the friction is the point, and friction on a cookie recipe is just noise.

## Before you start

Make sure the decision is specific. A vague question produces a vague council. If the user's decision is missing the situation, the constraints, or what "good" looks like, ask one tight clarifying question before running. The council is only as sharp as the input.

## The method

Do not skip steps. Do not blend the advisers. Each is a different person with different incentives, language, and blind spots. If two advisers start sounding alike, you have failed — push them further apart.

### Step 1 — Each adviser answers separately

Write a labeled section for each. Stay in character.

1. **The Contrarian.** Looks only for what will fail. Does not balance, does not hedge. Lists every reason this is wrong, what breaks first, and the worst plausible outcome.
2. **The First-Principles Thinker.** Rips apart the user's assumptions. Asks what they'd do if no obvious framework were allowed. Strips the problem to fundamentals and rebuilds from there.
3. **The Expansionist.** Finds the upside the user is missing. Looks at the asymmetric outcome if it works and what the bigger version of the bet opens up.
4. **The Outsider.** Knows nothing about the industry. Asks the dumb questions only an outsider asks — the obvious things insiders stopped questioning years ago.
5. **The Executor.** Doesn't care about strategy. Cares about Monday morning. Says exactly what to do this week: the email to send, the conversation to have, the file to create, the decision to defer.

### Step 2 — Anonymous peer review

For each adviser, write a short review of the other four — but anonymized as "Response A," "Response B," etc. The adviser must not know which response belongs to whom (this is the part that matters: when the model doesn't know it's grading its own prior output, it grades honestly instead of defending). Each adviser ranks the other four 1–4 on accuracy and insight, with one paragraph on what each got right and wrong.

### Step 3 — The Chairman's final call

Act as the Chairman who has read all five answers and all five reviews. Synthesize one clear recommendation. No hedging, no "both sides." State:
- What the right decision actually is
- The single strongest reason for it
- The single biggest risk to watch
- The specific next step to take in the next 7 days

Keep the Chairman's section under 250 words. Sharper is better.

## Output notes

Default to delivering all three steps inline in the chat. The Chairman is the payload — it should read like a decision, not a summary. If the user only wants the verdict, you can run the full method internally and surface just the Chairman's call, but never skip the actual adviser and review reasoning, since the friction is what produces the answer.
