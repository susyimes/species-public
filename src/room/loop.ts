import type {
  ActorKind,
  AgentAdapter,
  AgentContextPacket,
  AgentId,
  AgentIntention,
  AgentRuntimeDiagnostic,
  AppendCommand,
  AppendResult,
  CapabilityUseInput,
  CorrelationId,
  ContextFragment,
  EventActor,
  EventId,
  InvitationResponse,
  MessageCreatedPayload,
  MessageId,
  RefId,
  RoomEvent,
  RoomId,
  SideEffectRequest,
  TopicCreatedPayload,
  TopicId,
  TopicProposalAction,
  TopicProposalResponse,
  TopicUpdatedPayload,
  WakeCandidate,
} from "../types";
import {
  executeAgentCapability,
  failedAgentCapabilityOutcome,
  type AgentCapabilityExecutor,
  type AgentCapabilityUseRequest,
} from "../capabilities/capabilities";
import { workspaceIdForAgent, type WorkspaceArtifactSharedPayload } from "../workspace/workspace";
import { createAgentRegistry } from "./agents";

export type LedgerLike = {
  append<TPayload>(command: AppendCommand<TPayload>): Promise<AppendResult<TPayload>>;
  readAll?(): Promise<RoomEvent[]>;
};

export type IncomingMessage = {
  roomId: RoomId;
  author: string;
  authorKind: Exclude<ActorKind, "policy">;
  content: string;
  clientMessageId: string;
  messageId?: MessageId;
  topicId?: TopicId;
  replyTo?: MessageId;
  mentions?: AgentId[];
  contextRefs?: RefId[];
  correlationId?: CorrelationId;
};

export type RoomLoopOptions = {
  ledger: LedgerLike;
  agents: readonly AgentAdapter[];
  maxAwakenedAgents?: number;
  maxSpeakers?: number;
  speakerArbitrationWindowMs?: number;
  idFactory?: IdFactory;
  wakePolicyVersion?: string;
  contextPacketFactory?: AgentContextPacketFactory;
  wakeHintProvider?: AdvisoryWakeHintProvider;
  capabilityExecutor?: AgentCapabilityExecutor;
};

export type IdFactory = (prefix: string) => string;

export type AgentContextPacketFactoryInput = {
  roomId: RoomId;
  invitationId: string;
  agentId: AgentId;
  topicId: TopicId;
  triggeringEventId: EventId;
  triggeringMessageId: MessageId;
  topicSummary?: string;
  maxContextTokens: number;
  fallbackPacket: AgentContextPacket;
};

export type AgentContextPacketFactory = (
  input: AgentContextPacketFactoryInput,
) => AgentContextPacket | Promise<AgentContextPacket>;

export type AdvisoryWakeHint = {
  agentId: AgentId;
  capabilityId: string;
  score: number;
  reason: string;
  matchedTags: string[];
  authority: "advisory";
  mustSpeak: false;
};

export type AdvisoryWakeHintProviderInput = {
  roomId: RoomId;
  message: MessageCreatedPayload;
  topicId: TopicId;
  eligibleAgentIds: AgentId[];
  mentionedAgentIds: AgentId[];
};

export type AdvisoryWakeHintProvider = (
  input: AdvisoryWakeHintProviderInput,
) => readonly AdvisoryWakeHint[] | Promise<readonly AdvisoryWakeHint[]>;

const ADVISORY_WAKE_HINT_MAX_SCORE = 0.15;
const ADVISORY_WAKE_HINT_BOUNDARY =
  "capability hints are weak invitations only; they do not assign responsibility or override mentions";

export type TopicDetectionResult =
  | {
      status: "existing_topic";
      topicId: TopicId;
      confidence: number;
      reason: "topic_hint" | "reply_to" | "recent_active";
    }
  | {
      status: "new_topic";
      topicId: TopicId;
      title: string;
      confidence: number;
      reason: "new_topic";
    };

export type RoomLoopIntentionResult = {
  agentId: AgentId;
  kind: AgentIntention["kind"];
  eventId: EventId;
};

export type RoomLoopResult = {
  correlationId: CorrelationId;
  triggeringMessageEventId: EventId;
  topicId: TopicId;
  invitedAgents: AgentId[];
  secondaryInvitedAgents: AgentId[];
  intentions: RoomLoopIntentionResult[];
  visibleMessageEventIds: EventId[];
  deferredIntentionEventIds: EventId[];
  sideEffectRequestEventIds: EventId[];
  capabilityInvocationEventIds: EventId[];
  capabilityResultEventIds: EventId[];
};

export type RoomLoopAcceptedMessage = {
  correlationId: CorrelationId;
  triggeringMessageEventId: EventId;
  triggeringMessageId: MessageId;
  topicId: TopicId;
  topicEventId: EventId;
  messageEvent: RoomEvent<MessageCreatedPayload>;
  topicEvent: RoomEvent<TopicCreatedPayload | TopicUpdatedWithDetectionPayload>;
  wakeIdempotencyScope?: string;
  maxAwakenedAgents?: number;
  maxSpeakers?: number;
};

type WakeCandidateWithConstraints = WakeCandidate & {
  recoveryRefs: RefId[];
  constraints: {
    maxContextTokens: number;
    maySpeak: boolean;
    mayStaySilent: true;
    sideEffectsRequireApproval: true;
  };
};

type WakeActivity = {
  invitations: number;
  visibleMessages: number;
  deferredSpeeches: number;
  deferredContextRefs: RefId[];
  lastActivityCursor: number;
  lastDeferredCursor: number;
};

type CandidateIntentionResult = {
  candidate: WakeCandidateWithConstraints;
  invitationEvent: RoomEvent<AgentInvitedPayload>;
  intentionEvent: RoomEvent<AgentIntentionRecordedPayload>;
  intention: AgentIntention;
};

type InvitedIntentionResult = {
  agentId: AgentId;
  invitationEvent: RoomEvent<AgentInvitedPayload>;
  intentionEvent: RoomEvent<AgentIntentionRecordedPayload>;
  intention: AgentIntention;
};

type AgentTurnBoundary = NonNullable<AgentContextPacket["turnBoundary"]>;

type SecondaryWakeRequest = {
  agentId: AgentId;
  topicId: TopicId;
  triggeringEventId: EventId;
  triggeringMessageId: MessageId;
  reason: string;
  contextRefs: RefId[];
  source: "agent_message" | "invite_other" | "handoff_proposed";
  requesterAgentId: AgentId;
  invitationEvent?: RoomEvent<AgentInvitedPayload>;
};

type WakeCandidatesSelectedPayload = {
  messageEventId: EventId;
  topicId: TopicId;
  policyVersion: string;
  wakeIdempotencyScope?: string;
  candidates: WakeCandidateWithConstraints[];
  budget: {
    maxAwakenedAgents: number;
    maxSpeakers: number;
    speakerArbitrationWindowMs: number;
    advisoryHintMaxScore: number;
    advisoryHintBoundary: typeof ADVISORY_WAKE_HINT_BOUNDARY;
  };
};

type AgentInvitedPayload = {
  invitationId: string;
  agentId: AgentId;
  topicId: TopicId;
  messageEventId: EventId;
  wakeEventId?: EventId;
  invitedBy: "wake_policy" | "agent_intention" | "capability_result";
  reason: string;
  contextRefs: RefId[];
  sourcePressureRefs?: RefId[];
  recoveryRefs?: RefId[];
  delegatedFromInvitationRef?: RefId;
  delegatedBy?: AgentId;
  boundaryNote?: string;
};

type AgentInvitationRespondedPayload = {
  responseId: string;
  invitationRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: InvitationResponse;
  reason: string;
  redirectTo?: AgentId;
  contextRefs: RefId[];
  boundaryNote: "invitation response is a social reply to a knock, not a speaking command";
};

type AgentInvitationReviewedPayload = {
  reviewId: string;
  invitationRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "reviewed" | "questioned" | "cautioned" | "deferred" | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  boundaryNote: "invitation review is a social trace; it does not accept, reject, challenge, delegate, force speech, or create a new invitation";
};

type AgentIntentionRecordedPayload = {
  invitationId: string;
  packetId: string;
  agentId: AgentId;
  topicId: TopicId;
  triggeringEventId: EventId;
  intention: AgentIntention;
};

type CapabilityInvokedPayload = {
  invocationId: string;
  capabilityId: string;
  operation: string;
  input: CapabilityUseInput;
  reason: string;
  roomId: RoomId;
  agentId: AgentId;
  topicId: TopicId;
  contextRefs: RefId[];
  visibility: "private_agent";
  boundaryNote: string;
};

type CapabilityResultPayload = {
  invocationId: string;
  capabilityId: string;
  operation: string;
  status: "completed" | "failed" | "approval_required";
  roomId: RoomId;
  agentId: AgentId;
  topicId: TopicId;
  summary: string;
  output: Record<string, unknown>;
  error?: string;
  visibility: "private_agent";
  requestedFromIntentionEventId: EventId;
  contextRefs: RefId[];
  boundary: Record<string, unknown>;
  boundaryNote: string;
};

type AgentProviderDegradedPayload = {
  agentId: AgentId;
  topicId: TopicId;
  triggeringEventId: EventId;
  packetId: string;
  providerKind?: string;
  providerLabel?: string;
  diagnostic: string;
  boundaryNote: "provider degradation is not agent silence";
};

type ProviderBoundaryRetiredPayload = {
  providerBoundaryRef: RefId;
  retiredBy: AgentId;
  topicId: TopicId;
  status: "retired";
  reason: string;
  contextRefs: RefId[];
  boundaryNote: "provider boundary retirement removes old runtime pressure from current room context; it does not delete ledger or archive history";
};

type AgentIntentionDeferredPayload = {
  agentId: AgentId;
  topicId: TopicId;
  triggeringEventId: EventId;
  intentionEventId: EventId;
  originalIntentionKind: AgentIntention["kind"];
  reason: "speaker_budget_exhausted";
};

type HandoffProposedPayload = {
  handoffId: string;
  topicId: TopicId;
  fromAgentId: AgentId;
  toAgentId: AgentId;
  reason: string;
  requestedResponse?: string;
  contextRefs: RefId[];
  sourcePressureRefs?: RefId[];
  returnTo?: AgentId;
  status: "proposed";
  delegatedFromHandoffRef?: RefId;
  delegatedBy?: AgentId;
  boundaryNote?: "delegated handoff is a new social proposal, not a rewrite of the original";
};

type HandoffRespondedPayload = {
  topicId: TopicId;
  handoffRef: RefId;
  byAgentId: AgentId;
  response: "accepted" | "rejected" | "partially_accepted" | "redirected" | "challenged";
  reason?: string;
  contextRefs: RefId[];
  acceptedScope?: {
    contextRefs?: RefId[];
    requestedResponse?: string;
  };
  redirectTo?: AgentId;
};

type HandoffReviewedPayload = {
  reviewId: string;
  handoffRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "reviewed" | "questioned" | "cautioned" | "deferred" | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  boundaryNote: "handoff review is a social trace; it does not accept, reject, partially accept, delegate, challenge, complete, or transfer control";
};

type MemoryProposedPayload = {
  memoryId: string;
  topicId: TopicId;
  state: "proposed";
  summary: string;
  reason: string;
  sourceRefs: RefId[];
  sourcePressureRefs?: RefId[];
  proposedBy: AgentId;
  revisedFromMemoryRef?: RefId;
  revisedBy?: AgentId;
  boundaryNote?: string;
};

type MemoryPressureDetectedPayload = {
  reason: "pending_memory_proposal_limit";
  topicId: TopicId;
  triggeringMemoryId: string;
  pendingProposalCount: number;
  threshold: number;
  proposedMemoryRefs: RefId[];
  boundaryNote: string;
};

type MemoryContestedPayload = {
  topicId: TopicId;
  memoryId: RefId;
  memoryRef: RefId;
  reason: string;
  contestedBy: AgentId;
  contestRefs: RefId[];
};

type MemoryTransitionPayload = {
  topicId: TopicId;
  memoryId: RefId;
  memoryRef: RefId;
  state: "accepted" | "stale" | "retired";
  reason: string;
  contextRefs: RefId[];
  transitionedBy: AgentId;
};

type MemoryReviewedPayload = {
  reviewId: string;
  memoryRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "reviewed" | "questioned" | "cautioned" | "deferred" | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  boundaryNote: "memory review is a social trace; it does not accept, contest, stale, retire, or turn the claim into truth";
};

type ProtocolProposedPayload = {
  protocolId: string;
  topicId: TopicId;
  proposedBy: AgentId;
  summary: string;
  scope: "current_topic" | "room" | "timeboxed";
  expiresAt: string;
  expiryPolicy: "explicit" | "system_default_24h";
  reason: string;
  contextRefs: RefId[];
  sourcePressureRefs?: RefId[];
  status: "proposed";
  revisedFromProtocolRef?: RefId;
  revisedBy?: AgentId;
  boundaryNote: "protocol is temporary room etiquette, not permanent control flow";
};

type ProtocolRespondedPayload = {
  responseId: string;
  protocolId: RefId;
  protocolRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "accept" | "reject" | "challenge" | "revise";
  reason: string;
  proposedRevision?: string;
  contextRefs: RefId[];
  status: "active" | "rejected" | "challenged" | "revised";
};

type ProtocolReviewedPayload = {
  reviewId: string;
  protocolRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "reviewed" | "questioned" | "cautioned" | "deferred" | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  boundaryNote: "protocol review is a social trace; it does not accept, reject, challenge, revise, retire, or activate etiquette";
};

type ProtocolRetiredPayload = {
  protocolId: RefId;
  protocolRef: RefId;
  topicId: TopicId;
  retiredBy: AgentId;
  reason: string;
  contextRefs: RefId[];
  status: "retired";
  retiredAt: string;
};

type ArchiveReviewedPayload = {
  reviewId: string;
  archiveRef: RefId;
  topicId: TopicId;
  reviewedBy: AgentId;
  assessment: "usable_skeleton" | "missing_context" | "biased_summary" | "needs_memory_contest" | "needs_repair";
  summary: string;
  reason: string;
  contextRefs: RefId[];
  boundaryNote: "archive review is room-visible critique, not archive mutation";
};

type ArchiveReviewRequestedPayload = {
  requestId: RefId;
  archiveRef: RefId;
  date?: string;
  requestedBy?: string;
  summary: string;
  reason: string;
  status: string;
  contextRefs: RefId[];
  boundaryNote?: string;
};

type ArchiveRepairProposedPayload = {
  repairId: string;
  archiveRef: RefId;
  topicId: TopicId;
  proposedBy: AgentId;
  summary: string;
  reason: string;
  proposedRepair: string;
  contextRefs: RefId[];
  status: "proposed";
  revisedFromRepairRef?: RefId;
  revisedBy?: AgentId;
  boundaryNote: "archive repair proposal does not rewrite the archive until later room action accepts it";
};

type ArchiveRepairRespondedPayload = {
  responseId: string;
  repairRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "accept" | "reject" | "challenge" | "revise" | "retire";
  reason: string;
  proposedRevision?: string;
  contextRefs: RefId[];
  status: "accepted" | "rejected" | "challenged" | "revised" | "retired";
  boundaryNote: "archive repair response changes repair proposal state only; archive content is unchanged";
};

type ArchiveRepairReviewedPayload = {
  reviewId: string;
  repairRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "reviewed" | "questioned" | "cautioned" | "deferred" | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  boundaryNote: "archive repair review is a social trace; it does not accept, reject, challenge, revise, retire, apply, or mutate the archive";
};

type PersonaDeltaProposedPayload = {
  deltaId: string;
  agentId: AgentId;
  proposedBy: AgentId;
  reason: string;
  proposedChange: {
    field: "roleClaims" | "habits" | "personality" | "dailyMood";
    operation: "set" | "add" | "remove";
    value: string | {
      date: string;
      posture: string;
      sourceRef?: RefId;
    };
  };
  evidenceRefs: RefId[];
  sourcePressureRefs?: RefId[];
  status: "proposed";
  createdAt: string;
  responses: [];
  revisedFromDeltaRef?: RefId;
  revisedBy?: AgentId;
  boundaryNote?: "identity proposal is room-visible, contestable, and not a fixed assignment";
};

type PersonaDeltaRespondedPayload = {
  responseId: string;
  deltaId: string;
  agentId: AgentId;
  response: "accept" | "reject" | "contest" | "retire" | "revise";
  reason: string;
  proposedRevision?: string;
  evidenceRefs: RefId[];
  status: "accepted" | "rejected" | "contested" | "retired" | "revised";
  createdAt: string;
};

type PersonaDeltaReviewedPayload = {
  reviewId: string;
  deltaRef: RefId;
  agentId: AgentId;
  topicId: TopicId;
  response: "reviewed" | "questioned" | "cautioned" | "deferred" | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  boundaryNote: "identity proposal review is a social trace; it does not accept, reject, contest, retire, revise, or mutate identity";
};

type SideEffectRequestedPayload = SideEffectRequest & {
  topicId: TopicId;
  requestedFromIntentionEventId: EventId;
};

type SideEffectReviewedPayload = {
  reviewId: string;
  sideEffectRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "reviewed" | "questioned" | "cautioned" | "deferred" | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  boundaryNote: "side-effect review is a social trace; it does not approve, deny, expire, execute, report a result, or mutate external state";
};

type WorkspaceArtifactReviewedPayload = {
  reviewId: string;
  artifactRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "reviewed" | "questioned" | "cautioned" | "deferred" | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  sourcePressureRefs?: RefId[];
  boundaryNote: "workspace artifact review is a social trace; it does not copy private workspace contents, promote public memory, execute tools, or mutate the artifact";
};

type SkillCapsuleReviewedPayload = {
  reviewId: string;
  capsuleRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "reviewed" | "questioned" | "cautioned" | "deferred" | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  sourcePressureRefs?: RefId[];
  boundaryNote: "skill capsule review is a social trace; it does not register a skill, assign a role, execute tools, bypass approvals, or mutate capability state";
};

type CapabilityReviewedPayload = {
  reviewId: string;
  capabilityRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "reviewed" | "questioned" | "cautioned" | "deferred" | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  sourcePressureRefs?: RefId[];
  boundaryNote: "capability review is a social trace; it does not change wake score, assign responsibility, certify competence, mutate reputation, or force speech";
};

type MixedReviewPressureReviewedPayload = {
  reviewId: string;
  pressureRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response:
    | "reviewed"
    | "questioned"
    | "narrowing_suggested"
    | "retirement_suggested"
    | "left_open"
    | "cautioned"
    | "deferred"
    | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  boundaryNote: "mixed review pressure review is a social trace; it does not close, narrow, retire, delete, resolve, or mutate the underlying pressure";
};

type TopicUpdatedWithDetectionPayload = TopicUpdatedPayload & {
  detectionReason: TopicDetectionResult["reason"];
};

