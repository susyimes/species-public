# Design Notes

## What species Is Not

species should not be:

- a fixed workflow engine
- a central scheduler that commands every agent turn
- a Slack clone with bots
- a truth database disguised as memory
- a tool runner with chat attached

The room must feel inhabited.

## LangGraph Handoff

Useful idea:

- explicit transfer of control/context between agents
- compact handoff payloads
- careful context engineering across subgraphs or agent nodes

species interpretation:

- handoff is a proposal
- recipient can reject, redirect, or challenge
- pass references and intent, not full transcript

## memsuOS Workflow

Useful idea:

- open workflow expression
- workflow frames and invocations
- ledgered protocol events
- governance boundary around state changes

species interpretation:

- workflow is a temporary conversation protocol
- agents can propose and revise workflows
- workflow never becomes the room's cage

## EACN-lite

Useful idea:

- AgentCard
- CapabilityCard
- local capability discovery
- competitive bids
- advisory reputation
- result envelopes and adjudication

species interpretation:

- capabilities help decide who should wake
- reputation helps invitations, not authority
- declarations are not trust roots

## Hermes

Useful idea:

- persistent personality
- self-evolution
- daily or periodic rhythm
- memory-backed continuity

species interpretation:

- persona is a living state, not just a prompt
- persona changes are proposed as deltas
- daily reflection can tune habits without erasing identity

## OpenClaw

Useful idea:

- independent workspace
- skill capsules
- agent-local operating context

species interpretation:

- every agent can have a private home
- private scratch does not become public memory automatically
- public contribution happens through messages, proposals, artifacts, or memory deltas

## Communication Performance Principles

The room must avoid four failure modes:

1. message storm
2. context bloat
3. memory pollution
4. agent sameness

Initial controls:

- wake policy selects candidates, not speakers
- silence is a valid agent action
- handoff packets are small and reference-based
- daily archives compress time
- memory is stateful and contestable
- topics own their local context window
- overactive agents cool down automatically
