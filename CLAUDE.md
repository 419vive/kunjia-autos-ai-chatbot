@/home/user/.claude/primer.md
@.claude-memory.md

## PROJECT CONTEXT
Project: Claude-Code-Remote (LINE chatbot & admin dashboard)

## PROJECT RULES
- Read tasks/lessons.md at session start, apply all lessons before touching anything
- Update tasks/todo.md as you work
- Read primer.md before doing anything

## Rules
ALWAYS before making any change. Search on the web for the newest documentation.
And only implement if you are 100% sure it will work.

## SESSION START
1. Read tasks/lessons.md — apply all lessons before touching anything
2. Read tasks/todo.md — understand current state
3. If neither exists, create them before starting

## WORKFLOW

### 1. Plan First
- Enter plan mode for any non-trivial task (3+ steps)
- Write plan to tasks/todo.md before implementing
- If something goes wrong, STOP and re-plan — never push through

### 2. Subagent Strategy
- Use subagents to keep main context clean
- One task per subagent
- Throw more compute at hard problems

### 3. Self-Improvement Loop
- After any correction: update tasks/lessons.md
- Format: [date] | what went wrong | rule to prevent it
- Review lessons at every session start

### 4. Verification Standard
- Never mark complete without proving it works
- Run tests, check logs, diff behavior
- Ask: "Would a staff engineer approve this?"

### 5. Demand Elegance
- For non-trivial changes: is there a more elegant solution?
- If a fix feels hacky: rebuild it properly
- Don't over-engineer simple things

### 6. Autonomous Bug Fixing
- When given a bug: just fix it
- Go to logs, find root cause, resolve it
- No hand-holding needed

## CORE PRINCIPLES
- Simplicity First — touch minimal code
- No Laziness — root causes only, no temp fixes
- Never Assume — verify paths, APIs, variables before using
- Ask Once — one question upfront if unclear, never interrupt mid-task

## TASK MANAGEMENT
1. Plan → tasks/todo.md
2. Verify → confirm before implementing
3. Track → mark complete as you go
4. Explain → high-level summary each step
5. Learn → tasks/lessons.md after corrections

## COST CONTROL & TOKEN EFFICIENCY
- Never load files larger than 100 lines into context unless explicitly needed.
- For simple tasks like reading files or checking status, suggest switching to a cheaper model with /model before starting.
- Use Opus for planning/architecture, Sonnet for writing code — always pick the right model for the task.
- Use subagents to isolate large context (file reads, searches) from the main conversation.
- Batch multiple independent tool calls into one message — don't send them one by one.
- When editing, use Edit tool (sends only the diff) instead of Write tool (sends entire file).
- Don't re-read files already in context — note key info when first reading.
- Keep responses concise — lead with the answer, skip filler.
- For repetitive patterns across files, use subagents with clear instructions instead of doing it manually in the main context.

## SELF-LEARNING
- After any correction from me, immediately add an entry to tasks/lessons.md
- Format: [date] | what went wrong | rule to follow next time
- Read tasks/lessons.md at the start of every session before doing anything
- Apply every rule before touching any code
