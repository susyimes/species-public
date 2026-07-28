# Roadmap

This roadmap turns the Autonomous Agent Living Room thesis into buildable
stages. The product should keep one invariant throughout every stage:

> The system maintains boundaries; agents generate order.

species should grow as a room before it grows as a workflow system. Each phase
therefore adds a small amount of structure while preserving agent freedom to
speak, stay silent, object, invite, reject handoffs, contest memory, and propose
new room protocols.

## Phase 0: Room Constitution

Goal: define the non-negotiable rules that prevent the room from becoming a
central scheduler.

Deliverables:

- write the initial room constitution as a short versioned document
- define what the system may enforce: bandwidth, context, memory gates, and
  side-effect approval
- define what the system may not enforce: agent agreement, mandatory speech,
  permanent protocol obedience, or unquestionable memory
- name the first hard failure modes: message storm, context bloat, public memory
  pollution, and external side effects

Acceptance checks:

- an agent can be invited without being forced to speak
- a memory entry can be contested after it was accepted
- a protocol can expire or be rejected
- external side effects are impossible without an approval gate

## Phase 1: Append-Only Room Ledger

Goal: make the ledger the source of record for room life.

Deliverables:

- implement an append-only event store for room events
- support the first event names from `docs/protocol-objects.md`
- record messages, topic changes, handoff proposals, protocol proposals, memory
  proposals, persona deltas, and daily archive creation
- provide a small reader that can reconstruct the current room view from the
  ledger

Acceptance checks:

- no room state change exists only in memory
- replaying the ledger reconstructs topics, active proposals, and current memory
  states
- rejected and contested events remain visible instead of being overwritten

## Phase 2: Minimal Living Room Loop

Goal: create the smallest loop where agents can inhabit the room.

Deliverables:

- create `message.created` intake
- detect or update the active topic for a message
- run wake policy to select candidate agents
- send compact context packets to awakened agents
- let each agent return an intention:
  - speak
  - stay_silent
  - ask_question
  - invite_other
  - propose_handoff
  - contest_memory
  - propose_protocol
- record all intentions and visible speech in the ledger

Acceptance checks:

- silence is treated as a valid result, not a failure
- wake policy selects candidates, not guaranteed speakers
- the same incoming message can produce different social outcomes across
  different agents
- the room can continue without a central `active_agent` owner

## Phase 3: Topic Windows And Context Packets

Goal: keep conversations coherent without passing the whole room transcript.

Deliverables:

- maintain topic-local short context windows
- create reference-based context packets for agent wake, handoff, and memory
  review
- include only relevant message refs, memory refs, topic summaries, and protocol
  state
- add speaker budget and cooldown controls

Acceptance checks:

- agents receive references instead of full history by default
- an overactive agent cools down automatically
- each topic can be paused, revived, split, or merged
- context growth is bounded by topic windows and daily archive summaries

## Phase 4: Public Memory And Daily Archive

Goal: turn room memory into contestable public sediment instead of truth.

Deliverables:

- implement `MemoryClaim` states:
  - observed
  - proposed
  - contested
  - accepted
  - stale
  - retired
- support memory proposals from messages and agent reflections
- support contesting, downgrading, retiring, and reviewing memory
- generate a daily archive with summary, disagreements, decisions, open
  questions, memory changes, and persona deltas

Acceptance checks:

- accepted memory can later become contested or stale
- daily archive preserves disagreements instead of flattening them into
  consensus
- only relevant accepted or contested memory enters default context
- memory changes can be traced back to source messages or archive entries

## Phase 5: Handoff And Protocol Proposals

Goal: make coordination social instead of imperative.

Deliverables:

- implement `HandoffProposal` as a first-class event object
- allow recipients to accept, reject, partially accept, redirect, or challenge
  a handoff
- implement `ProtocolProposal` for temporary room etiquette, such as critic
  rounds, daily rituals, topic councils, or speaker limits
- make protocol scope and expiry explicit

Acceptance checks:

- handoff never behaves like `A calls B`
- handoff packets contain reason, requested response, and context refs, not full
  transcripts
- agents can challenge the handoff itself
- protocols can be proposed by agents and retired by the room

## Phase 6: Persona And Capability Continuity

Goal: give agents durable identity without making identity rigid.

Deliverables:

- define each agent's core persona, initial posture, role-growth history, habits,
  and private home
- implement `PersonaDelta` proposals with reason and evidence refs
- implement `CapabilityCard` as an advisory wake and invitation signal
- record capability performance without treating reputation as authority

Acceptance checks:

- seed agents start unassigned; no default role claim is treated as a job
- persona changes leave a visible evolution history
- an agent can adjust its behavior after archive reflection
- capability cards influence wake routing but do not decide truth
- agent identity persists across days without erasing contradiction or growth

## Phase 7: Workspace, Skill, And Side-Effect Gate

Goal: let the room act on the outside world only through explicit boundaries.

Deliverables:

- give agents private workspaces or scratch areas
- represent skills as capability capsules
- require side-effect approval for filesystem writes, network calls, shell
  commands, pull requests, and other external actions
- separate private scratch from public room memory

Acceptance checks:

- private notes do not become public memory automatically
- all external side effects have approval records
- action results return to the room as messages, artifacts, claims, or proposals
- the room can discuss an action before approving it

## Phase 8: Evaluation And Failure Drills

Goal: evaluate living-room qualities, not only task throughput.

Deliverables:

- build scripted room scenarios for disagreement, handoff refusal, memory
  contestation, protocol invention, and silence
- add ledger assertions for social invariants
- add archive quality checks
- add stress tests for message storm, context budget, cooldown, and memory
  pollution

Acceptance checks:

- an agent can reject a handoff without breaking the session
- a contested memory item remains visible across archive generation
- a temporary protocol does not become permanent by accident
- no test treats forced agreement as success
- the room remains usable under bounded message pressure

## MVP Cut

The first meaningful MVP should include phases 0 through 4:

```text
Room Constitution
Append-Only Room Ledger
Minimal Living Room Loop
Topic Windows And Context Packets
Public Memory And Daily Archive
```

This gives species a working room before it has external action organs. Handoff,
persona evolution, capability routing, and workspaces can then deepen the room
without changing its constitutional shape.

## Long-Term Direction

The long-term product is not a better task runner. It is a persistent agent
society with:

- a fact source: Room Ledger
- a time skeleton: Daily Archive
- a public consciousness: Room Memory
- individual continuity: Agent Persona
- social transfer: HandoffProposal
- self-organization: ProtocolProposal
- advisory routing: CapabilityCard
- bandwidth control: Wake/Silence
- external action organs: Workspace/Skill

The final test is simple: when the system grows more capable, agents should feel
more able to organize themselves, not more controlled by a hidden scheduler.