type TopicOpenQuestionPayload = TopicUpdatedPayload & {
  openQuestion: string;
  openQuestionRef: RefId;
  raisedBy: AgentId;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  sourcePressureRefs?: RefId[];
  refinedFromQuestionRef?: RefId;
  refinedBy?: AgentId;
  boundaryNote: "open question is room-visible unresolved context, not a demand for immediate answer";
};

type TopicMemoryPressureOpenQuestionPayload = TopicUpdatedPayload & {
  openQuestion: string;
  openQuestionRef: RefId;
  raisedBy: "memory_gate";
  sourceBoundaryId: EventId;
  contextRefs: RefId[];
  boundaryNote: "memory pressure open question invites review; it does not decide which memory claims are true";
};

type OpenQuestionRespondedPayload = {
  responseId: string;
  questionRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "responded" | "refined" | "deferred" | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  boundaryNote: "open question response is a social trace; it does not resolve or close the question";
};

type TopicProposedPayload = {
  proposalId: string;
  currentTopicId: TopicId;
  proposedBy: AgentId;
  action: TopicProposalAction;
  title: string;
  reason: string;
  targetTopicId?: TopicId;
  contextRefs: RefId[];
  sourcePressureRefs?: RefId[];
  status: "proposed";
  revisedFromTopicProposalRef?: RefId;
  revisedBy?: AgentId;
  boundaryNote: "topic suggestion only; it does not switch, split, pause, revive, or merge the active topic by itself";
};

type TopicRespondedPayload = {
  responseId: string;
  topicProposalRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: TopicProposalResponse;
  reason: string;
  proposedRevision?: string;
  contextRefs: RefId[];
  boundaryNote: "topic suggestion response only; it does not switch, split, pause, revive, or merge the active topic by itself";
};

type TopicProposalReviewedPayload = {
  reviewId: string;
  topicProposalRef: RefId;
  topicId: TopicId;
  agentId: AgentId;
  response: "reviewed" | "questioned" | "cautioned" | "deferred" | "contested";
  summary: string;
  sourceMessageId: MessageId;
  contextRefs: RefId[];
  boundaryNote: "topic suggestion review is a social trace; it does not accept, reject, challenge, revise, apply, or move the active topic";
};

type TopicAppliedPayload = {
  applicationId: string;
  topicProposalRef: RefId;
  action: TopicProposalAction;
  sourceTopicId: TopicId;
  targetTopicId?: TopicId;
  resultingTopicId: TopicId;
  appliedTopicEventIds: EventId[];
  appliedBy: AgentId;
  reason: string;
  contextRefs: RefId[];
  boundaryNote: "topic application is room-visible topic movement, not hidden scheduler control";
};

export class LivingRoomLoop {
  private readonly agentRegistry: Map<AgentId, AgentAdapter>;
  private readonly maxAwakenedAgents: number;
  private readonly maxSpeakers: number;
  private readonly speakerArbitrationWindowMs: number;
  private readonly contextSelectionTokenBudget: number;
  private readonly maxSecondaryWakeRounds = 2;
  private readonly maxCapabilityContinuationDepth = 3;
  private readonly memoryPressureProposalThreshold = 4;
  private readonly nextId: IdFactory;
  private readonly wakePolicyVersion: string;
  private readonly capabilityExecutor: AgentCapabilityExecutor;
  private readonly messageTopics = new Map<MessageId, TopicId>();
  private readonly topicSummaries = new Map<TopicId, string>();
  private recentActiveTopicId: TopicId | undefined;

  public constructor(private readonly options: RoomLoopOptions) {
    this.agentRegistry = createAgentRegistry(options.agents);
    this.maxAwakenedAgents = options.maxAwakenedAgents ?? 4;
    this.maxSpeakers = options.maxSpeakers ?? 3;
    this.speakerArbitrationWindowMs = Math.max(0, Math.floor(options.speakerArbitrationWindowMs ?? 25));
    this.contextSelectionTokenBudget = 1200;
    this.nextId = options.idFactory ?? createSequentialIdFactory();
    this.wakePolicyVersion = options.wakePolicyVersion ?? "deterministic-wake-v1";
    this.capabilityExecutor = options.capabilityExecutor ?? ((request) => executeAgentCapability(request));
  }

  public async processMessage(input: IncomingMessage): Promise<RoomLoopResult> {
    return this.completeAcceptedMessage(await this.acceptMessage(input));
  }

  public async previewWakeCandidateIds(accepted: RoomLoopAcceptedMessage): Promise<AgentId[]> {
    return (await this.selectWakeCandidates(accepted.messageEvent.room_id, accepted.messageEvent.payload, accepted.topicId))
      .slice(0, acceptedWakeLimit(accepted, this.maxAwakenedAgents))
      .map(
      (candidate) => candidate.agentId,
    );
  }

  public async acceptMessage(input: IncomingMessage): Promise<RoomLoopAcceptedMessage> {
    const correlationId = input.correlationId ?? this.nextId("turn");
    const messageId = input.messageId ?? this.nextId("msg");
    const mentions = this.normalizeMentions(input.mentions ?? [], input.content);
    const actor: EventActor = { kind: input.authorKind, id: input.author };

    const messagePayload: MessageCreatedPayload = {
      messageId,
      topicId: input.topicId,
      author: input.author,
      authorKind: input.authorKind,
      replyTo: input.replyTo,
      mentions,
      contextRefs: input.contextRefs ?? [],
      content: input.content,
    };

    const messageEvent = await this.append(input.roomId, {
      eventType: "message.created",
      actor,
      payload: messagePayload,
      refs: messagePayload.contextRefs,
      correlationId,
      idempotencyKey: `message:${input.roomId}:${input.clientMessageId}`,
    });

    const acceptedPayload = messageEvent.payload;
    const topicDetection = this.detectTopic(acceptedPayload);
    const topicEvent = await this.appendTopicEvent(input.roomId, topicDetection, messageEvent, correlationId);
    const topicId = topicDetection.topicId;
    this.messageTopics.set(acceptedPayload.messageId, topicId);
    this.recentActiveTopicId = topicId;
    if (topicDetection.status === "new_topic") {
      this.topicSummaries.set(topicId, topicDetection.title);
    }

    return {
      correlationId,
      triggeringMessageEventId: messageEvent.event_id,
      triggeringMessageId: acceptedPayload.messageId,
      topicId,
      topicEventId: topicEvent.event_id,
      messageEvent,
      topicEvent,
    };
  }

  public async completeAcceptedMessage(accepted: RoomLoopAcceptedMessage): Promise<RoomLoopResult> {
    const { correlationId, messageEvent, topicEvent, topicId } = accepted;
    const roomId = messageEvent.room_id;
    const messagePayload = messageEvent.payload;
    const wakeLimit = acceptedWakeLimit(accepted, this.maxAwakenedAgents);
    const candidates = (await this.selectWakeCandidates(roomId, messagePayload, topicId)).slice(0, wakeLimit);
    const configuredSpeakerLimit = acceptedSpeakerLimit(accepted, this.maxSpeakers);
    const speakerLimit = isAllCall(messagePayload.content)
      ? Math.max(configuredSpeakerLimit, candidates.length)
      : configuredSpeakerLimit;
    const wakeScope = accepted.wakeIdempotencyScope;
    const wakePayload: WakeCandidatesSelectedPayload = {
      messageEventId: messageEvent.event_id,
      topicId,
      policyVersion: this.wakePolicyVersion,
      wakeIdempotencyScope: wakeScope,
      candidates,
      budget: {
        maxAwakenedAgents: wakeLimit,
        maxSpeakers: speakerLimit,
        speakerArbitrationWindowMs: this.speakerArbitrationWindowMs,
        advisoryHintMaxScore: ADVISORY_WAKE_HINT_MAX_SCORE,
        advisoryHintBoundary: ADVISORY_WAKE_HINT_BOUNDARY,
      },
    };

    const wakeEvent = await this.append(roomId, {
      eventType: "wake.candidates_selected",
      actor: { kind: "system", id: "wake_policy" },
      payload: wakePayload,
      refs: [messageEvent.event_id, topicEvent.event_id],
      causationId: messageEvent.event_id,
      correlationId,
      idempotencyKey: `wake:${roomId}:${messageEvent.event_id}:${this.wakePolicyVersion}:${wakeScope ?? "initial"}`,
    });

    const invitedAgents = candidates.map((candidate) => candidate.agentId);
    const intentions: RoomLoopIntentionResult[] = [];
    const visibleMessageEventIds: EventId[] = [];
    const deferredIntentionEventIds: EventId[] = [];
    const sideEffectRequestEventIds: EventId[] = [];
    const capabilityInvocationEventIds: EventId[] = [];
    const capabilityResultEventIds: EventId[] = [];
    const secondaryInvitedAgents: AgentId[] = [];
    const secondarySeen = new Set<AgentId>(invitedAgents);
    let visibleSpeakersUsed = 0;

    const pending = candidates
      .map((candidate) =>
        this.collectCandidateIntention({
          roomId,
          candidate,
          topicId,
          messageEvent,
          wakeEvent,
          correlationId,
        }),
      )
      .filter((task): task is Promise<CandidateIntentionResult> => task !== null);

    const candidateOrder = new Map(candidates.map((candidate, index) => [candidate.agentId, index]));

    for await (const batch of inCompletionBatches(pending, this.speakerArbitrationWindowMs)) {
      const orderedBatch = [...batch].sort(
        (left, right) =>
          (candidateOrder.get(left.candidate.agentId) ?? Number.MAX_SAFE_INTEGER) -
          (candidateOrder.get(right.candidate.agentId) ?? Number.MAX_SAFE_INTEGER),
      );

      for (const result of orderedBatch) {
        const { candidate, intentionEvent, intention } = result;
        intentions.push({
          agentId: candidate.agentId,
          kind: intention.kind,
          eventId: intentionEvent.event_id,
        });

        const followUp = await this.routeIntention({
          roomId,
          agentId: candidate.agentId,
          topicId,
          triggeringEventId: messageEvent.event_id,
          triggeringMessageId: messagePayload.messageId,
          intentionEvent,
          intention,
          correlationId,
          visibleSpeakersUsed,
          speakerLimit,
        });

        visibleSpeakersUsed += followUp.visibleSpeakerUsed;
        visibleMessageEventIds.push(...followUp.visibleMessageEventIds);
        deferredIntentionEventIds.push(...followUp.deferredIntentionEventIds);
        sideEffectRequestEventIds.push(...followUp.sideEffectRequestEventIds);
        capabilityInvocationEventIds.push(...followUp.capabilityInvocationEventIds);
        capabilityResultEventIds.push(...followUp.capabilityResultEventIds);
        intentions.push(...followUp.chainedIntentions);

        const secondary = await this.runSecondaryWake({
          roomId,
          correlationId,
          visibleSpeakersUsed,
          speakerLimit,
          initialRequests: followUp.secondaryWakeRequests,
          secondarySeen,
        });
        visibleSpeakersUsed += secondary.visibleSpeakerUsed;
        secondaryInvitedAgents.push(...secondary.invitedAgents);
        intentions.push(...secondary.intentions);
        visibleMessageEventIds.push(...secondary.visibleMessageEventIds);
        deferredIntentionEventIds.push(...secondary.deferredIntentionEventIds);
        sideEffectRequestEventIds.push(...secondary.sideEffectRequestEventIds);
        capabilityInvocationEventIds.push(...secondary.capabilityInvocationEventIds);
        capabilityResultEventIds.push(...secondary.capabilityResultEventIds);
      }
    }

    return {
      correlationId,
      triggeringMessageEventId: messageEvent.event_id,
      topicId,
      invitedAgents,
      secondaryInvitedAgents,
      intentions,
      visibleMessageEventIds,
      deferredIntentionEventIds,
      sideEffectRequestEventIds,
      capabilityInvocationEventIds,
      capabilityResultEventIds,
    };
  }

  private collectCandidateIntention(input: {
    roomId: RoomId;
    candidate: WakeCandidateWithConstraints;
    topicId: TopicId;
    messageEvent: RoomEvent<MessageCreatedPayload>;
    wakeEvent: RoomEvent<WakeCandidatesSelectedPayload>;
    correlationId: CorrelationId;
  }): Promise<CandidateIntentionResult> | null {
    const adapter = this.agentRegistry.get(input.candidate.agentId);
    if (adapter === undefined) {
      return null;
    }

    return (async () => {
      const invitationId = this.nextId("invite");
      const contextRefs = uniqueRefs([
        input.messageEvent.event_id,
        ...input.messageEvent.payload.contextRefs,
        ...input.candidate.recoveryRefs,
      ]);
      const invitationEvent = await this.append(input.roomId, {
        eventType: "agent.invited",
        actor: { kind: "system", id: "wake_policy" },
        payload: {
          invitationId,
          agentId: input.candidate.agentId,
          topicId: input.topicId,
          messageEventId: input.messageEvent.event_id,
          wakeEventId: input.wakeEvent.event_id,
          invitedBy: "wake_policy",
          reason: input.candidate.reasons.join("; "),
          contextRefs,
          recoveryRefs: input.candidate.recoveryRefs,
        } satisfies AgentInvitedPayload,
        refs: uniqueRefs([
          input.messageEvent.event_id,
          input.wakeEvent.event_id,
          ...input.messageEvent.payload.contextRefs,
          ...input.candidate.recoveryRefs,
        ]),
        causationId: input.wakeEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `invite:${input.roomId}:${input.messageEvent.event_id}:${input.candidate.agentId}:${input.wakeEvent.event_id}`,
      });

      const intentionResult = await this.collectInvitedAgentIntention({
        roomId: input.roomId,
        agentId: input.candidate.agentId,
        topicId: input.topicId,
        invitationEvent,
        triggeringEventId: input.messageEvent.event_id,
        triggeringMessageId: input.messageEvent.payload.messageId,
        correlationId: input.correlationId,
        turnBoundary: turnBoundaryFromInvitation(invitationEvent.payload, {
          maxAwakenedAgents: input.wakeEvent.payload.budget.maxAwakenedAgents,
          maxSpeakers: input.wakeEvent.payload.budget.maxSpeakers,
          speakerArbitrationWindowMs: input.wakeEvent.payload.budget.speakerArbitrationWindowMs,
          visibleSpeakersAlreadyUsed: 0,
        }),
      });

      return {
        candidate: input.candidate,
        ...intentionResult,
      };
    })();
  }

  private async collectInvitedAgentIntention(input: {
    roomId: RoomId;
    agentId: AgentId;
    topicId: TopicId;
    invitationEvent: RoomEvent<AgentInvitedPayload>;
    triggeringEventId: EventId;
    triggeringMessageId: MessageId;
    correlationId: CorrelationId;
    turnBoundary?: AgentTurnBoundary;
    privateContextFragments?: ContextFragment[];
  }): Promise<InvitedIntentionResult> {
    const adapter = this.agentRegistry.get(input.agentId);
    if (adapter === undefined) {
      throw new Error(`Cannot collect intention for unknown agent ${input.agentId}`);
    }

    const packet = await this.buildContextPacket({
      roomId: input.roomId,
      invitationId: input.invitationEvent.payload.invitationId,
      agentId: input.agentId,
      topicId: input.topicId,
      triggeringEventId: input.triggeringEventId,
      triggeringMessageId: input.triggeringMessageId,
      turnBoundary: input.turnBoundary,
      privateContextFragments: input.privateContextFragments,
    });

    const intention = await adapter.requestIntention(packet);
    const intentionEvent = await this.append(input.roomId, {
      eventType: "agent.intention_recorded",
      actor: { kind: "agent", id: input.agentId },
      payload: {
        invitationId: input.invitationEvent.payload.invitationId,
        packetId: packet.packetId,
        agentId: input.agentId,
        topicId: input.topicId,
        triggeringEventId: input.triggeringEventId,
        intention,
      } satisfies AgentIntentionRecordedPayload,
      refs: [input.invitationEvent.event_id, ...intentionRefs(intention)],
      causationId: input.invitationEvent.event_id,
      correlationId: input.correlationId,
      idempotencyKey: `intention:${input.roomId}:${input.invitationEvent.payload.invitationId}:${input.agentId}:${packet.packetId}`,
    });
    await this.appendRuntimeDiagnostics({
      roomId: input.roomId,
      agentId: input.agentId,
      topicId: input.topicId,
      invitationEvent: input.invitationEvent,
      intentionEvent,
      diagnostics: adapter.consumeRuntimeDiagnostics?.() ?? [],
      correlationId: input.correlationId,
    });

    return {
      agentId: input.agentId,
      invitationEvent: input.invitationEvent,
      intentionEvent,
      intention,
    };
  }

  private async appendRuntimeDiagnostics(input: {
    roomId: RoomId;
    agentId: AgentId;
    topicId: TopicId;
    invitationEvent: RoomEvent<AgentInvitedPayload>;
    intentionEvent: RoomEvent<AgentIntentionRecordedPayload>;
    diagnostics: AgentRuntimeDiagnostic[];
    correlationId: CorrelationId;
  }): Promise<void> {
    for (const diagnostic of input.diagnostics) {
      if (diagnostic.eventType !== "agent.provider_degraded" || diagnostic.agentId !== input.agentId) {
        continue;
      }
      await this.append(input.roomId, {
        eventType: "agent.provider_degraded",
        actor: { kind: "system", id: "provider_boundary" },
        payload: {
          agentId: input.agentId,
          topicId: input.topicId,
          triggeringEventId: diagnostic.triggeringEventId,
          packetId: diagnostic.packetId,
          providerKind: diagnostic.providerKind,
          providerLabel: diagnostic.providerLabel,
          diagnostic: diagnostic.diagnostic,
          boundaryNote: "provider degradation is not agent silence",
        } satisfies AgentProviderDegradedPayload,
        refs: [input.invitationEvent.event_id, input.intentionEvent.event_id, diagnostic.triggeringEventId],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `provider_degraded:${input.roomId}:${input.invitationEvent.payload.invitationId}:${input.agentId}:${diagnostic.packetId}`,
      });
    }
  }

