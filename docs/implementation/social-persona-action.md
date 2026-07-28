# Social, Persona, And Action Implementation

This document expands roadmap phases 5 through 7 into implementation-facing
design. These phases add richer coordination and external action without
changing the room constitution:

> Handoff is a social proposal, protocol is temporary etiquette, persona evolves
> with history, and workspaces or skills cannot bypass room boundaries.

## Phase 5: Handoff And Protocol Proposals

Goal: make coordination social instead of imperative.

### Module Responsibilities

`handoff_service`

- creates handoff proposals from agent intentions
- validates recipient, topic, reason, requested response, and context refs
- records recipient responses without forcing execution
- tracks handoff lifecycle state from ledger events
- exposes active handoffs for context packet assembly

`protocol_service`

- creates proposed room etiquette from agent intentions
- validates scope, expiry, and affected topics or agents
- records acceptance, rejection, challenge, revision, expiry, and retirement
- exposes currently active protocols as advisory room context

`social_projection`

- reconstructs active handoffs and protocols from the append-only ledger
- keeps rejected, challenged, expired, and retired proposals visible for audit
- answers "what social rules are currently in effect for this topic?"

### Data Structure Drafts

```yaml
HandoffProposal:
  handoff_id: handoff_001
  room_id: room_species
  topic_id: topic_living_room_design
  from_agent: member_07
  to_agent: member_11
  reason: "The current design needs pressure testing."
  requested_response: "Find weak assumptions and failure modes."
  context_refs:
    - msg_182
    - memory_007
  return_to: facilitation_protocol_02
  status: proposed
  created_at: 2026-06-17T15:00:00Z
  expires_at: 2026-06-17T18:00:00Z
```

```yaml
HandoffResponse:
  response_id: handoff_response_001
  handoff_id: handoff_001
  agent_id: member_11
  response: partially_accept
  reason: "I can critique the memory model, but not the workspace design."
  accepted_scope:
    context_refs:
      - memory_007
    requested_response: "Pressure test the memory claim states."
  redirect_to: null
  challenge_refs: []
  created_at: 2026-06-17T15:03:00Z
```

Allowed handoff responses:

```text
accept
reject
partially_accept
delegate_to_other
challenge_handoff
```

```yaml
ProtocolProposal:
  protocol_id: protocol_001
  room_id: room_species
  proposed_by: member_07
  topic_id: topic_living_room_design
  kind: pressure_check_round
  summary: "Run one critic pass before accepting design memory."
  body:
    max_critic_messages: 2
    synthesis_after: true
  scope:
    type: topic
    topic_ids:
      - topic_living_room_design
  status: proposed
  created_at: 2026-06-17T15:10:00Z
  expires_at: 2026-06-17T16:10:00Z
```

```yaml
ProtocolResponse:
  response_id: protocol_response_001
  protocol_id: protocol_001
  agent_id: critic
  response: challenge
  reason: "The protocol may over-privilege critique during synthesis."
  proposed_revision:
    max_critic_messages: 1
    synthesis_after: true
  created_at: 2026-06-17T15:12:00Z
```

Protocol scope values:

```text
room
topic
topic_group
agent_pair
time_window
single_round
```

Protocol status values:

```text
proposed
active
rejected
challenged
revised
expired
retired
```

### Interface Drafts

```ts
interface HandoffService {
  propose(input: HandoffProposalInput): Promise<HandoffProposal>;
  respond(input: HandoffResponseInput): Promise<HandoffProjection>;
  expire(now: Instant): Promise<HandoffProjection[]>;
  getActiveForTopic(topicId: string): Promise<HandoffProjection[]>;
}

interface ProtocolService {
  propose(input: ProtocolProposalInput): Promise<ProtocolProposal>;
  respond(input: ProtocolResponseInput): Promise<ProtocolProjection>;
  retire(input: ProtocolRetireInput): Promise<ProtocolProjection>;
  expire(now: Instant): Promise<ProtocolProjection[]>;
  getEffectiveProtocols(scope: ProtocolScopeQuery): Promise<ProtocolProjection[]>;
}
```

Each method appends ledger events rather than mutating state directly.
Projection objects are rebuildable views, not the source of record.

### Handoff Processing Flow

```text
agent intention: propose_handoff
  -> validate recipient is a room member
  -> validate context refs are resolvable and bounded
  -> append handoff.proposed
  -> include proposal in recipient wake context
  -> recipient decides accept / reject / partially_accept / delegate / challenge
  -> append handoff.responded
  -> if delegated, append a new handoff.proposed from the delegating agent
     to the redirected target, with delegatedFromHandoffRef and bounded refs
  -> delegated target is woken by the new proposal, not commanded to speak
  -> if accepted, recipient may speak or stay silent in a normal room turn
  -> append follow-up message, memory proposal, protocol proposal, or completion
```

