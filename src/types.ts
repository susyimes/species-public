export type RoomId = string;
export type AgentId = string;
export type TopicId = string;
export type MessageId = string;
export type EventId = string;
export type RefId = string;
export type CorrelationId = string;
export type LedgerCursor = number;

export type ActorKind = "user" | "agent" | "system" | "policy";

export type EventActor = {
  kind: ActorKind;
  id: string;
};

export type RoomEvent<TPayload = unknown> = {
  event_id: EventId;
  room_id: RoomId;
  event_type: string;
  schema_version: string;
  payload_schema: string;
  occurred_at: string;
  appended_at: string;
  actor: EventActor;
  causation_id: EventId | null;
  correlation_id: CorrelationId;
  idempotency_key: string;
  refs: RefId[];
  payload: TPayload;
  prev_event_id: EventId | null;
  prev_event_hash: string | null;
  event_hash: string;
};

export type InvariantResult = {
  ok: boolean;
  invariantId: string;
  severity: "error" | "warning";
  message: string;
  eventId?: string;
  suggestedEventType?: string;
};

export type AppendCommand<TPayload = unknown> = {
  roomId: RoomId;
  eventType: string;
  actor: EventActor;
  payload: TPayload;
  refs?: RefId[];
  causationId?: EventId;
  correlationId: CorrelationId;
  idempotencyKey: string;
  occurredAt?: string;
  expectedPrevEventId?: EventId;
  payloadSchema?: string;
};

export type AppendResult<TPayload = unknown> =
  | {
      status: "appended";
      event: RoomEvent<TPayload>;
      position: number;
    }
  | {
      status: "duplicate";
      event: RoomEvent<TPayload>;
      position: number;
    }
  | {
      status: "rejected";
      reason: string;
      invariantResults: InvariantResult[];
    }
  | {
      status: "conflict";
      expectedPrevEventId?: EventId;
      actualPrevEventId: EventId | null;
    };

export type MessageCreatedPayload = {
  messageId: MessageId;
  topicId?: TopicId;
  author: string;
  authorKind: ActorKind;
  replyTo?: MessageId;
  mentions: AgentId[];
  contextRefs: RefId[];
  content: string;
};

export type TopicStatus = "active" | "paused" | "merged" | "retired";

export type TopicRecord = {
  topicId: TopicId;
  title: string;
  status: TopicStatus;
  createdFrom: EventId;
  parentTopicId?: TopicId;
  summary?: string;
  openQuestions: string[];
};

export type TopicCreatedPayload = {
  topicId: TopicId;
  title: string;
  createdFromMessageId: MessageId;
  parentTopicId?: TopicId;
};

export type TopicUpdatedPayload = {
  topicId: TopicId;
  messageId?: MessageId;
  status?: TopicStatus;
  summary?: string;
  openQuestion?: string;
  mergedInto?: TopicId;
  appliedTopicProposalRef?: RefId;
  appliedBy?: AgentId;
  boundaryNote?: string;
};

export type TopicProposalAction = "new" | "split" | "pause" | "revive" | "merge";
export type TopicProposalResponse = "accept" | "reject" | "challenge" | "revise";

export type WakeCandidate = {
  agentId: AgentId;
  score: number;
  reasons: string[];
};

export type ContextFragmentVisibility =
  | "room_visible"
  | "agent_visible"
  | "hidden_runtime"
  | "private_agent";

export type ContextFragmentRole =
  | "user"
  | "agent"
  | "system"
  | "runtime"
  | "memory"
  | "protocol"
  | "persona"
  | "archive";

export type ContextFragmentSource = {
  kind: "ledger" | "projection" | "runtime" | "agent_profile";
  eventId?: EventId;
  ledgerCursor?: LedgerCursor;
};

export type ContextFragment = {
  id: string;
  type: string;
  visibility: ContextFragmentVisibility;
  role: ContextFragmentRole;
  source: ContextFragmentSource;
  refs: RefId[];
  tokenEstimate: number;
  hardCap: number;
  cacheKey: string;
  priority: number;
  body: string;
};

export type ContextFragmentOmissionReason =
  | "context_budget"
  | "hard_cap"
  | "duplicate"
  | "inactive_not_relevant"
  | "stale_not_relevant";

export type OmittedContextFragment = {
  id: string;
  type: string;
  visibility: ContextFragmentVisibility;
  tokenEstimate: number;
  hardCap: number;
  priority: number;
  reason: ContextFragmentOmissionReason;
  refs: RefId[];
};

export type ContextPacketAudit = {
  packetId: string;
  agentId?: AgentId;
  topicId: TopicId;
  selectedFragments: ContextFragment[];
  omittedFragments: OmittedContextFragment[];
  totalTokenEstimate: number;
  largestFragment?: {
    id: string;
    type: string;
    tokenEstimate: number;
    hardCap: number;
  };
  cacheKey: string;
  builtFromLedgerRange: {
    fromCursor: LedgerCursor;
    toCursor: LedgerCursor;
  };
};

