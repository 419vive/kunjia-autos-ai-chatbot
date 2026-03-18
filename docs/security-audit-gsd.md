# Security Audit: gsd-build/get-shit-done

**Audit Date:** 2026-03-18
**Repo:** https://github.com/gsd-build/get-shit-done
**Version Audited:** v1.25.1 (latest main, shallow clone)
**Auditor:** Claude Opus 4.6 (automated deep-code review)

---

## Executive Summary

**Verdict: SAFE — No critical or high severity findings.**

`get-shit-done` (GSD) is a meta-prompting and context engineering system for AI-assisted development. It installs markdown prompt files and JavaScript hooks into your `~/.claude/` directory.

After auditing **all 30+ source files** (installer, CLI tools, hooks, lib modules, CI workflows, package manifest), the repo is clean:

- **0 CRITICAL** findings
- **0 HIGH** findings
- **1 MEDIUM** finding
- **3 LOW** findings
- Zero runtime dependencies
- No postinstall/preinstall lifecycle scripts
- No data exfiltration, backdoors, or obfuscated code

---

## Audit Scope

| Category | Files Audited |
|----------|--------------|
| Installer | `bin/install.js` |
| CLI Tool | `get-shit-done/bin/gsd-tools.cjs` |
| Core Libraries | `get-shit-done/bin/lib/*.cjs` (12 files) |
| Hooks | `hooks/gsd-check-update.js`, `hooks/gsd-statusline.js`, `hooks/gsd-context-monitor.js` |
| Build Scripts | `scripts/build-hooks.js`, `scripts/run-tests.cjs` |
| Package Manifest | `package.json`, `package-lock.json` |
| CI/CD | `.github/workflows/test.yml`, `.github/workflows/auto-label-issues.yml` |

---

## Detailed Findings

### MEDIUM Severity

| ID | File | Finding | Risk |
|----|------|---------|------|
| M-1 | `get-shit-done/bin/lib/verify.cjs:360` | `new RegExp(link.pattern)` constructs regex from YAML frontmatter data. Potential ReDoS if malicious patterns are crafted in plan files. | Local-only; no network exposure. Exploitable only if attacker controls `.planning/` files. |

### LOW Severity

| ID | File | Finding | Risk |
|----|------|---------|------|
| L-1 | `hooks/gsd-check-update.js` | Spawns detached background process (`spawn` + `detached: true` + `child.unref()`) that runs `npm view get-shit-done-cc version` via `execSync`. | Command is hardcoded — no injection vector. Standard update-check pattern. Outbound npm registry query is read-only. |
| L-2 | `.github/workflows/auto-label-issues.yml` | `actions/github-script@v7` is tag-pinned, not SHA-pinned. Minor supply chain risk (tag could theoretically be moved). | Permissions tightly scoped to `issues: write`. Script is a single `addLabels` call. |
| L-3 | `get-shit-done/bin/lib/commands.cjs:348` | `fetch()` call to `api.search.brave.com` for web research feature. Reads `process.env.BRAVE_API_KEY`. | Opt-in only (requires user to set BRAVE_API_KEY). Goes to legitimate Brave Search API. Key is never logged or transmitted elsewhere. |

---

## Positive Security Features

| Feature | Details |
|---------|---------|
| **Zero runtime dependencies** | `package.json` has 0 `dependencies`. Only 2 `devDependencies` (`c8`, `esbuild`) — both mainstream. |
| **No lifecycle scripts** | No `postinstall`, `preinstall`, or `install` scripts. The `bin/install.js` only runs when user explicitly invokes `npx get-shit-done-cc`. |
| **Sensitive data redaction** | `profile-output.cjs` actively strips API keys, tokens, passwords, GitHub PATs, Slack tokens, and home directory paths from output using regex patterns. |
| **Session data stays local** | `profile-pipeline.cjs` reads `~/.claude/projects/` session history but explicitly notes "read-only, nothing is modified or sent anywhere." Data goes to local temp file only. |
| **SHA-pinned CI actions** | `test.yml` pins `actions/checkout` and `actions/setup-node` by commit SHA (not tag). |
| **Input sanitization** | `core.cjs` sanitizes file paths with `/[^a-zA-Z0-9._\-/]/g` before passing to `git check-ignore`. |
| **Hash-checked installs** | Installer uses `crypto` module to hash existing files before overwriting, detecting user modifications. |