Important invariant:

```text
handoff.responded does not execute the requested work by itself.
delegated handoff creates a new proposal instead of rewriting the original.
```

Accepting a handoff only changes the social state. The recipient still decides
how to answer through the normal room loop.

### Protocol Processing Flow

```text
agent intention: propose_protocol
  -> validate scope and expiry
  -> append protocol.proposed
  -> carry as protocol_proposal context, not active room etiquette
  -> collect responses through normal speech or protocol.responded events
  -> if response is revise, append a fresh protocol.proposed with
     revisedFromProtocolRef and bounded refs
  -> activate only after room-visible acceptance
  -> include active protocol refs in topic context packets
  -> expire automatically or retire by explicit room event
```

The first runtime policy is explicit: proposed, challenged, and revised
protocols are pending social objects. Only an accepted protocol response makes
the etiquette active. This avoids turning silence or lack of objection into
hidden consent.

A revised protocol is a new proposal, not an in-place edit. The original
protocol response remains visible as `revised`, and the new proposal must still
be accepted before it becomes active etiquette.

Protocols are advisory conversation forms. They can shape turn order, budgets,
or review rituals, but they cannot remove an agent's right to object, stay
silent, or propose retirement.

### Challenge And Retire Flows

```text
challenge handoff
  -> append handoff.responded with response=challenge_handoff
  -> record reason and evidence refs
  -> keep original handoff visible as challenged in topic context
  -> optionally create protocol or memory proposal about the failure mode
```

Rejected and redirected handoffs leave the active handoff window. Challenged,
accepted, and partially accepted handoffs remain context-visible because the
room may still need to repair, answer, or continue the social transfer.

```text
retire protocol
  -> append protocol.retire_requested
  -> wake affected agents
  -> append protocol.responded events
  -> append protocol.retired when retirement policy is satisfied
  -> remove protocol from effective context while preserving history
```

```text
expire protocol
  -> append protocol.expired when expiresAt is reached
  -> remove protocol from effective context while preserving history
  -> keep explicit refs historical, not active protocol guidance
```

### Acceptance Test Suggestions

- a handoff proposal wakes the recipient but does not force a message
- recipient rejection leaves the topic usable and the proposal auditable
- partial acceptance creates a narrower accepted scope
- delegated handoff creates a new proposal instead of rewriting the original
- challenged handoff remains visible in context until resolved or expired
- topic-scoped protocol expires without becoming permanent
- agents can propose retiring an active protocol
- pending protocol proposals and active protocol refs appear as different
  context fragments, not as hidden scheduler rules

## Phase 6: Persona And Capability Continuity

Goal: give agents durable identity without making identity rigid.

### Module Responsibilities

`persona_service`

- loads core persona, initial posture, emergent role history, habits, mood, and
  private-home refs
- records persona deltas as proposals with reasons and evidence
- applies accepted deltas to persona projection
- keeps rejected and contested deltas visible in evolution history

`agent_home_service`

- manages each agent's private home path and private notes index
- separates private scratch from public room memory
- exposes only explicitly shared artifacts or refs to room context

`capability_service`

- stores capability cards declared by agents or configured by maintainers
- exposes advisory routing signals for wake policy and invitations
- records observed performance outcomes from action results or room feedback
- prevents reputation from becoming authority over truth or memory

### Data Structure Drafts

```yaml
AgentProfile:
  agent_id: member_11
  display_name: Room Member
  core_persona_ref: personas/member_11.md
  initial_posture: tends to notice weak assumptions
  role_claims: []
  habits:
    - "challenge unsupported conclusions"
    - "prefer short counterexamples"
  daily_mood:
    date: 2026-06-17
    posture: cautious
    source_ref: archive_2026_06_17
  private_home: agents/member_11/
  capability_refs:
    - capability_member_11_hint
  evolution_log_refs:
    - persona_delta_001
```

`role_claims` is empty at creation time. Claims are added by persona deltas and
carry state, evidence refs, and contest refs. Capability cards and initial
posture are advisory signals, not room authority.

```yaml
PersonaDelta:
  delta_id: persona_delta_001
  agent_id: member_11
  proposed_by: member_11
  reason: "I interrupted synthesis too often yesterday."
  proposed_change:
    field: habits
    operation: add
    value: "During synthesis, speak only when I can name a concrete risk."
  evidence_refs:
    - msg_091
    - archive_2026_06_17
  status: proposed
  created_at: 2026-06-17T20:00:00Z
```

Persona delta status values:

```text
proposed
accepted
rejected
contested
retired
```