export type AgentContextPacket = {
  packetId: string;
  roomId: RoomId;
  invitationId: string;
  agentId: AgentId;
  topicId: TopicId;
  triggeringEventId: EventId;
  topicSummary?: string;
  messageRefs: RefId[];
  proposalRefs: RefId[];
  memoryRefs: RefId[];
  protocolRefs: RefId[];
  actionRefs?: RefId[];
  constraints: {
    sideEffectsRequireApproval: true;
    silenceIsValid: true;
    mayRejectHandoff: true;
  };
  turnBoundary?: {
    invitedBy: "wake_policy" | "agent_intention" | "capability_result";
    invitationReason: string;
    invitationContextRefs: RefId[];
    recoveryRefs?: RefId[];
    maxAwakenedAgents?: number;
    maxSpeakers?: number;
    speakerArbitrationWindowMs?: number;
    visibleSpeakersAlreadyUsed?: number;
    speakerSlotsRemaining?: number;
    mayStaySilent: true;
    boundaryNote: string;
  };
  requestedPosture?: string;
  contextFragments?: ContextFragment[];
  contextAudit?: ContextPacketAudit;
};

export type SideEffectKind =
  | "filesystem.write"
  | "filesystem.delete"
  | "shell.exec"
  | "network.request"
  | "git.commit"
  | "git.push"
  | "pull_request.open"
  | "external_api.call";

export type SideEffectRequest = {
  requestId: string;
  roomId: RoomId;
  requestedBy: AgentId;
  topicId?: TopicId;
  kind: SideEffectKind;
  reason: string;
  target: string;
  expectedImpact: string;
  contextRefs: RefId[];
  sourcePressureRefs?: RefId[];
  proposedCommand?: string;
  idempotencyKey: string;
};

export type CapabilityUseInput = {
  path?: string;
  root?: string;
  query?: string;
  glob?: string;
  content?: string;
};

export type CapabilityUseIntention = {
  kind: "use_capability";
  capabilityId: string;
  operation: string;
  input: CapabilityUseInput;
  reason: string;
  contextRefs?: RefId[];
};

export type AgentIntention =
  | { kind: "speak"; content: string; contextRefs?: RefId[] }
  | { kind: "stay_silent"; reason?: string }
  | {
      kind: "ask_question";
      question: string;
      target?: "room" | AgentId | "user";
      contextRefs?: RefId[];
    }
  | {
      kind: "propose_topic";
      action: TopicProposalAction;
      title: string;
      reason: string;
      targetTopicId?: TopicId;
      contextRefs?: RefId[];
    }
  | {
      kind: "respond_topic";
      topicProposalRef: RefId;
      response: TopicProposalResponse;
      reason: string;
      proposedRevision?: string;
      contextRefs?: RefId[];
    }
  | {
      kind: "apply_topic";
      topicProposalRef: RefId;
      action: TopicProposalAction;
      title?: string;
      targetTopicId?: TopicId;
      reason: string;
      contextRefs?: RefId[];
    }
  | { kind: "invite_other"; agentId: AgentId; reason: string; contextRefs?: RefId[] }
  | {
      kind: "respond_invitation";
      invitationRef: RefId;
      response: InvitationResponse;
      reason: string;
      redirectTo?: AgentId;
      contextRefs?: RefId[];
    }
  | {
      kind: "propose_handoff";
      toAgentId: AgentId;
      reason: string;
      requestedResponse?: string;
      contextRefs: RefId[];
      returnTo?: AgentId;
    }
  | { kind: "accept_handoff"; handoffRef: RefId; reason?: string; contextRefs?: RefId[] }
  | { kind: "reject_handoff"; handoffRef: RefId; reason: string; contextRefs?: RefId[] }
  | {
      kind: "partially_accept_handoff";
      handoffRef: RefId;
      reason: string;
      acceptedScope?: {
        contextRefs?: RefId[];
        requestedResponse?: string;
      };
      contextRefs?: RefId[];
    }
  | {
      kind: "delegate_handoff";
      handoffRef: RefId;
      reason: string;
      redirectTo: AgentId;
      contextRefs?: RefId[];
    }
  | { kind: "challenge_handoff"; handoffRef: RefId; reason: string; contextRefs?: RefId[] }
  | { kind: "propose_memory"; summary: string; reason: string; contextRefs: RefId[]; revisedFromMemoryRef?: RefId }
  | { kind: "contest_memory"; memoryRef: RefId; reason: string; contextRefs?: RefId[] }
  | { kind: "accept_memory"; memoryRef: RefId; reason: string; contextRefs?: RefId[] }
  | { kind: "mark_memory_stale"; memoryRef: RefId; reason: string; contextRefs?: RefId[] }
  | { kind: "retire_memory"; memoryRef: RefId; reason: string; contextRefs?: RefId[] }
  | {
      kind: "propose_persona_delta";
      targetAgentId?: AgentId;
      field: "roleClaims" | "habits" | "personality" | "dailyMood";
      operation?: "set" | "add" | "remove";
      value: string;
      reason: string;
      contextRefs?: RefId[];
    }
  | {
      kind: "respond_persona_delta";
      deltaRef: RefId;
      response: "accept" | "reject" | "contest" | "retire" | "revise";
      reason: string;
      proposedRevision?: string;
      contextRefs?: RefId[];
    }
  | {
      kind: "propose_protocol";
      summary: string;
      scope: "current_topic" | "room" | "timeboxed";
      expiresAt?: string;
      reason: string;
      contextRefs?: RefId[];
    }
  | {
      kind: "respond_protocol";
      protocolRef: RefId;
      response: "accept" | "reject" | "challenge" | "revise";
      reason: string;
      proposedRevision?: string;
      contextRefs?: RefId[];
    }
  | { kind: "retire_protocol"; protocolRef: RefId; reason: string; contextRefs?: RefId[] }
  | {
      kind: "review_archive";
      archiveRef: RefId;
      assessment: "usable_skeleton" | "missing_context" | "biased_summary" | "needs_memory_contest" | "needs_repair";
      summary: string;
      reason: string;
      contextRefs?: RefId[];
    }
  | {
      kind: "propose_archive_repair";
      archiveRef: RefId;
      summary: string;
      reason: string;
      proposedRepair: string;
      contextRefs?: RefId[];
    }
  | {
      kind: "respond_archive_repair";
      repairRef: RefId;
      response: "accept" | "reject" | "challenge" | "revise" | "retire";
      reason: string;
      proposedRevision?: string;
      contextRefs?: RefId[];
    }
  | {
      kind: "retire_provider_boundary";
      providerBoundaryRef: RefId;
      reason: string;
      contextRefs?: RefId[];
    }
  | { kind: "share_workspace_artifact"; pathRef: string; summary: string; contextRefs?: RefId[] }
  | CapabilityUseIntention
  | { kind: "request_side_effect"; request: SideEffectRequest };