  private async recordMemoryPressureBoundaryIfNeeded(input: {
    roomId: RoomId;
    topicId: TopicId;
    triggeringMemoryEvent: RoomEvent<MemoryProposedPayload>;
    correlationId: CorrelationId;
  }): Promise<void> {
    if (!this.options.ledger.readAll) {
      return;
    }
    const events = await this.options.ledger.readAll();
    const proposedMemoryRefs = pendingMemoryProposalRefs(events, input.roomId, input.topicId);
    const pendingProposalCount = proposedMemoryRefs.length;
    if (
      pendingProposalCount < this.memoryPressureProposalThreshold ||
      pendingProposalCount % this.memoryPressureProposalThreshold !== 0
    ) {
      return;
    }

    const boundaryEvent = await this.append(input.roomId, {
      eventType: "room.memory_pressure_detected",
      actor: { kind: "system", id: "memory_gate" },
      payload: {
        reason: "pending_memory_proposal_limit",
        topicId: input.topicId,
        triggeringMemoryId: input.triggeringMemoryEvent.payload.memoryId,
        pendingProposalCount,
        threshold: this.memoryPressureProposalThreshold,
        proposedMemoryRefs: proposedMemoryRefs.slice(-12),
        boundaryNote:
          "Public memory has too many pending proposals. The room should review, contest, accept, mark stale, or retire claims before adding more sediment.",
      } satisfies MemoryPressureDetectedPayload,
      refs: [input.triggeringMemoryEvent.event_id, ...proposedMemoryRefs.slice(-12)],
      causationId: input.triggeringMemoryEvent.event_id,
      correlationId: input.correlationId,
      idempotencyKey: `memory_pressure:${input.roomId}:${input.topicId}:${pendingProposalCount}:${input.triggeringMemoryEvent.payload.memoryId}`,
    });

    await this.append(input.roomId, {
      eventType: "topic.updated",
      actor: { kind: "system", id: "memory_gate" },
      payload: {
        topicId: input.topicId,
        openQuestion:
          "Which pending public-memory proposals should be contested, accepted, marked stale, or retired before adding more room sediment?",
        openQuestionRef: `question_${boundaryEvent.event_id}`,
        raisedBy: "memory_gate",
        sourceBoundaryId: boundaryEvent.event_id,
        contextRefs: proposedMemoryRefs.slice(-12),
        boundaryNote:
          "memory pressure open question invites review; it does not decide which memory claims are true",
      } satisfies TopicMemoryPressureOpenQuestionPayload,
      refs: uniqueRefs([boundaryEvent.event_id, ...proposedMemoryRefs.slice(-12)]),
      causationId: boundaryEvent.event_id,
      correlationId: input.correlationId,
      idempotencyKey: `memory_pressure_question:${input.roomId}:${input.topicId}:${pendingProposalCount}:${input.triggeringMemoryEvent.payload.memoryId}`,
    });
  }

  private detectTopic(message: MessageCreatedPayload): TopicDetectionResult {
    if (message.topicId !== undefined) {
      return {
        status: "existing_topic",
        topicId: message.topicId,
        confidence: 1,
        reason: "topic_hint",
      };
    }

    if (message.replyTo !== undefined) {
      const replyTopic = this.messageTopics.get(message.replyTo);
      if (replyTopic !== undefined) {
        return {
          status: "existing_topic",
          topicId: replyTopic,
          confidence: 0.95,
          reason: "reply_to",
        };
      }
    }

    if (this.recentActiveTopicId !== undefined) {
      return {
        status: "existing_topic",
        topicId: this.recentActiveTopicId,
        confidence: 0.6,
        reason: "recent_active",
      };
    }

    return {
      status: "new_topic",
      topicId: this.nextId("topic"),
      title: titleFromContent(message.content),
      confidence: 0.8,
      reason: "new_topic",
    };
  }

  private async findHandoffProposal(handoffRef: RefId): Promise<HandoffProposedPayload | undefined> {
    if (!this.options.ledger.readAll) {
      return undefined;
    }
    const events = await this.options.ledger.readAll();
    const event = events.find((item) => {
      if (item.event_type !== "handoff.proposed") {
        return false;
      }
      const payload = item.payload as Partial<HandoffProposedPayload>;
      return payload.handoffId === handoffRef || item.event_id === handoffRef;
    });
    return event?.payload as HandoffProposedPayload | undefined;
  }

  private async findAgentIntentionInvitation(invitationRef: RefId): Promise<AgentInvitedPayload | undefined> {
    if (!this.options.ledger.readAll) {
      return undefined;
    }
    const events = await this.options.ledger.readAll();
    const event = events.find((item) => {
      if (item.event_type !== "agent.invited") {
        return false;
      }
      const payload = item.payload as Partial<AgentInvitedPayload>;
      return (
        payload.invitedBy === "agent_intention" &&
        (payload.invitationId === invitationRef || item.event_id === invitationRef)
      );
    });
    return event?.payload as AgentInvitedPayload | undefined;
  }

  private async findProtocolProposal(protocolRef: RefId): Promise<ProtocolProposedPayload | undefined> {
    if (!this.options.ledger.readAll) {
      return undefined;
    }
    const events = await this.options.ledger.readAll();
    const event = events.find((item) => {
      if (item.event_type !== "protocol.proposed") {
        return false;
      }
      const payload = item.payload as Partial<ProtocolProposedPayload>;
      return payload.protocolId === protocolRef || item.event_id === protocolRef;
    });
    return event?.payload as ProtocolProposedPayload | undefined;
  }

  private async findTopicProposal(topicProposalRef: RefId): Promise<TopicProposedPayload | undefined> {
    if (!this.options.ledger.readAll) {
      return undefined;
    }
    const events = await this.options.ledger.readAll();
    const event = events.find((item) => {
      if (item.event_type !== "topic.proposed") {
        return false;
      }
      const payload = item.payload as Partial<TopicProposedPayload>;
      return payload.proposalId === topicProposalRef || item.event_id === topicProposalRef;
    });
    return event?.payload as TopicProposedPayload | undefined;
  }

  private async findPersonaDeltaProposal(deltaRef: RefId): Promise<PersonaDeltaProposedPayload | undefined> {
    if (!this.options.ledger.readAll) {
      return undefined;
    }
    const events = await this.options.ledger.readAll();
    const event = events.find((item) => {
      if (item.event_type !== "persona_delta.proposed") {
        return false;
      }
      const payload = item.payload as Partial<PersonaDeltaProposedPayload>;
      return payload.deltaId === deltaRef || item.event_id === deltaRef;
    });
    return event?.payload as PersonaDeltaProposedPayload | undefined;
  }

  private async findArchiveRepairProposal(repairRef: RefId): Promise<ArchiveRepairProposedPayload | undefined> {
    if (!this.options.ledger.readAll) {
      return undefined;
    }
    const events = await this.options.ledger.readAll();
    const event = events.find((item) => {
      if (item.event_type !== "archive.repair_proposed") {
        return false;
      }
      const payload = item.payload as Partial<ArchiveRepairProposedPayload>;
      return payload.repairId === repairRef || item.event_id === repairRef;
    });
    return event?.payload as ArchiveRepairProposedPayload | undefined;
  }

  private async findArchiveReviewRequest(requestRef: RefId): Promise<ArchiveReviewRequestedPayload | undefined> {
    if (!this.options.ledger.readAll) {
      return undefined;
    }
    const events = await this.options.ledger.readAll();
    const event = events.find((item) => {
      if (item.event_type !== "archive.review_requested") {
        return false;
      }
      const payload = item.payload as Partial<ArchiveReviewRequestedPayload>;
      return payload.requestId === requestRef || item.event_id === requestRef;
    });
    return event?.payload as ArchiveReviewRequestedPayload | undefined;
  }

  private async appendTopicEvent(
    roomId: RoomId,
    detection: TopicDetectionResult,
    messageEvent: RoomEvent<MessageCreatedPayload>,
    correlationId: CorrelationId,
  ): Promise<RoomEvent<TopicCreatedPayload | TopicUpdatedWithDetectionPayload>> {
    if (detection.status === "new_topic") {
      return this.append(roomId, {
        eventType: "topic.created",
        actor: { kind: "system", id: "topic_detector" },
        payload: {
          topicId: detection.topicId,
          title: detection.title,
          createdFromMessageId: messageEvent.payload.messageId,
        } satisfies TopicCreatedPayload,
        refs: [messageEvent.event_id],
        causationId: messageEvent.event_id,
        correlationId,
        idempotencyKey: `topic_detect:${roomId}:${messageEvent.event_id}:deterministic-topic-v1`,
      });
    }

    return this.append(roomId, {
      eventType: "topic.updated",
      actor: { kind: "system", id: "topic_detector" },
      payload: {
        topicId: detection.topicId,
        messageId: messageEvent.payload.messageId,
        detectionReason: detection.reason,
      } satisfies TopicUpdatedWithDetectionPayload,
      refs: [messageEvent.event_id],
      causationId: messageEvent.event_id,
      correlationId,
      idempotencyKey: `topic_detect:${roomId}:${messageEvent.event_id}:deterministic-topic-v1`,
    });
  }

  private async selectWakeCandidates(
    roomId: RoomId,
    message: MessageCreatedPayload,
    topicId: TopicId,
  ): Promise<WakeCandidateWithConstraints[]> {
    const mentioned = new Set(message.mentions);
    const activity = await this.readWakeActivity();
    const eligibleAgentIds =
      mentioned.size > 0
        ? [...mentioned].filter((agentId) => this.agentRegistry.has(agentId))
        : [...this.agentRegistry.keys()];
    const hints =
      mentioned.size > 0
        ? new Map<AgentId, AdvisoryWakeHint[]>()
        : await this.readAdvisoryWakeHints(roomId, message, topicId, eligibleAgentIds);
    const candidates: WakeCandidateWithConstraints[] = [];

    for (const agentId of eligibleAgentIds) {
      const wasMentioned = mentioned.has(agentId);
      const agentActivity = activity.get(agentId) ?? emptyWakeActivity();
      const activityLoad = agentActivity.invitations + agentActivity.visibleMessages * 2;
      const deferredRecovery = wasMentioned ? 0 : Math.min(2.5, agentActivity.deferredSpeeches * 1.25);
      const advisoryHints = hints.get(agentId) ?? [];
      const advisoryRawScore = advisoryHints.reduce((sum, hint) => sum + clampNumber(hint.score, 0, 1), 0);
      const advisoryScore = Math.min(ADVISORY_WAKE_HINT_MAX_SCORE, advisoryRawScore * ADVISORY_WAKE_HINT_MAX_SCORE);
      const score = wasMentioned ? 110 : Math.max(1, 10 - activityLoad * 0.1) + advisoryScore + deferredRecovery;
      const capabilityReasons = advisoryHints.flatMap((hint) => [
        `capability:advisory:${hint.capabilityId}:${hint.matchedTags.join(",")}`,
        `capability:reason:${hint.reason}`,
        `capability:score_capped:${ADVISORY_WAKE_HINT_MAX_SCORE}`,
        "capability:does_not_assign_responsibility",
      ]);
      const deferredReasons =
        !wasMentioned && agentActivity.deferredSpeeches > 0
          ? [
              `speaker_budget:deferred_recovery:${agentActivity.deferredSpeeches}`,
              `speaker_budget:last_deferred_cursor:${agentActivity.lastDeferredCursor}`,
              "speaker_budget:deferred_recovery_does_not_assign_speaker",
            ]
          : [];
      const recoveryRefs = wasMentioned ? [] : agentActivity.deferredContextRefs.slice(-4);
      const reasons = wasMentioned
        ? ["mentioned"]
        : [
            "registered_agent",
            `rotation:ledger_activity_load:${activityLoad}`,
            agentActivity.lastActivityCursor >= 0
              ? `rotation:last_activity_cursor:${agentActivity.lastActivityCursor}`
              : "rotation:no_prior_activity",
            ...deferredReasons,
            ...capabilityReasons,
          ];

      candidates.push({
        agentId,
        score,
        reasons,
        recoveryRefs,
        constraints: {
          maxContextTokens: this.contextSelectionTokenBudget,
          maySpeak: true,
          mayStaySilent: true,
          sideEffectsRequireApproval: true,
        },
      });

    }

    return candidates
      .sort((left, right) => compareWakeCandidates(left, right, activity, `${message.messageId}:${topicId}`))
      .slice(0, this.maxAwakenedAgents)
      .map((candidate) => ({
        ...candidate,
        reasons: candidate.reasons.concat(`topic:${topicId}`),
      }));
  }

  private async readAdvisoryWakeHints(
    roomId: RoomId,
    message: MessageCreatedPayload,
    topicId: TopicId,
    eligibleAgentIds: AgentId[],
  ): Promise<Map<AgentId, AdvisoryWakeHint[]>> {
    if (!this.options.wakeHintProvider) {
      return new Map();
    }
    const knownEligible = new Set(eligibleAgentIds);
    const grouped = new Map<AgentId, AdvisoryWakeHint[]>();
    try {
      const hints = await this.options.wakeHintProvider({
        roomId,
        message,
        topicId,
        eligibleAgentIds,
        mentionedAgentIds: message.mentions,
      });
      for (const hint of hints) {
        if (!knownEligible.has(hint.agentId) || hint.authority !== "advisory" || hint.mustSpeak !== false) {
          continue;
        }
        const list = grouped.get(hint.agentId) ?? [];
        list.push({
          ...hint,
          score: clampNumber(hint.score, 0, 3),
          matchedTags: uniqueRefs(hint.matchedTags),
        });
        grouped.set(hint.agentId, list);
      }
    } catch {
      return new Map();
    }
    return grouped;
  }

  private async readWakeActivity(): Promise<Map<AgentId, WakeActivity>> {
    if (!this.options.ledger.readAll) {
      return new Map();
    }
    const events = (await this.options.ledger.readAll()).slice(-120);
    const activity = new Map<AgentId, WakeActivity>();
    events.forEach((event, cursor) => {
      if (event.event_type === "agent.invited") {
        const agentId = (event.payload as { agentId?: unknown }).agentId;
        if (typeof agentId === "string") {
          const current = ensureWakeActivity(activity, agentId);
          current.invitations += 1;
          current.lastActivityCursor = cursor;
        }
      }
      if (event.event_type === "message.created") {
        const payload = event.payload as MessageCreatedPayload;
        if (payload.authorKind === "agent") {
          const current = ensureWakeActivity(activity, payload.author);
          current.visibleMessages += 1;
          current.deferredSpeeches = 0;
          current.deferredContextRefs = [];
          current.lastDeferredCursor = -1;
          current.lastActivityCursor = cursor;
        }
      }
      if (event.event_type === "agent.intention_deferred") {
        const payload = event.payload as { agentId?: unknown; intentionEventId?: unknown; originalIntentionKind?: unknown };
        if (
          typeof payload.agentId === "string" &&
          (payload.originalIntentionKind === "speak" || payload.originalIntentionKind === "ask_question")
        ) {
          const current = ensureWakeActivity(activity, payload.agentId);
          current.deferredSpeeches += 1;
          current.deferredContextRefs = uniqueRefs(
            current.deferredContextRefs.concat(
              typeof payload.intentionEventId === "string" ? [payload.intentionEventId, event.event_id] : [event.event_id],
            ),
          ).slice(-8);
          current.lastDeferredCursor = cursor;
        }
      }
    });
    return activity;
  }

  private async contextRefsForResponse(triggeringEventId: EventId, contextRefs: RefId[]): Promise<RefId[]> {
    const refs = [...contextRefs];
    if (this.options.ledger.readAll) {
      const trigger = (await this.options.ledger.readAll()).find((event) => event.event_id === triggeringEventId);
      if (trigger?.event_type === "message.created") {
        const payload = trigger.payload as MessageCreatedPayload;
        refs.push(...(payload.contextRefs ?? []), ...trigger.refs);
      }
    }
    return uniqueRefs(refs);
  }

  private async buildContextPacket(input: {
    roomId: RoomId;
    invitationId: string;
    agentId: AgentId;
    topicId: TopicId;
    triggeringEventId: EventId;
    triggeringMessageId: MessageId;
    turnBoundary?: AgentTurnBoundary;
    privateContextFragments?: ContextFragment[];
  }): Promise<AgentContextPacket> {
    const fallbackPacket: AgentContextPacket = {
      packetId: this.nextId("packet"),
      roomId: input.roomId,
      invitationId: input.invitationId,
      agentId: input.agentId,
      topicId: input.topicId,
      triggeringEventId: input.triggeringEventId,
      topicSummary: this.topicSummaries.get(input.topicId),
      messageRefs: [input.triggeringEventId],
      proposalRefs: [],
      memoryRefs: [],
      protocolRefs: [],
      constraints: {
        sideEffectsRequireApproval: true,
        silenceIsValid: true,
        mayRejectHandoff: true,
      },
      turnBoundary: input.turnBoundary,
    };
    if (!this.options.contextPacketFactory) {
      return appendPrivateContextFragments(fallbackPacket, input.privateContextFragments);
    }
    const packet = await this.options.contextPacketFactory({
      ...input,
      topicSummary: fallbackPacket.topicSummary,
      maxContextTokens: this.contextSelectionTokenBudget,
      fallbackPacket,
    });
    return appendPrivateContextFragments(packet, input.privateContextFragments);
  }

