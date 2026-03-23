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

## COST CONTROL
- Never load files larger than 100 lines into context unless explicitly needed.
- For simple tasks like reading files or checking status, suggest switching to a cheaper model with /model before starting.

## SELF-LEARNING
- After any correction from me, immediately add an entry to tasks/lessons.md
- Format: [date] | what went wrong | rule to follow next time
- Read tasks/lessons.md at the start of every session before doing anything
- Apply every rule before touching any code

## Multi-Agent Tasks (Ruflo / claude-flow)
For any task requiring multiple steps, parallel work, or more than two files: use Ruflo.

```bash
# Quick parallel orchestration
claude-flow orchestrate "<task>" --agents 8 --parallel

# Full SPARC pipeline (Specification → Pseudocode → Architecture → Refinement → Completion)
claude-flow sparc run dev "<task>"

# Hive-Mind swarm for complex refactors
claude-flow hive init --topology mesh --agents 5
claude-flow hive run "<task>"

# Status & monitoring
claude-flow status
claude-flow logs --agent <agent-name>
claude-flow cost --last
claude-flow stop --all
```

Do not work sequentially when Ruflo can parallelize.

### Model Routing
- Basic tasks (<2000 tokens) → Haiku (cheapest)
- Advanced tasks (<8000 tokens) → Sonnet
- Complex tasks → Opus
- Ruflo routes automatically — no manual model selection needed

### When to Use Ruflo
- Large refactors touching many files
- Features with multiple components (API + tests + docs + security)
- Code reviews on large PRs
- Any task you would normally prompt Claude 5+ times sequentially

### When NOT to Use Ruflo
- Single file edits
- Quick fixes
- Simple questions
- Swarm overhead is not worth it on small tasks

## Build & Test
```bash
npm run build
npm test
npm run lint
```

## Security Rules
- NEVER hardcode API keys, secrets, or credentials in source files
- NEVER commit .env files or any file containing secrets
- Always validate user input at system boundaries