export type RoomProposal = {
  kind?: string;
  type?: string;
  eventType?: string;
  action?: string;
  refs?: RefId[];
  contextRefs?: RefId[];
  [key: string]: unknown;
};

export type RoomToolRequest = {
  capabilityId?: string;
  capability_id?: string;
  capability?: string;
  tool?: string;
  operation?: string;
  op?: string;
  action?: string;
  input?: CapabilityUseInput;
  reason?: string;
  refs?: RefId[];
  contextRefs?: RefId[];
  [key: string]: unknown;
};

export type RoomProposalEnvelope = {
  reply?: string | { content?: string; message?: string; refs?: RefId[]; contextRefs?: RefId[] };
  silence?: boolean | string | { reason?: string };
  proposedEvents?: RoomProposal[];
  proposed_events?: RoomProposal[];
  toolRequests?: RoomToolRequest[];
  tool_requests?: RoomToolRequest[];
  rationale?: string;
  refs?: RefId[];
  contextRefs?: RefId[];
};

export type AgentAdapter = {
  agentId: AgentId;
  requestIntention(packet: AgentContextPacket): Promise<AgentIntention>;
  consumeRuntimeDiagnostics?(): AgentRuntimeDiagnostic[];
};

export type AgentRuntimeDiagnostic = {
  eventType: "agent.provider_degraded";
  agentId: AgentId;
  providerKind?: string;
  providerLabel?: string;
  diagnostic: string;
  triggeringEventId: EventId;
  packetId: string;
};

export type MemoryState = "observed" | "proposed" | "contested" | "accepted" | "stale" | "retired";

export type MemoryClaim = {
  memoryId: string;
  roomId: RoomId;
  state: MemoryState;
  summary: string;
  sourceRefs: RefId[];
  sourcePressureRefs: RefId[];
  proposedBy?: AgentId;
  revisedFromMemoryRef?: RefId;
  revisedBy?: AgentId;
  contestedBy: AgentId[];
  contestRefs: RefId[];
  lastReviewedAt?: string;
};

export type InvitationResponse = "accept" | "reject" | "challenge" | "delegate";

export type HandoffStatus =
  | "proposed"
  | "accepted"
  | "rejected"
  | "partially_accepted"
  | "redirected"
  | "challenged"
  | "completed"
  | "expired";

export type ProtocolStatus = "proposed" | "active" | "rejected" | "challenged" | "revised" | "expired" | "retired";

export type Projection<T> = {
  apply(event: RoomEvent): void;
  view(): T;
};