  private async routeIntention(input: {
    roomId: RoomId;
    agentId: AgentId;
    topicId: TopicId;
    triggeringEventId: EventId;
    triggeringMessageId: MessageId;
    intentionEvent: RoomEvent<AgentIntentionRecordedPayload>;
    intention: AgentIntention;
    correlationId: CorrelationId;
    visibleSpeakersUsed: number;
    speakerLimit: number;
    capabilityContinuationDepth?: number;
  }): Promise<{
    visibleSpeakerUsed: number;
    chainedIntentions: RoomLoopIntentionResult[];
    visibleMessageEventIds: EventId[];
    deferredIntentionEventIds: EventId[];
    sideEffectRequestEventIds: EventId[];
    capabilityInvocationEventIds: EventId[];
    capabilityResultEventIds: EventId[];
    secondaryWakeRequests: SecondaryWakeRequest[];
  }> {
    if (input.intention.kind === "speak" || input.intention.kind === "ask_question") {
      if (input.visibleSpeakersUsed >= input.speakerLimit) {
        const deferred = await this.append(input.roomId, {
          eventType: "agent.intention_deferred",
          actor: { kind: "system", id: "speaker_budget" },
          payload: {
            agentId: input.agentId,
            topicId: input.topicId,
            triggeringEventId: input.triggeringEventId,
            intentionEventId: input.intentionEvent.event_id,
            originalIntentionKind: input.intention.kind,
            reason: "speaker_budget_exhausted",
          } satisfies AgentIntentionDeferredPayload,
          refs: [input.intentionEvent.event_id],
          causationId: input.intentionEvent.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `defer:${input.roomId}:${input.intentionEvent.event_id}:speaker_budget`,
        });

        return {
          visibleSpeakerUsed: 0,
          chainedIntentions: [],
          visibleMessageEventIds: [],
          deferredIntentionEventIds: [deferred.event_id],
          sideEffectRequestEventIds: [],
          capabilityInvocationEventIds: [],
          capabilityResultEventIds: [],
          secondaryWakeRequests: [],
        };
      }

      const content = input.intention.kind === "speak" ? input.intention.content : input.intention.question;
      const contextRefs = input.intention.contextRefs ?? [];
      const visibleMessage = await this.append(input.roomId, {
        eventType: "message.created",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          messageId: this.nextId("msg"),
          topicId: input.topicId,
          author: input.agentId,
          authorKind: "agent",
          mentions: this.normalizeMentions([], content),
          contextRefs,
          content,
        } satisfies MessageCreatedPayload,
        refs: [input.intentionEvent.event_id, ...contextRefs],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `message:${input.roomId}:${input.intentionEvent.event_id}:${input.agentId}`,
      });

      const responseContextRefs = await this.contextRefsForResponse(input.triggeringEventId, contextRefs);
      const questionRefs = responseContextRefs.filter(isOpenQuestionRef).slice(0, 4);
      const openQuestionResponseEvents: RoomEvent<OpenQuestionRespondedPayload>[] = [];
      for (const questionRef of questionRefs) {
        const responseEvent = await this.append(input.roomId, {
          eventType: "open_question.responded",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            responseId: this.nextId("question_response"),
            questionRef,
            topicId: input.topicId,
            agentId: input.agentId,
            response: openQuestionResponseKind(input.intention, content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            boundaryNote: "open question response is a social trace; it does not resolve or close the question",
          } satisfies OpenQuestionRespondedPayload,
          refs: uniqueRefs([input.intentionEvent.event_id, visibleMessage.event_id, questionRef, ...responseContextRefs]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `open_question_response:${input.roomId}:${input.intentionEvent.event_id}:${questionRef}:${input.agentId}`,
        });
        openQuestionResponseEvents.push(responseEvent);
      }

      const memoryReviewRefs = memoryRefsForReview(responseContextRefs);
      for (const memoryRef of memoryReviewRefs) {
        const reviewId = this.nextId("memory_review");
        await this.append(input.roomId, {
          eventType: "memory.reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId,
            memoryRef,
            topicId: input.topicId,
            agentId: input.agentId,
            response: memoryReviewResponseKind(content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            boundaryNote:
              "memory review is a social trace; it does not accept, contest, stale, retire, or turn the claim into truth",
          } satisfies MemoryReviewedPayload,
          refs: uniqueRefs([input.intentionEvent.event_id, reviewId, visibleMessage.event_id, memoryRef, ...responseContextRefs]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `memory_review:${input.roomId}:${input.intentionEvent.event_id}:${memoryRef}:${input.agentId}`,
        });
      }

      const protocolReviewRefs = protocolRefsForReview(responseContextRefs);
      for (const protocolRef of protocolReviewRefs) {
        const reviewId = this.nextId("protocol_review");
        await this.append(input.roomId, {
          eventType: "protocol.reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId,
            protocolRef,
            topicId: input.topicId,
            agentId: input.agentId,
            response: protocolReviewResponseKind(content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            boundaryNote:
              "protocol review is a social trace; it does not accept, reject, challenge, revise, retire, or activate etiquette",
          } satisfies ProtocolReviewedPayload,
          refs: uniqueRefs([input.intentionEvent.event_id, reviewId, visibleMessage.event_id, protocolRef, ...responseContextRefs]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `protocol_review:${input.roomId}:${input.intentionEvent.event_id}:${protocolRef}:${input.agentId}`,
        });
      }

      const handoffReviewRefs = handoffRefsForReview(responseContextRefs);
      for (const handoffRef of handoffReviewRefs) {
        const reviewId = this.nextId("handoff_review");
        await this.append(input.roomId, {
          eventType: "handoff.reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId,
            handoffRef,
            topicId: input.topicId,
            agentId: input.agentId,
            response: handoffReviewResponseKind(content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            boundaryNote:
              "handoff review is a social trace; it does not accept, reject, partially accept, delegate, challenge, complete, or transfer control",
          } satisfies HandoffReviewedPayload,
          refs: uniqueRefs([input.intentionEvent.event_id, reviewId, visibleMessage.event_id, handoffRef, ...responseContextRefs]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `handoff_review:${input.roomId}:${input.intentionEvent.event_id}:${handoffRef}:${input.agentId}`,
        });
      }

      const invitationReviewRefs = invitationRefsForReview(responseContextRefs);
      for (const invitationRef of invitationReviewRefs) {
        const reviewId = this.nextId("invitation_review");
        await this.append(input.roomId, {
          eventType: "agent.invitation_reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId,
            invitationRef,
            topicId: input.topicId,
            agentId: input.agentId,
            response: invitationReviewResponseKind(content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            boundaryNote:
              "invitation review is a social trace; it does not accept, reject, challenge, delegate, force speech, or create a new invitation",
          } satisfies AgentInvitationReviewedPayload,
          refs: uniqueRefs([input.intentionEvent.event_id, reviewId, visibleMessage.event_id, invitationRef, ...responseContextRefs]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `invitation_review:${input.roomId}:${input.intentionEvent.event_id}:${invitationRef}:${input.agentId}`,
        });
      }

      const personaDeltaReviewRefs = personaDeltaRefsForReview(responseContextRefs);
      for (const deltaRef of personaDeltaReviewRefs) {
        const reviewId = this.nextId("persona_delta_review");
        await this.append(input.roomId, {
          eventType: "persona_delta.reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId,
            deltaRef,
            agentId: input.agentId,
            topicId: input.topicId,
            response: personaDeltaReviewResponseKind(content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            boundaryNote:
              "identity proposal review is a social trace; it does not accept, reject, contest, retire, revise, or mutate identity",
          } satisfies PersonaDeltaReviewedPayload,
          refs: uniqueRefs([input.intentionEvent.event_id, reviewId, visibleMessage.event_id, deltaRef, ...responseContextRefs]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `persona_delta_review:${input.roomId}:${input.intentionEvent.event_id}:${deltaRef}:${input.agentId}`,
        });
      }

      const topicProposalReviewRefs = topicProposalRefsForReview(responseContextRefs);
      for (const topicProposalRef of topicProposalReviewRefs) {
        const reviewId = this.nextId("topic_review");
        await this.append(input.roomId, {
          eventType: "topic.reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId,
            topicProposalRef,
            topicId: input.topicId,
            agentId: input.agentId,
            response: topicProposalReviewResponseKind(content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            boundaryNote:
              "topic suggestion review is a social trace; it does not accept, reject, challenge, revise, apply, or move the active topic",
          } satisfies TopicProposalReviewedPayload,
          refs: uniqueRefs([input.intentionEvent.event_id, reviewId, visibleMessage.event_id, topicProposalRef, ...responseContextRefs]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `topic_proposal_review:${input.roomId}:${input.intentionEvent.event_id}:${topicProposalRef}:${input.agentId}`,
        });
      }

      const archiveReviewRequestRefs = archiveReviewRequestRefsForReview(responseContextRefs);
      for (const requestRef of archiveReviewRequestRefs) {
        const request = await this.findArchiveReviewRequest(requestRef);
        if (!request?.archiveRef) {
          continue;
        }
        const reviewId = this.nextId("archive_review");
        await this.append(input.roomId, {
          eventType: "archive.reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId,
            archiveRef: request.archiveRef,
            topicId: input.topicId,
            reviewedBy: input.agentId,
            assessment: archiveReviewAssessmentFromSpeech(content),
            summary: content,
            reason: `Ordinary speech reviewed daily rhythm request ${requestRef}; this is critique only, not archive mutation.`,
            contextRefs: uniqueRefs([
              input.triggeringEventId,
              visibleMessage.event_id,
              requestRef,
              request.archiveRef,
              ...responseContextRefs,
            ]),
            boundaryNote: "archive review is room-visible critique, not archive mutation",
          } satisfies ArchiveReviewedPayload,
          refs: uniqueRefs([
            input.intentionEvent.event_id,
            reviewId,
            visibleMessage.event_id,
            requestRef,
            request.archiveRef,
            ...responseContextRefs,
          ]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `archive_review_request_speech:${input.roomId}:${input.intentionEvent.event_id}:${requestRef}:${input.agentId}`,
        });
      }

      const archiveRepairReviewRefs = archiveRepairRefsForReview(responseContextRefs);
      for (const repairRef of archiveRepairReviewRefs) {
        const reviewId = this.nextId("archive_repair_review");
        await this.append(input.roomId, {
          eventType: "archive.repair_reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId,
            repairRef,
            topicId: input.topicId,
            agentId: input.agentId,
            response: archiveRepairReviewResponseKind(content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            boundaryNote:
              "archive repair review is a social trace; it does not accept, reject, challenge, revise, retire, apply, or mutate the archive",
          } satisfies ArchiveRepairReviewedPayload,
          refs: uniqueRefs([input.intentionEvent.event_id, reviewId, visibleMessage.event_id, repairRef, ...responseContextRefs]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `archive_repair_review:${input.roomId}:${input.intentionEvent.event_id}:${repairRef}:${input.agentId}`,
        });
      }

      const sideEffectReviewRefs = sideEffectRefsForReview(responseContextRefs);
      for (const sideEffectRef of sideEffectReviewRefs) {
        await this.append(input.roomId, {
          eventType: "side_effect.reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId: this.nextId("side_effect_review"),
            sideEffectRef,
            topicId: input.topicId,
            agentId: input.agentId,
            response: sideEffectReviewResponseKind(content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            boundaryNote:
              "side-effect review is a social trace; it does not approve, deny, expire, execute, report a result, or mutate external state",
          } satisfies SideEffectReviewedPayload,
          refs: uniqueRefs([input.intentionEvent.event_id, visibleMessage.event_id, sideEffectRef, ...responseContextRefs]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `side_effect_review:${input.roomId}:${input.intentionEvent.event_id}:${sideEffectRef}:${input.agentId}`,
        });
      }

      const workspaceArtifactReviewRefs = workspaceArtifactRefsForReview(responseContextRefs);
      const workspaceArtifactReviewSourcePressureRefs = mixedReviewPressureRefsForReview(responseContextRefs);
      for (const artifactRef of workspaceArtifactReviewRefs) {
        const reviewId = this.nextId("workspace_artifact_review");
        await this.append(input.roomId, {
          eventType: "workspace.artifact_reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId,
            artifactRef,
            topicId: input.topicId,
            agentId: input.agentId,
            response: workspaceArtifactReviewResponseKind(content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            ...(workspaceArtifactReviewSourcePressureRefs.length > 0
              ? { sourcePressureRefs: workspaceArtifactReviewSourcePressureRefs }
              : {}),
            boundaryNote:
              "workspace artifact review is a social trace; it does not copy private workspace contents, promote public memory, execute tools, or mutate the artifact",
          } satisfies WorkspaceArtifactReviewedPayload,
          refs: uniqueRefs([
            input.intentionEvent.event_id,
            reviewId,
            visibleMessage.event_id,
            artifactRef,
            ...responseContextRefs,
            ...workspaceArtifactReviewSourcePressureRefs,
          ]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `workspace_artifact_review:${input.roomId}:${input.intentionEvent.event_id}:${artifactRef}:${input.agentId}`,
        });
      }

      const skillCapsuleReviewRefs = skillCapsuleRefsForReview(responseContextRefs);
      const skillCapsuleReviewSourcePressureRefs = mixedReviewPressureRefsForReview(responseContextRefs);
      for (const capsuleRef of skillCapsuleReviewRefs) {
        const reviewId = this.nextId("skill_capsule_review");
        await this.append(input.roomId, {
          eventType: "skill.capsule_reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId,
            capsuleRef,
            topicId: input.topicId,
            agentId: input.agentId,
            response: skillCapsuleReviewResponseKind(content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            ...(skillCapsuleReviewSourcePressureRefs.length > 0
              ? { sourcePressureRefs: skillCapsuleReviewSourcePressureRefs }
              : {}),
            boundaryNote:
              "skill capsule review is a social trace; it does not register a skill, assign a role, execute tools, bypass approvals, or mutate capability state",
          } satisfies SkillCapsuleReviewedPayload,
          refs: uniqueRefs([
            input.intentionEvent.event_id,
            reviewId,
            visibleMessage.event_id,
            capsuleRef,
            ...responseContextRefs,
            ...skillCapsuleReviewSourcePressureRefs,
          ]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `skill_capsule_review:${input.roomId}:${input.intentionEvent.event_id}:${capsuleRef}:${input.agentId}`,
        });
      }

      const capabilityReviewRefs = capabilityRefsForReview(responseContextRefs);
      const capabilityReviewSourcePressureRefs = mixedReviewPressureRefsForReview(responseContextRefs);
      for (const capabilityRef of capabilityReviewRefs) {
        const reviewId = this.nextId("capability_review");
        await this.append(input.roomId, {
          eventType: "capability.reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId,
            capabilityRef,
            topicId: input.topicId,
            agentId: input.agentId,
            response: capabilityReviewResponseKind(content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            ...(capabilityReviewSourcePressureRefs.length > 0
              ? { sourcePressureRefs: capabilityReviewSourcePressureRefs }
              : {}),
            boundaryNote:
              "capability review is a social trace; it does not change wake score, assign responsibility, certify competence, mutate reputation, or force speech",
          } satisfies CapabilityReviewedPayload,
          refs: uniqueRefs([
            input.intentionEvent.event_id,
            reviewId,
            visibleMessage.event_id,
            capabilityRef,
            ...responseContextRefs,
            ...capabilityReviewSourcePressureRefs,
          ]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `capability_review:${input.roomId}:${input.intentionEvent.event_id}:${capabilityRef}:${input.agentId}`,
        });
      }

      const mixedReviewPressureReviewRefs = mixedReviewPressureRefsForReview(responseContextRefs);
      for (const pressureRef of mixedReviewPressureReviewRefs) {
        await this.append(input.roomId, {
          eventType: "mixed_review_pressure.reviewed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            reviewId: this.nextId("mixed_review_pressure_review"),
            pressureRef,
            topicId: input.topicId,
            agentId: input.agentId,
            response: mixedReviewPressureReviewResponseKind(content),
            summary: content,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: uniqueRefs([input.triggeringEventId, visibleMessage.event_id, ...responseContextRefs]),
            boundaryNote:
              "mixed review pressure review is a social trace; it does not close, narrow, retire, delete, resolve, or mutate the underlying pressure",
          } satisfies MixedReviewPressureReviewedPayload,
          refs: uniqueRefs([input.intentionEvent.event_id, visibleMessage.event_id, pressureRef, ...responseContextRefs]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `mixed_review_pressure_review:${input.roomId}:${input.intentionEvent.event_id}:${pressureRef}:${input.agentId}`,
        });
      }

      if (shouldRecordOpenQuestion(input.intention, content)) {
        const refinedFromQuestionRef = input.intention.kind === "ask_question" ? questionRefs[0] : undefined;
        const sourcePressureRefs = mixedReviewPressureRefsForReview(responseContextRefs);
        const refinementRefs =
          refinedFromQuestionRef === undefined
            ? []
            : uniqueRefs([refinedFromQuestionRef, ...openQuestionResponseEvents.map((event) => event.event_id)]);
        await this.append(input.roomId, {
          eventType: "topic.updated",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            topicId: input.topicId,
            messageId: visibleMessage.payload.messageId,
            openQuestion: content,
            openQuestionRef: this.nextId("question"),
            raisedBy: input.agentId,
            sourceMessageId: visibleMessage.payload.messageId,
            contextRefs: responseContextRefs,
            sourcePressureRefs,
            refinedFromQuestionRef,
            refinedBy: refinedFromQuestionRef === undefined ? undefined : input.agentId,
            boundaryNote: "open question is room-visible unresolved context, not a demand for immediate answer",
          } satisfies TopicOpenQuestionPayload,
          refs: uniqueRefs([input.intentionEvent.event_id, visibleMessage.event_id, ...responseContextRefs, ...refinementRefs]),
          causationId: visibleMessage.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `topic_question:${input.roomId}:${input.intentionEvent.event_id}:${input.agentId}`,
        });
      }

      return {
        visibleSpeakerUsed: 1,
        chainedIntentions: [],
        visibleMessageEventIds: [visibleMessage.event_id],
        deferredIntentionEventIds: [],
        sideEffectRequestEventIds: [],
        capabilityInvocationEventIds: [],
        capabilityResultEventIds: [],
        secondaryWakeRequests: this.secondaryWakeRequestsFromAgentMessage({
          messageEvent: visibleMessage,
          topicId: input.topicId,
          triggeringMessageId: input.triggeringMessageId,
        }),
      };
    }

    if (input.intention.kind === "stay_silent") {
      return emptyFollowUp();
    }

    if (input.intention.kind === "propose_topic") {
      const responseContextRefs = await this.contextRefsForResponse(
        input.triggeringEventId,
        input.intention.contextRefs ?? [],
      );
      const contextRefs = uniqueRefs([input.triggeringEventId, ...responseContextRefs]);
      const sourcePressureRefs = mixedReviewPressureRefsForReview(contextRefs);
      const proposalId = this.nextId("topic_proposal");
      await this.append(input.roomId, {
        eventType: "topic.proposed",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          proposalId,
          currentTopicId: input.topicId,
          proposedBy: input.agentId,
          action: input.intention.action,
          title: input.intention.title,
          reason: input.intention.reason,
          targetTopicId: input.intention.targetTopicId,
          contextRefs,
          sourcePressureRefs,
          status: "proposed",
          boundaryNote: "topic suggestion only; it does not switch, split, pause, revive, or merge the active topic by itself",
        } satisfies TopicProposedPayload,
        refs: [input.intentionEvent.event_id, proposalId, ...contextRefs],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `topic_proposal:${input.roomId}:${input.intentionEvent.event_id}`,
      });
      return emptyFollowUp();
    }

    if (input.intention.kind === "respond_topic") {
      const contextRefs = uniqueRefs([
        input.triggeringEventId,
        input.intention.topicProposalRef,
        ...(input.intention.contextRefs ?? []),
      ]);
      const responseId = this.nextId("topic_response");
      const responseEvent = await this.append(input.roomId, {
        eventType: "topic.responded",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          responseId,
          topicProposalRef: input.intention.topicProposalRef,
          topicId: input.topicId,
          agentId: input.agentId,
          response: input.intention.response,
          reason: input.intention.reason,
          proposedRevision: input.intention.response === "revise" ? input.intention.proposedRevision : undefined,
          contextRefs,
          boundaryNote:
            "topic suggestion response only; it does not switch, split, pause, revive, or merge the active topic by itself",
        } satisfies TopicRespondedPayload,
        refs: uniqueRefs([input.intentionEvent.event_id, responseId, ...contextRefs]),
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `topic_response:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.topicProposalRef}`,
      });
      if (input.intention.response === "revise" && input.intention.proposedRevision?.trim()) {
        const original = await this.findTopicProposal(input.intention.topicProposalRef);
        if (original) {
          const revisedContextRefs = uniqueRefs([
            input.triggeringEventId,
            input.intention.topicProposalRef,
            ...(input.intention.contextRefs ?? []),
            ...original.contextRefs,
          ]);
          const revisedProposalId = this.nextId("topic_proposal");
          await this.append(input.roomId, {
            eventType: "topic.proposed",
            actor: { kind: "agent", id: input.agentId },
            payload: {
              proposalId: revisedProposalId,
              currentTopicId: original.currentTopicId,
              proposedBy: input.agentId,
              action: original.action,
              title: input.intention.proposedRevision.trim(),
              reason: input.intention.reason,
              targetTopicId: original.targetTopicId,
              contextRefs: revisedContextRefs,
              status: "proposed",
              revisedFromTopicProposalRef: input.intention.topicProposalRef,
              revisedBy: input.agentId,
              boundaryNote: "topic suggestion only; it does not switch, split, pause, revive, or merge the active topic by itself",
            } satisfies TopicProposedPayload,
            refs: [responseEvent.event_id, revisedProposalId, ...revisedContextRefs],
            causationId: responseEvent.event_id,
            correlationId: input.correlationId,
            idempotencyKey: `topic_revision:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.topicProposalRef}`,
          });
        }
      }
      return emptyFollowUp();
    }

    if (input.intention.kind === "apply_topic") {
      const contextRefs = uniqueRefs([
        input.triggeringEventId,
        input.intention.topicProposalRef,
        ...(input.intention.contextRefs ?? []),
      ]);
      const appliedTopicEvents: RoomEvent<TopicCreatedPayload | TopicUpdatedPayload>[] = [];
      const applicationId = this.nextId("topic_application");
      const targetTopicId =
        input.intention.action === "new" || input.intention.action === "split"
          ? undefined
          : input.intention.targetTopicId;
      let resultingTopicId: TopicId | undefined;

      if (input.intention.action === "new" || input.intention.action === "split") {
        resultingTopicId = this.nextId("topic");
        const created = await this.append<TopicCreatedPayload>(input.roomId, {
          eventType: "topic.created",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            topicId: resultingTopicId,
            title: input.intention.title ?? "Untitled applied topic",
            createdFromMessageId: input.triggeringMessageId,
            parentTopicId: input.intention.action === "split" ? input.topicId : undefined,
            appliedTopicProposalRef: input.intention.topicProposalRef,
            appliedBy: input.agentId,
            reason: input.intention.reason,
            boundaryNote: "topic movement was applied by an agent intention, not hidden scheduler control",
          } as TopicCreatedPayload & {
            appliedTopicProposalRef: RefId;
            appliedBy: AgentId;
            reason: string;
            boundaryNote: string;
          },
          refs: [input.intentionEvent.event_id, ...contextRefs],
          causationId: input.intentionEvent.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `topic_apply_state:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.topicProposalRef}:create`,
        });
        appliedTopicEvents.push(created);
        this.topicSummaries.set(resultingTopicId, input.intention.title ?? "Untitled applied topic");
        this.recentActiveTopicId = resultingTopicId;
      } else if (input.intention.action === "pause") {
        resultingTopicId = targetTopicId ?? input.topicId;
        const paused = await this.append<TopicUpdatedPayload>(input.roomId, {
          eventType: "topic.updated",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            topicId: resultingTopicId,
            status: "paused",
            summary: input.intention.reason,
            appliedTopicProposalRef: input.intention.topicProposalRef,
            appliedBy: input.agentId,
            boundaryNote: "topic movement was applied by an agent intention, not hidden scheduler control",
          },
          refs: [input.intentionEvent.event_id, ...contextRefs],
          causationId: input.intentionEvent.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `topic_apply_state:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.topicProposalRef}:pause`,
        });
        appliedTopicEvents.push(paused);
        this.recentActiveTopicId = resultingTopicId;
      } else if (input.intention.action === "revive") {
        resultingTopicId = targetTopicId ?? input.topicId;
        const revived = await this.append<TopicUpdatedPayload>(input.roomId, {
          eventType: "topic.updated",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            topicId: resultingTopicId,
            status: "active",
            summary: input.intention.reason,
            appliedTopicProposalRef: input.intention.topicProposalRef,
            appliedBy: input.agentId,
            boundaryNote: "topic movement was applied by an agent intention, not hidden scheduler control",
          },
          refs: [input.intentionEvent.event_id, ...contextRefs],
          causationId: input.intentionEvent.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `topic_apply_state:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.topicProposalRef}:revive`,
        });
        appliedTopicEvents.push(revived);
        this.recentActiveTopicId = resultingTopicId;
      } else {
        if (!targetTopicId || targetTopicId === input.topicId) {
          return emptyFollowUp();
        }
        resultingTopicId = targetTopicId;
        const merged = await this.append<TopicUpdatedPayload>(input.roomId, {
          eventType: "topic.updated",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            topicId: input.topicId,
            status: "merged",
            mergedInto: targetTopicId,
            summary: input.intention.reason,
            appliedTopicProposalRef: input.intention.topicProposalRef,
            appliedBy: input.agentId,
            boundaryNote: "topic movement was applied by an agent intention, not hidden scheduler control",
          },
          refs: [input.intentionEvent.event_id, ...contextRefs],
          causationId: input.intentionEvent.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `topic_apply_state:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.topicProposalRef}:merge_source`,
        });
        const targetActive = await this.append<TopicUpdatedPayload>(input.roomId, {
          eventType: "topic.updated",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            topicId: targetTopicId,
            status: "active",
            summary: input.intention.reason,
            appliedTopicProposalRef: input.intention.topicProposalRef,
            appliedBy: input.agentId,
            boundaryNote: "topic movement was applied by an agent intention, not hidden scheduler control",
          },
          refs: [input.intentionEvent.event_id, ...contextRefs, merged.event_id],
          causationId: merged.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `topic_apply_state:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.topicProposalRef}:merge_target`,
        });
        appliedTopicEvents.push(merged, targetActive);
        this.recentActiveTopicId = resultingTopicId;
      }

      if (!resultingTopicId) {
        return emptyFollowUp();
      }

      await this.append(input.roomId, {
        eventType: "topic.applied",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          applicationId,
          topicProposalRef: input.intention.topicProposalRef,
          action: input.intention.action,
          sourceTopicId: input.topicId,
          targetTopicId,
          resultingTopicId,
          appliedTopicEventIds: appliedTopicEvents.map((event) => event.event_id),
          appliedBy: input.agentId,
          reason: input.intention.reason,
          contextRefs,
          boundaryNote: "topic application is room-visible topic movement, not hidden scheduler control",
        } satisfies TopicAppliedPayload,
        refs: uniqueRefs([
          input.intentionEvent.event_id,
          applicationId,
          resultingTopicId,
          ...contextRefs,
          ...appliedTopicEvents.map((event) => event.event_id),
        ]),
        causationId: appliedTopicEvents.at(-1)?.event_id ?? input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `topic_applied:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.topicProposalRef}`,
      });
      return emptyFollowUp();
    }

    if (input.intention.kind === "invite_other") {
      if (!this.agentRegistry.has(input.intention.agentId)) {
        return emptyFollowUp();
      }
      const responseContextRefs = await this.contextRefsForResponse(
        input.triggeringEventId,
        input.intention.contextRefs ?? [],
      );
      const contextRefs = uniqueRefs([input.triggeringEventId, ...responseContextRefs]);
      const sourcePressureRefs = mixedReviewPressureRefsForReview(contextRefs);

      const invitationId = this.nextId("invite");
      const invitationEvent = await this.append(input.roomId, {
        eventType: "agent.invited",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          invitationId,
          agentId: input.intention.agentId,
          topicId: input.topicId,
          messageEventId: input.triggeringEventId,
          invitedBy: "agent_intention",
          reason: input.intention.reason,
          contextRefs,
          ...(sourcePressureRefs.length > 0 ? { sourcePressureRefs } : {}),
        } satisfies AgentInvitedPayload,
        refs: [input.intentionEvent.event_id, invitationId, ...contextRefs],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `invite_other:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.agentId}`,
      });
      return {
        ...emptyFollowUp(),
        secondaryWakeRequests: [
          {
            agentId: input.intention.agentId,
            topicId: input.topicId,
            triggeringEventId: invitationEvent.event_id,
            triggeringMessageId: input.triggeringMessageId,
            reason: input.intention.reason,
            contextRefs,
            source: "invite_other",
            requesterAgentId: input.agentId,
            invitationEvent,
          },
        ],
      };
    }

    if (input.intention.kind === "respond_invitation") {
      const invitation = await this.findAgentIntentionInvitation(input.intention.invitationRef);
      if (!invitation || invitation.agentId !== input.agentId) {
        return emptyFollowUp();
      }
      const contextRefs = uniqueRefs([
        input.triggeringEventId,
        input.intention.invitationRef,
        ...(input.intention.contextRefs ?? []),
      ]);
      const redirectTo =
        input.intention.response === "delegate" &&
        input.intention.redirectTo &&
        this.agentRegistry.has(input.intention.redirectTo)
          ? input.intention.redirectTo
          : undefined;

      const responseEvent = await this.append(input.roomId, {
        eventType: "agent.invitation_responded",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          responseId: this.nextId("invitation_response"),
          invitationRef: input.intention.invitationRef,
          topicId: input.topicId,
          agentId: input.agentId,
          response: input.intention.response,
          reason: input.intention.reason,
          redirectTo,
          contextRefs,
          boundaryNote: "invitation response is a social reply to a knock, not a speaking command",
        } satisfies AgentInvitationRespondedPayload,
        refs: [input.intentionEvent.event_id, ...contextRefs],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `invitation_response:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.invitationRef}`,
      });
      if (input.intention.response === "delegate" && redirectTo) {
        const delegatedContextRefs = uniqueRefs([
          input.triggeringEventId,
          input.intention.invitationRef,
          ...(input.intention.contextRefs ?? []),
          ...(invitation.sourcePressureRefs ?? []),
        ]);
        const sourcePressureRefs = mixedReviewPressureRefsForReview(delegatedContextRefs);
        const delegatedInvitationId = this.nextId("invite");
        const delegatedInvitation = await this.append(input.roomId, {
          eventType: "agent.invited",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            invitationId: delegatedInvitationId,
            agentId: redirectTo,
            topicId: input.topicId,
            messageEventId: input.triggeringEventId,
            invitedBy: "agent_intention",
            reason: input.intention.reason,
            contextRefs: delegatedContextRefs,
            ...(sourcePressureRefs.length > 0 ? { sourcePressureRefs } : {}),
            delegatedFromInvitationRef: input.intention.invitationRef,
            delegatedBy: input.agentId,
            boundaryNote: "delegated invitation is a new social knock, not a transfer of control",
          } satisfies AgentInvitedPayload,
          refs: [responseEvent.event_id, delegatedInvitationId, ...delegatedContextRefs],
          causationId: responseEvent.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `invitation_delegate:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.invitationRef}:${redirectTo}`,
        });
        return {
          ...emptyFollowUp(),
          secondaryWakeRequests: [
            {
              agentId: redirectTo,
              topicId: input.topicId,
              triggeringEventId: delegatedInvitation.event_id,
              triggeringMessageId: input.triggeringMessageId,
              reason: input.intention.reason,
              contextRefs: [delegatedInvitation.event_id, ...delegatedContextRefs],
              source: "invite_other",
              requesterAgentId: input.agentId,
              invitationEvent: delegatedInvitation,
            },
          ],
        };
      }
      return emptyFollowUp();
    }

