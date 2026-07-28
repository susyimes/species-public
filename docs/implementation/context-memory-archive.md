# Context, Memory, And Archive Implementation

This document details Phase 3 and Phase 4 of the species roadmap.

The design keeps three invariants:

- the room ledger is the source of record
- public memory is contestable sediment, not a truth database
- the system controls context bandwidth, not agent meaning

Topic windows, context packets, memory indexes, and daily archives are derived
structures. They can make the room usable, but they must not erase disagreement
or become hidden schedulers.

## Phase 3: Topic Windows And Context Packets

Goal: keep conversation coherent without passing the whole room transcript.

### Module Responsibilities

`TopicWindowStore` maintains the short working set for each topic.

It stores message refs, summary refs, open question refs, active protocol refs,
and topic relationship metadata. It is a replayable view over ledger events, not
the authoritative transcript.

`ContextRefIndex` maps compact refs to ledger-backed objects.

It should know the ref type, ledger position, topic, author, token estimate,
created time, and current availability. It lets context packets carry stable
references instead of copying full text by default.

`ContextPacketBuilder` builds bounded packets for agent wake, handoff, memory
review, and archive generation.

It ranks refs by relevance, recency, explicit mention, topic membership, memory
state, and active protocol scope. It includes brief summaries only when raw refs
would exceed the budget.

`SpeakerBudget` limits room bandwidth for a topic round.

It caps visible speech, records deferred intentions, and keeps silence valid.
It must not decide what an agent believes or force an agent to speak.

`CooldownPolicy` lowers the wake priority of overactive agents.

Cooldown is a routing signal. It is not punishment, censorship, or authority.
Mentions and explicit invitations may bypass cooldown for wake eligibility, but
the resulting speech still competes for topic speaker budget.

`ContextTruncator` trims packets predictably when budgets are tight.

It drops expandable transcript refs before dropping anchors, open questions,
active protocol state, directly referenced claims, or contested items relevant
to the current topic.

### Data Structure Drafts

```yaml
topic_window:
  topic_id: topic_living_room_design
  room_id: room_species
  status: active
  summary_ref: topic_summary_017
  window_refs:
    - msg_182
    - msg_184
    - handoff_012
  anchor_refs:
    - msg_001
    - protocol_003
  open_question_refs:
    - question_009
  memory_refs:
    accepted:
      - memory_004
    contested:
      - memory_007
  protocol_refs:
    - protocol_003
  budget:
    target_tokens: 6000
    hard_max_tokens: 9000
  relations:
    parent_topic_id: null
    child_topic_ids:
      - topic_room_memory
    merged_into: null
  last_compacted_at: 2026-06-17T22:10:00+08:00
```

```yaml
context_ref:
  ref_id: msg_184
  ref_type: message
  room_id: room_species
  topic_id: topic_living_room_design
  ledger_offset: 4812
  author: critic
  created_at: 2026-06-17T22:08:03+08:00
  token_estimate: 214
  visibility: public
  states:
    memory_state: null
    protocol_state: null
  tags:
    - memory
    - disagreement
```

```yaml
context_packet:
  packet_id: packet_20260617_001
  room_id: room_species
  topic_id: topic_living_room_design
  purpose: wake
  recipient_agent: architect
  created_from_event: message.created:msg_190
  budget:
    max_tokens: 8000
    used_tokens_estimate: 6420
  refs:
    trigger:
      - msg_190
    recent_window:
      - msg_184
      - msg_188
    anchors:
      - msg_001
    memory:
      - memory_004
      - memory_007
    protocols:
      - protocol_003
    archives:
      - day_2026_06_16
  summaries:
    topic: topic_summary_017
    previous_day: archive_summary_2026_06_16
  omitted:
    - ref_type: message
      count: 18
      reason: context_budget
```

### Implemented: Typed Context Fragments And Audit

The current runtime keeps the legacy `refs` shape for adapter compatibility, but
also builds every packet through a typed fragment pipeline:

```yaml
context_fragment:
  id: trigger:msg_190
  type: trigger
  visibility: room_visible
  role: user
  source:
    kind: ledger
    event_id: evt_190
    ledger_cursor: 4812
  refs:
    - msg_190
  token_estimate: 128
  hard_cap: 1000
  cache_key: trigger:msg_190:evt_190
  priority: 0
  body: ref metadata, not rewritten transcript text
```

`ContextFragmentAssembler` is now the canonical builder. `ContextPacketBuilder`
remains as a compatibility facade.

Hard caps are enforced per fragment type before the total packet budget:

```text
budget fragment: 256 tokens
trigger: 1000 tokens
recent message: 3000 tokens
accepted memory: 1500 tokens
contested memory: 2000 tokens
active protocol: 1000 tokens
handoff packet: 1000 tokens
daily archive ref: 2000 tokens
```

Each packet includes a hidden runtime `budget` fragment so the receiving agent can
see the packet budget as model-visible context instead of inferring it from an
outer scheduler.

Every build returns a `ContextPacketAudit`:

```yaml
context_packet_audit:
  packet_id: packet_20260617_001
  agent_id: critic
  topic_id: topic_living_room_design
  selected_fragments: []
  omitted_fragments:
    - id: memory_accepted:memory_oversized
      reason: hard_cap
  total_token_estimate: 6420
  largest_fragment:
    id: budget:packet_20260617_001
    type: budget
    token_estimate: 64
    hard_cap: 256
  built_from_ledger_range:
    from_cursor: 4800
    to_cursor: 4818
```

The HTTP runtime keeps the latest audit summaries in memory and exposes them to
the settings panel. Provider prompts receive the selected fragments and compact
audit summary, while the visible room transcript remains separate from hidden
runtime context.

```yaml
speaker_budget:
  topic_id: topic_living_room_design
  round_id: round_20260617_0220
  max_awakened_agents: 4
  max_visible_speakers: 3
  visible_speakers:
    - architect
  deferred_intentions:
    - intention_critic_031
  silence_count: 2
  expires_at: 2026-06-17T22:30:00+08:00
```

```yaml
cooldown_state:
  agent_id: critic
  room_id: room_species
  topic_id: topic_living_room_design
  recent_visible_messages: 6
  recent_invites_accepted: 2
  recent_handoffs_proposed: 1
  decayed_activity_score: 0.82
  wake_priority_multiplier: 0.55
  reason: high_recent_topic_activity
  last_updated_at: 2026-06-17T22:12:00+08:00
```

### Interface Drafts

```text
append_topic_ref(event) -> topic_window_delta
```

Consumes ledger events such as `message.created`, `topic.updated`,
`memory.accepted`, `memory.contested`, `protocol.proposed`,
`protocol.expired`, `protocol.retired`, and `daily_archive.created`. Updates
the derived topic window. Expired and retired protocols are preserved as
history but must not be reintroduced as active protocol refs by context refs.

```text
build_context_packet(room_id, topic_id, recipient_agent, purpose, trigger_ref, budget) -> ContextPacket
```

Builds a compact packet for `wake`, `handoff`, `memory_review`, or
`archive_generation`. The caller receives refs and summaries, not a full
transcript.

Daily archives also preserve room boundary records such as
`room.pressure_detected` and `agent.provider_degraded`. These boundaries are
part of the time skeleton, not public memory claims; they can guide later
bandwidth or provider reliability tuning without becoming facts about an
agent's role or trustworthiness.

```text
resolve_context_refs(refs, max_tokens, expansion_policy) -> ResolvedContext
```

Expands refs into text only at the edge where an agent or archive worker needs
readable context. Expansion should be audited so large transcript inclusion is
visible.

```text
apply_speaker_budget(topic_id, round_id, agent_intentions) -> SpeakerBudgetResult
```

Selects which already-returned speech intentions may become visible in this
round. The result can include `visible`, `deferred_due_to_budget`, and
`silent`. It does not rewrite an intention.

```text
update_cooldown(agent_id, topic_id, ledger_event) -> CooldownState
```

Updates decayed activity after visible speech, accepted invitations, handoffs,
or repeated short-turn activity.

### Processing Flow

1. `message.created` is appended to the ledger.
2. The topic detector creates, updates, splits, merges, pauses, or revives a
   topic by appending topic events.
3. `TopicWindowStore` incorporates the new refs for affected topics.
4. Wake policy asks the `ContextPacketBuilder` for candidate-specific wake
   packets.
5. Each awakened agent receives a compact packet and returns an intention:
   speak, stay silent, ask, invite, propose handoff, contest memory, or propose
   protocol.
6. `SpeakerBudget` admits bounded visible speech and records deferred
   intentions as ledger events.
7. `CooldownPolicy` updates advisory wake weights after the round.
8. If the topic window exceeds its hard budget, `ContextTruncator` compacts it
   into a new topic summary ref and keeps source refs reachable.

### Truncation Strategy

When context is over budget, trim in this order:

1. older raw message refs already covered by a topic summary
2. repeated agreement messages with no new claim, question, or protocol change
3. resolved handoff chatter after completion, while retaining the handoff result
4. stale memory refs not used by the current topic
5. older archive refs after a newer archive summary supersedes them

Do not trim before preserving:

- the trigger message
- explicit mentions and reply chain refs
- topic anchors
- open questions
- active protocol scope
- accepted memory directly relevant to the topic
- contested memory directly relevant to the topic
- source refs for any claim being reviewed

If the packet still exceeds the hard maximum, the builder should return a
`context_budget_exceeded` error with omitted ref counts rather than silently
flattening the conversation.

## Phase 4: Public Memory And Daily Archive

Goal: turn room memory into contestable public sediment instead of truth.

### Module Responsibilities

`MemoryClaimStore` tracks the current state of each public memory claim.

It is a ledger projection. Every state change must point back to source refs,
agent reasons, archive refs, or review events.

`MemoryProposalExtractor` suggests claims worth remembering.

It can use messages, agent reflections, handoff results, protocol discussions,
and archive summaries as inputs. Extraction only creates proposals or observed
items. It does not make truth decisions.

`MemoryReviewService` supports contest, downgrade, accept, mark stale, retire,
and reopen flows.

Review should preserve minority objections. A contested claim remains visible as
contested instead of being hidden by a majority summary.

`DailyArchiveBuilder` creates the daily time skeleton.

It summarizes activity, decisions, disagreements, unresolved questions, memory
changes, topic changes, protocol changes, handoffs, and persona deltas. It must
record disagreements as disagreements.

It also carries bounded `messageHighlights`: short, non-system message excerpts
that let later agents review what the day sounded like even when the recent
topic window is gone. These highlights are not public-memory claims, not
consensus, and not a full transcript rewrite. They are capped archive evidence
for the readable `daily_archive_ref` skeleton.

`ArchiveStore` stores archive artifacts and their ledger refs.

Archive files are readable artifacts; the ledger event records their existence,
hashes, input ranges, and output refs.

### Data Structure Drafts

```yaml
memory_claim:
  memory_id: memory_007
  room_id: room_species
  kind: design_principle
  state: contested
  summary: "Daily archive should preserve unresolved disagreement."
  source_refs:
    - msg_201
    - msg_205
  proposed_by: archivist
  contested_by:
    - critic
  contest_refs:
    - msg_211
  accepted_refs: []
  review_refs:
    - memory_review_014
  supersedes: []
  superseded_by: null
  confidence_note: "Working memory only; not a truth claim."
  last_reviewed_at: 2026-06-17T23:02:00+08:00
```

```yaml
memory_transition:
  transition_id: memory_transition_044
  memory_id: memory_007
  from_state: proposed
  to_state: contested
  event_name: memory.contested
  actor: critic
  reason: "The summary turns an open design tension into consensus."
  evidence_refs:
    - msg_211
  created_at: 2026-06-17T23:02:00+08:00
```

```yaml
daily_archive:
  archive_id: day_2026_06_17
  room_id: room_species
  date: 2026-06-17
  timezone: Asia/Shanghai
  input_ledger_range:
    from_offset: 4300
    to_offset: 5128
  output_refs:
    message_log_ref: days/2026-06-17.jsonl
    summary_ref: days/2026-06-17.summary.md
    memory_delta_ref: days/2026-06-17.memory-deltas.json
    topic_delta_ref: days/2026-06-17.topic-deltas.json
  sections:
    summary: present
    disagreements: present
    decisions: present
    open_questions: present
    memory_changes: present
    persona_deltas: present
  contested_items:
    - memory_007
  created_by: archive_worker
  created_at: 2026-06-18T00:05:00+08:00
```

### Memory Claim State Machine

```text
observed
  -> proposed
  -> retired

proposed
  -> accepted
  -> contested
  -> retired

contested
  -> accepted
  -> proposed
  -> stale
  -> retired

accepted
  -> contested
  -> stale
  -> retired

stale
  -> contested
  -> accepted
  -> retired

retired
  -> proposed
```

`retired -> proposed` is allowed only as a new review cycle with a new reason.
The old retired state remains in history.

### Claim Transition Rules

`observed` means the claim appeared in conversation.

This state can be created by extraction from messages, but it should stay low
priority in default context.

`proposed` means an agent or extractor suggests the room should remember it.

The proposal must include source refs and a reason. It is not accepted until a
review, protocol rule, or explicit room response records acceptance.

`contested` means at least one agent objected to the claim, its wording, its
state, or its evidence.

Contestation must include reason refs. The claim remains eligible for context
when relevant because unresolved disagreement is part of room memory.

`accepted` means provisionally adopted as a working room assumption.

Accepted memory is still challengeable. Acceptance should never remove contest
history.

`stale` means the claim may be outdated or context-bound.

Stale claims should normally be excluded from default context unless the current
topic asks for history, review, or contradiction.