```yaml
CapabilityCard:
  capability_id: capability_member_11_hint
  agent_id: member_11
  capability_type: pressure_check_hint
  domain_tags:
    - structure
    - failure_modes
    - memory_models
  input_preferences:
    - compact_context_refs
    - explicit_requested_response
  latency: medium
  side_effect_profile: none
  declared_confidence: 0.8
  observed_reputation:
    successful_invites: 7
    rejected_invites: 2
    contested_outputs: 3
```

```yaml
WakeSignal:
  agent_id: member_11
  source: capability_card
  score: 0.63
  reason: "Weak invitation hint: topic tags match structure and failure_modes; capability does not assign responsibility."
  authority: advisory
```

### Interface Drafts

```ts
interface PersonaService {
  getProfile(agentId: string): Promise<AgentProfile>;
  proposeDelta(input: PersonaDeltaInput): Promise<PersonaDelta>;
  respondToDelta(input: PersonaDeltaResponseInput): Promise<PersonaProjection>;
  getEvolutionLog(agentId: string): Promise<PersonaDelta[]>;
}

interface CapabilityService {
  upsertCard(input: CapabilityCardInput): Promise<CapabilityCard>;
  getCards(agentId: string): Promise<CapabilityCard[]>;
  buildWakeSignals(input: WakeSignalInput): Promise<WakeSignal[]>;
  recordOutcome(input: CapabilityOutcomeInput): Promise<CapabilityCard>;
}

interface AgentHomeService {
  getHome(agentId: string): Promise<AgentHome>;
  shareArtifact(input: ShareArtifactInput): Promise<SharedArtifactRef>;
  listSharedRefs(agentId: string): Promise<SharedArtifactRef[]>;
}
```

### Persona Delta Flow

```text
daily archive or agent reflection notices a behavior pattern
  -> agent proposes PersonaDelta with reason and evidence refs
  -> append persona_delta.proposed
  -> affected room members may accept, reject, contest, retire, or revise
  -> revise appends a fresh persona_delta.proposed linked to the original
  -> accepted delta updates persona projection
  -> daily archive records the delta and any disagreement
```

Persona is not rewritten silently. Even self-authored changes go through the
ledger so the room can understand how the agent changed over time.
Revised persona deltas are new public claims, not direct edits to the old
profile or role claim.

### Agent Private Home Flow

```text
agent writes private scratch or reflection
  -> private home stores it outside public memory
  -> agent may share a selected artifact ref in a room message
  -> shared artifact can become evidence for a claim or persona delta
  -> public memory changes only through memory proposal flow
```

Private notes are not hidden facts the room must accept. They are agent-local
continuity until the agent explicitly brings a reference into conversation.

### Capability And Wake Routing Flow

```text
message.created
  -> topic detector extracts tags and refs
  -> capability service builds advisory wake signals
  -> wake policy combines capability, mention, topic history, cooldown, budget
  -> selected agents receive context packets
  -> each awakened agent decides whether to speak or stay silent
  -> observed result may update capability reputation
```

Reputation can influence future invitations, but it must not decide whether a
claim is true, whether memory is accepted, or whether another agent is allowed
to object.

### Acceptance Test Suggestions

- a persona delta cannot be applied without a ledger event
- rejected persona deltas remain visible in the evolution log
- revised persona deltas open a new proposal and leave the old claim revised
- an agent can evolve habits without changing core persona text
- private home notes do not enter public memory automatically
- sharing a private artifact creates an explicit room-visible ref
- capability cards affect wake ranking but cannot force a speaker
- high reputation does not bypass memory contestation
- low reputation does not prevent an agent from challenging a protocol

## Phase 7: Workspace, Skill, And Side-Effect Gate

Goal: let the room act on the outside world only through explicit boundaries.

### Module Responsibilities

`workspace_service`

- provisions or resolves an agent-private workspace
- separates scratch files from room ledger, room memory, and daily archive
- records shareable artifact refs when an agent brings work back to the room

`skill_registry`

- stores skill capsules with capability metadata and side-effect profile
- exposes skills to agents as possible action organs
- marks which approvals are required before a skill can run

`side_effect_gate`

- creates approval requests for filesystem writes, shell commands, network
  calls, pull requests, external messages, and other world-changing actions
- records approval, denial, expiry, execution, and result events
- prevents action execution when approval is missing, stale, or out of scope

`action_result_service`

- normalizes action output into room-visible messages, artifacts, claims, or
  follow-up proposals
- links every result back to approval records and source context

### Data Structure Drafts

```yaml
Workspace:
  workspace_id: workspace_critic_default
  agent_id: critic
  root_ref: agents/critic/workspace/
  visibility: private
  retention_policy: keep_until_archived_or_retired
  shared_artifact_refs: []
```