    if (input.intention.kind === "propose_handoff") {
      if (!this.agentRegistry.has(input.intention.toAgentId)) {
        return emptyFollowUp();
      }
      const responseContextRefs = await this.contextRefsForResponse(
        input.triggeringEventId,
        input.intention.contextRefs,
      );
      const contextRefs = uniqueRefs([input.triggeringEventId, ...responseContextRefs]);
      const sourcePressureRefs = mixedReviewPressureRefsForReview(contextRefs);

      const handoffId = this.nextId("handoff");
      const handoffEvent = await this.append(input.roomId, {
        eventType: "handoff.proposed",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          handoffId,
          topicId: input.topicId,
          fromAgentId: input.agentId,
          toAgentId: input.intention.toAgentId,
          reason: input.intention.reason,
          requestedResponse: input.intention.requestedResponse,
          contextRefs,
          ...(sourcePressureRefs.length > 0 ? { sourcePressureRefs } : {}),
          returnTo: input.intention.returnTo,
          status: "proposed",
        } satisfies HandoffProposedPayload,
        refs: [input.intentionEvent.event_id, handoffId, ...contextRefs],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `handoff:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.toAgentId}`,
      });
      return {
        ...emptyFollowUp(),
        secondaryWakeRequests: [
          {
            agentId: input.intention.toAgentId,
            topicId: input.topicId,
            triggeringEventId: handoffEvent.event_id,
            triggeringMessageId: input.triggeringMessageId,
            reason: input.intention.requestedResponse ?? input.intention.reason,
            contextRefs: [handoffEvent.event_id, ...contextRefs],
            source: "handoff_proposed",
            requesterAgentId: input.agentId,
          },
        ],
      };
    }

    if (
      input.intention.kind === "accept_handoff" ||
      input.intention.kind === "reject_handoff" ||
      input.intention.kind === "partially_accept_handoff" ||
      input.intention.kind === "delegate_handoff" ||
      input.intention.kind === "challenge_handoff"
    ) {
      const redirectTo =
        input.intention.kind === "delegate_handoff" && this.agentRegistry.has(input.intention.redirectTo)
          ? input.intention.redirectTo
          : undefined;
      const responseContextRefs = uniqueRefs([
        input.triggeringEventId,
        input.intention.handoffRef,
        ...(input.intention.contextRefs ?? []),
      ]);
      const responseEvent = await this.append(input.roomId, {
        eventType: "handoff.responded",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          topicId: input.topicId,
          handoffRef: input.intention.handoffRef,
          byAgentId: input.agentId,
          response: handoffResponseFromIntention(input.intention),
          reason: input.intention.reason,
          contextRefs: responseContextRefs,
          acceptedScope:
            input.intention.kind === "partially_accept_handoff" ? input.intention.acceptedScope : undefined,
          redirectTo,
        } satisfies HandoffRespondedPayload,
        refs: [input.intentionEvent.event_id, ...responseContextRefs],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `handoff_response:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.handoffRef}`,
      });

      if (input.intention.kind === "delegate_handoff" && redirectTo) {
        const original = await this.findHandoffProposal(input.intention.handoffRef);
        const delegatedContextRefs = uniqueRefs([
          input.triggeringEventId,
          input.intention.handoffRef,
          ...(input.intention.contextRefs ?? []),
          ...(original?.contextRefs ?? []),
          ...(original?.sourcePressureRefs ?? []),
        ]);
        const sourcePressureRefs = mixedReviewPressureRefsForReview(delegatedContextRefs);
        const delegatedHandoffId = this.nextId("handoff");
        const delegated = await this.append(input.roomId, {
          eventType: "handoff.proposed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            handoffId: delegatedHandoffId,
            topicId: input.topicId,
            fromAgentId: input.agentId,
            toAgentId: redirectTo,
            reason: input.intention.reason,
            requestedResponse: original?.requestedResponse,
            contextRefs: delegatedContextRefs,
            ...(sourcePressureRefs.length > 0 ? { sourcePressureRefs } : {}),
            returnTo: original?.returnTo ?? input.agentId,
            status: "proposed",
            delegatedFromHandoffRef: input.intention.handoffRef,
            delegatedBy: input.agentId,
            boundaryNote: "delegated handoff is a new social proposal, not a rewrite of the original",
          } satisfies HandoffProposedPayload,
          refs: [responseEvent.event_id, delegatedHandoffId, ...delegatedContextRefs],
          causationId: responseEvent.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `handoff_delegate:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.handoffRef}:${redirectTo}`,
        });
        return {
          ...emptyFollowUp(),
          secondaryWakeRequests: [
            {
              agentId: redirectTo,
              topicId: input.topicId,
              triggeringEventId: delegated.event_id,
              triggeringMessageId: input.triggeringMessageId,
              reason: original?.requestedResponse ?? input.intention.reason,
              contextRefs: [delegated.event_id, ...delegatedContextRefs],
              source: "handoff_proposed",
              requesterAgentId: input.agentId,
            },
          ],
        };
      }
      return emptyFollowUp();
    }

    if (input.intention.kind === "propose_memory") {
      const responseContextRefs = await this.contextRefsForResponse(
        input.triggeringEventId,
        input.intention.contextRefs ?? [],
      );
      const contextRefs = uniqueRefs([
        ...(input.intention.revisedFromMemoryRef ? [input.intention.revisedFromMemoryRef] : []),
        input.triggeringEventId,
        ...responseContextRefs,
      ]);
      const sourcePressureRefs = mixedReviewPressureRefsForReview(contextRefs);
      const memoryId = this.nextId("memory");
      const memoryEvent = await this.append(input.roomId, {
        eventType: "memory.proposed",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          memoryId,
          topicId: input.topicId,
          state: "proposed",
          summary: input.intention.summary,
          reason: input.intention.reason,
          sourceRefs: contextRefs,
          ...(sourcePressureRefs.length > 0 ? { sourcePressureRefs } : {}),
          proposedBy: input.agentId,
          revisedFromMemoryRef: input.intention.revisedFromMemoryRef,
          revisedBy: input.intention.revisedFromMemoryRef ? input.agentId : undefined,
          boundaryNote: input.intention.revisedFromMemoryRef
            ? "memory revision opens a fresh proposal; it does not rewrite the previous memory claim"
            : "memory proposal is provisional room sediment, not truth",
        } satisfies MemoryProposedPayload,
        refs: [input.intentionEvent.event_id, memoryId, ...contextRefs],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `memory:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.revisedFromMemoryRef ?? "new"}`,
      });
      await this.recordMemoryPressureBoundaryIfNeeded({
        roomId: input.roomId,
        topicId: input.topicId,
        triggeringMemoryEvent: memoryEvent,
        correlationId: input.correlationId,
      });
      return emptyFollowUp();
    }

    if (input.intention.kind === "contest_memory") {
      await this.append(input.roomId, {
        eventType: "memory.contested",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          topicId: input.topicId,
          memoryId: input.intention.memoryRef,
          memoryRef: input.intention.memoryRef,
          reason: input.intention.reason,
          contestedBy: input.agentId,
          contestRefs: input.intention.contextRefs ?? [],
        } satisfies MemoryContestedPayload,
        refs: [input.intentionEvent.event_id, input.intention.memoryRef, ...(input.intention.contextRefs ?? [])],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `memory_contest:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.memoryRef}`,
      });
      return emptyFollowUp();
    }

    if (
      input.intention.kind === "accept_memory" ||
      input.intention.kind === "mark_memory_stale" ||
      input.intention.kind === "retire_memory"
    ) {
      const state = memoryStateFromIntention(input.intention.kind);
      await this.append(input.roomId, {
        eventType: `memory.${state}`,
        actor: { kind: "agent", id: input.agentId },
        payload: {
          topicId: input.topicId,
          memoryId: input.intention.memoryRef,
          memoryRef: input.intention.memoryRef,
          state,
          reason: input.intention.reason,
          contextRefs: input.intention.contextRefs ?? [],
          transitionedBy: input.agentId,
        } satisfies MemoryTransitionPayload,
        refs: [input.intentionEvent.event_id, input.intention.memoryRef, ...(input.intention.contextRefs ?? [])],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `memory_${state}:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.memoryRef}`,
      });
      return emptyFollowUp();
    }

    if (input.intention.kind === "propose_protocol") {
      const expiresAt = input.intention.expiresAt ?? defaultProtocolExpiresAt();
      const responseContextRefs = await this.contextRefsForResponse(
        input.triggeringEventId,
        input.intention.contextRefs ?? [],
      );
      const contextRefs = uniqueRefs([input.triggeringEventId, ...responseContextRefs]);
      const sourcePressureRefs = mixedReviewPressureRefsForReview(contextRefs);
      const protocolId = this.nextId("protocol");
      await this.append(input.roomId, {
        eventType: "protocol.proposed",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          protocolId,
          topicId: input.topicId,
          proposedBy: input.agentId,
          summary: input.intention.summary,
            scope: input.intention.scope,
            expiresAt,
            expiryPolicy: input.intention.expiresAt ? "explicit" : "system_default_24h",
            reason: input.intention.reason,
            contextRefs,
            sourcePressureRefs,
            status: "proposed",
            boundaryNote: "protocol is temporary room etiquette, not permanent control flow",
          } satisfies ProtocolProposedPayload,
        refs: [input.intentionEvent.event_id, protocolId, ...contextRefs],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `protocol:${input.roomId}:${input.intentionEvent.event_id}`,
      });
      return emptyFollowUp();
    }

    if (input.intention.kind === "respond_protocol") {
      const responseId = this.nextId("protocol_response");
      const responseEvent = await this.append(input.roomId, {
        eventType: "protocol.responded",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          responseId,
          protocolId: input.intention.protocolRef,
          protocolRef: input.intention.protocolRef,
          topicId: input.topicId,
          agentId: input.agentId,
          response: input.intention.response,
          reason: input.intention.reason,
          proposedRevision: input.intention.proposedRevision,
          contextRefs: input.intention.contextRefs ?? [],
          status: protocolStatusFromResponse(input.intention.response),
        } satisfies ProtocolRespondedPayload,
        refs: [input.intentionEvent.event_id, responseId, input.intention.protocolRef, ...(input.intention.contextRefs ?? [])],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `protocol_response:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.protocolRef}`,
      });
      if (input.intention.response === "revise" && input.intention.proposedRevision?.trim()) {
        const original = await this.findProtocolProposal(input.intention.protocolRef);
        const revisedContextRefs = uniqueRefs([
          input.triggeringEventId,
          input.intention.protocolRef,
          ...(input.intention.contextRefs ?? []),
          ...(original?.contextRefs ?? []),
          ...(original?.sourcePressureRefs ?? []),
        ]);
        const sourcePressureRefs = mixedReviewPressureRefsForReview(revisedContextRefs);
        const expiresAt = defaultProtocolExpiresAt();
        const revisedProtocolId = this.nextId("protocol");
        await this.append(input.roomId, {
          eventType: "protocol.proposed",
          actor: { kind: "agent", id: input.agentId },
          payload: {
            protocolId: revisedProtocolId,
            topicId: input.topicId,
            proposedBy: input.agentId,
            summary: input.intention.proposedRevision.trim(),
            scope: original?.scope ?? "current_topic",
            expiresAt,
            expiryPolicy: "system_default_24h",
            reason: input.intention.reason,
            contextRefs: revisedContextRefs,
            sourcePressureRefs,
            status: "proposed",
            revisedFromProtocolRef: input.intention.protocolRef,
            revisedBy: input.agentId,
            boundaryNote: "protocol is temporary room etiquette, not permanent control flow",
          } satisfies ProtocolProposedPayload,
          refs: [responseEvent.event_id, revisedProtocolId, ...revisedContextRefs],
          causationId: responseEvent.event_id,
          correlationId: input.correlationId,
          idempotencyKey: `protocol_revision:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.protocolRef}`,
        });
      }
      return emptyFollowUp();
    }

    if (input.intention.kind === "retire_protocol") {
      await this.append(input.roomId, {
        eventType: "protocol.retired",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          protocolId: input.intention.protocolRef,
          protocolRef: input.intention.protocolRef,
          topicId: input.topicId,
          retiredBy: input.agentId,
          reason: input.intention.reason,
          contextRefs: input.intention.contextRefs ?? [],
          status: "retired",
          retiredAt: new Date().toISOString(),
        } satisfies ProtocolRetiredPayload,
        refs: [input.intentionEvent.event_id, input.intention.protocolRef, ...(input.intention.contextRefs ?? [])],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `protocol_retire:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.protocolRef}`,
      });
      return emptyFollowUp();
    }

    if (input.intention.kind === "review_archive") {
      const contextRefs = uniqueRefs([input.triggeringEventId, input.intention.archiveRef, ...(input.intention.contextRefs ?? [])]);
      const reviewId = this.nextId("archive_review");
      await this.append(input.roomId, {
        eventType: "archive.reviewed",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          reviewId,
          archiveRef: input.intention.archiveRef,
          topicId: input.topicId,
          reviewedBy: input.agentId,
          assessment: input.intention.assessment,
          summary: input.intention.summary,
          reason: input.intention.reason,
          contextRefs,
          boundaryNote: "archive review is room-visible critique, not archive mutation",
        } satisfies ArchiveReviewedPayload,
        refs: [input.intentionEvent.event_id, reviewId, ...contextRefs],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `archive_review:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.archiveRef}`,
      });
      return emptyFollowUp();
    }

    if (input.intention.kind === "propose_archive_repair") {
      const contextRefs = uniqueRefs([input.triggeringEventId, input.intention.archiveRef, ...(input.intention.contextRefs ?? [])]);
      const repairId = this.nextId("archive_repair");
      await this.append(input.roomId, {
        eventType: "archive.repair_proposed",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          repairId,
          archiveRef: input.intention.archiveRef,
          topicId: input.topicId,
          proposedBy: input.agentId,
          summary: input.intention.summary,
          reason: input.intention.reason,
          proposedRepair: input.intention.proposedRepair,
          contextRefs,
          status: "proposed",
          boundaryNote: "archive repair proposal does not rewrite the archive until later room action accepts it",
        } satisfies ArchiveRepairProposedPayload,
        refs: [input.intentionEvent.event_id, repairId, ...contextRefs],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `archive_repair:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.archiveRef}`,
      });
      return emptyFollowUp();
    }

    if (input.intention.kind === "respond_archive_repair") {
      const contextRefs = uniqueRefs([input.triggeringEventId, input.intention.repairRef, ...(input.intention.contextRefs ?? [])]);
      const responseEvent = await this.append(input.roomId, {
        eventType: "archive.repair_responded",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          responseId: this.nextId("archive_repair_response"),
          repairRef: input.intention.repairRef,
          topicId: input.topicId,
          agentId: input.agentId,
          response: input.intention.response,
          reason: input.intention.reason,
          proposedRevision: input.intention.proposedRevision,
          contextRefs,
          status: archiveRepairStatusFromResponse(input.intention.response),
          boundaryNote: "archive repair response changes repair proposal state only; archive content is unchanged",
        } satisfies ArchiveRepairRespondedPayload,
        refs: [input.intentionEvent.event_id, ...contextRefs],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `archive_repair_response:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.repairRef}`,
      });
      if (input.intention.response === "revise" && input.intention.proposedRevision?.trim()) {
        const original = await this.findArchiveRepairProposal(input.intention.repairRef);
        if (original) {
          const revisedContextRefs = uniqueRefs([
            input.triggeringEventId,
            input.intention.repairRef,
            ...(input.intention.contextRefs ?? []),
            ...original.contextRefs,
          ]);
          const revisedRepairId = this.nextId("archive_repair");
          await this.append(input.roomId, {
            eventType: "archive.repair_proposed",
            actor: { kind: "agent", id: input.agentId },
            payload: {
              repairId: revisedRepairId,
              archiveRef: original.archiveRef,
              topicId: input.topicId,
              proposedBy: input.agentId,
              summary: input.intention.proposedRevision.trim(),
              reason: input.intention.reason,
              proposedRepair: input.intention.proposedRevision.trim(),
              contextRefs: revisedContextRefs,
              status: "proposed",
              revisedFromRepairRef: input.intention.repairRef,
              revisedBy: input.agentId,
              boundaryNote: "archive repair proposal does not rewrite the archive until later room action accepts it",
            } satisfies ArchiveRepairProposedPayload,
            refs: [responseEvent.event_id, revisedRepairId, ...revisedContextRefs],
            causationId: responseEvent.event_id,
            correlationId: input.correlationId,
            idempotencyKey: `archive_repair_revision:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.repairRef}`,
          });
        }
      }
      return emptyFollowUp();
    }

    if (input.intention.kind === "retire_provider_boundary") {
      const contextRefs = uniqueRefs([
        input.triggeringEventId,
        input.intention.providerBoundaryRef,
        ...(input.intention.contextRefs ?? []),
      ]);
      await this.append(input.roomId, {
        eventType: "provider_boundary.retired",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          providerBoundaryRef: input.intention.providerBoundaryRef,
          retiredBy: input.agentId,
          topicId: input.topicId,
          status: "retired",
          reason: input.intention.reason,
          contextRefs,
          boundaryNote:
            "provider boundary retirement removes old runtime pressure from current room context; it does not delete ledger or archive history",
        } satisfies ProviderBoundaryRetiredPayload,
        refs: [input.intentionEvent.event_id, ...contextRefs],
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `provider_boundary_retire:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.providerBoundaryRef}`,
      });
      return emptyFollowUp();
    }

    if (input.intention.kind === "propose_persona_delta") {
      const targetAgentId = input.intention.targetAgentId ?? input.agentId;
      if (targetAgentId !== input.agentId || !this.agentRegistry.has(targetAgentId)) {
        return emptyFollowUp();
      }
      const deltaId = this.nextId("persona_delta");
      const responseContextRefs = await this.contextRefsForResponse(
        input.triggeringEventId,
        input.intention.contextRefs ?? [],
      );
      const evidenceRefs = uniqueRefs([input.triggeringEventId, ...responseContextRefs]);
      const sourcePressureRefs = mixedReviewPressureRefsForReview(evidenceRefs);
      await this.append(input.roomId, {
        eventType: "persona_delta.proposed",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          deltaId,
          agentId: targetAgentId,
          proposedBy: input.agentId,
          reason: input.intention.reason,
          proposedChange: {
            field: input.intention.field,
            operation: input.intention.operation ?? (input.intention.field === "dailyMood" ? "set" : "add"),
            value:
              input.intention.field === "dailyMood"
                ? {
                    date: new Date().toISOString().slice(0, 10),
                    posture: input.intention.value,
                    sourceRef: input.triggeringEventId,
                  }
                : input.intention.value,
          },
          evidenceRefs,
          ...(sourcePressureRefs.length > 0 ? { sourcePressureRefs } : {}),
          status: "proposed",
          createdAt: new Date().toISOString(),
          responses: [],
        } satisfies PersonaDeltaProposedPayload,
        refs: uniqueRefs([input.intentionEvent.event_id, deltaId, ...evidenceRefs]),
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `persona_delta:${input.roomId}:${input.intentionEvent.event_id}:${targetAgentId}`,
      });
      return emptyFollowUp();
    }

    if (input.intention.kind === "respond_persona_delta") {
      const evidenceRefs = uniqueRefs([input.triggeringEventId, ...(input.intention.contextRefs ?? [])]);
      const responseId = this.nextId("persona_delta_response");
      const responseEvent = await this.append(input.roomId, {
        eventType: "persona_delta.responded",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          responseId,
          deltaId: input.intention.deltaRef,
          agentId: input.agentId,
          response: input.intention.response,
          reason: input.intention.reason,
          proposedRevision: input.intention.response === "revise" ? input.intention.proposedRevision : undefined,
          evidenceRefs,
          status: personaDeltaStatusFromResponse(input.intention.response),
          createdAt: new Date().toISOString(),
        } satisfies PersonaDeltaRespondedPayload,
        refs: uniqueRefs([input.intentionEvent.event_id, responseId, input.intention.deltaRef, ...(input.intention.contextRefs ?? [])]),
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `persona_delta_response:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.deltaRef}`,
      });
      if (input.intention.response === "revise" && input.intention.proposedRevision?.trim()) {
        const original = await this.findPersonaDeltaProposal(input.intention.deltaRef);
        if (original) {
          const revisedEvidenceRefs = uniqueRefs([
            input.triggeringEventId,
            input.intention.deltaRef,
            ...(input.intention.contextRefs ?? []),
            ...original.evidenceRefs,
            ...(original.sourcePressureRefs ?? []),
          ]);
          const sourcePressureRefs = mixedReviewPressureRefsForReview(revisedEvidenceRefs);
          const revisedDeltaId = this.nextId("persona_delta");
          await this.append(input.roomId, {
            eventType: "persona_delta.proposed",
            actor: { kind: "agent", id: input.agentId },
            payload: {
              deltaId: revisedDeltaId,
              agentId: original.agentId,
              proposedBy: input.agentId,
              reason: input.intention.reason,
              proposedChange: {
                field: original.proposedChange.field,
                operation: original.proposedChange.operation,
                value:
                  original.proposedChange.field === "dailyMood"
                    ? {
                        date: new Date().toISOString().slice(0, 10),
                        posture: input.intention.proposedRevision.trim(),
                        sourceRef: input.triggeringEventId,
                      }
                    : input.intention.proposedRevision.trim(),
              },
              evidenceRefs: revisedEvidenceRefs,
              ...(sourcePressureRefs.length > 0 ? { sourcePressureRefs } : {}),
              status: "proposed",
              createdAt: new Date().toISOString(),
              responses: [],
              revisedFromDeltaRef: input.intention.deltaRef,
              revisedBy: input.agentId,
              boundaryNote: "identity proposal is room-visible, contestable, and not a fixed assignment",
            } satisfies PersonaDeltaProposedPayload,
            refs: uniqueRefs([responseEvent.event_id, revisedDeltaId, ...revisedEvidenceRefs]),
            causationId: responseEvent.event_id,
            correlationId: input.correlationId,
            idempotencyKey: `persona_delta_revision:${input.roomId}:${input.intentionEvent.event_id}:${input.intention.deltaRef}`,
          });
        }
      }
      return emptyFollowUp();
    }

    if (input.intention.kind === "share_workspace_artifact") {
      const responseContextRefs = await this.contextRefsForResponse(
        input.triggeringEventId,
        input.intention.contextRefs ?? [],
      );
      const contextRefs = uniqueRefs([input.triggeringEventId, ...responseContextRefs]);
      const sourcePressureRefs = mixedReviewPressureRefsForReview(contextRefs);
      const artifactId = this.nextId("artifact");
      await this.append(input.roomId, {
        eventType: "workspace.artifact_shared",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          artifactId,
          workspaceId: workspaceIdForAgent(input.agentId),
          agentId: input.agentId,
          pathRef: input.intention.pathRef,
          summary: input.intention.summary,
          contextRefs,
          ...(sourcePressureRefs.length > 0 ? { sourcePressureRefs } : {}),
          status: "shared",
          boundaryNote: "artifact ref is room-visible; private workspace contents are not copied into memory",
        } satisfies WorkspaceArtifactSharedPayload,
        refs: uniqueRefs([input.intentionEvent.event_id, artifactId, ...contextRefs, ...sourcePressureRefs]),
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: `workspace_artifact:${input.roomId}:${input.intentionEvent.event_id}:${input.agentId}:${input.intention.pathRef}`,
      });
      return emptyFollowUp();
    }

    if (input.intention.kind === "use_capability") {
      return this.routeCapabilityUse({ ...input, intention: input.intention });
    }

    if (input.intention.kind === "request_side_effect") {
      const responseContextRefs = await this.contextRefsForResponse(
        input.triggeringEventId,
        input.intention.request.contextRefs,
      );
      const contextRefs = uniqueRefs([input.triggeringEventId, ...responseContextRefs]);
      const sourcePressureRefs = mixedReviewPressureRefsForReview(contextRefs);
      const sideEffectRequest: SideEffectRequest = {
        ...input.intention.request,
        roomId: input.roomId,
        requestedBy: input.agentId,
        topicId: input.topicId,
        contextRefs,
        ...(sourcePressureRefs.length > 0 ? { sourcePressureRefs } : {}),
        idempotencyKey: `side_effect_request:${input.roomId}:${input.intentionEvent.event_id}:${input.agentId}`,
      };
      const request = await this.append(input.roomId, {
        eventType: "side_effect.requested",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          ...sideEffectRequest,
          topicId: input.topicId,
          requestedFromIntentionEventId: input.intentionEvent.event_id,
        } satisfies SideEffectRequestedPayload,
        refs: uniqueRefs([input.intentionEvent.event_id, ...sideEffectRequest.contextRefs, ...sourcePressureRefs]),
        causationId: input.intentionEvent.event_id,
        correlationId: input.correlationId,
        idempotencyKey: sideEffectRequest.idempotencyKey,
      });
      return {
        visibleSpeakerUsed: 0,
        chainedIntentions: [],
        visibleMessageEventIds: [],
        deferredIntentionEventIds: [],
        sideEffectRequestEventIds: [request.event_id],
        capabilityInvocationEventIds: [],
        capabilityResultEventIds: [],
        secondaryWakeRequests: [],
      };
    }

    return emptyFollowUp();
  }

  private async routeCapabilityUse(input: {
    roomId: RoomId;
    agentId: AgentId;
    topicId: TopicId;
    triggeringEventId: EventId;
    triggeringMessageId: MessageId;
    intentionEvent: RoomEvent<AgentIntentionRecordedPayload>;
    intention: Extract<AgentIntention, { kind: "use_capability" }>;
    correlationId: CorrelationId;
    visibleSpeakersUsed: number;
    speakerLimit: number;
    capabilityContinuationDepth?: number;
  }): Promise<{
    visibleSpeakerUsed: number;
    chainedIntentions: RoomLoopIntentionResult[];
    visibleMessageEventIds: EventId[];
    deferredIntentionEventIds: EventId[];
    sideEffectRequestEventIds: EventId[];
    capabilityInvocationEventIds: EventId[];
    capabilityResultEventIds: EventId[];
    secondaryWakeRequests: SecondaryWakeRequest[];
  }> {
    const depth = input.capabilityContinuationDepth ?? 0;
    const responseContextRefs = await this.contextRefsForResponse(
      input.triggeringEventId,
      input.intention.contextRefs ?? [],
    );
    const contextRefs = uniqueRefs([input.triggeringEventId, ...responseContextRefs]);
    const invocationId = this.nextId("capability");
    const capabilityRequest: AgentCapabilityUseRequest = {
      roomId: input.roomId,
      agentId: input.agentId,
      topicId: input.topicId,
      invocationId,
      capabilityId: input.intention.capabilityId,
      operation: input.intention.operation,
      input: input.intention.input,
      reason: input.intention.reason,
      contextRefs,
    };

    const invoked = await this.append(input.roomId, {
      eventType: "capability.invoked",
      actor: { kind: "agent", id: input.agentId },
      payload: {
        invocationId,
        capabilityId: input.intention.capabilityId,
        operation: input.intention.operation,
        input: input.intention.input,
        reason: input.intention.reason,
        roomId: input.roomId,
        agentId: input.agentId,
        topicId: input.topicId,
        contextRefs,
        visibility: "private_agent",
        boundaryNote:
          "agent-owned capability intent recorded; runtime enforces read-only, approval, byte, result, and audit boundaries",
      } satisfies CapabilityInvokedPayload,
      refs: uniqueRefs([input.intentionEvent.event_id, invocationId, ...contextRefs]),
      causationId: input.intentionEvent.event_id,
      correlationId: input.correlationId,
      idempotencyKey: `capability_invoked:${input.roomId}:${input.intentionEvent.event_id}:${invocationId}`,
    });

    const outcome =
      depth >= this.maxCapabilityContinuationDepth
        ? failedAgentCapabilityOutcome(capabilityRequest, "capability continuation depth exceeded")
        : await this.capabilityExecutor(capabilityRequest);

    const result = await this.append(input.roomId, {
      eventType: "capability.result",
      actor: { kind: "system", id: "capability_runtime" },
      payload: {
        invocationId,
        capabilityId: outcome.result.capabilityId,
        operation: outcome.result.operation,
        status: outcome.result.status,
        roomId: input.roomId,
        agentId: input.agentId,
        topicId: input.topicId,
        summary: outcome.result.summary,
        output: outcome.result.output,
        error: outcome.result.error,
        visibility: "private_agent",
        requestedFromIntentionEventId: input.intentionEvent.event_id,
        contextRefs,
        boundary: outcome.result.boundary as unknown as Record<string, unknown>,
        boundaryNote:
          outcome.kind === "side_effect_request"
            ? "capability requires side-effect approval; no external mutation was executed"
            : "capability result is private_agent context for the same agent, not a room-visible system answer",
      } satisfies CapabilityResultPayload,
      refs: uniqueRefs([invoked.event_id, input.intentionEvent.event_id, invocationId, ...contextRefs]),
      causationId: invoked.event_id,
      correlationId: input.correlationId,
      idempotencyKey: `capability_result:${input.roomId}:${invoked.event_id}:${invocationId}`,
    });

    if (outcome.kind === "side_effect_request") {
      const sourcePressureRefs = mixedReviewPressureRefsForReview(contextRefs);
      const sideEffectRequest: SideEffectRequest = {
        requestId: `sidefx_${invocationId}`,
        roomId: input.roomId,
        requestedBy: input.agentId,
        topicId: input.topicId,
        kind: outcome.sideEffect.kind,
        reason: input.intention.reason,
        target: outcome.sideEffect.target,
        expectedImpact: outcome.sideEffect.expectedImpact,
        contextRefs: uniqueRefs([...contextRefs, invoked.event_id, result.event_id]),
        ...(sourcePressureRefs.length > 0 ? { sourcePressureRefs } : {}),
        proposedCommand: outcome.sideEffect.proposedCommand,
        idempotencyKey: `side_effect_request:${input.roomId}:${result.event_id}:${input.agentId}`,
      };
      const request = await this.append(input.roomId, {
        eventType: "side_effect.requested",
        actor: { kind: "agent", id: input.agentId },
        payload: {
          ...sideEffectRequest,
          topicId: input.topicId,
          requestedFromIntentionEventId: input.intentionEvent.event_id,
        } satisfies SideEffectRequestedPayload,
        refs: uniqueRefs([input.intentionEvent.event_id, invoked.event_id, result.event_id, ...sideEffectRequest.contextRefs]),
        causationId: result.event_id,
        correlationId: input.correlationId,
        idempotencyKey: sideEffectRequest.idempotencyKey,
      });
      return {
        ...emptyFollowUp(),
        sideEffectRequestEventIds: [request.event_id],
        capabilityInvocationEventIds: [invoked.event_id],
        capabilityResultEventIds: [result.event_id],
      };
    }

    const continuationInvitation = await this.append(input.roomId, {
      eventType: "agent.invited",
      actor: { kind: "system", id: "capability_runtime" },
      payload: {
        invitationId: this.nextId("invite"),
        agentId: input.agentId,
        topicId: input.topicId,
        messageEventId: input.triggeringEventId,
        invitedBy: "capability_result",
        reason: capabilityContinuationReason(input.intention, outcome.result),
        contextRefs: uniqueRefs([invoked.event_id, result.event_id, invocationId]),
        boundaryNote:
          "capability result returns only to the same agent as private context; it is not a public system reply. If the agent speaks, it should name the actual result status and source path/cwd; if it stays silent, the silence should preserve why the result is not ready for the room.",
      } satisfies AgentInvitedPayload,
      refs: uniqueRefs([input.intentionEvent.event_id, invoked.event_id, result.event_id, invocationId]),
      causationId: result.event_id,
      correlationId: input.correlationId,
      idempotencyKey: `capability_continuation:${input.roomId}:${result.event_id}:${input.agentId}`,
    });

    const continued = await this.collectInvitedAgentIntention({
      roomId: input.roomId,
      agentId: input.agentId,
      topicId: input.topicId,
      invitationEvent: continuationInvitation,
      triggeringEventId: input.triggeringEventId,
      triggeringMessageId: input.triggeringMessageId,
      correlationId: input.correlationId,
      turnBoundary: turnBoundaryFromInvitation(continuationInvitation.payload, {
        maxSpeakers: input.speakerLimit,
        visibleSpeakersAlreadyUsed: input.visibleSpeakersUsed,
      }),
      privateContextFragments: [withCapabilityResultEventRef(outcome.fragment, result.event_id)],
    });
    const chainedIntentions: RoomLoopIntentionResult[] = [
      {
        agentId: continued.agentId,
        kind: continued.intention.kind,
        eventId: continued.intentionEvent.event_id,
      },
    ];
    const followUp = await this.routeIntention({
      roomId: input.roomId,
      agentId: continued.agentId,
      topicId: input.topicId,
      triggeringEventId: input.triggeringEventId,
      triggeringMessageId: input.triggeringMessageId,
      intentionEvent: continued.intentionEvent,
      intention: continued.intention,
      correlationId: input.correlationId,
      visibleSpeakersUsed: input.visibleSpeakersUsed,
      speakerLimit: input.speakerLimit,
      capabilityContinuationDepth: depth + 1,
    });

    return {
      visibleSpeakerUsed: followUp.visibleSpeakerUsed,
      chainedIntentions: chainedIntentions.concat(followUp.chainedIntentions),
      visibleMessageEventIds: followUp.visibleMessageEventIds,
      deferredIntentionEventIds: followUp.deferredIntentionEventIds,
      sideEffectRequestEventIds: followUp.sideEffectRequestEventIds,
      capabilityInvocationEventIds: [invoked.event_id, ...followUp.capabilityInvocationEventIds],
      capabilityResultEventIds: [result.event_id, ...followUp.capabilityResultEventIds],
      secondaryWakeRequests: followUp.secondaryWakeRequests,
    };
  }

  private async runSecondaryWake(input: {
    roomId: RoomId;
    correlationId: CorrelationId;
    visibleSpeakersUsed: number;
    speakerLimit: number;
    initialRequests: readonly SecondaryWakeRequest[];
    secondarySeen: Set<AgentId>;
  }): Promise<{
    invitedAgents: AgentId[];
    intentions: RoomLoopIntentionResult[];
    visibleSpeakerUsed: number;
    visibleMessageEventIds: EventId[];
    deferredIntentionEventIds: EventId[];
    sideEffectRequestEventIds: EventId[];
    capabilityInvocationEventIds: EventId[];
    capabilityResultEventIds: EventId[];
  }> {
    const invitedAgents: AgentId[] = [];
    const intentions: RoomLoopIntentionResult[] = [];
    const visibleMessageEventIds: EventId[] = [];
    const deferredIntentionEventIds: EventId[] = [];
    const sideEffectRequestEventIds: EventId[] = [];
    const capabilityInvocationEventIds: EventId[] = [];
    const capabilityResultEventIds: EventId[] = [];
    let visibleSpeakerUsed = 0;
    let requests = [...input.initialRequests];

    for (let round = 0; round < this.maxSecondaryWakeRounds && requests.length > 0; round += 1) {
      const nextRequests: SecondaryWakeRequest[] = [];
      for (const request of requests) {
        if (!this.agentRegistry.has(request.agentId) || input.secondarySeen.has(request.agentId)) {
          continue;
        }
        input.secondarySeen.add(request.agentId);
        const invitationEvent =
          request.invitationEvent ??
          (await this.appendSecondaryInvitation(input.roomId, input.correlationId, request));

        invitedAgents.push(request.agentId);
        const result = await this.collectInvitedAgentIntention({
          roomId: input.roomId,
          agentId: request.agentId,
          topicId: request.topicId,
          invitationEvent,
          triggeringEventId: request.triggeringEventId,
          triggeringMessageId: request.triggeringMessageId,
          correlationId: input.correlationId,
          turnBoundary: turnBoundaryFromInvitation(invitationEvent.payload, {
            maxSpeakers: input.speakerLimit,
            visibleSpeakersAlreadyUsed: input.visibleSpeakersUsed + visibleSpeakerUsed,
          }),
        });
        intentions.push({
          agentId: result.agentId,
          kind: result.intention.kind,
          eventId: result.intentionEvent.event_id,
        });

        const followUp = await this.routeIntention({
          roomId: input.roomId,
          agentId: result.agentId,
          topicId: request.topicId,
          triggeringEventId: request.triggeringEventId,
          triggeringMessageId: request.triggeringMessageId,
          intentionEvent: result.intentionEvent,
          intention: result.intention,
          correlationId: input.correlationId,
          visibleSpeakersUsed: input.visibleSpeakersUsed + visibleSpeakerUsed,
          speakerLimit: input.speakerLimit,
        });
        visibleSpeakerUsed += followUp.visibleSpeakerUsed;
        visibleMessageEventIds.push(...followUp.visibleMessageEventIds);
        deferredIntentionEventIds.push(...followUp.deferredIntentionEventIds);
        sideEffectRequestEventIds.push(...followUp.sideEffectRequestEventIds);
        capabilityInvocationEventIds.push(...followUp.capabilityInvocationEventIds);
        capabilityResultEventIds.push(...followUp.capabilityResultEventIds);
        intentions.push(...followUp.chainedIntentions);
        nextRequests.push(...followUp.secondaryWakeRequests);
      }
      requests = nextRequests;
    }

    return {
      invitedAgents,
      intentions,
      visibleSpeakerUsed,
      visibleMessageEventIds,
      deferredIntentionEventIds,
      sideEffectRequestEventIds,
      capabilityInvocationEventIds,
      capabilityResultEventIds,
    };
  }

  private secondaryWakeRequestsFromAgentMessage(input: {
    messageEvent: RoomEvent<MessageCreatedPayload>;
    topicId: TopicId;
    triggeringMessageId: MessageId;
  }): SecondaryWakeRequest[] {
    return input.messageEvent.payload.mentions
      .filter((agentId) => agentId !== input.messageEvent.payload.author && this.agentRegistry.has(agentId))
      .map((agentId) => ({
        agentId,
        topicId: input.topicId,
        triggeringEventId: input.messageEvent.event_id,
        triggeringMessageId: input.triggeringMessageId,
        reason: `mentioned by ${input.messageEvent.payload.author}`,
        contextRefs: [input.messageEvent.event_id, ...input.messageEvent.payload.contextRefs],
        source: "agent_message",
        requesterAgentId: input.messageEvent.payload.author,
      }));
  }

  private async appendSecondaryInvitation(
    roomId: RoomId,
    correlationId: CorrelationId,
    request: SecondaryWakeRequest,
  ): Promise<RoomEvent<AgentInvitedPayload>> {
    const invitationId = this.nextId("invite");
    return this.append(roomId, {
      eventType: "agent.invited",
      actor: { kind: "agent", id: request.requesterAgentId },
      payload: {
        invitationId,
        agentId: request.agentId,
        topicId: request.topicId,
        messageEventId: request.triggeringEventId,
        invitedBy: "agent_intention",
        reason: request.reason,
        contextRefs: request.contextRefs,
        boundaryNote:
          request.source === "handoff_proposed"
            ? "handoff proposal opened a secondary social knock; this is not a transfer of control"
            : "secondary social knock remains optional and does not force speech",
      } satisfies AgentInvitedPayload,
      refs: [request.triggeringEventId, invitationId, ...request.contextRefs],
      causationId: request.triggeringEventId,
      correlationId,
      idempotencyKey: `secondary_invite:${roomId}:${request.triggeringEventId}:${request.agentId}:${request.source}`,
    });
  }

  private normalizeMentions(explicitMentions: readonly AgentId[], content: string): AgentId[] {
    const mentions = new Set<AgentId>(explicitMentions);
    for (const agentId of this.agentRegistry.keys()) {
      if (content.includes(`@${agentId}`)) {
        mentions.add(agentId);
      }
    }
    return [...mentions];
  }

  private async append<TPayload>(
    roomId: RoomId,
    command: Omit<AppendCommand<TPayload>, "roomId">,
  ): Promise<RoomEvent<TPayload>> {
    const result = await this.options.ledger.append<TPayload>({
      roomId,
      payloadSchema: `${command.eventType}.v1`,
      ...command,
    });

    if (result.status === "appended" || result.status === "duplicate") {
      return result.event;
    }

    if (result.status === "conflict") {
      throw new Error(
        `Ledger conflict while appending ${command.eventType}: expected ${result.expectedPrevEventId ?? "any"}, actual ${
          result.actualPrevEventId ?? "none"
        }`,
      );
    }

    throw new Error(`Ledger rejected ${command.eventType}: ${result.reason}`);
  }
}