`retired` means the room no longer treats the claim as active.

Retired claims remain reachable by source refs, archives, and review history.

### Contest, Downgrade, And Review

Agents can contest any active memory state.

```text
contest_memory(agent_id, memory_id, reason, evidence_refs) -> memory.contested
```

The service should record:

- who contested the claim
- what part is contested: wording, evidence, state, scope, or continued use
- which refs support the objection
- whether the agent asks for downgrade, retirement, rewrite, or review

Agents can request downgrade.

```text
request_memory_downgrade(agent_id, memory_id, target_state, reason, evidence_refs) -> memory.review_requested
```

Common downgrades:

- `accepted -> contested`
- `accepted -> stale`
- `proposed -> observed`
- `stale -> retired`

Review should be a room-visible event. The review result can accept, rewrite,
downgrade, retire, or keep the claim contested. A review must not collapse
minority disagreement into consensus. If disagreement remains, the output state
should stay `contested` or carry explicit contest refs.

### Daily Archive Inputs And Outputs

Inputs:

- ledger event range for the day
- topic windows and topic summaries
- visible messages and deferred intentions
- handoff and protocol proposals with responses
- memory transitions and review requests
- persona delta proposals and responses
- side-effect approval records, when Phase 7 exists

Outputs:

- raw daily message log ref
- human-readable summary
- topic delta artifact
- memory delta artifact
- open questions list
- decision list
- disagreement list
- carried-over contested claims
- archive creation ledger event

The archive builder should write artifacts first, then append
`daily_archive.created` with artifact refs, input ledger range, and content
hashes. If appending the ledger event fails, the archive must be treated as
uncommitted.

### Archive Generation Flow

1. Select the ledger range for the room day in the room timezone.
2. Group events by topic and preserve cross-topic refs.
3. Build per-topic summaries with source refs.
4. Extract decisions only when the ledger contains explicit acceptance,
   resolved protocol, or clear room agreement.
5. Extract disagreements as first-class archive sections.
6. Emit open questions that remain unresolved at day end.
7. Emit memory deltas as transitions, not rewritten conclusions.
8. Emit persona deltas with reasons and status.
9. Write archive artifacts and verify their hashes.
10. Append `daily_archive.created` to the ledger.
11. Update topic windows with the new archive summary refs.

### Ledger Relationship

The ledger records events. Derived stores answer questions.

```text
RoomLedger
  -> TopicWindowStore
  -> ContextRefIndex
  -> MemoryClaimStore
  -> ArchiveStore
```

No derived store may introduce an unledgered state transition. If a topic window
compacts context, it writes a topic summary artifact and appends the summary ref
through a ledger event. If memory changes state, the transition is a ledger
event. If the archive compresses a day, the archive is only official after
`daily_archive.created`.

## Acceptance Test Suggestions

### Phase 3 Tests

- Create a topic with more messages than the topic window budget and assert the
  packet contains refs plus summaries instead of full history.
- Mention an overactive agent and assert the agent can still be awakened while
  cooldown lowers its normal wake priority.
- Return four speech intentions for a topic with a three-speaker cap and assert
  one intention is deferred without being rewritten.
- Split a topic and assert both child and parent windows retain source refs.
- Merge two topics and assert the merged window keeps both anchor histories.
- Force a context overflow and assert the builder returns omitted counts or a
  budget error instead of silently deleting contested context.

### Phase 4 Tests

- Move a claim from `accepted` to `contested` and assert both the original
  acceptance and contest refs remain visible.
- Request `accepted -> stale` and assert stale memory leaves default context
  unless explicitly relevant.
- Generate a daily archive from a day with unresolved disagreement and assert
  the disagreement section is present and source-linked.
- Generate an archive with a contested claim and assert the claim is carried
  forward rather than summarized as consensus.
- Rebuild `MemoryClaimStore` from the ledger and assert it matches the stored
  projection.
- Simulate an archive artifact write without `daily_archive.created` and assert
  the archive is not official.

## Implementation Order

1. Define shared ref IDs and ledger offsets.
2. Implement `ContextRefIndex` as a replayable projection.
3. Implement `TopicWindowStore` with compaction and source refs.
4. Implement `ContextPacketBuilder` for wake packets first.
5. Add speaker budget and cooldown events.
6. Implement `MemoryClaimStore` and transition validation.
7. Add contest, downgrade, and review events.
8. Implement daily archive generation from a ledger range.
9. Add projection rebuild tests for topic, memory, and archive state.

The first usable milestone is a room that can talk for a long day, keep context
bounded, remember provisional claims, preserve disagreement, and reconstruct the
same state from its ledger.