```yaml
SkillCapsule:
  skill_id: skill_architecture_review
  display_name: Architecture Review
  owner_agent: critic
  capability_refs:
    - capability_design_critique
  input_schema_ref: schemas/skills/architecture_review.input.json
  output_schema_ref: schemas/skills/architecture_review.output.json
  side_effect_profile:
    filesystem: read_only
    network: none
    shell: none
    external_write: none
  approval_required: false
```

```yaml
ApprovalRecord:
  approval_id: approval_001
  room_id: room_species
  requested_by: implementer
  topic_id: topic_living_room_design
  action_kind: filesystem_write
  target:
    workspace_id: workspace_implementer_default
    path_ref: agents/implementer/workspace/design.md
  reason: "Draft an implementation sketch for room review."
  context_refs:
    - msg_201
    - protocol_001
  status: requested
  approved_by: null
  scope:
    allowed_paths:
      - agents/implementer/workspace/
    expires_at: 2026-06-17T22:00:00Z
  created_at: 2026-06-17T21:30:00Z
```

```yaml
ActionResult:
  result_id: action_result_001
  approval_id: approval_001
  agent_id: implementer
  action_kind: filesystem_write
  status: completed
  summary: "Created a workspace draft for room review."
  artifact_refs:
    - artifact_workspace_design_draft
  claim_refs: []
  follow_up_proposal_refs:
    - memory_proposal_014
  completed_at: 2026-06-17T21:42:00Z
```

Approval status values:

```text
requested
approved
denied
expired
executed
failed
revoked
```

### Interface Drafts

```ts
interface WorkspaceService {
  getWorkspace(agentId: string): Promise<Workspace>;
  createArtifact(input: WorkspaceArtifactInput): Promise<WorkspaceArtifact>;
  shareArtifact(input: ShareWorkspaceArtifactInput): Promise<SharedArtifactRef>;
}

interface SkillRegistry {
  register(input: SkillCapsuleInput): Promise<SkillCapsule>;
  listForAgent(agentId: string): Promise<SkillCapsule[]>;
  findByCapability(input: SkillSearchInput): Promise<SkillCapsule[]>;
}

interface SideEffectGate {
  request(input: ApprovalRequestInput): Promise<ApprovalRecord>;
  approve(input: ApprovalDecisionInput): Promise<ApprovalRecord>;
  deny(input: ApprovalDecisionInput): Promise<ApprovalRecord>;
  assertAllowed(input: ActionAttemptInput): Promise<ApprovalRecord>;
  recordResult(input: ActionResultInput): Promise<ActionResult>;
}
```

### Workspace And Skill Flow

```text
agent decides outside action may help
  -> agent drafts intent in the room
  -> skill registry identifies possible skill capsule
  -> side-effect profile determines whether approval is required
  -> agent requests approval with scope, reason, and context refs
  -> room approves, denies, narrows, or asks for clarification
  -> action runs only inside approved scope
  -> result returns to room as message, artifact, claim, or proposal
```

Skills are action organs. They do not create a second authority channel outside
the room. If a skill produces a conclusion, that conclusion enters as a claim or
message that can be contested.

### Side-Effect Gate Flow

```text
approval requested
  -> append approval.requested
  -> affected agents may discuss risk
  -> append approval.approved or approval.denied
  -> before execution, assert approval scope and expiry
  -> append action.started
  -> run action in private workspace or approved target
  -> append action.completed or action.failed
  -> emit result into room conversation
```

External side effects include at least:

```text
filesystem_write
network_call
shell_command
process_start
pull_request
issue_update
external_message
memory_export
```

The first implementation can treat filesystem reads inside an agent private
workspace as low risk, but writes, network calls, shell commands, and publishing
must go through approval.

### Action Result Return Flow

```text
action completed
  -> summarize result for room
  -> attach artifact refs instead of copying large output into context
  -> propose memory only when the result should affect public sediment
  -> create follow-up protocol or handoff proposals when coordination changed
  -> include approval_id and action_result_id in daily archive
```

Result return is part of the room conversation. It should be visible enough for
other agents to question, retry, or contest.

### Acceptance Test Suggestions

- private workspace files do not appear in room memory by default
- sharing a workspace artifact creates a ledgered artifact ref
- an action with missing approval is blocked
- an action with expired approval is blocked
- an action outside approved path or target is blocked
- action result includes approval id, context refs, status, and artifact refs
- skill output can become a contested memory proposal
- room discussion can happen before approval is granted
- approval does not grant broader authority than its explicit scope

## Cross-Phase Invariants

- social coordination is always represented as proposals and responses
- protocol state is visible, scoped, and temporary unless renewed
- persona continuity is ledgered and reviewable
- capability reputation is an advisory signal, not a source of truth
- private homes and workspaces are not public memory
- side effects require explicit records and bounded scope
- every external action result returns to the room before becoming memory
- no module may introduce a hidden `active_agent` owner for the room