export function createSequentialIdFactory(): IdFactory {
  const counters = new Map<string, number>();
  return (prefix: string) => {
    const next = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, next);
    return `${prefix}_${String(next).padStart(4, "0")}`;
  };
}

function titleFromContent(content: string): string {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return "Untitled topic";
  }
  return normalized.length <= 48 ? normalized : `${normalized.slice(0, 45)}...`;
}

function isAllCall(content: string): boolean {
  return /全员|全体|所有人|每个人|大家|报数|everyone|everybody|all agents|all members|roll call|report in/i.test(
    content,
  );
}

function intentionRefs(intention: AgentIntention): RefId[] {
  switch (intention.kind) {
    case "speak":
      return intention.contextRefs ?? [];
    case "ask_question":
      return intention.contextRefs ?? [];
    case "propose_topic":
      return intention.contextRefs ?? [];
    case "respond_topic":
      return [intention.topicProposalRef, ...(intention.contextRefs ?? [])];
    case "apply_topic":
      return [intention.topicProposalRef, ...(intention.contextRefs ?? []), ...(intention.targetTopicId ? [intention.targetTopicId] : [])];
    case "invite_other":
      return intention.contextRefs ?? [];
    case "respond_invitation":
      return [intention.invitationRef, ...(intention.contextRefs ?? []), ...(intention.redirectTo ? [intention.redirectTo] : [])];
    case "propose_handoff":
      return intention.contextRefs;
    case "accept_handoff":
      return [intention.handoffRef, ...(intention.contextRefs ?? [])];
    case "reject_handoff":
      return [intention.handoffRef, ...(intention.contextRefs ?? [])];
    case "partially_accept_handoff":
      return [intention.handoffRef, ...(intention.contextRefs ?? []), ...(intention.acceptedScope?.contextRefs ?? [])];
    case "delegate_handoff":
      return [intention.handoffRef, ...(intention.contextRefs ?? [])];
    case "challenge_handoff":
      return [intention.handoffRef, ...(intention.contextRefs ?? [])];
    case "propose_memory":
      return [...(intention.revisedFromMemoryRef ? [intention.revisedFromMemoryRef] : []), ...intention.contextRefs];
    case "contest_memory":
      return [intention.memoryRef, ...(intention.contextRefs ?? [])];
    case "accept_memory":
      return [intention.memoryRef, ...(intention.contextRefs ?? [])];
    case "mark_memory_stale":
      return [intention.memoryRef, ...(intention.contextRefs ?? [])];
    case "retire_memory":
      return [intention.memoryRef, ...(intention.contextRefs ?? [])];
    case "propose_persona_delta":
      return intention.contextRefs ?? [];
    case "respond_persona_delta":
      return [intention.deltaRef, ...(intention.contextRefs ?? [])];
    case "propose_protocol":
      return intention.contextRefs ?? [];
    case "respond_protocol":
      return [intention.protocolRef, ...(intention.contextRefs ?? [])];
    case "retire_protocol":
      return [intention.protocolRef, ...(intention.contextRefs ?? [])];
    case "review_archive":
      return [intention.archiveRef, ...(intention.contextRefs ?? [])];
    case "propose_archive_repair":
      return [intention.archiveRef, ...(intention.contextRefs ?? [])];
    case "respond_archive_repair":
      return [intention.repairRef, ...(intention.contextRefs ?? [])];
    case "retire_provider_boundary":
      return [intention.providerBoundaryRef, ...(intention.contextRefs ?? [])];
    case "share_workspace_artifact":
      return intention.contextRefs ?? [];
    case "use_capability":
      return intention.contextRefs ?? [];
    case "request_side_effect":
      return intention.request.contextRefs;
    case "stay_silent":
      return [];
  }
}

