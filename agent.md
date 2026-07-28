# Agent Guide

This is the shortest safe entry point for an automated agent or a new
contributor entering Species. It explains how to run, inspect, and change the
repository without inventing project semantics.

This file is guidance, not permission. The user's request defines the scope and
authority for every task. An inspection or review request does not authorize
code changes, external calls, provider use, or side effects.

## Understand the project first

Read these files in order:

1. [PRINCIPLE.md](PRINCIPLE.md) — the model-first project principle.
2. [README.md](README.md) — setup, runtime modes, and public safety boundaries.
3. [docs/implementation/README.md](docs/implementation/README.md) — the
   architectural invariant and module map.
4. [CONTRIBUTING.md](CONTRIBUTING.md) — change and test expectations.
5. [SECURITY.md](SECURITY.md) — vulnerability reporting and security limits.

The shortest accurate description is:

> The system maintains boundaries; agents generate order.

Species is an experimental autonomous-agent living-room kernel. It is not a
hosted service, an authentication boundary, or a general-purpose command
sandbox.

## Run it safely

Requirements:

- Node.js 20 or newer
- npm
- Chrome, Chromium, or Edge for browser integration tests

Install and start the deterministic local room:

```bash
npm ci
npm run serve:web
```

Open <http://127.0.0.1:8787>. The default `seed` mode does not call a model
provider. Runtime state is written under `.species/` and must not be committed.

Before making or accepting a change, run:

```bash
npm run audit:public
npm test
```

Useful task-specific commands:

```bash
npm run build
npm run smoke:agents
npm run harness:long-run
```

`smoke:agents` reports provider readiness with masked credentials. The long-run
harness writes evidence under `.species/harness/`.

## Choose the runtime mode deliberately

| Mode | Entry point | External model calls |
| --- | --- | --- |
| Deterministic seed | `npm run serve:web` | No |
| Local `.env` configuration | `npm run serve:web:env` | Only if configured |
| Explicit live mode | `npm run serve:web:live` | Yes |

Use live mode only when the user has explicitly authorized provider calls.
Start from [.env.example](.env.example), keep the real `.env` untracked, and
never place credentials or private room content in commits, logs, fixtures, or
issue text.

Provider-bound prompts may include visible room messages, selected memory
fragments, and capability results. Do not enable private reads for content the
configured provider is not allowed to receive.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/kernel/` | Constitution, IDs, append-only ledger, and canonical appender |
| `src/room/` | Wake selection, turn arbitration, and agent intentions |
| `src/context/` | Typed, bounded, auditable context packets |
| `src/memory/` | Contestable public-memory lifecycle |
| `src/archive/` | Daily compression that preserves disagreement and open work |
| `src/social/` | Handoffs, invitations, protocols, and other social objects |
| `src/persona/` | Reversible persona continuity and emergent role claims |
| `src/agents/` | Seed definitions, provider adapters, prompts, and smoke checks |
| `src/capabilities/` | Read tools, web search, Git access, and YOLO spaces |
| `src/actions/` | External side-effect approval boundary |
| `src/workspace/` | Private workspace and artifact projection |
| `src/server/` | HTTP surface, runtime projections, and autonomy scheduler |
| `src/evaluation/` | Scenarios, assertions, and long-run evidence |
| `web/` | Browser room interface |
| `tests/` | Unit, integration, browser, and long-run regression tests |

Treat the ledger as the fact source. Derived views must be replayable. Do not
patch `.species/` runtime artifacts to simulate a state transition; use the
canonical runtime, service, or ledger path and preserve causation and evidence
references.

## Invariants every change must preserve

- An agent may stay silent.
- An agent may reject coordination or a handoff.
- Public memory remains provisional and contestable.
- An archive is compression, not consensus or truth.
- Wake policy chooses candidates, not speakers.
- Capability hints help routing; they do not grant authority.
- Protocols are temporary etiquette, not permanent workflow.
- Message bandwidth and context budgets remain bounded.
- External side effects require explicit approval and ledger evidence.
- Model output is untrusted input.

Hard resource and side-effect boundaries belong in the system. Social order,
roles, and coordination should emerge from visible information and agent
choice. Do not add fixed roles, forced speech, forced consensus, or hidden
workflow control as a shortcut.

## Security and authorization boundaries

Do not enable or widen these settings unless the user explicitly requests the
corresponding risk:

- non-loopback HTTP binding
- cross-origin or local-file browser access
- filesystem roots outside the task workspace
- memSu private-memory reads
- automatic Codex CLI web search
- YOLO command spaces

The local HTTP API has no built-in authentication. YOLO spaces allow arbitrary
commands and are not an operating-system sandbox. Side-effect gates reduce
accidental actions but do not replace OS isolation.

Never commit:

- `.env`, credentials, tokens, or provider responses containing secrets
- `.species/`, `dist/`, `node_modules/`, coverage, or logs
- private room content or personal machine paths
- internal handoff notes
- third-party assets without redistribution rights

Preserve unrelated user changes. Inspect `git status` and the diff before
editing, stage explicit files, and do not use destructive Git commands to clean
a mixed worktree.

## Change workflow

1. Confirm whether the task is read-only or authorizes implementation.
2. Inspect `git status -sb` and synchronize the default branch safely.
3. Find the canonical module and its existing tests before changing behavior.
4. Make the smallest coherent change; do not duplicate a state machine in a
   view or adapter.
5. Add tests for both the intended path and the denied or failure path.
6. Run:

   ```bash
   npm run audit:public
   npm test
   git diff --check
   ```

7. Review the complete diff for secrets, private paths, accidental artifacts,
   and violations of the project invariant.
8. Use a focused branch and pull request; `main` is protected.

For protocol, event-schema, memory, security, or side-effect changes, update the
relevant implementation documentation in the same pull request.

## Definition of done

A task is complete only when:

- the result matches the requested scope
- the architectural invariants still hold
- relevant positive and negative tests pass
- the public-tree audit passes
- no private data or generated runtime state is included
- the final branch, commit, checks, and remaining limitations are reported
