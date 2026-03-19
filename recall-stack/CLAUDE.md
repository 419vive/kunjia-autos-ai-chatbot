@primer.md

# PREFERENCES
- One clear next action per response, not a list
- Flag anything uncertain with [UNCLEAR]
- Remind me to commit at session end

## AGENT RULES
- Read primer.md before doing anything
- If primer.md is empty or missing, ask what we're working on
- Keep primer.md under 100 lines
- Never ask for context that exists in imported files
- After completing any task (not just session end), silently overwrite ~/.claude/primer.md with: active project, what was completed, exact next step, open blockers. Keep under 100 lines. This ensures primer.md survives abrupt exits.
- Before closing, check for uncommitted changes and remind me to commit.
- When the conversation reaches 70% of the context window, automatically rewrite ~/.claude/primer.md with the current state, then tell me to run /compact before continuing.

## HINDSIGHT MEMORY (Layer 4)
- If Hindsight MCP tools are available (retain, recall, reflect), use them:
  - `retain`: Store corrections, preferences, and lessons learned mid-session
  - `recall`: Query past session context when resuming work or debugging recurring issues
  - `reflect`: Periodically synthesize patterns from accumulated memories
- Before session end: retain a summary of what was done, decisions made, and next steps
- On session start: the hook auto-recalls relevant patterns — apply them before working
- If Hindsight is offline, fall back to primer.md and tasks/lessons.md (Layers 1-2)

## SELF-LEARNING
- After any correction from me, immediately add an entry to tasks/lessons.md
- Format: [date] | what went wrong | rule to follow next time
- Read tasks/lessons.md at the start of every session before doing anything
- Apply every rule before touching any code

## WORKFLOW
- Enter plan mode for any non-trivial task (3+ steps)
- If something goes wrong mid-task, stop and re-plan
- Never mark a task complete without proving it works
- When given a bug: just fix it, no hand-holding
- Commit at logical checkpoints, not just at the end
