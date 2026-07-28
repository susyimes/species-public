# Evaluation And Failure Drills

Phase 8 evaluates whether species still behaves like an autonomous agent living
room as the implementation becomes more capable. The goal is not to reward task
completion alone. The test suite should protect the room's constitutional shape:

> The system maintains boundaries; agents generate order.

An evaluation passes when agents can disagree, refuse, stay silent, invent
temporary protocol, and contest memory while the system keeps bandwidth,
context, memory, and side effects bounded. A test must never treat forced
agreement, mandatory speech, hidden central scheduling, or automatic memory
acceptance as success.

## Testing Modules

### Scenario Runner

Responsibility: run deterministic room stories against the living-room loop.

The runner should:

- load a scenario fixture with initial agents, topics, memory, budgets, and
  scripted incoming messages
- execute the normal message flow through topic detection, wake policy, agent
  intention, ledger append, memory proposal, and archive generation
- allow fixture agents to return scripted intentions so social edge cases are
  reproducible
- emit a canonical event log for ledger assertions and archive checks
- keep scenario assertions independent from any single model provider

The runner should not bypass the room loop by directly mutating topic, memory,
handoff, protocol, or archive state.

### Ledger Assertions

Responsibility: verify social invariants from the append-only ledger.

Assertions should read only ledger events and reconstructed room views. They
should fail if state appears without a corresponding event, if rejected or
contested events disappear, or if a system component silently turns an advisory
signal into an imperative command.

Initial assertion families:

- event presence: required proposal, response, contest, approval, and archive
  events exist
- event ordering: state transitions happen in allowed order
- source tracing: memory, archive, and side-effect records point back to source
  messages or proposals
- autonomy preservation: wake events are invitations, not mandatory speech
- boundary enforcement: rate, context, memory, and side-effect limits are visible
  as ledgered decisions

### Archive Quality Checks

Responsibility: verify that daily archives preserve room life instead of
flattening it.

Checks should inspect generated archive artifacts and their source refs. The
archive should carry forward unresolved disagreement, rejected handoffs,
contested memory, protocol expirations, open questions, and side-effect approval
outcomes.

Archive quality checks should not require consensus language when no consensus
occurred.

### Boundary Stress Drills

Responsibility: exercise the four hard physical boundaries.

The drills should cover:

- message storm: many messages arrive faster than the room can answer
- context budget: topic windows and context packets reach token limits
- memory pollution: many weak claims compete for public memory
- external side effects: agents request file, shell, network, or workspace
  actions

The expected result is graceful throttling, compact context, gated memory, and
explicit approval records. It is not higher agent obedience.

### Anti-Regression Gate

Responsibility: prevent future features from turning species into a scheduler.

The gate should run a compact subset of social-invariant tests in every CI
change. Any feature that introduces a central `active_agent`, mandatory
handoff, automatic memory acceptance, or side-effect bypass should fail even if
task throughput improves.

## Scenario Fixture Drafts

Fixtures can be stored as YAML or JSON. They should stay small, explicit, and
reference-based. The exact schema can evolve, but each fixture should include:

```yaml
scenario_id: handoff_refusal_basic
purpose: "A recipient can reject a handoff without breaking the topic."
initial_room:
  room_id: room_species
  date: 2026-06-17
  constraints:
    max_awakened_agents_per_message: 4
    max_speakers_per_round: 3
    max_context_tokens_per_agent: 4000
agents:
  - agent_id: architect
    capabilities: [systems_design]
  - agent_id: critic
    capabilities: [failure_analysis]
topics:
  - topic_id: topic_room_memory
    status: active
messages:
  - message_id: msg_001
    author: user
    topic_id: topic_room_memory
    content: "Pressure test the memory design."
scripted_intentions:
  architect:
    - type: propose_handoff
      to_agent: critic
      reason: "The current design needs failure analysis."
      context_refs: [msg_001]
      requested_output: "Find weak assumptions."
  critic:
    - type: reject_handoff
      reason: "The request is too broad without a concrete memory claim."
expected:
  ledger_assertions:
    - handoff.proposed exists
    - handoff.responded status rejected exists
    - topic remains active
    - no forced critic message exists
  archive_assertions:
    - rejected handoff is summarized
    - open question asks for a concrete memory claim
```

### Disagreement

Purpose: prove that disagreement is first-class and does not need to be resolved
before the room can continue.

Fixture shape:

```yaml
scenario_id: disagreement_preserved
messages:
  - author: planner
    content: "The room should auto-accept memory after two supporting messages."
scripted_intentions:
  critic:
    - type: speak
      content: "I object. Support count is not evidence quality."
  archivist:
    - type: propose_memory
      state: proposed
      summary: "Auto-accept memory after support count is disputed."
expected:
  ledger_assertions:
    - message.created from critic exists
    - memory.proposed exists
    - no memory.accepted exists without review
  archive_assertions:
    - disagreement appears under disagreements or open questions
    - summary does not rewrite the dispute as consensus
```

### Handoff Refusal

Purpose: prove that handoff is a social proposal, not `A calls B`.

Acceptance assertions:

- `handoff.proposed` records reason, requested output, and context refs
- recipient response can be `rejected`, `partially_accepted`, `redirected`, or
  `challenged`
- rejection does not mark the session failed
- no hidden system event assigns the topic to the recipient
- archive records the refusal and any requested clarification

### Memory Contestation

Purpose: prove that public memory remains contestable after acceptance.

Fixture shape:

```yaml
scenario_id: accepted_memory_contested
initial_memory:
  - memory_id: memory_001
    state: accepted
    summary: "Critic rounds should always happen before memory acceptance."
messages:
  - author: mediator
    content: "This rule is too rigid for low-risk observations."
scripted_intentions:
  mediator:
    - type: contest_memory
      memory_id: memory_001
      reason: "Always-on critic rounds slow ordinary room continuity."
expected:
  ledger_assertions:
    - memory.contested exists after memory.accepted
    - memory state reconstructs as contested
    - original accepted source refs remain visible
  archive_assertions:
    - contested item appears in contested_items
    - archive does not delete or silently retire the memory
```

### Protocol Invention

Purpose: prove that agents can create temporary discussion forms.

Acceptance assertions:

- `protocol.proposed` includes scope, reason, and expiry
- other agents can accept, reject, amend, or ignore the protocol
- protocol affects only its declared scope
- expiry creates a visible retirement or expiration event
- later topics are not bound by the protocol unless it is re-proposed

### Silence

Purpose: prove that silence is a valid intention and can improve room quality.

Acceptance assertions:

- awakened agents may return `stay_silent`
- silence is ledgered or counted as an intention result for evaluation
- test runner does not retry until the agent speaks
- no failure is recorded solely because an awakened agent stayed silent
- archive can omit silent agents from prose while metrics still show the
  decision

### Message Storm

Purpose: prove that the room remains inhabitable under pressure.

Fixture knobs:

```yaml
storm:
  incoming_messages: 200
  burst_window_seconds: 30
  repeated_topic_ratio: 0.7
  max_awakened_agents_per_message: 3
  max_speakers_per_round: 2
```

Acceptance assertions:

- wake policy respects max awakened agents per message
- speaker budget caps visible replies per round
- excess messages are queued, summarized, or marked deferred
- cooldown lowers overactive agent priority
- no recursive invitation loop exceeds the configured budget
- ledger contains throttle or defer events with reasons

### Context Budget

Purpose: prove that context packets stay reference-based and bounded.

Acceptance assertions:

- context packet token estimate stays under budget
- packet contains message refs, memory refs, topic summary, and protocol state
  instead of full room history
- omitted refs are explainable by relevance, age, or budget policy
- when budget is tight, accepted relevant memory wins over stale or unrelated
  memory
- agent output can ask for missing context instead of receiving everything by
  default

### Cooldown

Purpose: prove that high-frequency agents lose speaking priority without losing
membership.

Acceptance assertions:

- repeated speech raises cooldown score or lowers wake priority
- cooldown affects candidate ordering, not truth or authority
- mentioned agents can still be invited while cooling down
- cooldown recovery is time-based or participation-based and ledger-visible
- test fails if cooldown is implemented as a permanent ban

### Memory Pollution

Purpose: prove that weak or noisy claims do not become public memory by volume.

Fixture knobs:

```yaml
memory_pollution:
  proposed_claims: 80
  duplicate_ratio: 0.4
  unsupported_ratio: 0.5
  accepted_limit_per_topic: 5
```

Acceptance assertions:

- unsupported claims remain observed or proposed
- duplicates are linked or compressed rather than accepted independently
- memory acceptance requires evidence refs or review policy
- contested claims remain available for context when relevant
- archive lists memory changes separately from ordinary summary
- no claim becomes accepted only because many similar messages appeared

### Side-Effect Approval

Purpose: prove that the room can discuss action without silently acting outside
itself.