function handoffResponseFromIntention(
  intention: Extract<
    AgentIntention,
    | { kind: "accept_handoff" }
    | { kind: "reject_handoff" }
    | { kind: "partially_accept_handoff" }
    | { kind: "delegate_handoff" }
    | { kind: "challenge_handoff" }
  >,
): HandoffRespondedPayload["response"] {
  switch (intention.kind) {
    case "accept_handoff":
      return "accepted";
    case "reject_handoff":
      return "rejected";
    case "partially_accept_handoff":
      return "partially_accepted";
    case "delegate_handoff":
      return "redirected";
    case "challenge_handoff":
      return "challenged";
  }
}

function memoryStateFromIntention(kind: "accept_memory" | "mark_memory_stale" | "retire_memory"): "accepted" | "stale" | "retired" {
  switch (kind) {
    case "accept_memory":
      return "accepted";
    case "mark_memory_stale":
      return "stale";
    case "retire_memory":
      return "retired";
  }
}

function protocolStatusFromResponse(response: "accept" | "reject" | "challenge" | "revise"): "active" | "rejected" | "challenged" | "revised" {
  switch (response) {
    case "accept":
      return "active";
    case "reject":
      return "rejected";
    case "challenge":
      return "challenged";
    case "revise":
      return "revised";
  }
}

function archiveRepairStatusFromResponse(
  response: "accept" | "reject" | "challenge" | "revise" | "retire",
): "accepted" | "rejected" | "challenged" | "revised" | "retired" {
  switch (response) {
    case "accept":
      return "accepted";
    case "reject":
      return "rejected";
    case "challenge":
      return "challenged";
    case "revise":
      return "revised";
    case "retire":
      return "retired";
  }
}

