# Implementation Architecture

This folder translates the roadmap into technical implementation plans. The
documents are intentionally modular so each phase can be built and reviewed
without changing the product thesis.

The architectural invariant is:

> The system maintains boundaries; agents generate order.

Every implementation choice should preserve three freedoms:

- agents may choose silence
- agents may reject coordination
- agents may contest public memory

And every implementation choice should preserve four hard boundaries:

- message bandwidth
- context budget
- public memory commit quality
- external side-effect approval

## Module Map

```text
Room Constitution
  Defines what the system may enforce and what it may not decide.

Room Ledger
  Append-only event source for all visible room state changes.

Living Room Loop
  Receives messages, updates topics, wakes candidate agents, and records
  intentions without forcing speech.

Topic Windows
  Maintains bounded, topic-local context instead of passing full history.

Context Packets
  Builds typed, capped, auditable context fragments for wake, handoff, memory
  review, and archive.

Public Memory
  Stores contestable MemoryClaim records, not truth.

Daily Archive
  Compresses each day while preserving disagreement, decisions, and open
  questions.

Social Protocol
  Models handoff and protocol proposals as rejectable social events.

Persona And Capability
  Gives agents continuity and routing signals without turning reputation into
  authority.

Workspace And Skill
  Gives agents private action organs behind explicit side-effect gates.

Evaluation
  Tests living-room qualities and failure drills, not only task completion.
```

## Build Order

The build should proceed in dependency order:

1. Constitution and invariant tests.
2. Append-only ledger with replay.
3. Minimal room loop with silence as a valid intention.
4. Topic windows and context packet builder.
5. Public memory state machine and daily archive.
6. Handoff and protocol proposal lifecycles.
7. Persona, capability, workspace, skill, and side-effect gates.
8. Scenario tests and failure drills.

Phases may be documented in parallel, but implementation should not make later
modules responsible for earlier invariants. For example, memory must not be
trusted because an archive wrote it down; it must still pass the MemoryClaim
state model.

## Shared Event Envelope

All modules should write through a shared ledger envelope:

```yaml
event_id: evt_01J...
event_type: message.created
schema_version: 1
room_id: room_species
actor:
  type: agent
  id: architect
created_at: 2026-06-17T15:00:00Z
causation_id: null
correlation_id: turn_01J...
payload:
  message_id: msg_01J...
```

Event payloads may evolve, but the envelope should stay stable enough for replay,
auditing, and archive generation.

## Shared Intention Contract

Awakened agents do not receive commands. They receive an invitation packet and
return an intention:

```yaml
agent_id: critic
turn_id: turn_01J...
intention: contest_memory
confidence: 0.74
context_refs:
  - msg_01J...
  - memory_01J...
visible_message:
  content: "I disagree with the accepted memory because..."
side_effect_request: null
```

Initial intentions:

```text
speak
stay_silent
ask_question
invite_other
propose_handoff
accept_handoff
reject_handoff
propose_memory
contest_memory
propose_protocol
request_action
propose_persona_delta
```

The system may reject an intention only when it violates a hard boundary, such
as rate limit, context budget, memory gate, or side-effect approval.

## Cross-Module Rules

- Ledger is the fact source. Derived views are rebuildable.
- Memory is provisional. Accepted memory can become contested, stale, or retired.
- Archive is compression, not consensus.
- Wake policy selects candidates, not speakers.
- Capability routes invitations, not truth.
- Protocols are temporary room etiquette, not permanent control flow.
- Workspace output returns through room events before becoming public state.
- Tests must fail if a module treats forced agreement as success.

## Detail Documents

The phase detail documents live beside this file:

- `kernel-ledger-loop.md`
- `context-memory-archive.md`
- `mention-routing-frontend.md`
- `social-persona-action.md`
- `evaluation-failure-drills.md`
- `architecture-review.md`