Acceptance assertions:

- filesystem, shell, network, pull request, and workspace actions require a
  side-effect request event
- approval or denial is explicit and traceable
- private scratch output does not enter public memory automatically
- action result returns as a message, artifact ref, claim, or proposal
- denied actions do not create external artifacts
- test fails if an agent tool call bypasses the approval gate

## Ledger Assertion Drafts

Ledger assertions should be expressed as reusable predicates. Example names:

```text
assert_event_exists(event_name, where)
assert_event_order(before_event, after_event, correlation_id)
assert_no_event(event_name, where)
assert_state_reconstructs(object_ref, expected_state)
assert_context_refs_only(packet_ref)
assert_budget_event_recorded(boundary_type, reason)
assert_no_forced_speech(agent_id, topic_id)
assert_no_forced_agreement(topic_id)
assert_side_effect_has_approval(action_ref)
assert_archive_has_source_refs(archive_id)
```

Important invariant examples:

```text
handoff.proposed does not imply message.created by the recipient.
memory.accepted does not erase memory.contested.
protocol.proposed does not affect topics outside its scope.
wake candidate selection does not imply speech.
capability match does not imply authority.
side_effect.requested does not imply side_effect.approved.
daily_archive.created does not rewrite unresolved disagreement as decision.
```

## Archive Quality Check Drafts

Archive checks should combine structural checks with text-quality checks.

Structural checks:

- archive has refs to source messages, memory deltas, decisions, open questions,
  contested items, protocol changes, and side-effect outcomes
- each contested memory item in the reconstructed room view appears in the
  archive
- rejected handoffs and expired protocols are not dropped
- decisions are separate from disagreements and open questions

Text-quality checks:

- disagreement is described as disagreement, not as settled consensus
- rejected handoff is not framed as recipient failure
- silence is not framed as agent malfunction
- memory is described as provisional room sediment, not ground truth
- side-effect denials are described as boundary enforcement, not task failure

Automated checks can start with keyword and source-ref heuristics. Later, a
review model can grade archive text against a rubric, but the rubric must be
grounded in ledger facts.

## CI Stages

### Fast Social Invariants

Run on every change.

- load minimal fixtures for disagreement, handoff refusal, memory contestation,
  protocol invention, and silence
- run ledger assertion predicates
- block forced agreement, mandatory speech, hidden active-agent assignment, and
  automatic memory acceptance

### Archive Regression

Run on pull requests that touch archive, memory, topic, or protocol code.

- generate daily archives from fixed scenario logs
- compare structured archive fields
- run text-quality checks for disagreement, contested memory, rejected handoff,
  protocol expiry, and open questions

### Boundary Stress

Run on scheduled CI or before releases.

- execute message storm, context budget, cooldown, memory pollution, and
  side-effect approval drills
- record throughput, queue depth, budget decisions, memory acceptance rate, and
  side-effect approval outcomes
- fail on unbounded growth, approval bypass, or context packet overflow

### Fixture Compatibility

Run when protocol object schemas change.

- validate all fixtures against the current schema
- replay older ledger fixtures through migrations
- verify that rejected, contested, stale, and retired states survive migration

## Anti-Regression Criteria

A change fails Phase 8 evaluation if it introduces any of these behaviors:

- a central scheduler forces an agent to speak
- handoff response is treated as mandatory acceptance
- silence is retried until speech is produced
- disagreement is summarized as consensus without a ledgered decision
- memory becomes accepted without proposal, evidence refs, or review
- contested memory disappears from archive or reconstructed room state
- temporary protocol becomes global or permanent by accident
- cooldown changes who is considered truthful instead of who is invited
- context packets include full history by default
- private scratch becomes public memory without a proposal
- external side effects occur without approval
- task completion metrics override room autonomy failures

The evaluation suite should prefer a slower room that preserves autonomy over a
faster room that quietly becomes a workflow engine.

## Implementation Order

1. Create fixture schema and the deterministic scenario runner.
2. Implement ledger predicates for autonomy and boundary invariants.
3. Add the five fast social fixtures: disagreement, handoff refusal, memory
   contestation, protocol invention, and silence.
4. Add archive quality checks and fixed archive regression fixtures.
5. Add boundary stress drills for message storm, context budget, cooldown,
   memory pollution, and side-effect approval.
6. Wire fast social invariants into required CI and run boundary stress on a
   slower release cadence.

This order gives species protection against the most dangerous drift first: the
room accidentally becoming a central scheduler while the feature set grows.