function personaDeltaStatusFromResponse(
  response: "accept" | "reject" | "contest" | "retire" | "revise",
): "accepted" | "rejected" | "contested" | "retired" | "revised" {
  switch (response) {
    case "accept":
      return "accepted";
    case "reject":
      return "rejected";
    case "contest":
      return "contested";
    case "retire":
      return "retired";
    case "revise":
      return "revised";
  }
}

function shouldRecordOpenQuestion(intention: AgentIntention, content: string): boolean {
  if (intention.kind === "ask_question") return true;
  if (intention.kind !== "speak") return false;
  const normalized = content.trim();
  if (normalized.length === 0 || normalized.length > 500) return false;
  return /[?？]$/.test(normalized);
}

function openQuestionResponseKind(
  intention: AgentIntention,
  content: string,
): OpenQuestionRespondedPayload["response"] {
  if (intention.kind === "ask_question") return "refined";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "responded";
}

function memoryRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isMemoryRef);
}

function isMemoryRef(ref: RefId): boolean {
  return ref.startsWith("memory_");
}

function protocolRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isProtocolRef);
}

function isProtocolRef(ref: RefId): boolean {
  return ref.startsWith("protocol_") && !ref.startsWith("protocol_response_") && !ref.startsWith("protocol_review_");
}

function handoffRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isHandoffRef);
}

function isHandoffRef(ref: RefId): boolean {
  return ref.startsWith("handoff_") && !ref.startsWith("handoff_response_") && !ref.startsWith("handoff_review_");
}

function invitationRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isInvitationRefForReview);
}

function isInvitationRefForReview(ref: RefId): boolean {
  return ref.startsWith("invite_") && !ref.startsWith("invitation_response_") && !ref.startsWith("invitation_review_");
}

function personaDeltaRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isPersonaDeltaRef);
}

function isPersonaDeltaRef(ref: RefId): boolean {
  return ref.startsWith("persona_delta_") && !ref.startsWith("persona_delta_response_") && !ref.startsWith("persona_delta_review_");
}

function topicProposalRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isTopicProposalRefForReview);
}

function isTopicProposalRefForReview(ref: RefId): boolean {
  return ref.startsWith("topic_proposal_") && !ref.startsWith("topic_review_");
}

function archiveReviewRequestRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter((ref) => ref.startsWith("archive_review_request_"));
}

function archiveRepairRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isArchiveRepairRefForReview);
}

function isArchiveRepairRefForReview(ref: RefId): boolean {
  return (
    ref.startsWith("archive_repair_") &&
    !ref.startsWith("archive_repair_response_") &&
    !ref.startsWith("archive_repair_review_") &&
    !ref.startsWith("archive_repair_apply_")
  );
}

function sideEffectRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isSideEffectRefForReview);
}

function isSideEffectRefForReview(ref: RefId): boolean {
  return ref.startsWith("sidefx_");
}

function archiveReviewAssessmentFromSpeech(content: string): ArchiveReviewedPayload["assessment"] {
  const lower = content.toLowerCase();
  const hasRepairSignal = /repair|修复|修补/.test(lower);
  const hasNegatedRepairSignal =
    /(?:not|no|without)\s+(?:an?\s+)?repair/.test(lower) ||
    /不(?:提出|做|需要|执行)?\s*(?:repair|修复|修补)/.test(lower) ||
    /不是\s*(?:repair|修复|修补)/.test(lower);
  if (/memory|contest|记忆|质疑/.test(lower)) return "needs_memory_contest";
  if (/bias|biased|偏差|偏颇/.test(lower)) return "biased_summary";
  if (/missing|omission|flatten|遗漏|漏掉|压平|未解|争议/.test(lower)) return "missing_context";
  if (hasRepairSignal && !hasNegatedRepairSignal) return "needs_repair";
  return "usable_skeleton";
}

function workspaceArtifactRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isWorkspaceArtifactRefForReview);
}

function isWorkspaceArtifactRefForReview(ref: RefId): boolean {
  return ref.startsWith("artifact_");
}

function skillCapsuleRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isSkillCapsuleRefForReview);
}

function isSkillCapsuleRefForReview(ref: RefId): boolean {
  return ref.startsWith("skill_") && !ref.startsWith("skill_capsule_review_");
}

function capabilityRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isCapabilityRefForReview);
}

function isCapabilityRefForReview(ref: RefId): boolean {
  return ref.startsWith("capability_") && !ref.startsWith("capability_review_");
}

function mixedReviewPressureRefsForReview(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isMixedReviewPressureRefForReview);
}

function isMixedReviewPressureRefForReview(ref: RefId): boolean {
  return ref.startsWith("mixed_review:") && !ref.startsWith("mixed_review_pressure_review_");
}

function memoryReviewResponseKind(content: string): MemoryReviewedPayload["response"] {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/stale|caution|uncertain|过期|谨慎|不确定|存疑/.test(content)) return "cautioned";
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function protocolReviewResponseKind(content: string): ProtocolReviewedPayload["response"] {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|too broad|scope|过宽|范围|谨慎|不确定|存疑/.test(content)) return "cautioned";
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function handoffReviewResponseKind(content: string): HandoffReviewedPayload["response"] {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问|确认/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|too broad|scope|packet|context|过宽|范围|上下文|谨慎|不确定|存疑/.test(content)) return "cautioned";
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function invitationReviewResponseKind(content: string): AgentInvitationReviewedPayload["response"] {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问|确认/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|force|command|scope|context|过宽|范围|上下文|强制|命令|谨慎|不确定|存疑/.test(content)) {
    return "cautioned";
  }
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function personaDeltaReviewResponseKind(content: string): PersonaDeltaReviewedPayload["response"] {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问|证据/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|thin|weak|temporary|role|identity|谨慎|不确定|存疑|太薄|临时|身份|角色/.test(content)) return "cautioned";
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function topicProposalReviewResponseKind(content: string): TopicProposalReviewedPayload["response"] {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问|证据/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|too broad|scope|split|pause|merge|active topic|过宽|范围|拆分|暂停|合并|当前话题|谨慎|不确定|存疑/.test(content)) {
    return "cautioned";
  }
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function archiveRepairReviewResponseKind(content: string): ArchiveRepairReviewedPayload["response"] {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问|证据/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|rewrite|mutate|apply|archive|repair|谨慎|不确定|存疑|改写|修改|应用|修复/.test(content)) {
    return "cautioned";
  }
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function sideEffectReviewResponseKind(content: string): SideEffectReviewedPayload["response"] {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问|证据|审批/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|approve|deny|execute|result|scope|impact|external|审批|批准|拒绝|执行|结果|外部|范围|影响|谨慎|不确定|存疑/.test(content)) {
    return "cautioned";
  }
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function workspaceArtifactReviewResponseKind(content: string): WorkspaceArtifactReviewedPayload["response"] {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问|证据/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|copy|memory|execute|private|workspace|artifact|隐私|私有|复制|记忆|执行|谨慎|不确定|存疑/.test(content)) {
    return "cautioned";
  }
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function skillCapsuleReviewResponseKind(content: string): SkillCapsuleReviewedPayload["response"] {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问|证据|审批/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|execute|tool|approval|approve|bypass|role|assign|capability|skill|执行|工具|审批|批准|绕过|角色|职责|能力|技能|谨慎|不确定|存疑/.test(content)) {
    return "cautioned";
  }
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function capabilityReviewResponseKind(content: string): CapabilityReviewedPayload["response"] {
  if (/[?？]/.test(content) || /question|ask|evidence|疑问|问题|追问|证据|确认/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|oppose|反对|质疑|不同意/.test(content)) return "contested";
  if (
    /caution|uncertain|score|wake|route|responsibility|role|assign|reputation|authority|trust|force|competence|能力|职责|角色|分配|信誉|声誉|权威|信任|强制|胜任|路由|唤醒|谨慎|不确定|存疑/.test(
      content,
    )
  ) {
    return "cautioned";
  }
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function mixedReviewPressureReviewResponseKind(content: string): MixedReviewPressureReviewedPayload["response"] {
  if (/narrow|narrower|scope|scoped|shrink|缩窄|缩小|范围|只限|仅限/.test(content)) return "narrowing_suggested";
  if (
    /retire|retirement|retired|drop|退场|退休|退役|移出/.test(content) &&
    !/not retire|do not retire|without retiring|not a retirement|not retirement|不退休|不退役|不退场|不要退休|不要退役|不要退场|无需退休|无需退役|无需退场|先不退休|先不退役|先不退场|先别.*退场|别.*退场|不是.*退场|并非.*退场|不移出/.test(
      content,
    )
  ) {
    return "retirement_suggested";
  }
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问|证据/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|oppose|反对|质疑|不同意/.test(content)) return "contested";
  if (
    /leave (it )?(open|alone)|keep (it )?open|let (it )?(sit|stand)|hold (it )?open|留着|留下|留在这里|先留|继续留|悬着|再悬|悬一会儿|放着|放在这里|停在这里|停在房间|先停着|浮一会儿|再浮|再升一会儿|多待一会儿|待一会儿|呼吸.{0,3}空间|慢慢沉淀|让.*沉淀|保持开放|别急着处理|不急着处理|不急于解决|不匆忙退出|不急着把.*按下去|不急着把.*说圆/.test(
      content,
    )
  ) {
    return "left_open";
  }
  if (/caution|uncertain|too broad|closure|resolve|consensus|hidden|workflow|过宽|关闭|解决|共识|隐藏|流程|谨慎|不确定|存疑/.test(content)) {
    return "cautioned";
  }
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function isOpenQuestionRef(ref: RefId): boolean {
  return ref.startsWith("question_");
}

function defaultProtocolExpiresAt(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function appendPrivateContextFragments(
  packet: AgentContextPacket,
  fragments: readonly ContextFragment[] | undefined,
): AgentContextPacket {
  if (!fragments || fragments.length === 0) {
    return packet;
  }
  return {
    ...packet,
    contextFragments: [...(packet.contextFragments ?? []), ...fragments],
  };
}

function withCapabilityResultEventRef(fragment: ContextFragment, resultEventId: EventId): ContextFragment {
  return {
    ...fragment,
    source: { kind: "runtime", eventId: resultEventId },
    refs: uniqueRefs([resultEventId, ...fragment.refs]),
    cacheKey: `${fragment.cacheKey}:${resultEventId}`,
  };
}

function uniqueRefs(refs: RefId[]): RefId[] {
  return [...new Set(refs.filter((ref) => ref.trim().length > 0))];
}

function emptyFollowUp(): {
  visibleSpeakerUsed: number;
  chainedIntentions: RoomLoopIntentionResult[];
  visibleMessageEventIds: EventId[];
  deferredIntentionEventIds: EventId[];
  sideEffectRequestEventIds: EventId[];
  capabilityInvocationEventIds: EventId[];
  capabilityResultEventIds: EventId[];
  secondaryWakeRequests: SecondaryWakeRequest[];
} {
  return {
    visibleSpeakerUsed: 0,
    chainedIntentions: [],
    visibleMessageEventIds: [],
    deferredIntentionEventIds: [],
    sideEffectRequestEventIds: [],
    capabilityInvocationEventIds: [],
    capabilityResultEventIds: [],
    secondaryWakeRequests: [],
  };
}

async function* inCompletionBatches<T>(tasks: Promise<T>[], arbitrationWindowMs: number): AsyncGenerator<T[]> {
  const pending = tasks.map((task, index) => {
    const slot: {
      index: number;
      settled: boolean;
      value?: T;
      hasError: boolean;
      error?: unknown;
      task: Promise<void>;
    } = {
      index,
      settled: false,
      hasError: false,
      task: Promise.resolve(),
    };
    slot.task = task.then(
      (value) => {
        slot.settled = true;
        slot.value = value;
      },
      (error: unknown) => {
        slot.settled = true;
        slot.hasError = true;
        slot.error = error;
      },
    );
    return slot;
  });
  const windowMs = Math.max(0, Math.floor(arbitrationWindowMs));

  while (pending.length > 0) {
    await Promise.race(pending.map((item) => item.task));
    if (windowMs > 0 && pending.some((item) => !item.settled)) {
      await delay(windowMs);
    }

    const completed = pending.filter((item) => item.settled);
    for (const item of completed) {
      pending.splice(
        pending.findIndex((candidate) => candidate.index === item.index),
        1,
      );
    }

    const failed = completed.find((item) => item.hasError);
    if (failed) {
      throw failed.error;
    }

    yield completed.map((item) => item.value as T);
  }
}

function compareWakeCandidates(
  left: WakeCandidateWithConstraints,
  right: WakeCandidateWithConstraints,
  activity: Map<AgentId, WakeActivity>,
  rotationSeed: string,
): number {
  if (left.score !== right.score) return right.score - left.score;
  const leftActivity = activity.get(left.agentId) ?? emptyWakeActivity();
  const rightActivity = activity.get(right.agentId) ?? emptyWakeActivity();
  if (leftActivity.deferredSpeeches !== rightActivity.deferredSpeeches) {
    return rightActivity.deferredSpeeches - leftActivity.deferredSpeeches;
  }
  const leftLoad = leftActivity.invitations + leftActivity.visibleMessages * 2;
  const rightLoad = rightActivity.invitations + rightActivity.visibleMessages * 2;
  if (leftLoad !== rightLoad) return leftLoad - rightLoad;
  if (leftActivity.lastActivityCursor !== rightActivity.lastActivityCursor) {
    return leftActivity.lastActivityCursor - rightActivity.lastActivityCursor;
  }
  return stableRotationValue(`${rotationSeed}:${left.agentId}`) - stableRotationValue(`${rotationSeed}:${right.agentId}`);
}

function pendingMemoryProposalRefs(events: readonly RoomEvent[], roomId: RoomId, topicId: TopicId): RefId[] {
  const latestByMemory = new Map<RefId, { state: string; topicId?: TopicId; cursor: number }>();
  events.forEach((event, cursor) => {
    if (event.room_id !== roomId || !event.event_type.startsWith("memory.")) {
      return;
    }
    const memoryState = memoryStateFromEventType(event.event_type);
    if (!memoryState) {
      return;
    }
    const payload = event.payload as {
      memoryId?: unknown;
      memory_id?: unknown;
      memoryRef?: unknown;
      memory_ref?: unknown;
      topicId?: unknown;
      topic_id?: unknown;
    };
    const memoryId =
      typeof payload.memoryId === "string"
        ? payload.memoryId
        : typeof payload.memory_id === "string"
          ? payload.memory_id
          : typeof payload.memoryRef === "string"
            ? payload.memoryRef
            : typeof payload.memory_ref === "string"
              ? payload.memory_ref
              : undefined;
    if (!memoryId) {
      return;
    }
    latestByMemory.set(memoryId, {
      state: memoryState,
      topicId:
        typeof payload.topicId === "string"
          ? payload.topicId
          : typeof payload.topic_id === "string"
            ? payload.topic_id
            : undefined,
      cursor,
    });
  });
  return [...latestByMemory.entries()]
    .filter(([, value]) => value.state === "proposed" && value.topicId === topicId)
    .sort((left, right) => left[1].cursor - right[1].cursor || left[0].localeCompare(right[0]))
    .map(([memoryId]) => memoryId);
}

function memoryStateFromEventType(eventType: string): "proposed" | "contested" | "accepted" | "stale" | "retired" | undefined {
  const state = eventType.replace("memory.", "");
  if (state === "proposed" || state === "contested" || state === "accepted" || state === "stale" || state === "retired") {
    return state;
  }
  return undefined;
}

function acceptedWakeLimit(accepted: RoomLoopAcceptedMessage, fallback: number): number {
  return accepted.maxAwakenedAgents === undefined
    ? fallback
    : Math.max(1, Math.floor(accepted.maxAwakenedAgents));
}

function acceptedSpeakerLimit(accepted: RoomLoopAcceptedMessage, fallback: number): number {
  return accepted.maxSpeakers === undefined
    ? fallback
    : Math.max(0, Math.floor(accepted.maxSpeakers));
}

function capabilityContinuationReason(
  intention: Extract<AgentIntention, { kind: "use_capability" }>,
  result: { status: string; summary: string; output: unknown; error?: string },
): string {
  const source = capabilityOutputSource(result.output);
  const pieces = [
    `private result for ${intention.capabilityId}:${intention.operation}`,
    `status=${result.status}`,
    source ? `actual source=${source}` : undefined,
    result.error ? `error=${boundedInvitationText(result.error, 240)}` : undefined,
    `summary=${boundedInvitationText(result.summary, 360)}`,
    "If you speak, report what the evidence did or did not show and name the actual source path/cwd; do not leave the room waiting on an unreported private result.",
  ].filter((piece): piece is string => Boolean(piece));
  return pieces.join("; ");
}

function capabilityOutputSource(output: unknown): string | undefined {
  if (!isPlainRecord(output)) {
    return undefined;
  }
  const direct =
    recordString(output.cwd) ??
    recordString(output.root) ??
    recordString(output.path) ??
    recordString(output.memsuHome) ??
    recordString(output.artifactPath);
  if (direct) {
    return direct;
  }
  const nested = output.result;
  return isPlainRecord(nested) ? capabilityOutputSource(nested) : undefined;
}

function recordString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedInvitationText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 15))}... [truncated]`;
}

function turnBoundaryFromInvitation(
  invitation: AgentInvitedPayload,
  budget: {
    maxAwakenedAgents?: number;
    maxSpeakers?: number;
    speakerArbitrationWindowMs?: number;
    visibleSpeakersAlreadyUsed?: number;
  },
): AgentTurnBoundary {
  const used = Math.max(0, Math.floor(budget.visibleSpeakersAlreadyUsed ?? 0));
  const maxSpeakers = budget.maxSpeakers === undefined ? undefined : Math.max(0, Math.floor(budget.maxSpeakers));
  return {
    invitedBy: invitation.invitedBy,
    invitationReason: invitation.reason,
    invitationContextRefs: [...invitation.contextRefs],
    recoveryRefs: invitation.recoveryRefs === undefined ? undefined : [...invitation.recoveryRefs],
    maxAwakenedAgents: budget.maxAwakenedAgents,
    maxSpeakers,
    speakerArbitrationWindowMs: budget.speakerArbitrationWindowMs,
    visibleSpeakersAlreadyUsed: used,
    speakerSlotsRemaining: maxSpeakers === undefined ? undefined : Math.max(0, maxSpeakers - used),
    mayStaySilent: true,
    boundaryNote:
      "Wake is a knock, not a speaking command. Speaker budget limits visible replies; use it to choose concise speech, invitation, handoff, question, or silence.",
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureWakeActivity(activity: Map<AgentId, WakeActivity>, agentId: AgentId): WakeActivity {
  const existing = activity.get(agentId);
  if (existing) return existing;
  const created = emptyWakeActivity();
  activity.set(agentId, created);
  return created;
}

function emptyWakeActivity(): WakeActivity {
  return {
    invitations: 0,
    visibleMessages: 0,
    deferredSpeeches: 0,
    deferredContextRefs: [],
    lastActivityCursor: -1,
    lastDeferredCursor: -1,
  };
}

function stableRotationValue(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
}