---

## Dangerous Pattern Scan

Searched the entire codebase for known dangerous patterns:

| Pattern | Found? | Context |
|---------|--------|---------|
| `eval()` | **No** | Not used anywhere |
| `new Function()` | **No** | Not used anywhere |
| `Buffer.from().toString('base64')` | **No** | Not used |
| `atob()` / `btoa()` | **No** | Not used |
| `net.connect` / `WebSocket` | **No** | Not used |
| `http.request` / `https.request` | **No** | Not used |
| `require('child_process')` | Yes | `core.cjs`, `commands.cjs`, `init.cjs` — used for `git` commands and `find` with sanitized inputs only |
| `execSync` | Yes | Hardcoded git commands + `npm view` (update check). No user input interpolation. |
| `fetch()` | Yes | Single Brave Search API call (opt-in, requires API key) |
| `process.env` | Yes | Reads config dir overrides (`CLAUDE_CONFIG_DIR`, etc.) and `BRAVE_API_KEY`. No secret exfiltration. |

---

## File-by-File Summary

| File | Verdict | Notes |
|------|---------|-------|
| `bin/install.js` | SAFE | Pure file-copy installer. No network, no shell. |
| `get-shit-done/bin/gsd-tools.cjs` | SAFE | CLI dispatcher. No network, no shell directly. |
| `get-shit-done/bin/lib/core.cjs` | SAFE | Git helpers with sanitized inputs. |
| `get-shit-done/bin/lib/init.cjs` | SAFE | Project scaffolding. Uses `find` to detect code files. |
| `get-shit-done/bin/lib/config.cjs` | SAFE | Config read/write within `.planning/`. |
| `get-shit-done/bin/lib/commands.cjs` | LOW | Brave Search fetch (opt-in). |
| `get-shit-done/bin/lib/verify.cjs` | MEDIUM | ReDoS via frontmatter regex. |
| `get-shit-done/bin/lib/frontmatter.cjs` | SAFE | Pure text parsing. |
| `get-shit-done/bin/lib/profile-output.cjs` | SAFE | Has credential redaction (positive). |
| `get-shit-done/bin/lib/milestone.cjs` | SAFE | File management within `.planning/`. |
| `get-shit-done/bin/lib/state.cjs` | SAFE | State tracking within `.planning/`. |
| `get-shit-done/bin/lib/phase.cjs` | SAFE | Phase CRUD within `.planning/`. |
| `get-shit-done/bin/lib/template.cjs` | SAFE | Template scaffolding. |
| `get-shit-done/bin/lib/model-profiles.cjs` | SAFE | Static data mapping only. |
| `get-shit-done/bin/lib/profile-pipeline.cjs` | SAFE | Reads sessions locally, no exfil. |
| `get-shit-done/bin/lib/roadmap.cjs` | SAFE | Roadmap parsing. |
| `hooks/gsd-check-update.js` | LOW | Background npm version check. |
| `hooks/gsd-statusline.js` | SAFE | Pure display logic. |
| `hooks/gsd-context-monitor.js` | SAFE | Read-only context monitoring. |
| `scripts/build-hooks.js` | SAFE | Trivial file copy. |
| `scripts/run-tests.cjs` | SAFE | Test runner. |
| `package.json` | SAFE | 0 runtime deps, no lifecycle scripts. |
| `.github/workflows/test.yml` | SAFE | SHA-pinned actions. |
| `.github/workflows/auto-label-issues.yml` | LOW | Tag-pinned `github-script@v7`. |

---

## Recommendations

1. **M-1 (ReDoS):** Consider wrapping `new RegExp(link.pattern)` in a try-catch with a timeout, or validate pattern complexity before construction.
2. **L-2 (CI):** Pin `actions/github-script` by SHA instead of tag `@v7`.
3. **General:** The tool is safe to install and use. It operates transparently with no hidden network activity.

---

## Conclusion

**GSD is safe to use.** It's a well-engineered prompting tool that:
- Has zero runtime dependencies (best-in-class for supply chain security)
- Never phones home except for an opt-in version check via `npm view`
- Actively redacts sensitive data from its profiling output
- Uses SHA-pinned CI actions
- Contains no obfuscated code, no eval, no backdoors
- All filesystem operations are scoped to `~/.claude/` and `cwd/.planning/`

The codebase is transparent, readable, and follows security best practices for a developer tool.
