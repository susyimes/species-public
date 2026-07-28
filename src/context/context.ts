import {
  AgentId,
  ContextFragment,
  ContextFragmentOmissionReason,
  ContextPacketAudit,
  MemoryState,
  OmittedContextFragment,
  Projection,
  RefId,
  RoomEvent,
  RoomId,
  TopicId,
} from "../types";

export type ContextRefType =
  | "message"
  | "topic"
  | "protocol"
  | "memory"
  | "archive"
  | "handoff"
  | "invitation"
  | "persona_delta"
  | "side_effect"
  | "workspace_artifact"
  | "skill_capsule"
  | "capability"
  | "turn_recovery"
  | "silence"
  | "pressure_boundary"
  | "memory_pressure"
  | "provider_boundary"
  | "mixed_review_pressure"
  | "summary"
  | "question";

export type ContextPurpose = "wake" | "handoff" | "memory_review" | "archive_generation";

export type RefAvailability = "available" | "compacted" | "retired";

export type ContextRefRecord = {
  refId: RefId;
  refType: ContextRefType;
  roomId: RoomId;
  topicId?: TopicId;
  sourceEventId: string;
  ledgerCursor: number;
  author?: string;
  tokenEstimate: number;
  createdAt: string;
  availability: RefAvailability;
  evidenceText?: string;
  states: {
    memoryState?: MemoryState;
    memorySummary?: string;
    memoryReason?: string;
    memoryProposedBy?: string;
    memorySourcePressureRefs?: string[];
    memoryRevisedFromRef?: string;
    memoryRevisedBy?: string;
    memoryBoundaryNote?: string;
    memoryLastReviewResponse?: string;
    memoryLastReviewSummary?: string;
    memoryLastReviewedBy?: string;
    memoryLastReviewRef?: string;
    protocolState?: string;
    protocolSummary?: string;
    protocolScope?: string;
    protocolProposedBy?: string;
    protocolReason?: string;
    protocolProposalReason?: string;
    protocolSourcePressureRefs?: string[];
    protocolExpiresAt?: string;
    protocolExpiryPolicy?: string;
    protocolBoundaryNote?: string;
    protocolResponse?: string;
    protocolRespondedBy?: string;
    protocolResponseReason?: string;
    protocolProposedRevision?: string;
    protocolLastReview?: string;
    protocolLastReviewSummary?: string;
    protocolReviewBoundaryNote?: string;
    protocolRevisedFromRef?: string;
    protocolRevisedBy?: string;
    personaDeltaState?: string;
    targetAgentId?: string;
    personaDeltaReason?: string;
    personaDeltaProposalReason?: string;
    personaDeltaSourcePressureRefs?: string[];
    personaDeltaResponseReason?: string;
    personaDeltaProposedBy?: string;
    personaDeltaRespondingAgentId?: string;
    personaDeltaResponse?: string;
    personaDeltaProposedRevision?: string;
    personaDeltaRevisedFromRef?: string;
    personaDeltaRevisedBy?: string;
    personaDeltaLastReview?: string;
    personaDeltaLastReviewSummary?: string;
    personaDeltaReviewBoundaryNote?: string;
    personaDeltaLastReviewedBy?: string;
    personaDeltaField?: string;
    personaDeltaOperation?: string;
    personaDeltaValueSummary?: string;
    personaDeltaBoundaryNote?: string;
    topicStatus?: string;
    handoffState?: string;
    handoffFromAgentId?: string;
    handoffToAgentId?: string;
    handoffByAgentId?: string;
    handoffProposalReason?: string;
    handoffSourcePressureRefs?: string[];
    handoffResponseReason?: string;
    handoffRequestedResponse?: string;
    handoffReturnTo?: string;
    handoffResponse?: string;
    handoffRedirectTo?: string;
    handoffAcceptedScopeSummary?: string;
    handoffLastReview?: string;
    handoffLastReviewSummary?: string;
    handoffReviewBoundaryNote?: string;
    handoffDelegatedFromRef?: string;
    handoffDelegatedBy?: string;
    handoffBoundaryNote?: string;
    invitationStatus?: string;
    invitationId?: string;
    invitationToAgentId?: string;
    invitationFromAgentId?: string;
    invitationInvitedBy?: string;
    invitationReason?: string;
    invitationSourcePressureRefs?: string[];
    invitationBoundaryNote?: string;
    invitationDelegatedFromRef?: string;
    invitationDelegatedBy?: string;
    invitationResponseId?: string;
    invitationResponse?: string;
    invitationResponseReason?: string;
    invitationRespondingAgentId?: string;
    invitationRedirectTo?: string;
    invitationResponseBoundaryNote?: string;
    invitationLastReview?: string;
    invitationLastReviewSummary?: string;
    invitationLastReviewedBy?: string;
    invitationLastReviewRef?: string;
    invitationReviewBoundaryNote?: string;
    sideEffectStatus?: string;
    sideEffectKind?: string;
    sideEffectTarget?: string;
    sideEffectRequestedBy?: string;
    sideEffectReason?: string;
    sideEffectRequestReason?: string;
    sideEffectSourcePressureRefs?: string[];
    sideEffectExpectedImpact?: string;
    sideEffectProposedCommand?: string;
    sideEffectApprovalId?: string;
    sideEffectApprovedBy?: string;
    sideEffectDeniedBy?: string;
    sideEffectExpiredBy?: string;
    sideEffectExpiredAt?: string;
    sideEffectDecisionReason?: string;
    sideEffectResultStatus?: string;
    sideEffectResultSummary?: string;
    sideEffectArtifactRefs?: string[];
    sideEffectLastReview?: string;
    sideEffectLastReviewSummary?: string;
    sideEffectLastReviewedBy?: string;
    sideEffectLastReviewRef?: string;
    sideEffectReviewBoundaryNote?: string;
    workspaceArtifactStatus?: string;
    workspaceArtifactId?: string;
    workspaceId?: string;
    workspaceAgentId?: string;
    workspacePathRef?: string;
    workspaceArtifactSummary?: string;
    workspaceArtifactSourcePressureRefs?: string[];
    workspaceBoundaryNote?: string;
    workspaceArtifactLastReview?: string;
    workspaceArtifactLastReviewSummary?: string;
    workspaceArtifactLastReviewedBy?: string;
    workspaceArtifactLastReviewRef?: string;
    workspaceArtifactReviewBoundaryNote?: string;
    skillCapsuleStatus?: string;
    skillCapsuleId?: string;
    skillAgentId?: string;
    skillLabel?: string;
    skillSummary?: string;
    skillTriggerHints?: string[];
    skillSideEffectKinds?: string[];
    skillApprovalRequired?: boolean;
    skillDisclosurePolicy?: string;
    skillInstructionRef?: string;
    skillInputContract?: string;
    skillOutputContract?: string;
    skillApprovalBoundaryNote?: string;
    skillCapsuleSourcePressureRefs?: string[];
    skillBoundaryNote?: string;
    skillCapsuleLastReview?: string;
    skillCapsuleLastReviewSummary?: string;
    skillCapsuleLastReviewedBy?: string;
    skillCapsuleLastReviewRef?: string;
    skillCapsuleReviewBoundaryNote?: string;
    capabilityState?: string;
    capabilityId?: string;
    capabilityAgentId?: string;
    capabilityType?: string;
    capabilityDomainTags?: string[];
    capabilityDeclaredConfidence?: number;
    capabilitySourcePressureRefs?: string[];
    capabilityLastReview?: string;
    capabilityLastReviewSummary?: string;
    capabilityLastReviewedBy?: string;
    capabilityLastReviewRef?: string;
    capabilityReviewBoundaryNote?: string;
    capabilityBoundaryNote?: string;
    turnRecoveryState?: string;
    turnRecoveryAgentId?: string;
    turnRecoveryInvitationId?: string;
    turnRecoveryPacketId?: string;
    turnRecoveryIntentionKind?: string;
    turnRecoveryContent?: string;
    turnRecoveryQuestion?: string;
    turnRecoveryReason?: string;
    turnRecoveryIntentionEventId?: string;
    turnRecoveryOriginalIntentionKind?: string;
    turnRecoveryBoundaryReason?: string;
    silenceAgentId?: string;
    silenceInvitationId?: string;
    silencePacketId?: string;
    silenceTriggeringEventId?: string;
    silenceReason?: string;
    silenceBoundaryNote?: string;
    pressureReason?: string;
    pressureMessageEventId?: string;
    pressureMessageId?: string;
    pressureActiveBackgroundTurns?: number;
    pressureQueuedBackgroundTurns?: number;
    pressureMaxConcurrentBackgroundTurns?: number;
    pressureBoundaryNote?: string;
    memoryPressureReason?: string;
    memoryPressureTopicId?: string;
    memoryPressureTriggeringMemoryId?: string;
    memoryPressurePendingProposalCount?: number;
    memoryPressureThreshold?: number;
    memoryPressureProposedMemoryRefs?: string[];
    memoryPressureBoundaryNote?: string;
    providerBoundaryAgentId?: string;
    providerBoundaryTopicId?: string;
    providerBoundaryTriggeringEventId?: string;
    providerBoundaryPacketId?: string;
    providerBoundaryKind?: string;
    providerBoundaryLabel?: string;
    providerBoundaryDiagnostic?: string;
    providerBoundaryState?: string;
    providerBoundaryRetiredBy?: string;
    providerBoundaryRetirementReason?: string;
    providerBoundaryNote?: string;
    providerBoundaryChoiceRepairRequestRefs?: string[];
    providerBoundaryChoiceDeniedRepairRefs?: string[];
    providerBoundaryChoiceApprovedRepairRefs?: string[];
    providerBoundaryChoiceResultRefs?: string[];
    providerBoundaryChoiceRetryProtocolRefs?: string[];
    providerBoundaryChoiceRetiredRetryProtocolRefs?: string[];
    providerBoundaryChoiceSilenceRefs?: string[];
    providerBoundaryChoiceContestedMemoryRefs?: string[];
    providerBoundaryChoiceArchiveCarryoverRefs?: string[];
    providerBoundaryChoiceAgentIds?: string[];
    providerBoundaryChoiceKindCount?: number;
    providerBoundaryChoiceHasMixedChoices?: boolean;
    providerBoundaryChoiceHasMultiAgentPressure?: boolean;
    providerBoundaryChoiceCarriedAcrossArchives?: boolean;
    providerBoundaryChoiceNote?: string;
    mixedReviewSourceMessageId?: string;
    mixedReviewTopicId?: string;
    mixedReviewAgentIds?: string[];
    mixedReviewResponseKindCounts?: Record<string, number>;
    mixedReviewObjectCount?: number;
    mixedReviewTouchedRefs?: string[];
    mixedReviewTouchedObjects?: string[];
    mixedReviewTraceEventRefs?: string[];
    mixedReviewBoundaryNote?: string;
    mixedReviewPressureLastReview?: string;
    mixedReviewPressureLastReviewSummary?: string;
    mixedReviewPressureLastReviewedBy?: string;
    mixedReviewPressureLastReviewRef?: string;
    mixedReviewPressureReviewBoundaryNote?: string;
    topicTitle?: string;
    topicSummary?: string;
    archiveDate?: string;
    archiveSummary?: string;
    archiveReadableSkeleton?: string;
    archiveReviewableSections?: string[];
    archiveOmittedReadableSections?: string[];
    archiveTimezone?: string;
    archiveCompressionNote?: string;
    archiveEventCount?: number;
    archiveMessageHighlightCount?: number;
    archiveDecisionCount?: number;
    archiveDisagreementCount?: number;
    archiveOpenQuestionCount?: number;
    archiveOpenQuestionTraceCount?: number;
    archiveMemoryChangeCount?: number;
    archiveTopicProposalCount?: number;
    archiveHandoffCount?: number;
    archiveProtocolCount?: number;
    archiveInvitationCount?: number;
    archiveSilenceCount?: number;
    archivePersonaDeltaCount?: number;
    archiveSideEffectBoundaryCount?: number;
    archiveWorkspaceBoundaryCount?: number;
    archiveWorkspaceArtifactCount?: number;
    archiveSkillCapsuleCount?: number;
    archiveCapabilityReviewCount?: number;
    archivePressureBoundaryCount?: number;
    archiveProviderBoundaryCount?: number;
    archiveMemoryPressureBoundaryCount?: number;
    archiveReviewTraceCount?: number;
    archiveReviewTraceTypes?: string[];
    archiveReviewSubjectRefs?: string[];
    archiveReviewEventRefs?: string[];
    archiveReviewBoundaryNote?: string;
    archiveMixedReviewPressureCount?: number;
    archiveMixedReviewSourceMessageRefs?: string[];
    archiveMixedReviewTouchedRefs?: string[];
    archiveMixedReviewTraceEventRefs?: string[];
    archiveMixedReviewBoundaryNote?: string;
    archiveMixedReviewPressureReviewCount?: number;
    archiveMixedReviewPressureReviewedRefs?: string[];
    archiveMixedReviewPressureReviewEventRefs?: string[];
    archiveMixedReviewPressureReviewResponses?: string[];
    archiveMixedReviewPressureReviewResponseKindCounts?: Record<string, number>;
    archiveMixedReviewPressureReviewAgentIds?: string[];
    archiveMixedReviewPressureReviewLatest?: string;
    archiveMixedReviewPressureReviewEvolutionNote?: string;
    archiveMixedReviewPressureReviewBoundaryNote?: string;
    archiveContestedCount?: number;
    archiveInputFromOffset?: number;
    archiveInputToOffset?: number;
    archiveRevisionOf?: string;
    archiveAppliedRepairRef?: string;
    archiveRevisionReason?: string;
    archiveProvenanceRefs?: string[];
    archiveRef?: string;
    archiveReviewAssessment?: string;
    archiveReviewSummary?: string;
    archiveReviewReason?: string;
    archiveRepairSummary?: string;
    archiveRepairReason?: string;
    archiveRepairProposedRepair?: string;
    archiveRepairRevisedFromRef?: string;
    archiveRepairRevisedBy?: string;
    archiveRepairStatus?: string;
    archiveRepairResponse?: string;
    archiveRepairResponseReason?: string;
    archiveRepairProposedRevision?: string;
    archiveRepairResponseAgentId?: string;
    archiveRepairReviewResponse?: string;
    archiveRepairReviewSummary?: string;
    archiveRepairReviewAgentId?: string;
    archiveRepairReviewSourceMessageId?: string;
    archiveRepairApplicationId?: string;
    archiveRepairAppliedBy?: string;
    archiveRepairRevisedArchiveRef?: string;
    archiveRepairAcceptedResponseRefs?: string[];
    archiveBoundaryNote?: string;
    topicParentTopicId?: string;
    topicMergedInto?: string;
    topicProposalAction?: string;
    topicProposalTitle?: string;
    topicProposalReason?: string;
    topicProposalCurrentTopicId?: string;
    topicProposalTargetTopicId?: string;
    topicProposalProposedBy?: string;
    topicProposalRevisedFromRef?: string;
    topicProposalRevisedBy?: string;
    topicProposalSourcePressureRefs?: string[];
    topicProposalRef?: string;
    topicProposalResponse?: string;
    topicProposalResponseReason?: string;
    topicProposalProposedRevision?: string;
    topicProposalRespondingAgentId?: string;
    topicProposalLastReview?: string;
    topicProposalLastReviewSummary?: string;
    topicProposalLastReviewedBy?: string;
    topicProposalLastReviewRef?: string;
    topicProposalReviewBoundaryNote?: string;
    topicProposalAppliedBy?: string;
    topicProposalApplicationReason?: string;
    topicProposalResultingTopicId?: string;
    topicProposalAppliedTopicEventIds?: string[];
    topicProposalBoundaryNote?: string;
    summaryText?: string;
    openQuestion?: string;
    openQuestionRefinedFromRef?: string;
    openQuestionRefinedBy?: string;
    openQuestionSourcePressureRefs?: string[];
    openQuestionResponseRefs?: string[];
    openQuestionResponseAgentIds?: string[];
    openQuestionResponseCount?: number;
    openQuestionResponseKindCounts?: Record<string, number>;
    openQuestionContestedCount?: number;
    openQuestionDeferredCount?: number;
    openQuestionRefinedCount?: number;
    openQuestionLastResponse?: string;
    openQuestionLastResponseSummary?: string;
    openQuestionLastResponseRef?: string;
    openQuestionResponseBoundaryNote?: string;
  };
  tags: string[];
  sourceRefs: RefId[];
};

type SourceEvidenceSnippet = {
  ref: RefId;
  refType: ContextRefType | "event";
  author?: string;
  eventId?: string;
  excerpt: string;
};

type MixedReviewContextTrace = {
  eventId: string;
  subject: string;
  targetRef: RefId;
  responderId: AgentId;
  response: string;
  topicId?: TopicId;
  sourceMessageId: RefId;
};

export type TopicWindowOptions = {
  maxMessageRefs?: number;
  maxAnchorRefs?: number;
  maxMemoryRefsPerState?: number;
  maxProtocolRefs?: number;
  maxHandoffRefs?: number;
  maxInvitationRefs?: number;
  maxArchiveRefs?: number;
  maxQuestionRefs?: number;
};

export type MemoryRefsByState = Record<MemoryState, RefId[]>;

export type TopicWindow = {
  topicId: TopicId;
  roomId: RoomId;
  status: "active" | "paused" | "merged" | "retired";
  title?: string;
  summaryRef?: RefId;
  parentTopicId?: TopicId;
  childTopicIds: TopicId[];
  mergedInto?: TopicId;
  messageRefs: RefId[];
  topicRefs: RefId[];
  anchorRefs: RefId[];
  openQuestionRefs: RefId[];
  memoryRefs: MemoryRefsByState;
  protocolProposalRefs: RefId[];
  protocolRefs: RefId[];
  handoffRefs: RefId[];
  invitationRefs: RefId[];
  archiveRefs: RefId[];
  lastUpdatedAt?: string;
};

export type TopicWindowView = {
  topics: TopicWindow[];
  refs: ContextRefRecord[];
};

export type ContextPacketBudget = {
  maxTokens: number;
  maxRefs: number;
  usedTokensEstimate: number;
  remainingTokensEstimate: number;
  omittedByType: Record<string, number>;
};

export type ContextPacketOmission = {
  refType: ContextRefType;
  count: number;
  reason: ContextFragmentOmissionReason;
};

export type ContextPacket = {
  packetId: string;
  roomId: RoomId;
  topicId: TopicId;
  purpose: ContextPurpose;
  recipientAgent?: AgentId;
  createdFromRef: RefId;
  budget: ContextPacketBudget;
  refs: {
    trigger: RefId[];
    recentWindow: RefId[];
    anchors: RefId[];
    memory: RefId[];
    protocols: RefId[];
    handoffs: RefId[];
    invitations: RefId[];
    archives: RefId[];
    personas: RefId[];
    sideEffects: RefId[];
    workspaceArtifacts: RefId[];
    skills: RefId[];
    capabilities: RefId[];
    turnRecovery: RefId[];
    silences: RefId[];
    pressureBoundaries: RefId[];
    memoryPressure: RefId[];
    providerBoundaries: RefId[];
    mixedReviewPressures: RefId[];
    topics: RefId[];
    openQuestions: RefId[];
  };
  omitted: ContextPacketOmission[];
  fragments: ContextFragment[];
  audit: ContextPacketAudit;
};

export type BuildContextPacketInput = {
  roomId: RoomId;
  topicId: TopicId;
  purpose: ContextPurpose;
  triggerRef: RefId;
  recipientAgent?: AgentId;
  maxTokens: number;
  maxRefs: number;
  relevantRefs?: RefId[];
  ambientArchiveRefs?: RefId[];
  packetId?: string;
};

const DEFAULT_TOPIC_WINDOW_OPTIONS: Required<TopicWindowOptions> = {
  maxMessageRefs: 40,
  maxAnchorRefs: 16,
  maxMemoryRefsPerState: 24,
  maxProtocolRefs: 12,
  maxHandoffRefs: 12,
  maxInvitationRefs: 12,
  maxArchiveRefs: 8,
  maxQuestionRefs: 12,
};

const MEMORY_STATES: MemoryState[] = [
  "observed",
  "proposed",
  "contested",
  "accepted",
  "stale",
  "retired",
];

const FRAGMENT_HARD_CAPS: Record<string, number> = {
  budget: 256,
  trigger: 1_000,
  topic_rule: 1_000,
  topic_summary: 1_000,
  anchor: 3_000,
  open_question: 1_000,
  memory_contested: 2_000,
  memory_accepted: 1_500,
  memory_relevant: 1_500,
  protocol_proposal: 1_000,
  protocol_active: 1_000,
  persona_delta: 1_000,
  handoff_packet: 1_000,
  invitation_packet: 1_000,
  side_effect_boundary: 1_000,
  workspace_artifact_ref: 1_000,
  skill_capsule_ref: 1_000,
  capability_ref: 1_000,
  deferred_intention: 1_000,
  silence_ref: 1_000,
  pressure_boundary: 1_000,
  memory_pressure_boundary: 1_000,
  provider_boundary: 1_000,
  mixed_review_pressure: 1_000,
  daily_archive_ref: 2_000,
  recent_message: 3_000,
};

const FRAGMENT_PRIORITY: Record<string, number> = {
  trigger: 0,
  budget: 5,
  topic_rule: 10,
  topic_summary: 15,
  anchor: 20,
  open_question: 25,
  memory_contested: 30,
  protocol_proposal: 38,
  protocol_active: 40,
  handoff_packet: 45,
  invitation_packet: 46,
  side_effect_boundary: 47,
  workspace_artifact_ref: 48,
  skill_capsule_ref: 49,
  capability_ref: 50,
  deferred_intention: 51,
  silence_ref: 52,
  pressure_boundary: 35,
  memory_pressure_boundary: 36,
  provider_boundary: 37,
  mixed_review_pressure: 34,
  memory_accepted: 50,
  memory_relevant: 55,
  daily_archive_ref: 33,
  recent_message: 80,
};

export class ContextRefIndex implements Projection<ContextRefRecord[]> {
  private readonly records = new Map<RefId, ContextRefRecord>();
  private readonly evidenceByRef = new Map<RefId, SourceEvidenceSnippet>();
  private readonly mixedReviewGroups = new Map<string, MixedReviewContextTrace[]>();
  private nextCursor = 0;

  static fromEvents(events: RoomEvent[]): ContextRefIndex {
    const index = new ContextRefIndex();
    events.forEach((event, cursor) => index.apply(event, cursor));
    return index;
  }

  apply(event: RoomEvent, ledgerCursor = this.nextCursor): void {
    this.nextCursor = Math.max(this.nextCursor, ledgerCursor + 1);

    const payload = objectPayload(event.payload);
    const topicId =
      stringValue(payload.topicId) ??
      stringValue(payload.topic_id) ??
      stringValue(payload.currentTopicId) ??
      stringValue(payload.current_topic_id);
    const sourceRefs = refsFromPayload(payload, event.refs);
    this.captureEventEvidence(event, payload);
    this.applyProviderBoundaryChoicePressure(event, payload, topicId, sourceRefs, ledgerCursor);
    this.applyMixedReviewPressure(event, payload, topicId, sourceRefs, ledgerCursor);

    if (event.event_type === "mixed_review_pressure.reviewed") {
      const pressureRef =
        stringValue(payload.pressureRef) ??
        stringValue(payload.pressure_ref) ??
        stringValue(payload.mixedReviewPressureRef) ??
        stringValue(payload.mixed_review_pressure_ref) ??
        event.refs.find((ref) => ref.startsWith("mixed_review:"));
      if (!pressureRef) return;
      const existing = this.records.get(pressureRef);
      const states = cleanStates({
        ...(existing?.states ?? {}),
        mixedReviewPressureLastReview: stringValue(payload.response) ?? "reviewed",
        mixedReviewPressureLastReviewSummary: boundedString(stringValue(payload.summary), 1_000),
        mixedReviewPressureLastReviewedBy: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
        mixedReviewPressureLastReviewRef: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
        mixedReviewPressureReviewBoundaryNote:
          stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          "mixed review pressure review is a social trace; it does not close, narrow, retire, delete, resolve, or mutate the underlying pressure",
      });
      this.upsert({
        refId: pressureRef,
        refType: "mixed_review_pressure",
        roomId: event.room_id,
        topicId: topicId ?? existing?.topicId ?? this.findTopicForRefs(sourceRefs),
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
        tokenEstimate: mixedReviewPressureTokenEstimate(states),
        createdAt: existing?.createdAt ?? event.occurred_at,
        availability: existing?.availability ?? "available",
        states,
        tags: unique((existing?.tags ?? ["mixed_review_pressure", "social_review_pressure"]).concat("mixed_review_pressure_review")),
        sourceRefs: unique([event.event_id, pressureRef, ...sourceRefs]),
      });
      return;
    }

    if (event.event_type === "message.created") {
      const messageId = stringValue(payload.messageId) ?? stringValue(payload.message_id);
      if (!messageId) return;
      this.upsert({
        refId: messageId,
        refType: "message",
        roomId: event.room_id,
        topicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.author) ?? event.actor.id,
        tokenEstimate: estimateTokens(stringValue(payload.content) ?? ""),
        createdAt: event.occurred_at,
        availability: "available",
        evidenceText: boundedString(stringValue(payload.content), 500),
        states: {},
        tags: ["message"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "topic.created" || event.event_type === "topic.updated") {
      const id = topicId;
      if (!id) return;
      this.upsert({
        refId: id,
        refType: "topic",
        roomId: event.room_id,
        topicId: id,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: event.actor.id,
        tokenEstimate: topicTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: "available",
        evidenceText: boundedString(
          [stringValue(payload.title), stringValue(payload.summary), stringValue(payload.openQuestion) ?? stringValue(payload.open_question)]
            .filter(Boolean)
            .join(" "),
          500,
        ),
        states: topicStatesFromPayload(payload),
        tags: ["topic"],
        sourceRefs,
      });

      const summaryRef = stringValue(payload.summaryRef) ?? stringValue(payload.summary_ref);
      if (summaryRef) {
        this.upsert(summaryRecord(event, ledgerCursor, summaryRef, id, sourceRefs));
      }

      const openQuestionRef = stringValue(payload.openQuestionRef) ?? stringValue(payload.open_question_ref);
      if (openQuestionRef) {
        this.upsert(questionRecord(event, ledgerCursor, openQuestionRef, id, sourceRefs));
      }
      return;
    }

    if (event.event_type === "open_question.responded") {
      const questionRef =
        stringValue(payload.questionRef) ??
        stringValue(payload.question_ref) ??
        stringValue(payload.openQuestionRef) ??
        stringValue(payload.open_question_ref);
      if (!questionRef) return;
      const existing = this.records.get(questionRef);
      const inferredTopicId = topicId ?? existing?.topicId ?? this.findTopicForRefs(sourceRefs);
      const states = openQuestionResponseStates(existing?.states ?? {}, payload);
      this.upsert({
        refId: questionRef,
        refType: "question",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
        tokenEstimate: estimateTokens(
          [states.openQuestion, states.openQuestionLastResponseSummary].filter(Boolean).join("\n"),
        ),
        createdAt: existing?.createdAt ?? event.occurred_at,
        availability: "available",
        states,
        tags: unique((existing?.tags ?? ["question"]).concat("question_response")),
        sourceRefs: unique([event.event_id, questionRef, ...sourceRefs]),
      });
      return;
    }

    if (
      event.event_type === "topic.proposed" ||
      event.event_type === "topic.responded" ||
      event.event_type === "topic.reviewed" ||
      event.event_type === "topic.applied"
    ) {
      const proposalId =
        event.event_type === "topic.applied"
          ? stringValue(payload.topicProposalRef) ??
            stringValue(payload.topic_proposal_ref) ??
            stringValue(payload.proposalId) ??
            stringValue(payload.proposal_id) ??
            event.event_id
          : event.event_type === "topic.reviewed"
            ? stringValue(payload.topicProposalRef) ??
              stringValue(payload.topic_proposal_ref) ??
              stringValue(payload.proposalId) ??
              stringValue(payload.proposal_id) ??
              event.refs[2] ??
              event.event_id
          : event.event_type === "topic.responded"
            ? stringValue(payload.responseId) ??
              stringValue(payload.response_id) ??
              stringValue(payload.topicProposalRef) ??
              stringValue(payload.topic_proposal_ref) ??
              event.event_id
          : stringValue(payload.proposalId) ??
            stringValue(payload.proposal_id) ??
            stringValue(payload.topicProposalId) ??
            stringValue(payload.topic_proposal_id) ??
            event.event_id;
      const proposalTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: proposalId,
        refType: "topic",
        roomId: event.room_id,
        topicId: proposalTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: event.actor.id,
        tokenEstimate: topicProposalTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: "available",
        states: topicProposalStatesFromPayload(event, payload),
        tags: [
          "topic",
          ...(event.event_type === "topic.applied" || event.event_type === "topic.reviewed" ? ["topic_proposal"] : []),
          event.event_type === "topic.responded"
            ? "topic_proposal_response"
            : event.event_type === "topic.reviewed"
              ? "topic_proposal_review"
              : event.event_type === "topic.applied"
                ? "topic_proposal_application"
                : "topic_proposal",
          ...optionalTag(stringValue(payload.action)),
        ],
        sourceRefs,
      });
      return;
    }

    if (event.event_type.startsWith("protocol.")) {
      const protocolId =
        stringValue(payload.protocolId) ??
        stringValue(payload.protocol_id) ??
        stringValue(payload.protocolRef) ??
        stringValue(payload.protocol_ref) ??
        stringValue(payload.proposalId) ??
        stringValue(payload.proposal_id);
      if (!protocolId) return;
      this.upsert({
        refId: protocolId,
        refType: "protocol",
        roomId: event.room_id,
        topicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: event.actor.id,
        tokenEstimate: protocolTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: protocolIsInactive(stringValue(payload.status)) ? "retired" : "available",
        evidenceText: evidenceTextFromPayload(payload),
        states: protocolStatesFromPayload(event, payload),
        tags: ["protocol"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type.startsWith("memory.")) {
      const memoryId =
        stringValue(payload.memoryId) ??
        stringValue(payload.memory_id) ??
        stringValue(payload.memoryRef) ??
        stringValue(payload.memory_ref);
      if (!memoryId) return;
      const memoryState = memoryStateFromEvent(event.event_type);
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: memoryId,
        refType: "memory",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: event.actor.id,
        tokenEstimate: estimateTokens(stringValue(payload.summary) ?? stringValue(payload.reason) ?? ""),
        createdAt: event.occurred_at,
        availability: memoryState === "retired" ? "retired" : "available",
        evidenceText: boundedString(
          [stringValue(payload.summary), stringValue(payload.reason), stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note)]
            .filter(Boolean)
            .join(" "),
          500,
        ),
        states: memoryStatesFromPayload(memoryState, payload),
        tags: ["memory", ...(memoryState ? [memoryState] : [])],
        sourceRefs,
      });
      return;
    }

    if (event.event_type.startsWith("persona_delta.")) {
      const deltaId =
        stringValue(payload.deltaId) ??
        stringValue(payload.delta_id) ??
        stringValue(payload.deltaRef) ??
        stringValue(payload.delta_ref) ??
        stringValue(payload.personaDeltaRef) ??
        stringValue(payload.persona_delta_ref);
      if (!deltaId) return;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: deltaId,
        refType: "persona_delta",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: event.actor.id,
        tokenEstimate: personaDeltaTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: personaDeltaIsInactive(stringValue(payload.status) ?? stringValue(payload.response)) ? "retired" : "available",
        evidenceText: personaDeltaEvidenceText(payload),
        states: personaDeltaStatesFromPayload(event, payload),
        tags: ["persona_delta"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type.startsWith("handoff.")) {
      const handoffId =
        stringValue(payload.handoffId) ??
        stringValue(payload.handoff_id) ??
        stringValue(payload.handoffRef) ??
        stringValue(payload.handoff_ref);
      if (!handoffId) return;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: handoffId,
        refType: "handoff",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: event.actor.id,
        tokenEstimate: handoffTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: handoffIsInactive(stringValue(payload.status) ?? event.event_type) ? "retired" : "available",
        evidenceText: boundedString(
          [
            stringValue(payload.reason),
            stringValue(payload.requestedResponse) ?? stringValue(payload.requested_response),
            stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
          ]
            .filter(Boolean)
            .join(" "),
          700,
        ),
        states: handoffStatesFromPayload(event, payload),
        tags: ["handoff"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "agent.invited" && stringValue(payload.invitedBy) === "agent_intention") {
      const invitationId =
        stringValue(payload.invitationId) ?? stringValue(payload.invitation_id) ?? event.event_id;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: invitationId,
        refType: "invitation",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: event.actor.id,
        tokenEstimate: invitationTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: "available",
        states: invitationStatesFromPayload(event, payload),
        tags: ["invitation"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "agent.invitation_responded" || event.event_type === "agent.invitation_reviewed") {
      const invitationId =
        stringValue(payload.invitationRef) ??
        stringValue(payload.invitation_ref) ??
        stringValue(payload.invitationId) ??
        stringValue(payload.invitation_id);
      if (!invitationId) return;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: invitationId,
        refType: "invitation",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
        tokenEstimate: invitationTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: "available",
        states: invitationStatesFromPayload(event, payload),
        tags: event.event_type === "agent.invitation_reviewed" ? ["invitation", "invitation_review"] : ["invitation", "invitation_response"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "agent.intention_recorded" && isDeliberateSilencePayload(payload)) {
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: event.event_id,
        refType: "silence",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.agentId) ?? event.actor.id,
        tokenEstimate: silenceTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: "available",
        states: silenceStatesFromPayload(payload),
        tags: ["silence", "agent_intention"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "agent.intention_recorded" || event.event_type === "agent.intention_deferred") {
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: event.event_id,
        refType: "turn_recovery",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.agentId) ?? event.actor.id,
        tokenEstimate: turnRecoveryTokenEstimate(event, payload),
        createdAt: event.occurred_at,
        availability: "available",
        states: turnRecoveryStatesFromPayload(event, payload),
        tags: ["turn_recovery", event.event_type],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "room.pressure_detected") {
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: event.event_id,
        refType: "pressure_boundary",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: event.actor.id,
        tokenEstimate: pressureBoundaryTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: "available",
        states: pressureBoundaryStatesFromPayload(payload),
        tags: ["pressure_boundary", "bandwidth"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "room.memory_pressure_detected") {
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: event.event_id,
        refType: "memory_pressure",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: event.actor.id,
        tokenEstimate: memoryPressureTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: "available",
        states: memoryPressureStatesFromPayload(payload),
        tags: ["memory_pressure", "memory_pollution_boundary"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "agent.provider_degraded") {
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      const boundaryRef = stringValue(payload.degradationId) ?? stringValue(payload.degradation_id) ?? event.event_id;
      this.upsert({
        refId: boundaryRef,
        refType: "provider_boundary",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.agentId) ?? event.actor.id,
        tokenEstimate: providerBoundaryTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: "available",
        states: providerBoundaryStatesFromPayload(payload),
        tags: ["provider_boundary", "runtime_boundary"],
        sourceRefs: unique([event.event_id, ...sourceRefs]),
      });
      return;
    }

    if (event.event_type === "provider_boundary.retired") {
      const boundaryRef =
        stringValue(payload.providerBoundaryRef) ??
        stringValue(payload.provider_boundary_ref) ??
        stringValue(payload.boundaryRef) ??
        stringValue(payload.boundary_ref);
      if (boundaryRef === undefined) {
        return;
      }
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: boundaryRef,
        refType: "provider_boundary",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.retiredBy) ?? stringValue(payload.retired_by) ?? event.actor.id,
        tokenEstimate: providerBoundaryTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: "retired",
        states: providerBoundaryStatesFromPayload(payload),
        tags: ["provider_boundary", "runtime_boundary", "retired"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type.startsWith("side_effect.")) {
      const sideEffectId =
        stringValue(payload.requestId) ??
        stringValue(payload.request_id) ??
        stringValue(payload.sideEffectRef) ??
        stringValue(payload.side_effect_ref) ??
        stringValue(payload.approvalId) ??
        stringValue(payload.approval_id) ??
        event.refs[0] ??
        event.event_id;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: sideEffectId,
        refType: "side_effect",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: event.actor.id,
        tokenEstimate: sideEffectTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: event.event_type === "side_effect.expired" ? "retired" : "available",
        states: sideEffectStatesFromPayload(event, payload),
        tags: ["side_effect", event.event_type.replace("side_effect.", "")],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "workspace.artifact_shared" || event.event_type === "workspace.artifact_reviewed") {
      const artifactId =
        stringValue(payload.artifactId) ??
        stringValue(payload.artifact_id) ??
        stringValue(payload.artifactRef) ??
        stringValue(payload.artifact_ref);
      if (!artifactId) return;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: artifactId,
        refType: "workspace_artifact",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: event.actor.id,
        tokenEstimate: workspaceArtifactTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: "available",
        states: workspaceArtifactStatesFromPayload(event, payload),
        tags:
          event.event_type === "workspace.artifact_reviewed"
            ? ["workspace_artifact", "workspace_artifact_review"]
            : ["workspace_artifact"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "skill.capsule_registered" || event.event_type === "skill.capsule_reviewed") {
      const capsuleId =
        stringValue(payload.capsuleId) ??
        stringValue(payload.capsule_id) ??
        stringValue(payload.capsuleRef) ??
        stringValue(payload.capsule_ref);
      if (!capsuleId) return;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: capsuleId,
        refType: "skill_capsule",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
        tokenEstimate: skillCapsuleTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: "available",
        states: skillCapsuleStatesFromPayload(event, payload),
        tags:
          event.event_type === "skill.capsule_reviewed"
            ? ["skill_capsule", "skill_capsule_review"]
            : ["skill_capsule"],
        sourceRefs,
      });
      return;
    }

    if (
      event.event_type === "capability_card.upserted" ||
      event.event_type === "capability_card.outcome_recorded" ||
      event.event_type === "capability.reviewed"
    ) {
      const capabilityId =
        stringValue(payload.capabilityId) ??
        stringValue(payload.capability_id) ??
        stringValue(payload.capabilityRef) ??
        stringValue(payload.capability_ref);
      if (!capabilityId) return;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      this.upsert({
        refId: capabilityId,
        refType: "capability",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
        tokenEstimate: capabilityTokenEstimate(payload),
        createdAt: event.occurred_at,
        availability: "available",
        states: capabilityStatesFromPayload(event, payload),
        tags:
          event.event_type === "capability.reviewed"
            ? ["capability", "capability_review"]
            : ["capability"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "archive.review_requested") {
      const requestId = stringValue(payload.requestId) ?? stringValue(payload.request_id) ?? event.event_id;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      const states = archiveReviewRequestStatesFromPayload(payload);
      this.upsert({
        refId: requestId,
        refType: "archive",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.requestedBy) ?? stringValue(payload.requested_by) ?? event.actor.id,
        tokenEstimate: archiveSocialTokenEstimate(states),
        createdAt: event.occurred_at,
        availability: "available",
        states,
        tags: ["archive", "archive_review_request"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "archive.reviewed") {
      const reviewId = stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      const states = archiveReviewStatesFromPayload(payload);
      this.upsert({
        refId: reviewId,
        refType: "archive",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.reviewedBy) ?? stringValue(payload.reviewed_by) ?? event.actor.id,
        tokenEstimate: archiveSocialTokenEstimate(states),
        createdAt: event.occurred_at,
        availability: "available",
        states,
        tags: ["archive", "archive_review"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "archive.repair_proposed") {
      const repairId = stringValue(payload.repairId) ?? stringValue(payload.repair_id) ?? event.event_id;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      const states = archiveRepairProposalStatesFromPayload(payload);
      this.upsert({
        refId: repairId,
        refType: "archive",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by) ?? event.actor.id,
        tokenEstimate: archiveSocialTokenEstimate(states),
        createdAt: event.occurred_at,
        availability: "available",
        states,
        tags: ["archive", "archive_repair_proposal"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "archive.repair_responded") {
      const responseId = stringValue(payload.responseId) ?? stringValue(payload.response_id) ?? event.event_id;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      const states = archiveRepairResponseStatesFromPayload(payload);
      this.upsert({
        refId: responseId,
        refType: "archive",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
        tokenEstimate: archiveSocialTokenEstimate(states),
        createdAt: event.occurred_at,
        availability: archiveRepairResponseIsInactive(stringValue(payload.status) ?? stringValue(payload.response))
          ? "retired"
          : "available",
        states,
        tags: ["archive", "archive_repair_response"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "archive.repair_reviewed") {
      const reviewId = stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id;
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      const states = archiveRepairReviewStatesFromPayload(payload);
      this.upsert({
        refId: reviewId,
        refType: "archive",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
        tokenEstimate: archiveSocialTokenEstimate(states),
        createdAt: event.occurred_at,
        availability: "available",
        states,
        tags: ["archive", "archive_repair_review"],
        sourceRefs,
      });
      return;
    }

    if (event.event_type === "archive.repair_applied") {
      const applicationId = stringValue(payload.applicationId) ?? stringValue(payload.application_id) ?? event.event_id;
      const revisedArchiveRef = stringValue(payload.revisedArchiveRef) ?? stringValue(payload.revised_archive_ref);
      const inferredTopicId = topicId ?? this.findTopicForRefs(sourceRefs);
      const states = archiveRepairApplicationStatesFromPayload(payload);
      this.upsert({
        refId: applicationId,
        refType: "archive",
        roomId: event.room_id,
        topicId: inferredTopicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: stringValue(payload.appliedBy) ?? stringValue(payload.applied_by) ?? event.actor.id,
        tokenEstimate: archiveSocialTokenEstimate(states),
        createdAt: event.occurred_at,
        availability: "available",
        states,
        tags: ["archive", "archive_repair_application"],
        sourceRefs,
      });
      if (revisedArchiveRef) {
        this.upsert({
          refId: revisedArchiveRef,
          refType: "archive",
          roomId: event.room_id,
          topicId: inferredTopicId,
          sourceEventId: event.event_id,
          ledgerCursor,
          author: stringValue(payload.appliedBy) ?? stringValue(payload.applied_by) ?? event.actor.id,
          tokenEstimate: archiveSocialTokenEstimate(states),
          createdAt: event.occurred_at,
          availability: "available",
          states,
          tags: ["archive", "archive_repair_application"],
          sourceRefs,
        });
      }
      return;
    }

    if (event.event_type === "daily_archive.created") {
      const archivePayload = archiveObjectPayload(payload);
      const archiveId = archiveIdFromPayload(event, archivePayload);
      const states = archiveStatesFromPayload(event, archivePayload);
      this.upsert({
        refId: archiveId,
        refType: "archive",
        roomId: event.room_id,
        topicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: event.actor.id,
        tokenEstimate: archiveTokenEstimate(states),
        createdAt: event.occurred_at,
        availability: "available",
        states,
        tags: ["archive"],
        sourceRefs,
      });
    }
  }

  private applyProviderBoundaryChoicePressure(
    event: RoomEvent,
    payload: Record<string, unknown>,
    topicId: TopicId | undefined,
    sourceRefs: RefId[],
    ledgerCursor: number,
  ): void {
    const updates = providerBoundaryChoiceUpdatesForEvent(event, payload, sourceRefs, this.records);
    for (const update of updates) {
      const existing = this.records.get(update.boundaryRef);
      if (!existing || existing.refType !== "provider_boundary") {
        continue;
      }
      const states = providerBoundaryChoiceStates(existing.states, update);
      this.upsert({
        ...existing,
        topicId: existing.topicId ?? topicId,
        sourceEventId: event.event_id,
        ledgerCursor,
        author: update.agentId ?? existing.author,
        tokenEstimate: providerBoundaryStatesTokenEstimate(states),
        availability: existing.availability,
        states,
        tags: unique(existing.tags.concat("choice_pressure")),
        sourceRefs: unique([event.event_id, update.refId, ...sourceRefs]),
      });
    }
  }

  private applyMixedReviewPressure(
    event: RoomEvent,
    payload: Record<string, unknown>,
    topicId: TopicId | undefined,
    sourceRefs: RefId[],
    ledgerCursor: number,
  ): void {
    const trace = mixedReviewTraceFromEvent(event, payload, topicId);
    if (!trace) {
      return;
    }
    const correlation = event.correlation_id ?? event.event_id;
    const key = `mixed_social_review:${correlation}:${trace.sourceMessageId}`;
    const traces = (this.mixedReviewGroups.get(key) ?? []).filter((item) => item.eventId !== trace.eventId);
    traces.push(trace);
    this.mixedReviewGroups.set(key, traces);
    if (!isMixedReviewPressureGroup(traces)) {
      return;
    }

    const pressureRef = mixedReviewPressureRef(trace.sourceMessageId, correlation);
    const states = mixedReviewPressureStatesFromTraces(traces);
    const inferredTopicId = trace.topicId ?? topicId ?? traces.find((item) => item.topicId)?.topicId ?? this.findTopicForRefs(sourceRefs);
    this.upsert({
      refId: pressureRef,
      refType: "mixed_review_pressure",
      roomId: event.room_id,
      topicId: inferredTopicId,
      sourceEventId: event.event_id,
      ledgerCursor,
      author: trace.responderId,
      tokenEstimate: mixedReviewPressureTokenEstimate(states),
      createdAt: event.occurred_at,
      availability: "available",
      states,
      tags: ["mixed_review_pressure", "social_review_pressure"],
      sourceRefs: unique(
        [
          trace.sourceMessageId,
          ...traces.map((item) => item.eventId),
          ...traces.map((item) => item.targetRef),
          ...sourceRefs,
        ].filter((ref): ref is RefId => Boolean(ref)),
      ),
    });
  }

  upsert(record: ContextRefRecord): void {
    const existing = this.records.get(record.refId);
    this.records.set(record.refId, existing ? mergeRefRecord(existing, record) : record);
    const stored = this.records.get(record.refId);
    if (stored?.evidenceText) {
      this.evidenceByRef.set(stored.refId, {
        ref: stored.refId,
        refType: stored.refType,
        author: stored.author,
        eventId: stored.sourceEventId,
        excerpt: stored.evidenceText,
      });
    }
  }

  get(refId: RefId): ContextRefRecord | undefined {
    return this.records.get(refId);
  }

  findTopicForRefs(refs: RefId[]): TopicId | undefined {
    for (const ref of refs) {
      const record = this.records.get(ref);
      if (record?.topicId) return record.topicId;
    }
    return undefined;
  }

  view(): ContextRefRecord[] {
    return [...this.records.values()].sort(compareRefRecords);
  }

  sourceEvidenceForRefs(
    refs: readonly RefId[],
    options: { excludeRef?: RefId; limit?: number; maxExcerptLength?: number } = {},
  ): SourceEvidenceSnippet[] {
    const limit = options.limit ?? 4;
    const maxExcerptLength = options.maxExcerptLength ?? 220;
    const snippets: SourceEvidenceSnippet[] = [];
    const seen = new Set<RefId>();
    for (const ref of refs) {
      if (ref === options.excludeRef || seen.has(ref)) continue;
      const snippet = this.evidenceByRef.get(ref);
      if (!snippet) continue;
      seen.add(ref);
      snippets.push({
        ...snippet,
        excerpt: truncateText(snippet.excerpt, maxExcerptLength),
      });
      if (snippets.length >= limit) break;
    }
    return snippets;
  }

  private captureEventEvidence(event: RoomEvent, payload: Record<string, unknown>): void {
    const text = evidenceTextFromPayload(payload);
    if (!text) return;
    this.evidenceByRef.set(event.event_id, {
      ref: event.event_id,
      refType: "event",
      author: event.actor.id,
      eventId: event.event_id,
      excerpt: text,
    });
  }
}

export class TopicWindowStore implements Projection<TopicWindowView> {
  readonly refIndex = new ContextRefIndex();

  private readonly topics = new Map<TopicId, TopicWindow>();
  private readonly options: Required<TopicWindowOptions>;
  private nextCursor = 0;

  constructor(options: TopicWindowOptions = {}) {
    this.options = { ...DEFAULT_TOPIC_WINDOW_OPTIONS, ...options };
  }

  static fromEvents(events: RoomEvent[], options: TopicWindowOptions = {}): TopicWindowStore {
    const store = new TopicWindowStore(options);
    events.forEach((event, cursor) => store.apply(event, cursor));
    return store;
  }

  apply(event: RoomEvent, ledgerCursor = this.nextCursor): void {
    this.nextCursor = Math.max(this.nextCursor, ledgerCursor + 1);
    this.refIndex.apply(event, ledgerCursor);

    const payload = objectPayload(event.payload);
    const topicId =
      stringValue(payload.topicId) ??
      stringValue(payload.topic_id) ??
      stringValue(payload.currentTopicId) ??
      stringValue(payload.current_topic_id);
    const sourceRefs = refsFromPayload(payload, event.refs);

    if (event.event_type === "topic.created" && topicId) {
      const window = this.ensureTopic(topicId, event.room_id);
      window.title = stringValue(payload.title) ?? window.title;
      window.parentTopicId = stringValue(payload.parentTopicId) ?? stringValue(payload.parent_topic_id);
      window.status = "active";
      if (window.parentTopicId) {
        pushUniqueBounded(
          this.ensureTopic(window.parentTopicId, event.room_id).childTopicIds,
          topicId,
          this.options.maxAnchorRefs,
        );
      }
      const createdFrom =
        stringValue(payload.createdFromMessageId) ??
        stringValue(payload.created_from_message_id) ??
        stringValue(payload.createdFrom);
      pushUniqueBounded(window.topicRefs, topicId, this.options.maxAnchorRefs);
      if (createdFrom) pushUniqueBounded(window.anchorRefs, createdFrom, this.options.maxAnchorRefs);
      window.lastUpdatedAt = event.occurred_at;
      return;
    }

    if (event.event_type === "topic.updated" && topicId) {
      const window = this.ensureTopic(topicId, event.room_id);
      window.status = topicStatusFromPayload(payload) ?? window.status;
      window.summaryRef = stringValue(payload.summaryRef) ?? stringValue(payload.summary_ref) ?? window.summaryRef;
      window.mergedInto = stringValue(payload.mergedInto) ?? stringValue(payload.merged_into) ?? window.mergedInto;
      const messageId = stringValue(payload.messageId) ?? stringValue(payload.message_id);
      if (messageId) pushUniqueBounded(window.messageRefs, messageId, this.options.maxMessageRefs);
      const openQuestionRef =
        stringValue(payload.openQuestionRef) ??
        stringValue(payload.open_question_ref) ??
        (stringValue(payload.openQuestion) || stringValue(payload.open_question) ? event.event_id : undefined);
      if (openQuestionRef) {
        pushUniqueBounded(window.openQuestionRefs, openQuestionRef, this.options.maxQuestionRefs);
      }
      window.lastUpdatedAt = event.occurred_at;
      return;
    }

    if (event.event_type === "open_question.responded" && topicId) {
      const questionRef =
        stringValue(payload.questionRef) ??
        stringValue(payload.question_ref) ??
        stringValue(payload.openQuestionRef) ??
        stringValue(payload.open_question_ref);
      if (questionRef) {
        pushUniqueBounded(this.ensureTopic(topicId, event.room_id).openQuestionRefs, questionRef, this.options.maxQuestionRefs);
      }
      this.ensureTopic(topicId, event.room_id).lastUpdatedAt = event.occurred_at;
      return;
    }

    if (
      event.event_type === "topic.proposed" ||
      event.event_type === "topic.responded" ||
      event.event_type === "topic.reviewed" ||
      event.event_type === "topic.applied"
    ) {
      const proposalId =
        event.event_type === "topic.applied"
          ? stringValue(payload.topicProposalRef) ??
            stringValue(payload.topic_proposal_ref) ??
            stringValue(payload.proposalId) ??
            stringValue(payload.proposal_id) ??
            event.event_id
          : event.event_type === "topic.reviewed"
            ? stringValue(payload.topicProposalRef) ??
              stringValue(payload.topic_proposal_ref) ??
              stringValue(payload.proposalId) ??
              stringValue(payload.proposal_id) ??
              event.refs[2] ??
              event.event_id
          : event.event_type === "topic.responded"
            ? stringValue(payload.responseId) ??
              stringValue(payload.response_id) ??
              stringValue(payload.topicProposalRef) ??
              stringValue(payload.topic_proposal_ref) ??
              event.event_id
          : stringValue(payload.proposalId) ??
            stringValue(payload.proposal_id) ??
            stringValue(payload.topicProposalId) ??
            stringValue(payload.topic_proposal_id) ??
            event.event_id;
      const proposalTopicId = topicId ?? this.refIndex.findTopicForRefs(sourceRefs);
      if (!proposalTopicId) return;
      const window = this.ensureTopic(proposalTopicId, event.room_id);
      pushUniqueBounded(window.topicRefs, proposalId, this.options.maxAnchorRefs);
      window.lastUpdatedAt = event.occurred_at;
      return;
    }

    if (event.event_type === "message.created" && topicId) {
      const messageId = stringValue(payload.messageId) ?? stringValue(payload.message_id);
      if (!messageId) return;
      const window = this.ensureTopic(topicId, event.room_id);
      pushUniqueBounded(window.messageRefs, messageId, this.options.maxMessageRefs);
      for (const ref of sourceRefs) {
        pushUniqueBounded(window.anchorRefs, ref, this.options.maxAnchorRefs);
      }
      const replyTo = stringValue(payload.replyTo) ?? stringValue(payload.reply_to);
      if (replyTo) pushUniqueBounded(window.anchorRefs, replyTo, this.options.maxAnchorRefs);
      window.lastUpdatedAt = event.occurred_at;
      return;
    }

    if (event.event_type.startsWith("protocol.") && topicId) {
      const protocolId =
        stringValue(payload.protocolId) ??
        stringValue(payload.protocol_id) ??
        stringValue(payload.proposalId) ??
        stringValue(payload.proposal_id);
      if (!protocolId) return;
      const window = this.ensureTopic(topicId, event.room_id);
      const placement = protocolContextPlacement(event.event_type, stringValue(payload.status), stringValue(payload.response));
      if (placement === "inactive") {
        removeValue(window.protocolRefs, protocolId);
        removeValue(window.protocolProposalRefs, protocolId);
      } else if (placement === "active") {
        removeValue(window.protocolProposalRefs, protocolId);
        pushUniqueBounded(window.protocolRefs, protocolId, this.options.maxProtocolRefs);
      } else {
        removeValue(window.protocolRefs, protocolId);
        pushUniqueBounded(window.protocolProposalRefs, protocolId, this.options.maxProtocolRefs);
      }
      window.lastUpdatedAt = event.occurred_at;
      return;
    }

    if (event.event_type.startsWith("handoff.")) {
      const handoffId =
        stringValue(payload.handoffId) ??
        stringValue(payload.handoff_id) ??
        stringValue(payload.handoffRef) ??
        stringValue(payload.handoff_ref);
      if (!handoffId) return;
      const handoffTopicId = topicId ?? this.refIndex.findTopicForRefs(sourceRefs);
      if (!handoffTopicId) return;
      const window = this.ensureTopic(handoffTopicId, event.room_id);
      const status = stringValue(payload.status) ?? handoffStateFromResponse(stringValue(payload.response)) ?? event.event_type;
      if (handoffIsInactive(status)) {
        removeValue(window.handoffRefs, handoffId);
      } else {
        pushUniqueBounded(window.handoffRefs, handoffId, this.options.maxHandoffRefs);
      }
      window.lastUpdatedAt = event.occurred_at;
      return;
    }

    if (
      (event.event_type === "agent.invited" && stringValue(payload.invitedBy) === "agent_intention") ||
      event.event_type === "agent.invitation_responded" ||
      event.event_type === "agent.invitation_reviewed"
    ) {
      const invitationId =
        stringValue(payload.invitationId) ??
        stringValue(payload.invitation_id) ??
        stringValue(payload.invitationRef) ??
        stringValue(payload.invitation_ref) ??
        event.event_id;
      const invitationTopicId = topicId ?? this.refIndex.findTopicForRefs(sourceRefs);
      if (!invitationTopicId) return;
      const window = this.ensureTopic(invitationTopicId, event.room_id);
      pushUniqueBounded(window.invitationRefs, invitationId, this.options.maxInvitationRefs);
      window.lastUpdatedAt = event.occurred_at;
      return;
    }

    if (event.event_type.startsWith("memory.")) {
      const memoryId =
        stringValue(payload.memoryId) ??
        stringValue(payload.memory_id) ??
        stringValue(payload.memoryRef) ??
        stringValue(payload.memory_ref);
      if (!memoryId) return;
      const memoryTopicId = topicId ?? this.refIndex.findTopicForRefs(sourceRefs);
      if (!memoryTopicId) return;
      const window = this.ensureTopic(memoryTopicId, event.room_id);
      const state = memoryStateFromEvent(event.event_type);
      if (!state) return;
      for (const candidate of MEMORY_STATES) {
        removeValue(window.memoryRefs[candidate], memoryId);
      }
      pushUniqueBounded(window.memoryRefs[state], memoryId, this.options.maxMemoryRefsPerState);
      window.lastUpdatedAt = event.occurred_at;
      return;
    }

    if (event.event_type === "daily_archive.created") {
      const archivePayload = archiveObjectPayload(payload);
      const archiveId = archiveIdFromPayload(event, archivePayload);
      const topicIds = archiveTopicIdsFromPayload(archivePayload);
      const targets = topicId ? [topicId] : topicIds.length > 0 ? topicIds : [...this.topics.keys()];
      for (const targetTopicId of targets) {
        const window = this.ensureTopic(targetTopicId, event.room_id);
        pushUniqueBounded(window.archiveRefs, archiveId, this.options.maxArchiveRefs);
        window.lastUpdatedAt = event.occurred_at;
      }
      return;
    }

    if (
      event.event_type === "archive.reviewed" ||
      event.event_type === "archive.repair_proposed" ||
      event.event_type === "archive.repair_reviewed" ||
      event.event_type === "archive.repair_applied"
    ) {
      const archiveRef =
        event.event_type === "archive.reviewed"
          ? stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id
          : event.event_type === "archive.repair_applied"
            ? stringValue(payload.revisedArchiveRef) ?? stringValue(payload.revised_archive_ref) ?? event.event_id
            : event.event_type === "archive.repair_reviewed"
              ? stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id
            : stringValue(payload.repairId) ?? stringValue(payload.repair_id) ?? event.event_id;
      const archiveTopicId = topicId ?? this.refIndex.findTopicForRefs(sourceRefs);
      if (!archiveTopicId) return;
      const window = this.ensureTopic(archiveTopicId, event.room_id);
      pushUniqueBounded(window.archiveRefs, archiveRef, this.options.maxArchiveRefs);
      window.lastUpdatedAt = event.occurred_at;
    }
  }

  getTopic(topicId: TopicId): TopicWindow | undefined {
    const topic = this.topics.get(topicId);
    return topic ? cloneTopicWindow(topic) : undefined;
  }

  getRef(refId: RefId): ContextRefRecord | undefined {
    return this.refIndex.get(refId);
  }

  view(): TopicWindowView {
    return {
      topics: [...this.topics.values()].map(cloneTopicWindow).sort((a, b) => a.topicId.localeCompare(b.topicId)),
      refs: this.refIndex.view(),
    };
  }

  private ensureTopic(topicId: TopicId, roomId: RoomId): TopicWindow {
    const existing = this.topics.get(topicId);
    if (existing) return existing;
    const created: TopicWindow = {
      topicId,
      roomId,
      status: "active",
      childTopicIds: [],
      messageRefs: [],
      topicRefs: [topicId],
      anchorRefs: [],
      openQuestionRefs: [],
      memoryRefs: emptyMemoryRefs(),
      protocolProposalRefs: [],
      protocolRefs: [],
      handoffRefs: [],
      invitationRefs: [],
      archiveRefs: [],
    };
    this.topics.set(topicId, created);
    return created;
  }
}

type CandidateFragment = ContextFragment & {
  group: keyof ContextPacket["refs"];
  refType: ContextRefType;
  ledgerCursor?: number;
  mandatory: boolean;
};

export class ContextFragmentAssembler {
  constructor(
    private readonly topicWindows: TopicWindowStore,
    private readonly refIndex: ContextRefIndex = topicWindows.refIndex,
  ) {}

  build(input: BuildContextPacketInput): ContextPacket {
    const topic = this.topicWindows.getTopic(input.topicId);
    if (!topic) {
      throw new Error(`Cannot build context packet for unknown topic: ${input.topicId}`);
    }

    const relevantRefs = new Set(input.relevantRefs ?? []);
    const selected = new Set<RefId>();
    const omitted = new Map<string, ContextPacketOmission>();
    const omittedFragments: OmittedContextFragment[] = [];
    const packet: ContextPacket = {
      packetId: input.packetId ?? `packet_${input.topicId}_${input.triggerRef}_${input.purpose}`,
      roomId: input.roomId,
      topicId: input.topicId,
      purpose: input.purpose,
      recipientAgent: input.recipientAgent,
      createdFromRef: input.triggerRef,
      budget: {
        maxTokens: input.maxTokens,
        maxRefs: input.maxRefs,
        usedTokensEstimate: 0,
        remainingTokensEstimate: input.maxTokens,
        omittedByType: {},
      },
      refs: {
        trigger: [],
        recentWindow: [],
        anchors: [],
        memory: [],
        protocols: [],
        handoffs: [],
        invitations: [],
        archives: [],
        personas: [],
        sideEffects: [],
        workspaceArtifacts: [],
        skills: [],
        capabilities: [],
        turnRecovery: [],
        silences: [],
        pressureBoundaries: [],
        memoryPressure: [],
        providerBoundaries: [],
        mixedReviewPressures: [],
        topics: [],
        openQuestions: [],
      },
      omitted: [],
      fragments: [],
      audit: emptyAudit(input.packetId ?? `packet_${input.topicId}_${input.triggerRef}_${input.purpose}`, input),
    };

    const budgetFragment = budgetContextFragment(packet.packetId, input);
    packet.fragments.push(budgetFragment);
    packet.budget.usedTokensEstimate += budgetFragment.tokenEstimate;

    const omit = (fragment: CandidateFragment, reason: ContextPacketOmission["reason"]): void => {
      addOmission(omitted, fragment.refType, reason);
      addOmittedByType(packet.budget.omittedByType, fragment.type);
      omittedFragments.push(omittedFragmentFrom(fragment, reason));
    };

    const add = (
      group: keyof ContextPacket["refs"],
      type: string,
      refId: RefId,
      mandatory = false,
    ): void => {
      const fragment = this.fragmentFor(group, type, refId, mandatory);
      if (selected.has(refId)) {
        omit(fragment, "duplicate");
        return;
      }
      if (fragment.tokenEstimate > fragment.hardCap) {
        omit(fragment, "hard_cap");
        return;
      }
      const wouldExceedRefs = selected.size + 1 > input.maxRefs;
      const wouldExceedTokens = packet.budget.usedTokensEstimate + fragment.tokenEstimate > input.maxTokens;
      if (!mandatory && (wouldExceedRefs || wouldExceedTokens)) {
        omit(fragment, "context_budget");
        return;
      }
      selected.add(refId);
      packet.refs[group].push(refId);
      packet.budget.usedTokensEstimate += fragment.tokenEstimate;
      packet.fragments.push(stripCandidateFields(fragment));
    };

    add("trigger", "trigger", input.triggerRef, true);
    for (const ref of topic.topicRefs) add("topics", "topic_rule", ref);
    if (topic.summaryRef) add("topics", "topic_summary", topic.summaryRef);
    for (const ref of relevantRefs) {
      const record = this.refIndex.get(ref);
      if (record?.refType === "topic") add("topics", "topic_rule", ref);
      if (record?.refType === "memory") add("memory", "memory_relevant", ref);
      if (record?.refType === "protocol") {
        if (record.availability === "available") {
          add("protocols", protocolFragmentType(record), ref);
        } else {
          const type = protocolFragmentType(record);
          addOmission(omitted, "protocol", "inactive_not_relevant");
          addOmittedByType(packet.budget.omittedByType, type);
          omittedFragments.push(
            omittedFragmentFrom(this.fragmentFor("protocols", type, ref, false), "inactive_not_relevant"),
          );
        }
      }
      if (record?.refType === "handoff") add("handoffs", "handoff_packet", ref);
      if (record?.refType === "invitation") add("invitations", "invitation_packet", ref);
      if (record?.refType === "archive") add("archives", "daily_archive_ref", ref);
      if (record?.refType === "persona_delta") add("personas", "persona_delta", ref);
      if (record?.refType === "side_effect") add("sideEffects", "side_effect_boundary", ref);
      if (record?.refType === "workspace_artifact") add("workspaceArtifacts", "workspace_artifact_ref", ref);
      if (record?.refType === "skill_capsule") add("skills", "skill_capsule_ref", ref);
      if (record?.refType === "capability") add("capabilities", "capability_ref", ref);
      if (record?.refType === "turn_recovery") add("turnRecovery", "deferred_intention", ref);
      if (record?.refType === "silence") add("silences", "silence_ref", ref);
      if (record?.refType === "pressure_boundary") add("pressureBoundaries", "pressure_boundary", ref);
      if (record?.refType === "memory_pressure") add("memoryPressure", "memory_pressure_boundary", ref);
      if (record?.refType === "provider_boundary") add("providerBoundaries", "provider_boundary", ref, true);
      if (record?.refType === "mixed_review_pressure") add("mixedReviewPressures", "mixed_review_pressure", ref);
      if (record?.refType === "question") add("openQuestions", "open_question", ref);
    }
    for (const ref of topic.anchorRefs) {
      const record = this.refIndex.get(ref);
      if (record?.refType === "archive") {
        add("archives", "daily_archive_ref", ref, true);
      } else if (record?.refType === "provider_boundary") {
        add("providerBoundaries", "provider_boundary", ref, true);
      } else {
        add("anchors", "anchor", ref, true);
      }
    }
    for (const ref of topic.openQuestionRefs) add("openQuestions", "open_question", ref, true);

    for (const ref of topic.memoryRefs.contested) add("memory", "memory_contested", ref, true);
    for (const ref of topic.memoryRefs.accepted) add("memory", "memory_accepted", ref);
    for (const ref of topic.memoryRefs.proposed) {
      add("memory", "memory_relevant", ref);
    }
    for (const ref of topic.memoryRefs.observed) {
      if (relevantRefs.has(ref)) add("memory", "memory_relevant", ref);
    }
    for (const ref of topic.memoryRefs.stale) {
      if (relevantRefs.has(ref)) {
        add("memory", "memory_relevant", ref);
      } else {
        addOmission(omitted, "memory", "stale_not_relevant");
        addOmittedByType(packet.budget.omittedByType, "memory_relevant");
        omittedFragments.push(
          omittedFragmentFrom(this.fragmentFor("memory", "memory_relevant", ref, false), "stale_not_relevant"),
        );
      }
    }

    for (const ref of topic.protocolProposalRefs) add("protocols", "protocol_proposal", ref);
    for (const ref of topic.protocolRefs) add("protocols", "protocol_active", ref);
    for (const ref of topic.handoffRefs) add("handoffs", "handoff_packet", ref);
    for (const ref of topic.invitationRefs) add("invitations", "invitation_packet", ref);
    for (const ref of latestFirst(topic.archiveRefs)) add("archives", "daily_archive_ref", ref);
    for (const ref of latestFirst(input.ambientArchiveRefs ?? [])) add("archives", "daily_archive_ref", ref, true);
    for (const ref of latestFirst(topic.messageRefs)) add("recentWindow", "recent_message", ref);

    packet.omitted = [...omitted.values()].sort((a, b) =>
      a.refType === b.refType ? a.reason.localeCompare(b.reason) : a.refType.localeCompare(b.refType),
    );
    packet.budget.remainingTokensEstimate = Math.max(0, input.maxTokens - packet.budget.usedTokensEstimate);
    packet.audit = buildAudit(packet, omittedFragments);
    return packet;
  }

  private fragmentFor(
    group: keyof ContextPacket["refs"],
    type: string,
    refId: RefId,
    mandatory: boolean,
  ): CandidateFragment {
    const record = this.refIndex.get(refId);
    const refType = record?.refType ?? "message";
    const body = fragmentBody(refId, refType, record, this.refIndex);
    return {
      id: `${type}:${refId}`,
      type,
      visibility: visibilityFor(type, record),
      role: roleFor(refType, record),
      source: {
        kind: record ? "ledger" : "projection",
        eventId: record?.sourceEventId,
        ledgerCursor: record?.ledgerCursor,
      },
      refs: unique([refId].concat(record ? fragmentSourceRefs(record) : [])),
      tokenEstimate: record?.tokenEstimate ?? 1,
      hardCap: FRAGMENT_HARD_CAPS[type] ?? 1_000,
      cacheKey: `${type}:${refId}:${record?.sourceEventId ?? "projection"}`,
      priority: FRAGMENT_PRIORITY[type] ?? 100,
      body,
      group,
      refType,
      ledgerCursor: record?.ledgerCursor,
      mandatory,
    };
  }
}

export class ContextPacketBuilder {
  private readonly assembler: ContextFragmentAssembler;

  constructor(
    topicWindows: TopicWindowStore,
    refIndex: ContextRefIndex = topicWindows.refIndex,
  ) {
    this.assembler = new ContextFragmentAssembler(topicWindows, refIndex);
  }

  build(input: BuildContextPacketInput): ContextPacket {
    return this.assembler.build(input);
  }
}

function emptyAudit(packetId: string, input: BuildContextPacketInput): ContextPacketAudit {
  return {
    packetId,
    agentId: input.recipientAgent,
    topicId: input.topicId,
    selectedFragments: [],
    omittedFragments: [],
    totalTokenEstimate: 0,
    cacheKey: `context:${packetId}:empty`,
    builtFromLedgerRange: {
      fromCursor: 0,
      toCursor: 0,
    },
  };
}

function budgetContextFragment(packetId: string, input: BuildContextPacketInput): ContextFragment {
  const tokenEstimate = Math.max(0, Math.min(64, input.maxTokens));
  return {
    id: `budget:${packetId}`,
    type: "budget",
    visibility: "hidden_runtime",
    role: "runtime",
    source: {
      kind: "runtime",
    },
    refs: [],
    tokenEstimate,
    hardCap: FRAGMENT_HARD_CAPS.budget,
    cacheKey: `budget:${input.topicId}:${input.maxTokens}:${input.maxRefs}:${input.purpose}`,
    priority: FRAGMENT_PRIORITY.budget,
    body: JSON.stringify({
      maxTokens: input.maxTokens,
      maxRefs: input.maxRefs,
      purpose: input.purpose,
      note: "Context is a bounded projection, not rewritten room history.",
    }),
  };
}

function stripCandidateFields(fragment: CandidateFragment): ContextFragment {
  return {
    id: fragment.id,
    type: fragment.type,
    visibility: fragment.visibility,
    role: fragment.role,
    source: fragment.source,
    refs: [...fragment.refs],
    tokenEstimate: fragment.tokenEstimate,
    hardCap: fragment.hardCap,
    cacheKey: fragment.cacheKey,
    priority: fragment.priority,
    body: fragment.body,
  };
}

function omittedFragmentFrom(
  fragment: CandidateFragment,
  reason: OmittedContextFragment["reason"],
): OmittedContextFragment {
  return {
    id: fragment.id,
    type: fragment.type,
    visibility: fragment.visibility,
    tokenEstimate: fragment.tokenEstimate,
    hardCap: fragment.hardCap,
    priority: fragment.priority,
    reason,
    refs: [...fragment.refs],
  };
}

function addOmittedByType(omittedByType: Record<string, number>, type: string): void {
  omittedByType[type] = (omittedByType[type] ?? 0) + 1;
}

function buildAudit(packet: ContextPacket, omittedFragments: OmittedContextFragment[]): ContextPacketAudit {
  const cursors = packet.fragments
    .map((fragment) => fragment.source.ledgerCursor)
    .filter((cursor): cursor is number => typeof cursor === "number");
  const largest = packet.fragments
    .map((fragment) => ({
      id: fragment.id,
      type: fragment.type,
      tokenEstimate: fragment.tokenEstimate,
      hardCap: fragment.hardCap,
    }))
    .concat(
      omittedFragments.map((fragment) => ({
        id: fragment.id,
        type: fragment.type,
        tokenEstimate: fragment.tokenEstimate,
        hardCap: fragment.hardCap,
      })),
    )
    .sort((a, b) => b.tokenEstimate - a.tokenEstimate)[0];

  return {
    packetId: packet.packetId,
    agentId: packet.recipientAgent,
    topicId: packet.topicId,
    selectedFragments: packet.fragments.map((fragment) => ({ ...fragment, refs: [...fragment.refs] })),
    omittedFragments: omittedFragments.map((fragment) => ({ ...fragment, refs: [...fragment.refs] })),
    totalTokenEstimate: packet.budget.usedTokensEstimate,
    largestFragment: largest,
    cacheKey: `context:${packet.topicId}:${packet.purpose}:${packet.fragments
      .map((fragment) => fragment.cacheKey)
      .join("|")}`,
    builtFromLedgerRange: {
      fromCursor: cursors.length > 0 ? Math.min(...cursors) : 0,
      toCursor: cursors.length > 0 ? Math.max(...cursors) : 0,
    },
  };
}

function visibilityFor(type: string, record: ContextRefRecord | undefined): ContextFragment["visibility"] {
  if (type === "budget") return "hidden_runtime";
  if (
    record?.refType === "memory" ||
    record?.refType === "protocol" ||
    record?.refType === "handoff" ||
    record?.refType === "invitation" ||
    record?.refType === "persona_delta" ||
    record?.refType === "side_effect" ||
    record?.refType === "skill_capsule" ||
    record?.refType === "capability" ||
    record?.refType === "turn_recovery" ||
    record?.refType === "provider_boundary" ||
    record?.refType === "mixed_review_pressure"
  ) {
    return "agent_visible";
  }
  return "room_visible";
}

function roleFor(refType: ContextRefType, record: ContextRefRecord | undefined): ContextFragment["role"] {
  if (refType === "memory") return "memory";
  if (refType === "protocol") return "protocol";
  if (refType === "archive") return "archive";
  if (refType === "invitation") return "runtime";
  if (
    refType === "side_effect" ||
    refType === "workspace_artifact" ||
    refType === "skill_capsule" ||
    refType === "capability" ||
    refType === "turn_recovery" ||
    refType === "provider_boundary" ||
    refType === "mixed_review_pressure"
  ) {
    return "runtime";
  }
  if (record?.author === "user") return "user";
  if (record?.author === "room_kernel" || record?.author === "archive_worker") return "system";
  if (
    refType === "topic" ||
    refType === "summary" ||
    refType === "question" ||
    refType === "pressure_boundary" ||
    refType === "memory_pressure"
  ) return "runtime";
  if (refType === "silence") return "agent";
  return "agent";
}

function fragmentBody(
  refId: RefId,
  refType: ContextRefType,
  record: ContextRefRecord | undefined,
  refIndex?: ContextRefIndex,
): string {
  const memoryState = record?.states.memoryState;
  const sourceEvidence =
    record && refTypeCarriesSourceEvidence(record.refType)
      ? refIndex?.sourceEvidenceForRefs(record.sourceRefs, { excludeRef: refId, limit: 4, maxExcerptLength: 220 })
      : undefined;
  return JSON.stringify({
    refId,
    refType,
    sourceEventId: record?.sourceEventId,
    availability: record?.availability ?? "available",
    claim:
      record?.refType === "memory"
        ? cleanStates({
            memoryState: record.states.memoryState,
            memorySummary: record.states.memorySummary,
            memoryReason: record.states.memoryReason,
            memorySourcePressureRefs: record.states.memorySourcePressureRefs,
            memoryBoundaryNote: record.states.memoryBoundaryNote,
            memoryLastReviewSummary: record.states.memoryLastReviewSummary,
          })
        : undefined,
    question:
      record?.refType === "question"
        ? cleanStates({
            openQuestion: record.states.openQuestion,
            openQuestionRefinedFromRef: record.states.openQuestionRefinedFromRef,
            openQuestionRefinedBy: record.states.openQuestionRefinedBy,
            openQuestionSourcePressureRefs: record.states.openQuestionSourcePressureRefs,
            openQuestionLastResponse: record.states.openQuestionLastResponse,
            openQuestionLastResponseSummary: record.states.openQuestionLastResponseSummary,
            openQuestionResponseBoundaryNote: record.states.openQuestionResponseBoundaryNote,
          })
        : undefined,
    protocol:
      record?.refType === "protocol"
        ? cleanStates({
            protocolState: record.states.protocolState,
            protocolSummary: record.states.protocolSummary,
            protocolScope: record.states.protocolScope,
            protocolProposalReason: record.states.protocolProposalReason,
            protocolSourcePressureRefs: record.states.protocolSourcePressureRefs,
            protocolResponse: record.states.protocolResponse,
            protocolResponseReason: record.states.protocolResponseReason,
            protocolProposedRevision: record.states.protocolProposedRevision,
            protocolLastReview: record.states.protocolLastReview,
            protocolLastReviewSummary: record.states.protocolLastReviewSummary,
            protocolReviewBoundaryNote: record.states.protocolReviewBoundaryNote,
            protocolExpiresAt: record.states.protocolExpiresAt,
            protocolBoundaryNote: record.states.protocolBoundaryNote,
          })
        : undefined,
    handoff:
      record?.refType === "handoff"
        ? cleanStates({
            handoffState: record.states.handoffState,
            handoffFromAgentId: record.states.handoffFromAgentId,
            handoffToAgentId: record.states.handoffToAgentId,
            handoffProposalReason: record.states.handoffProposalReason,
            handoffSourcePressureRefs: record.states.handoffSourcePressureRefs,
            handoffResponse: record.states.handoffResponse,
            handoffResponseReason: record.states.handoffResponseReason,
            handoffRequestedResponse: record.states.handoffRequestedResponse,
            handoffRedirectTo: record.states.handoffRedirectTo,
            handoffLastReview: record.states.handoffLastReview,
            handoffLastReviewSummary: record.states.handoffLastReviewSummary,
            handoffReviewBoundaryNote: record.states.handoffReviewBoundaryNote,
            handoffBoundaryNote: record.states.handoffBoundaryNote,
          })
        : undefined,
    invitation:
      record?.refType === "invitation"
        ? cleanStates({
            invitationStatus: record.states.invitationStatus,
            invitationToAgentId: record.states.invitationToAgentId,
            invitationFromAgentId: record.states.invitationFromAgentId,
            invitationInvitedBy: record.states.invitationInvitedBy,
            invitationReason: record.states.invitationReason,
            invitationSourcePressureRefs: record.states.invitationSourcePressureRefs,
            invitationDelegatedFromRef: record.states.invitationDelegatedFromRef,
            invitationDelegatedBy: record.states.invitationDelegatedBy,
            invitationResponse: record.states.invitationResponse,
            invitationResponseReason: record.states.invitationResponseReason,
            invitationRespondingAgentId: record.states.invitationRespondingAgentId,
            invitationRedirectTo: record.states.invitationRedirectTo,
            invitationLastReview: record.states.invitationLastReview,
            invitationLastReviewSummary: record.states.invitationLastReviewSummary,
            invitationLastReviewedBy: record.states.invitationLastReviewedBy,
            invitationLastReviewRef: record.states.invitationLastReviewRef,
            invitationReviewBoundaryNote: record.states.invitationReviewBoundaryNote,
            invitationBoundaryNote: record.states.invitationBoundaryNote,
            invitationResponseBoundaryNote: record.states.invitationResponseBoundaryNote,
          })
        : undefined,
    personaDelta:
      record?.refType === "persona_delta"
        ? cleanStates({
            personaDeltaState: record.states.personaDeltaState,
            targetAgentId: record.states.targetAgentId,
            personaDeltaField: record.states.personaDeltaField,
            personaDeltaOperation: record.states.personaDeltaOperation,
            personaDeltaValueSummary: record.states.personaDeltaValueSummary,
            personaDeltaProposalReason: record.states.personaDeltaProposalReason,
            personaDeltaSourcePressureRefs: record.states.personaDeltaSourcePressureRefs,
            personaDeltaResponse: record.states.personaDeltaResponse,
            personaDeltaResponseReason: record.states.personaDeltaResponseReason,
            personaDeltaProposedRevision: record.states.personaDeltaProposedRevision,
            personaDeltaLastReview: record.states.personaDeltaLastReview,
            personaDeltaLastReviewSummary: record.states.personaDeltaLastReviewSummary,
            personaDeltaReviewBoundaryNote: record.states.personaDeltaReviewBoundaryNote,
            personaDeltaBoundaryNote: record.states.personaDeltaBoundaryNote,
          })
        : undefined,
    sideEffect:
      record?.refType === "side_effect"
        ? cleanStates({
            sideEffectStatus: record.states.sideEffectStatus,
            sideEffectKind: record.states.sideEffectKind,
            sideEffectTarget: record.states.sideEffectTarget,
            sideEffectRequestedBy: record.states.sideEffectRequestedBy,
            sideEffectRequestReason: record.states.sideEffectRequestReason,
            sideEffectSourcePressureRefs: record.states.sideEffectSourcePressureRefs,
            sideEffectExpectedImpact: record.states.sideEffectExpectedImpact,
            sideEffectProposedCommand: record.states.sideEffectProposedCommand,
            sideEffectApprovalId: record.states.sideEffectApprovalId,
            sideEffectApprovedBy: record.states.sideEffectApprovedBy,
            sideEffectDeniedBy: record.states.sideEffectDeniedBy,
            sideEffectExpiredBy: record.states.sideEffectExpiredBy,
            sideEffectDecisionReason: record.states.sideEffectDecisionReason,
            sideEffectResultStatus: record.states.sideEffectResultStatus,
            sideEffectResultSummary: record.states.sideEffectResultSummary,
            sideEffectLastReview: record.states.sideEffectLastReview,
            sideEffectLastReviewSummary: record.states.sideEffectLastReviewSummary,
            sideEffectLastReviewedBy: record.states.sideEffectLastReviewedBy,
            sideEffectLastReviewRef: record.states.sideEffectLastReviewRef,
            sideEffectReviewBoundaryNote: record.states.sideEffectReviewBoundaryNote,
          })
        : undefined,
    archive:
      record?.refType === "archive"
        ? cleanStates({
            archiveDate: record.states.archiveDate,
            archiveTimezone: record.states.archiveTimezone,
            archiveSummary: record.states.archiveSummary,
            archiveReadableSkeleton: record.states.archiveReadableSkeleton,
            archiveReviewableSections: record.states.archiveReviewableSections,
            archiveOmittedReadableSections: record.states.archiveOmittedReadableSections,
            archiveCompressionNote: record.states.archiveCompressionNote,
            archiveEventCount: record.states.archiveEventCount,
            archiveMessageHighlightCount: record.states.archiveMessageHighlightCount,
            archiveDecisionCount: record.states.archiveDecisionCount,
            archiveDisagreementCount: record.states.archiveDisagreementCount,
            archiveOpenQuestionCount: record.states.archiveOpenQuestionCount,
            archiveOpenQuestionTraceCount: record.states.archiveOpenQuestionTraceCount,
            archiveMemoryChangeCount: record.states.archiveMemoryChangeCount,
            archiveReviewTraceCount: record.states.archiveReviewTraceCount,
            archiveReviewBoundaryNote: record.states.archiveReviewBoundaryNote,
            archiveMixedReviewBoundaryNote: record.states.archiveMixedReviewBoundaryNote,
            archiveMixedReviewPressureReviewBoundaryNote: record.states.archiveMixedReviewPressureReviewBoundaryNote,
          })
        : undefined,
    workspaceArtifact:
      record?.refType === "workspace_artifact"
        ? cleanStates({
            workspaceArtifactStatus: record.states.workspaceArtifactStatus,
            workspaceArtifactId: record.states.workspaceArtifactId,
            workspaceId: record.states.workspaceId,
            workspaceAgentId: record.states.workspaceAgentId,
            workspacePathRef: record.states.workspacePathRef,
            workspaceArtifactSummary: record.states.workspaceArtifactSummary,
            workspaceArtifactSourcePressureRefs: record.states.workspaceArtifactSourcePressureRefs,
            workspaceBoundaryNote: record.states.workspaceBoundaryNote,
            workspaceArtifactLastReview: record.states.workspaceArtifactLastReview,
            workspaceArtifactLastReviewSummary: record.states.workspaceArtifactLastReviewSummary,
            workspaceArtifactLastReviewedBy: record.states.workspaceArtifactLastReviewedBy,
            workspaceArtifactLastReviewRef: record.states.workspaceArtifactLastReviewRef,
            workspaceArtifactReviewBoundaryNote: record.states.workspaceArtifactReviewBoundaryNote,
          })
        : undefined,
    skillCapsule:
      record?.refType === "skill_capsule"
        ? cleanStates({
            skillCapsuleStatus: record.states.skillCapsuleStatus,
            skillCapsuleId: record.states.skillCapsuleId,
            skillAgentId: record.states.skillAgentId,
            skillLabel: record.states.skillLabel,
            skillSummary: record.states.skillSummary,
            skillTriggerHints: record.states.skillTriggerHints,
            skillSideEffectKinds: record.states.skillSideEffectKinds,
            skillApprovalRequired: record.states.skillApprovalRequired,
            skillDisclosurePolicy: record.states.skillDisclosurePolicy,
            skillInstructionRef: record.states.skillInstructionRef,
            skillInputContract: record.states.skillInputContract,
            skillOutputContract: record.states.skillOutputContract,
            skillApprovalBoundaryNote: record.states.skillApprovalBoundaryNote,
            skillCapsuleSourcePressureRefs: record.states.skillCapsuleSourcePressureRefs,
            skillBoundaryNote: record.states.skillBoundaryNote,
            skillCapsuleLastReview: record.states.skillCapsuleLastReview,
            skillCapsuleLastReviewSummary: record.states.skillCapsuleLastReviewSummary,
            skillCapsuleLastReviewedBy: record.states.skillCapsuleLastReviewedBy,
            skillCapsuleLastReviewRef: record.states.skillCapsuleLastReviewRef,
            skillCapsuleReviewBoundaryNote: record.states.skillCapsuleReviewBoundaryNote,
          })
        : undefined,
    capability:
      record?.refType === "capability"
        ? cleanStates({
            capabilityState: record.states.capabilityState,
            capabilityId: record.states.capabilityId,
            capabilityAgentId: record.states.capabilityAgentId,
            capabilityType: record.states.capabilityType,
            capabilityDomainTags: record.states.capabilityDomainTags,
            capabilityDeclaredConfidence: record.states.capabilityDeclaredConfidence,
            capabilitySourcePressureRefs: record.states.capabilitySourcePressureRefs,
            capabilityBoundaryNote: record.states.capabilityBoundaryNote,
            capabilityLastReview: record.states.capabilityLastReview,
            capabilityLastReviewSummary: record.states.capabilityLastReviewSummary,
            capabilityLastReviewedBy: record.states.capabilityLastReviewedBy,
            capabilityLastReviewRef: record.states.capabilityLastReviewRef,
            capabilityReviewBoundaryNote: record.states.capabilityReviewBoundaryNote,
          })
        : undefined,
    mixedReviewPressure:
      record?.refType === "mixed_review_pressure"
        ? cleanStates({
            mixedReviewSourceMessageId: record.states.mixedReviewSourceMessageId,
            mixedReviewTopicId: record.states.mixedReviewTopicId,
            mixedReviewAgentIds: record.states.mixedReviewAgentIds,
            mixedReviewResponseKindCounts: record.states.mixedReviewResponseKindCounts,
            mixedReviewObjectCount: record.states.mixedReviewObjectCount,
            mixedReviewTouchedRefs: record.states.mixedReviewTouchedRefs,
            mixedReviewTouchedObjects: record.states.mixedReviewTouchedObjects,
            mixedReviewTraceEventRefs: record.states.mixedReviewTraceEventRefs,
            mixedReviewBoundaryNote: record.states.mixedReviewBoundaryNote,
            mixedReviewPressureLastReview: record.states.mixedReviewPressureLastReview,
            mixedReviewPressureLastReviewSummary: record.states.mixedReviewPressureLastReviewSummary,
            mixedReviewPressureLastReviewedBy: record.states.mixedReviewPressureLastReviewedBy,
            mixedReviewPressureLastReviewRef: record.states.mixedReviewPressureLastReviewRef,
            mixedReviewPressureReviewBoundaryNote: record.states.mixedReviewPressureReviewBoundaryNote,
          })
        : undefined,
    sourceEvidence: sourceEvidence && sourceEvidence.length > 0 ? sourceEvidence : undefined,
    states: record?.states ?? {},
    tags: record?.tags ?? [],
    sourceRefs: fragmentSourceRefs(record),
    sourceRefCount: record?.sourceRefs.length ?? 0,
    omittedSourceRefCount: omittedSourceRefCount(record),
    note:
      record?.states.memoryRevisedFromRef
        ? "Revised memory is a fresh proposal linked to an earlier claim. Do not treat it as editing, accepting, or erasing the previous memory."
        : memoryState === "accepted"
        ? "Accepted memory is provisional room sediment, not truth. It may be questioned, downgraded, contested, made stale, or retired."
        : memoryState === "contested"
          ? "Contested memory is an active disagreement surface. Do not flatten it into consensus."
          : record?.refType === "protocol"
            ? protocolIsActiveState(record.states.protocolState)
              ? "Active protocol is accepted temporary room etiquette, not a scheduler command. Agents may follow, question, revise, retire, or ignore it when silence helps the room."
              : "Protocol proposal is not active guidance yet. Agents may accept, reject, challenge, revise, or ignore it; do not treat it as a room rule until accepted."
          : record?.refType === "handoff"
            ? "Handoff is a social proposal, not a function call or forced transfer. The target may accept, reject, partially accept, delegate, challenge, or stay silent."
          : record?.refType === "invitation"
            ? "Invitation is a social knock, not a speaking command. The invited agent may respond, stay silent, invite someone else, or let the room move on."
          : record?.refType === "persona_delta"
            ? "Persona delta is a proposed identity evolution record, not a fixed job assignment. It can be accepted, rejected, contested, or retired."
          : record?.tags.includes("archive_review_request")
            ? "Daily archive review request is a daily rhythm invitation, not a command to speak, create consensus, repair the archive, or mutate the time skeleton."
          : record?.tags.includes("archive_review")
            ? "Archive review is room-visible critique, not archive mutation. It can point out omissions, bias, missing context, or repair needs while keeping the archive contestable."
          : record?.tags.includes("archive_repair_proposal")
            ? "Archive repair proposal is a contestable suggestion, not an archive rewrite. Agents may accept, reject, challenge, revise, retire, or stay silent."
          : record?.tags.includes("archive_repair_response")
            ? "Archive repair response changes repair proposal state only. It does not rewrite archive content."
          : record?.tags.includes("archive_repair_review")
            ? "Archive repair review is discussion pressure only. It does not accept, reject, challenge, revise, retire, apply, or mutate the archive."
          : record?.tags.includes("archive_repair_application")
            ? "Archive repair application records an explicit accepted repair becoming a new archive revision. The original archive remains unchanged, and the revision remains a compressed time skeleton rather than consensus."
          : record?.refType === "archive"
            ? record.states.archiveReviewTraceCount ||
              record.states.archiveMixedReviewPressureCount ||
              record.states.archiveMixedReviewPressureReviewCount
              ? "Daily archive is a compressed time skeleton carrying social review traces as pressure, not closure, consensus, or object lifecycle transitions. Use it to orient time while keeping claims contestable."
              : "Daily archive is a compressed time skeleton, not consensus, truth, or rewritten chat history. Use it to orient time, boundaries, disagreements, and deltas while keeping claims contestable."
          : record?.refType === "side_effect"
            ? "Side-effect record is an approval boundary. A request is not permission, ordinary review is not approval or denial, approval must be explicit and scoped, and results must be linked back before any external effect is treated as completed."
          : record?.refType === "workspace_artifact"
            ? record.states.workspaceArtifactLastReview
              ? "Workspace artifact is a room-visible ref from a private workspace. It is not public memory. Review traces are social pressure only; they do not copy private contents, promote public memory, execute tools, or mutate the artifact."
              : "Workspace artifact is a room-visible ref from a private workspace. It is not public memory and does not copy private workspace contents into the room."
          : record?.refType === "skill_capsule"
            ? record.states.skillCapsuleLastReview
              ? "Skill capsule is a possible action organ, not an execution or fixed role. Review traces are social pressure only; they do not register skills, assign responsibility, execute tools, bypass approvals, or mutate capability state."
              : "Skill capsule is a possible action organ, not an execution. Any side-effectful skill still requires an explicit room event and required approval."
          : record?.refType === "capability"
            ? record.states.capabilityLastReview
              ? "Capability card is an advisory routing hint, not authority. Review traces are social pressure only; they do not change wake score, assign responsibility, certify competence, mutate reputation, or force speech."
              : "Capability card is an advisory routing hint, not authority, responsibility, or proof of competence."
          : record?.refType === "mixed_review_pressure"
            ? record.states.mixedReviewPressureLastReview
              ? "Mixed review pressure is a social-state index over unresolved room pressure, not a command, closure, or consensus. Reviews of the pressure are social traces only; they do not close, narrow, retire, delete, resolve, or mutate the pressure."
              : "Mixed review pressure is a social-state index over unresolved room pressure, not a command, closure, consensus, or lifecycle state. Agents may question, narrow, defer, or suggest retiring it through ordinary speech."
          : record?.refType === "turn_recovery"
            ? "Deferred intention is recovery context for a later wake. It shows what was unheard and why speaker budget delayed it; it does not command the agent to speak."
          : record?.refType === "silence"
            ? "Deliberate silence is an agent expression, not provider failure, agreement, absence, or a command to stay silent again. It can be questioned or referenced like any other room-visible social move."
          : record?.refType === "pressure_boundary"
            ? "Pressure boundary is a room resource signal, not a judgment about any agent. Message expression was preserved while wake or background work was delayed to keep the room inhabitable."
          : record?.refType === "memory_pressure"
            ? "Memory pressure boundary is a public-memory hygiene signal, not a truth judgment. It asks the room to review, contest, accept, mark stale, or retire pending proposals before adding more sediment."
          : record?.refType === "provider_boundary"
            ? record.availability === "retired" || record.states.providerBoundaryState === "retired"
              ? "Retired provider boundary is historical runtime evidence, not active pressure. Retirement does not delete ledger/archive history, repair the provider, or redefine the agent."
              : record.states.providerBoundaryChoiceKindCount
                ? "Provider boundary carries parallel choice pressure: repair requests, retry etiquette, deliberate silence, denials, contested memory, or archive carryover are social traces. Do not collapse them into workflow state, provider recovery, consensus, or a system-recommended repair path."
              : "Provider boundary is a runtime availability signal, not agent silence, agreement, absence, or personality. It can be discussed to repair provider wiring, choose another participant, or ask the same agent again later."
          : record?.tags.includes("topic_proposal")
            ? "Topic proposal is a soft room-order suggestion, not a topic switch command. Review traces are discussion pressure only; agents may accept, reject, revise, ignore, split, pause, revive, or merge through later room-visible interaction."
          : record?.refType === "topic"
            ? "Topic ref is a room focus marker, not a command to switch discussion. Topic movement remains soft and can be split, paused, revived, merged, or ignored by later room-visible interaction."
          : record?.refType === "summary"
            ? "Topic summary is a bounded projection of recent focus, not rewritten transcript or consensus."
          : record?.refType === "question"
            ? record.states.openQuestionResponseCount
              ? "Open question has response traces, but remains unresolved room context. Treat responses as social sediment, not closure, consensus, or task completion."
              : "Open question is an unresolved room question. Treat it as a live invitation to respond, refine, defer, or contest."
          : "Fetch referenced ledger entries as needed; do not treat summaries as rewritten history.",
  });
}

function fragmentSourceRefs(record: ContextRefRecord | undefined): RefId[] {
  if (!record) return [];
  if (record.refType === "archive") return record.sourceRefs.slice(0, 24);
  return record.sourceRefs;
}

function omittedSourceRefCount(record: ContextRefRecord | undefined): number {
  if (!record || record.refType !== "archive") return 0;
  return Math.max(0, record.sourceRefs.length - 24);
}

function emptyMemoryRefs(): MemoryRefsByState {
  return {
    observed: [],
    proposed: [],
    contested: [],
    accepted: [],
    stale: [],
    retired: [],
  };
}

function cloneTopicWindow(topic: TopicWindow): TopicWindow {
  return {
    ...topic,
    childTopicIds: [...topic.childTopicIds],
    messageRefs: [...topic.messageRefs],
    topicRefs: [...topic.topicRefs],
    anchorRefs: [...topic.anchorRefs],
    openQuestionRefs: [...topic.openQuestionRefs],
    memoryRefs: {
      observed: [...topic.memoryRefs.observed],
      proposed: [...topic.memoryRefs.proposed],
      contested: [...topic.memoryRefs.contested],
      accepted: [...topic.memoryRefs.accepted],
      stale: [...topic.memoryRefs.stale],
      retired: [...topic.memoryRefs.retired],
    },
    protocolProposalRefs: [...topic.protocolProposalRefs],
    protocolRefs: [...topic.protocolRefs],
    handoffRefs: [...topic.handoffRefs],
    invitationRefs: [...topic.invitationRefs],
    archiveRefs: [...topic.archiveRefs],
  };
}

function mergeRefRecord(existing: ContextRefRecord, incoming: ContextRefRecord): ContextRefRecord {
  return {
    ...existing,
    ...incoming,
    sourceRefs: unique(existing.sourceRefs.concat(incoming.sourceRefs)),
    tags: unique(existing.tags.concat(incoming.tags)),
    states: {
      ...existing.states,
      ...incoming.states,
    },
    ledgerCursor: Math.max(existing.ledgerCursor, incoming.ledgerCursor),
  };
}

function compareRefRecords(a: ContextRefRecord, b: ContextRefRecord): number {
  if (a.ledgerCursor !== b.ledgerCursor) return a.ledgerCursor - b.ledgerCursor;
  return a.refId.localeCompare(b.refId);
}

function summaryRecord(
  event: RoomEvent,
  ledgerCursor: number,
  refId: RefId,
  topicId: TopicId,
  sourceRefs: RefId[],
): ContextRefRecord {
  return {
    refId,
    refType: "summary",
    roomId: event.room_id,
    topicId,
    sourceEventId: event.event_id,
    ledgerCursor,
    author: event.actor.id,
    tokenEstimate: estimateTokens(stringValue(objectPayload(event.payload).summary) ?? ""),
    createdAt: event.occurred_at,
    availability: "available",
    states: cleanStates({
      summaryText: boundedString(stringValue(objectPayload(event.payload).summary), 1_000),
    }),
    tags: ["summary"],
    sourceRefs,
  };
}

function questionRecord(
  event: RoomEvent,
  ledgerCursor: number,
  refId: RefId,
  topicId: TopicId,
  sourceRefs: RefId[],
): ContextRefRecord {
  const payload = objectPayload(event.payload);
  const openQuestion = stringValue(payload.openQuestion) ?? stringValue(payload.open_question);
  const questionSourceRefs = unique(
    [
      stringValue(payload.messageId) ?? stringValue(payload.message_id),
      stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      ...sourceRefs,
    ].filter((ref): ref is string => Boolean(ref)),
  );
  return {
    refId,
    refType: "question",
    roomId: event.room_id,
    topicId,
    sourceEventId: event.event_id,
    ledgerCursor,
    author: event.actor.id,
    tokenEstimate: estimateTokens(openQuestion ?? ""),
    createdAt: event.occurred_at,
    availability: "available",
    evidenceText: boundedString(openQuestion, 500),
    states: cleanStates({
      openQuestion: boundedString(openQuestion, 1_000),
      openQuestionRefinedFromRef:
        stringValue(payload.refinedFromQuestionRef) ??
        stringValue(payload.refined_from_question_ref),
      openQuestionRefinedBy:
        stringValue(payload.refinedBy) ?? stringValue(payload.refined_by),
      openQuestionSourcePressureRefs: arrayOfStrings(payload.sourcePressureRefs).concat(arrayOfStrings(payload.source_pressure_refs)),
    }),
    tags: ["question"],
    sourceRefs: questionSourceRefs,
  };
}

function refTypeCarriesSourceEvidence(refType: ContextRefType): boolean {
  return (
    refType === "memory" ||
    refType === "question" ||
    refType === "protocol" ||
    refType === "handoff" ||
    refType === "persona_delta" ||
    refType === "mixed_review_pressure"
  );
}

function openQuestionResponseStates(
  existing: ContextRefRecord["states"],
  payload: Record<string, unknown>,
): ContextRefRecord["states"] {
  const responseRef =
    stringValue(payload.responseId) ??
    stringValue(payload.response_id) ??
    stringValue(payload.sourceMessageId) ??
    stringValue(payload.source_message_id);
  const agentId = stringValue(payload.agentId) ?? stringValue(payload.agent_id);
  const responseRefs = responseRef ? appendBoundedUnique(existing.openQuestionResponseRefs ?? [], responseRef, 12) : existing.openQuestionResponseRefs;
  const responseAgentIds = agentId
    ? appendBoundedUnique(existing.openQuestionResponseAgentIds ?? [], agentId, 12)
    : existing.openQuestionResponseAgentIds;
  const responseKind = stringValue(payload.response) ?? stringValue(payload.status) ?? "responded";
  const existingKindCounts = existing.openQuestionResponseKindCounts ?? {};
  const responseKindCounts = {
    ...existingKindCounts,
    [responseKind]: (existingKindCounts[responseKind] ?? 0) + 1,
  };
  return cleanStates({
    ...existing,
    openQuestionResponseRefs: responseRefs,
    openQuestionResponseAgentIds: responseAgentIds,
    openQuestionResponseCount: responseRefs?.length ?? existing.openQuestionResponseCount,
    openQuestionResponseKindCounts: responseKindCounts,
    openQuestionContestedCount: responseKindCounts.contested,
    openQuestionDeferredCount: responseKindCounts.deferred,
    openQuestionRefinedCount: responseKindCounts.refined,
    openQuestionLastResponse: responseKind,
    openQuestionLastResponseSummary: boundedString(stringValue(payload.summary), 1_000),
    openQuestionLastResponseRef: responseRef,
    openQuestionResponseBoundaryNote:
      boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 1_000) ??
      "open question response is a social trace; it does not resolve or close the question",
  });
}

function topicStatesFromPayload(payload: Record<string, unknown>): ContextRefRecord["states"] {
  return cleanStates({
    topicStatus: stringValue(payload.status),
    topicTitle: boundedString(stringValue(payload.title), 800),
    topicSummary: boundedString(stringValue(payload.summary), 1_000),
    topicParentTopicId: stringValue(payload.parentTopicId) ?? stringValue(payload.parent_topic_id),
    topicMergedInto: stringValue(payload.mergedInto) ?? stringValue(payload.merged_into),
    openQuestion: boundedString(stringValue(payload.openQuestion) ?? stringValue(payload.open_question), 1_000),
    openQuestionRefinedFromRef:
      stringValue(payload.refinedFromQuestionRef) ?? stringValue(payload.refined_from_question_ref),
    openQuestionRefinedBy: stringValue(payload.refinedBy) ?? stringValue(payload.refined_by),
    openQuestionSourcePressureRefs: arrayOfStrings(payload.sourcePressureRefs).concat(arrayOfStrings(payload.source_pressure_refs)),
  });
}

function topicTokenEstimate(payload: Record<string, unknown>): number {
  return estimateTokens(
    [
      stringValue(payload.title),
      stringValue(payload.summary),
      stringValue(payload.openQuestion) ?? stringValue(payload.open_question),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function memoryStatesFromPayload(memoryState: MemoryState | undefined, payload: Record<string, unknown>): ContextRefRecord["states"] {
  const reviewId = stringValue(payload.reviewId) ?? stringValue(payload.review_id);
  const reviewResponse = stringValue(payload.response);
  const hasReviewPayload = Boolean(reviewId || reviewResponse);
  const isReviewOnly = memoryState === undefined && hasReviewPayload;
  const sourcePressureRefs = unique(
    arrayOfStrings(payload.sourcePressureRefs)
      .concat(arrayOfStrings(payload.source_pressure_refs))
      .concat(arrayOfStrings(payload.sourceRefs))
      .concat(arrayOfStrings(payload.source_refs))
      .concat(arrayOfStrings(payload.contextRefs))
      .concat(arrayOfStrings(payload.context_refs))
      .filter(isMixedReviewPressureRef),
  );
  return cleanStates({
    memoryState,
    memorySummary: isReviewOnly ? undefined : boundedString(stringValue(payload.summary), 800),
    memoryReason: isReviewOnly ? undefined : boundedString(stringValue(payload.reason), 1_000),
    memoryProposedBy: isReviewOnly ? undefined : stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by),
    memorySourcePressureRefs: isReviewOnly ? undefined : sourcePressureRefs,
    memoryRevisedFromRef: isReviewOnly
      ? undefined
      : stringValue(payload.revisedFromMemoryRef) ?? stringValue(payload.revised_from_memory_ref),
    memoryRevisedBy: isReviewOnly ? undefined : stringValue(payload.revisedBy) ?? stringValue(payload.revised_by),
    memoryLastReviewResponse: reviewResponse,
    memoryLastReviewSummary: hasReviewPayload ? boundedString(stringValue(payload.summary), 800) : undefined,
    memoryLastReviewedBy: hasReviewPayload ? stringValue(payload.agentId) ?? stringValue(payload.agent_id) : undefined,
    memoryLastReviewRef: reviewId,
    memoryBoundaryNote: isReviewOnly
      ? undefined
      : boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 1_000) ??
        (stringValue(payload.revisedFromMemoryRef) || stringValue(payload.revised_from_memory_ref)
          ? "memory revision opens a fresh proposal; it does not rewrite the previous memory claim"
          : "public memory is provisional room sediment, not truth"),
  });
}

function topicProposalStatesFromPayload(event: RoomEvent, payload: Record<string, unknown>): ContextRefRecord["states"] {
  const isReview = event.event_type === "topic.reviewed";
  return cleanStates({
    topicStatus:
      isReview
        ? undefined
        : stringValue(payload.status) ?? (event.event_type === "topic.applied" ? "applied" : "proposed"),
    topicProposalAction: isReview ? undefined : stringValue(payload.action),
    topicProposalTitle: isReview ? undefined : boundedString(stringValue(payload.title) ?? stringValue(payload.summary), 800),
    topicProposalReason: isReview ? undefined : boundedString(stringValue(payload.reason), 1_000),
    topicProposalCurrentTopicId: isReview
      ? undefined
      : (stringValue(payload.currentTopicId) ?? stringValue(payload.current_topic_id)),
    topicProposalTargetTopicId: isReview
      ? undefined
      : (stringValue(payload.targetTopicId) ?? stringValue(payload.target_topic_id)),
    topicProposalProposedBy: isReview
      ? undefined
      : (stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by)),
    topicProposalSourcePressureRefs: isReview
      ? undefined
      : unique(
          arrayOfStrings(payload.sourcePressureRefs)
            .concat(arrayOfStrings(payload.source_pressure_refs))
            .concat(arrayOfStrings(payload.contextRefs))
            .concat(arrayOfStrings(payload.context_refs))
            .filter((ref) => ref.startsWith("mixed_review:")),
        ),
    topicProposalRevisedFromRef: isReview
      ? undefined
      : (stringValue(payload.revisedFromTopicProposalRef) ?? stringValue(payload.revised_from_topic_proposal_ref)),
    topicProposalRevisedBy: isReview ? undefined : (stringValue(payload.revisedBy) ?? stringValue(payload.revised_by)),
    topicProposalRef: stringValue(payload.topicProposalRef) ?? stringValue(payload.topic_proposal_ref),
    topicProposalResponse: stringValue(payload.response),
    topicProposalResponseReason:
      event.event_type === "topic.responded" ? boundedString(stringValue(payload.reason), 1_000) : undefined,
    topicProposalProposedRevision: boundedString(
      stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision),
      1_000,
    ),
    topicProposalRespondingAgentId:
      event.event_type === "topic.responded" ? stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id : undefined,
    topicProposalLastReview: isReview ? stringValue(payload.response) ?? "reviewed" : undefined,
    topicProposalLastReviewSummary:
      isReview ? boundedString(stringValue(payload.summary), 1_000) : undefined,
    topicProposalLastReviewedBy:
      isReview ? stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id : undefined,
    topicProposalLastReviewRef:
      isReview
        ? stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id
        : undefined,
    topicProposalReviewBoundaryNote:
      isReview
        ? boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 1_000)
        : undefined,
    topicProposalAppliedBy:
      event.event_type === "topic.applied" ? stringValue(payload.appliedBy) ?? stringValue(payload.applied_by) ?? event.actor.id : undefined,
    topicProposalApplicationReason:
      event.event_type === "topic.applied" ? boundedString(stringValue(payload.reason), 1_000) : undefined,
    topicProposalResultingTopicId:
      event.event_type === "topic.applied" ? stringValue(payload.resultingTopicId) ?? stringValue(payload.resulting_topic_id) : undefined,
    topicProposalAppliedTopicEventIds:
      event.event_type === "topic.applied"
        ? arrayOfStrings(payload.appliedTopicEventIds).concat(arrayOfStrings(payload.applied_topic_event_ids))
        : undefined,
    topicProposalBoundaryNote:
      isReview
        ? undefined
        : boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 1_000) ??
          (event.event_type === "topic.applied"
            ? "topic application is room-visible topic movement, not hidden scheduler control"
            : "topic suggestion only; it does not switch, split, pause, revive, or merge the active topic by itself"),
  });
}

function topicProposalTokenEstimate(payload: Record<string, unknown>): number {
  return estimateTokens(
    [
      stringValue(payload.action),
      stringValue(payload.title) ?? stringValue(payload.summary),
      stringValue(payload.reason),
      stringValue(payload.response),
      stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function protocolStatesFromPayload(
  event: RoomEvent,
  payload: Record<string, unknown>,
): ContextRefRecord["states"] {
  return cleanStates({
    protocolState:
      event.event_type === "protocol.reviewed"
        ? undefined
        : stringValue(payload.status) ?? protocolStateFromResponse(stringValue(payload.response)) ?? event.event_type.replace("protocol.", ""),
    protocolSummary: boundedString(stringValue(payload.summary), 800),
    protocolScope: stringValue(payload.scope),
    protocolProposedBy: stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by),
    protocolReason: boundedString(stringValue(payload.reason), 800),
    protocolProposalReason: event.event_type === "protocol.proposed" ? boundedString(stringValue(payload.reason), 800) : undefined,
    protocolSourcePressureRefs:
      event.event_type === "protocol.proposed"
        ? unique(
            arrayOfStrings(payload.sourcePressureRefs)
              .concat(arrayOfStrings(payload.source_pressure_refs))
              .concat(arrayOfStrings(payload.contextRefs))
              .concat(arrayOfStrings(payload.context_refs))
              .filter((ref) => ref.startsWith("mixed_review:")),
          )
        : undefined,
    protocolExpiresAt: stringValue(payload.expiresAt) ?? stringValue(payload.expires_at),
    protocolExpiryPolicy: stringValue(payload.expiryPolicy) ?? stringValue(payload.expiry_policy),
    protocolBoundaryNote: stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
    protocolResponse: stringValue(payload.response),
    protocolRespondedBy: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    protocolResponseReason: event.event_type === "protocol.responded" ? boundedString(stringValue(payload.reason), 800) : undefined,
    protocolProposedRevision: boundedString(stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision), 800),
    protocolLastReview: event.event_type === "protocol.reviewed" ? stringValue(payload.response) ?? "reviewed" : undefined,
    protocolLastReviewSummary: event.event_type === "protocol.reviewed" ? boundedString(stringValue(payload.summary), 800) : undefined,
    protocolReviewBoundaryNote:
      event.event_type === "protocol.reviewed" ? stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note) : undefined,
    protocolRevisedFromRef: stringValue(payload.revisedFromProtocolRef) ?? stringValue(payload.revised_from_protocol_ref),
    protocolRevisedBy: stringValue(payload.revisedBy) ?? stringValue(payload.revised_by),
  });
}

function protocolTokenEstimate(payload: Record<string, unknown>): number {
  return estimateTokens(
    [
      stringValue(payload.summary),
      stringValue(payload.reason),
      stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function personaDeltaStatesFromPayload(
  event: RoomEvent,
  payload: Record<string, unknown>,
): ContextRefRecord["states"] {
  const proposedChange = objectPayload(payload.proposedChange);
  const snakeProposedChange = objectPayload(payload.proposed_change);
  const change = Object.keys(proposedChange).length > 0 ? proposedChange : snakeProposedChange;
  const sourcePressureRefs = unique(
    arrayOfStrings(payload.sourcePressureRefs)
      .concat(arrayOfStrings(payload.source_pressure_refs))
      .concat(arrayOfStrings(payload.evidenceRefs).filter(isMixedReviewPressureRef))
      .concat(arrayOfStrings(payload.evidence_refs).filter(isMixedReviewPressureRef)),
  );
  return cleanStates({
    personaDeltaState:
      event.event_type === "persona_delta.reviewed"
        ? undefined
        : stringValue(payload.status) ?? stringValue(payload.response) ?? event.event_type.replace("persona_delta.", ""),
    targetAgentId:
      event.event_type === "persona_delta.proposed"
        ? stringValue(payload.agentId) ?? stringValue(payload.agent_id)
        : undefined,
    personaDeltaReason: boundedString(stringValue(payload.reason), 800),
    personaDeltaProposalReason: event.event_type === "persona_delta.proposed" ? boundedString(stringValue(payload.reason), 800) : undefined,
    personaDeltaSourcePressureRefs: event.event_type === "persona_delta.proposed" ? sourcePressureRefs : undefined,
    personaDeltaResponseReason: event.event_type === "persona_delta.responded" ? boundedString(stringValue(payload.reason), 800) : undefined,
    personaDeltaProposedBy: stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by),
    personaDeltaRespondingAgentId: event.event_type === "persona_delta.responded" ? stringValue(payload.agentId) ?? stringValue(payload.agent_id) : undefined,
    personaDeltaResponse: stringValue(payload.response),
    personaDeltaProposedRevision: boundedString(
      stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision),
      800,
    ),
    personaDeltaRevisedFromRef: stringValue(payload.revisedFromDeltaRef) ?? stringValue(payload.revised_from_delta_ref),
    personaDeltaRevisedBy: stringValue(payload.revisedBy) ?? stringValue(payload.revised_by),
    personaDeltaLastReview:
      event.event_type === "persona_delta.reviewed" ? stringValue(payload.response) ?? "reviewed" : undefined,
    personaDeltaLastReviewSummary:
      event.event_type === "persona_delta.reviewed" ? boundedString(stringValue(payload.summary), 800) : undefined,
    personaDeltaReviewBoundaryNote:
      event.event_type === "persona_delta.reviewed" ? stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note) : undefined,
    personaDeltaLastReviewedBy:
      event.event_type === "persona_delta.reviewed" ? stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id : undefined,
    personaDeltaField: stringValue(change.field),
    personaDeltaOperation: stringValue(change.operation),
    personaDeltaValueSummary: summarizeUnknown(change.value, 800),
    personaDeltaBoundaryNote:
      event.event_type === "persona_delta.reviewed"
        ? undefined
        : stringValue(payload.boundaryNote) ??
          stringValue(payload.boundary_note) ??
          (event.event_type === "persona_delta.proposed"
            ? "identity proposal is room-visible, contestable, and not a fixed assignment"
            : undefined),
  });
}

function personaDeltaTokenEstimate(payload: Record<string, unknown>): number {
  const proposedChange = objectPayload(payload.proposedChange);
  const snakeProposedChange = objectPayload(payload.proposed_change);
  const change = Object.keys(proposedChange).length > 0 ? proposedChange : snakeProposedChange;
  return estimateTokens([stringValue(payload.reason), stringValue(payload.summary), summarizeUnknown(change.value, 800)].filter(Boolean).join("\n"));
}

function personaDeltaEvidenceText(payload: Record<string, unknown>): string | undefined {
  const proposedChange = objectPayload(payload.proposedChange);
  const snakeProposedChange = objectPayload(payload.proposed_change);
  const change = Object.keys(proposedChange).length > 0 ? proposedChange : snakeProposedChange;
  return boundedString(
    [
      stringValue(payload.reason),
      summarizeUnknown(change.value, 800),
      stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision),
      stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
    ]
      .filter(Boolean)
      .join(" "),
    700,
  );
}

function handoffStatesFromPayload(
  event: RoomEvent,
  payload: Record<string, unknown>,
): ContextRefRecord["states"] {
  const acceptedScope = objectPayload(payload.acceptedScope);
  const snakeAcceptedScope = objectPayload(payload.accepted_scope);
  const scope = Object.keys(acceptedScope).length > 0 ? acceptedScope : snakeAcceptedScope;
  const sourcePressureRefs = unique(
    arrayOfStrings(payload.sourcePressureRefs)
      .concat(arrayOfStrings(payload.source_pressure_refs))
      .concat(arrayOfStrings(payload.contextRefs))
      .concat(arrayOfStrings(payload.context_refs))
      .filter(isMixedReviewPressureRef),
  );
  return cleanStates({
    handoffState:
      event.event_type === "handoff.reviewed"
        ? undefined
        : stringValue(payload.status) ?? stringValue(payload.response) ?? event.event_type.replace("handoff.", ""),
    handoffFromAgentId: stringValue(payload.fromAgentId) ?? stringValue(payload.from_agent_id),
    handoffToAgentId: stringValue(payload.toAgentId) ?? stringValue(payload.to_agent_id),
    handoffByAgentId: stringValue(payload.byAgentId) ?? stringValue(payload.by_agent_id),
    handoffProposalReason: event.event_type === "handoff.proposed" ? boundedString(stringValue(payload.reason), 800) : undefined,
    handoffSourcePressureRefs: event.event_type === "handoff.proposed" ? sourcePressureRefs : undefined,
    handoffResponseReason: event.event_type === "handoff.responded" ? boundedString(stringValue(payload.reason), 800) : undefined,
    handoffRequestedResponse: boundedString(stringValue(payload.requestedResponse) ?? stringValue(payload.requested_response), 800),
    handoffReturnTo: stringValue(payload.returnTo) ?? stringValue(payload.return_to),
    handoffResponse: stringValue(payload.response),
    handoffRedirectTo: stringValue(payload.redirectTo) ?? stringValue(payload.redirect_to),
    handoffAcceptedScopeSummary: Object.keys(scope).length > 0 ? summarizeUnknown(scope, 800) : undefined,
    handoffLastReview: event.event_type === "handoff.reviewed" ? stringValue(payload.response) ?? "reviewed" : undefined,
    handoffLastReviewSummary: event.event_type === "handoff.reviewed" ? boundedString(stringValue(payload.summary), 800) : undefined,
    handoffReviewBoundaryNote:
      event.event_type === "handoff.reviewed" ? stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note) : undefined,
    handoffDelegatedFromRef: stringValue(payload.delegatedFromHandoffRef) ?? stringValue(payload.delegated_from_handoff_ref),
    handoffDelegatedBy: stringValue(payload.delegatedBy) ?? stringValue(payload.delegated_by),
    handoffBoundaryNote:
      event.event_type === "handoff.reviewed"
        ? undefined
        : stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
  });
}

function handoffTokenEstimate(payload: Record<string, unknown>): number {
  return estimateTokens(
    [
      stringValue(payload.reason),
      stringValue(payload.requestedResponse) ?? stringValue(payload.requested_response),
      stringValue(payload.summary),
      summarizeUnknown(payload.acceptedScope, 800) ?? summarizeUnknown(payload.accepted_scope, 800),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function invitationStatesFromPayload(
  event: RoomEvent,
  payload: Record<string, unknown>,
): ContextRefRecord["states"] {
  if (event.event_type === "agent.invitation_reviewed") {
    return cleanStates({
      invitationStatus: "reviewed",
      invitationId:
        stringValue(payload.invitationRef) ??
        stringValue(payload.invitation_ref) ??
        stringValue(payload.invitationId) ??
        stringValue(payload.invitation_id) ??
        event.event_id,
      invitationLastReview: stringValue(payload.response) ?? "reviewed",
      invitationLastReviewSummary: boundedString(stringValue(payload.summary), 1_000),
      invitationLastReviewedBy: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      invitationLastReviewRef: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      invitationReviewBoundaryNote:
        boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 800) ??
        "invitation review is a social trace; it does not accept, reject, challenge, delegate, force speech, or create a new invitation",
    });
  }
  if (event.event_type === "agent.invitation_responded") {
    return cleanStates({
      invitationStatus: stringValue(payload.response) ?? stringValue(payload.status) ?? "responded",
      invitationId:
        stringValue(payload.invitationRef) ??
        stringValue(payload.invitation_ref) ??
        stringValue(payload.invitationId) ??
        stringValue(payload.invitation_id) ??
        event.event_id,
      invitationResponseId: stringValue(payload.responseId) ?? stringValue(payload.response_id) ?? event.event_id,
      invitationResponse: stringValue(payload.response) ?? stringValue(payload.status),
      invitationResponseReason: boundedString(stringValue(payload.reason), 800),
      invitationRespondingAgentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      invitationRedirectTo: stringValue(payload.redirectTo) ?? stringValue(payload.redirect_to),
      invitationResponseBoundaryNote:
        boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 800) ??
        "invitation response is a social reply to a knock, not a speaking command",
    });
  }
  const sourcePressureRefs = unique(
    arrayOfStrings(payload.sourcePressureRefs)
      .concat(arrayOfStrings(payload.source_pressure_refs))
      .concat(arrayOfStrings(payload.contextRefs))
      .concat(arrayOfStrings(payload.context_refs))
      .filter(isMixedReviewPressureRef),
  );
  return cleanStates({
    invitationStatus: stringValue(payload.status) ?? "invited",
    invitationId: stringValue(payload.invitationId) ?? stringValue(payload.invitation_id) ?? event.event_id,
    invitationToAgentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    invitationFromAgentId: event.actor.id,
    invitationInvitedBy: stringValue(payload.invitedBy) ?? stringValue(payload.invited_by),
    invitationReason: boundedString(stringValue(payload.reason), 800),
    invitationSourcePressureRefs: sourcePressureRefs,
    invitationDelegatedFromRef:
      stringValue(payload.delegatedFromInvitationRef) ?? stringValue(payload.delegated_from_invitation_ref),
    invitationDelegatedBy: stringValue(payload.delegatedBy) ?? stringValue(payload.delegated_by),
    invitationBoundaryNote:
      boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 800) ??
      "invitation is a social knock, not a speaking command",
  });
}

function invitationTokenEstimate(payload: Record<string, unknown>): number {
  return estimateTokens(
    [
      stringValue(payload.agentId) ?? stringValue(payload.agent_id),
      stringValue(payload.invitedBy) ?? stringValue(payload.invited_by),
      stringValue(payload.reason),
      stringValue(payload.summary),
      stringValue(payload.response) ?? stringValue(payload.status),
      stringValue(payload.redirectTo) ?? stringValue(payload.redirect_to),
      stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function turnRecoveryStatesFromPayload(event: RoomEvent, payload: Record<string, unknown>): ContextRefRecord["states"] {
  const intention = objectPayload(payload.intention);
  return cleanStates({
    turnRecoveryState: event.event_type.replace("agent.", ""),
    turnRecoveryAgentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    turnRecoveryInvitationId: stringValue(payload.invitationId) ?? stringValue(payload.invitation_id),
    turnRecoveryPacketId: stringValue(payload.packetId) ?? stringValue(payload.packet_id),
    turnRecoveryIntentionKind:
      stringValue(intention.kind) ?? stringValue(payload.originalIntentionKind) ?? stringValue(payload.original_intention_kind),
    turnRecoveryContent: boundedString(stringValue(intention.content), 1_000),
    turnRecoveryQuestion: boundedString(stringValue(intention.question), 1_000),
    turnRecoveryReason: boundedString(stringValue(intention.reason), 800),
    turnRecoveryIntentionEventId: stringValue(payload.intentionEventId) ?? stringValue(payload.intention_event_id),
    turnRecoveryOriginalIntentionKind:
      stringValue(payload.originalIntentionKind) ?? stringValue(payload.original_intention_kind),
    turnRecoveryBoundaryReason: boundedString(stringValue(payload.reason), 800),
  });
}

function turnRecoveryTokenEstimate(event: RoomEvent, payload: Record<string, unknown>): number {
  const states = turnRecoveryStatesFromPayload(event, payload);
  return estimateTokens(
    [
      states.turnRecoveryIntentionKind,
      states.turnRecoveryContent,
      states.turnRecoveryQuestion,
      states.turnRecoveryReason,
      states.turnRecoveryBoundaryReason,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function isDeliberateSilencePayload(payload: Record<string, unknown>): boolean {
  const intention = objectPayload(payload.intention);
  if (stringValue(intention.kind) !== "stay_silent") return false;
  const reason = stringValue(intention.reason) ?? "";
  return !reason.toLowerCase().startsWith("live provider degraded:");
}

function silenceStatesFromPayload(payload: Record<string, unknown>): ContextRefRecord["states"] {
  const intention = objectPayload(payload.intention);
  return cleanStates({
    silenceAgentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    silenceInvitationId: stringValue(payload.invitationId) ?? stringValue(payload.invitation_id),
    silencePacketId: stringValue(payload.packetId) ?? stringValue(payload.packet_id),
    silenceTriggeringEventId: stringValue(payload.triggeringEventId) ?? stringValue(payload.triggering_event_id),
    silenceReason: boundedString(stringValue(intention.reason), 800),
    silenceBoundaryNote: "deliberate silence is a valid room expression, not provider failure or agreement",
  });
}

function silenceTokenEstimate(payload: Record<string, unknown>): number {
  const states = silenceStatesFromPayload(payload);
  return estimateTokens(
    [
      states.silenceAgentId,
      states.silenceTriggeringEventId,
      states.silenceReason,
      states.silenceBoundaryNote,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function pressureBoundaryStatesFromPayload(payload: Record<string, unknown>): ContextRefRecord["states"] {
  return cleanStates({
    pressureReason: stringValue(payload.reason) ?? "room_pressure_detected",
    pressureMessageEventId: stringValue(payload.messageEventId) ?? stringValue(payload.message_event_id),
    pressureMessageId: stringValue(payload.messageId) ?? stringValue(payload.message_id),
    pressureActiveBackgroundTurns:
      numberValue(payload.activeBackgroundTurns) ?? numberValue(payload.active_background_turns),
    pressureQueuedBackgroundTurns:
      numberValue(payload.queuedBackgroundTurns) ?? numberValue(payload.queued_background_turns),
    pressureMaxConcurrentBackgroundTurns:
      numberValue(payload.maxConcurrentBackgroundTurns) ?? numberValue(payload.max_concurrent_background_turns),
    pressureBoundaryNote:
      boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 1_000) ??
      "room pressure boundary recorded; message expression is preserved while wake may be delayed",
  });
}

function pressureBoundaryTokenEstimate(payload: Record<string, unknown>): number {
  const states = pressureBoundaryStatesFromPayload(payload);
  return estimateTokens(
    [
      states.pressureReason,
      states.pressureMessageId,
      states.pressureBoundaryNote,
      [
        states.pressureActiveBackgroundTurns,
        states.pressureQueuedBackgroundTurns,
        states.pressureMaxConcurrentBackgroundTurns,
      ]
        .filter((value): value is number => typeof value === "number")
        .join(" "),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function memoryPressureStatesFromPayload(payload: Record<string, unknown>): ContextRefRecord["states"] {
  return cleanStates({
    memoryPressureReason: stringValue(payload.reason) ?? "pending_memory_proposal_limit",
    memoryPressureTopicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    memoryPressureTriggeringMemoryId:
      stringValue(payload.triggeringMemoryId) ?? stringValue(payload.triggering_memory_id),
    memoryPressurePendingProposalCount:
      numberValue(payload.pendingProposalCount) ?? numberValue(payload.pending_proposal_count),
    memoryPressureThreshold: numberValue(payload.threshold),
    memoryPressureProposedMemoryRefs: arrayOfStrings(payload.proposedMemoryRefs).concat(
      arrayOfStrings(payload.proposed_memory_refs),
    ),
    memoryPressureBoundaryNote:
      boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 1_000) ??
      "public memory pressure boundary recorded; review pending proposals before adding more sediment",
  });
}

function memoryPressureTokenEstimate(payload: Record<string, unknown>): number {
  const states = memoryPressureStatesFromPayload(payload);
  return estimateTokens(
    [
      states.memoryPressureReason,
      states.memoryPressureTriggeringMemoryId,
      states.memoryPressureBoundaryNote,
      ...(states.memoryPressureProposedMemoryRefs ?? []).slice(-12),
      [states.memoryPressurePendingProposalCount, states.memoryPressureThreshold]
        .filter((value): value is number => typeof value === "number")
        .join(" "),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function providerBoundaryStatesFromPayload(payload: Record<string, unknown>): ContextRefRecord["states"] {
  const status = stringValue(payload.status) ?? stringValue(payload.state) ?? "degraded";
  return cleanStates({
    providerBoundaryAgentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    providerBoundaryTopicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id),
    providerBoundaryTriggeringEventId:
      stringValue(payload.triggeringEventId) ?? stringValue(payload.triggering_event_id),
    providerBoundaryPacketId: stringValue(payload.packetId) ?? stringValue(payload.packet_id),
    providerBoundaryKind: stringValue(payload.providerKind) ?? stringValue(payload.provider_kind),
    providerBoundaryLabel: stringValue(payload.providerLabel) ?? stringValue(payload.provider_label),
    providerBoundaryDiagnostic: boundedString(stringValue(payload.diagnostic), 1_000),
    providerBoundaryState: status,
    providerBoundaryRetiredBy: stringValue(payload.retiredBy) ?? stringValue(payload.retired_by),
    providerBoundaryRetirementReason: boundedString(stringValue(payload.reason), 1_000),
    providerBoundaryNote:
      boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 1_000) ??
      (status === "retired"
        ? "provider boundary retirement removes old runtime pressure from current room context; it does not delete ledger or archive history"
        : "provider degradation is not agent silence"),
  });
}

function providerBoundaryTokenEstimate(payload: Record<string, unknown>): number {
  const states = providerBoundaryStatesFromPayload(payload);
  return providerBoundaryStatesTokenEstimate(states);
}

type ProviderBoundaryChoiceUpdate = {
  boundaryRef: RefId;
  kind:
    | "repair_request"
    | "repair_denied"
    | "repair_approved"
    | "repair_result"
    | "retry_protocol"
    | "retired_retry_protocol"
    | "silence"
    | "contested_memory"
    | "archive_carryover";
  refId: RefId;
  agentId?: AgentId;
};

function providerBoundaryChoiceUpdatesForEvent(
  event: RoomEvent,
  payload: Record<string, unknown>,
  sourceRefs: RefId[],
  records: ReadonlyMap<RefId, ContextRefRecord>,
): ProviderBoundaryChoiceUpdate[] {
  const refs = providerBoundaryRefsForEvent(payload, sourceRefs, records);
  const text = providerBoundaryChoiceSearchText(event, payload, records);
  const agentId = providerBoundaryChoiceAgentId(event, payload);

  if (event.event_type === "daily_archive.created") {
    const archiveId = archiveIdFromPayload(event, archiveObjectPayload(payload));
    return providerBoundaryRefsMentionedInArchive(payload, records).map((boundaryRef) => ({
      boundaryRef,
      kind: "archive_carryover",
      refId: archiveId,
      agentId,
    }));
  }

  if (refs.length === 0) {
    return [];
  }

  if (event.event_type === "side_effect.requested" && providerBoundaryChoiceMentionsRepair(text)) {
    const refId = sideEffectRefFromPayload(event, payload);
    return refs.map((boundaryRef) => ({ boundaryRef, kind: "repair_request", refId, agentId }));
  }
  if (event.event_type === "side_effect.denied") {
    const refId = sideEffectRefFromPayload(event, payload);
    return refs.map((boundaryRef) => ({ boundaryRef, kind: "repair_denied", refId, agentId }));
  }
  if (event.event_type === "side_effect.approved") {
    const refId = sideEffectRefFromPayload(event, payload);
    return refs.map((boundaryRef) => ({ boundaryRef, kind: "repair_approved", refId, agentId }));
  }
  if (event.event_type === "side_effect.result_reported") {
    const refId = sideEffectRefFromPayload(event, payload);
    return refs.map((boundaryRef) => ({ boundaryRef, kind: "repair_result", refId, agentId }));
  }
  if (event.event_type === "protocol.proposed" && providerBoundaryChoiceMentionsRetry(text)) {
    const refId = protocolRefFromPayload(event, payload);
    return refs.map((boundaryRef) => ({ boundaryRef, kind: "retry_protocol", refId, agentId }));
  }
  if (
    (event.event_type === "protocol.retired" || event.event_type === "protocol.expired") &&
    providerBoundaryChoiceMentionsRetry(text)
  ) {
    const refId = protocolRefFromPayload(event, payload);
    return refs.map((boundaryRef) => ({ boundaryRef, kind: "retired_retry_protocol", refId, agentId }));
  }
  if (event.event_type === "agent.intention_recorded" && intentionKindFromPayload(payload) === "stay_silent") {
    return refs.map((boundaryRef) => ({ boundaryRef, kind: "silence", refId: event.event_id, agentId }));
  }
  if (event.event_type === "memory.contested") {
    const refId = memoryRefFromPayload(event, payload);
    return refs.map((boundaryRef) => ({ boundaryRef, kind: "contested_memory", refId, agentId }));
  }

  return [];
}

function providerBoundaryChoiceStates(
  existing: ContextRefRecord["states"],
  update: ProviderBoundaryChoiceUpdate,
): ContextRefRecord["states"] {
  const next: ContextRefRecord["states"] = { ...existing };
  if (update.kind === "repair_request") {
    next.providerBoundaryChoiceRepairRequestRefs = appendBoundedUnique(
      next.providerBoundaryChoiceRepairRequestRefs,
      update.refId,
    );
  }
  if (update.kind === "repair_denied") {
    next.providerBoundaryChoiceDeniedRepairRefs = appendBoundedUnique(
      next.providerBoundaryChoiceDeniedRepairRefs,
      update.refId,
    );
  }
  if (update.kind === "repair_approved") {
    next.providerBoundaryChoiceApprovedRepairRefs = appendBoundedUnique(
      next.providerBoundaryChoiceApprovedRepairRefs,
      update.refId,
    );
  }
  if (update.kind === "repair_result") {
    next.providerBoundaryChoiceResultRefs = appendBoundedUnique(next.providerBoundaryChoiceResultRefs, update.refId);
  }
  if (update.kind === "retry_protocol") {
    next.providerBoundaryChoiceRetryProtocolRefs = appendBoundedUnique(
      next.providerBoundaryChoiceRetryProtocolRefs,
      update.refId,
    );
  }
  if (update.kind === "retired_retry_protocol") {
    next.providerBoundaryChoiceRetiredRetryProtocolRefs = appendBoundedUnique(
      next.providerBoundaryChoiceRetiredRetryProtocolRefs,
      update.refId,
    );
  }
  if (update.kind === "silence") {
    next.providerBoundaryChoiceSilenceRefs = appendBoundedUnique(next.providerBoundaryChoiceSilenceRefs, update.refId);
  }
  if (update.kind === "contested_memory") {
    next.providerBoundaryChoiceContestedMemoryRefs = appendBoundedUnique(
      next.providerBoundaryChoiceContestedMemoryRefs,
      update.refId,
    );
  }
  if (update.kind === "archive_carryover") {
    next.providerBoundaryChoiceArchiveCarryoverRefs = appendBoundedUnique(
      next.providerBoundaryChoiceArchiveCarryoverRefs,
      update.refId,
    );
  }
  if (update.agentId) {
    next.providerBoundaryChoiceAgentIds = appendBoundedUnique(next.providerBoundaryChoiceAgentIds, update.agentId);
  }

  const choiceKindCount = providerBoundaryChoiceKindCount(next);
  next.providerBoundaryChoiceKindCount = choiceKindCount;
  next.providerBoundaryChoiceHasMixedChoices = choiceKindCount >= 2;
  next.providerBoundaryChoiceHasMultiAgentPressure = (next.providerBoundaryChoiceAgentIds?.length ?? 0) >= 3 && choiceKindCount >= 2;
  next.providerBoundaryChoiceCarriedAcrossArchives = (next.providerBoundaryChoiceArchiveCarryoverRefs?.length ?? 0) > 1;
  next.providerBoundaryChoiceNote =
    "provider boundary choice pressure is observation only; repair, retry, silence, denial, memory contest, and archive carryover remain separate social traces";

  return cleanStates(next);
}

function providerBoundaryStatesTokenEstimate(states: ContextRefRecord["states"]): number {
  return estimateTokens(
    [
      states.providerBoundaryAgentId,
      states.providerBoundaryKind,
      states.providerBoundaryLabel,
      states.providerBoundaryDiagnostic,
      states.providerBoundaryState,
      states.providerBoundaryRetiredBy,
      states.providerBoundaryRetirementReason,
      states.providerBoundaryNote,
      states.providerBoundaryTriggeringEventId,
      states.providerBoundaryPacketId,
      ...(states.providerBoundaryChoiceRepairRequestRefs ?? []),
      ...(states.providerBoundaryChoiceDeniedRepairRefs ?? []),
      ...(states.providerBoundaryChoiceApprovedRepairRefs ?? []),
      ...(states.providerBoundaryChoiceResultRefs ?? []),
      ...(states.providerBoundaryChoiceRetryProtocolRefs ?? []),
      ...(states.providerBoundaryChoiceRetiredRetryProtocolRefs ?? []),
      ...(states.providerBoundaryChoiceSilenceRefs ?? []),
      ...(states.providerBoundaryChoiceContestedMemoryRefs ?? []),
      ...(states.providerBoundaryChoiceArchiveCarryoverRefs ?? []),
      ...(states.providerBoundaryChoiceAgentIds ?? []),
      states.providerBoundaryChoiceNote,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function providerBoundaryChoiceKindCount(states: ContextRefRecord["states"]): number {
  return [
    states.providerBoundaryChoiceRepairRequestRefs,
    states.providerBoundaryChoiceDeniedRepairRefs,
    states.providerBoundaryChoiceApprovedRepairRefs,
    states.providerBoundaryChoiceResultRefs,
    states.providerBoundaryChoiceRetryProtocolRefs,
    states.providerBoundaryChoiceRetiredRetryProtocolRefs,
    states.providerBoundaryChoiceSilenceRefs,
    states.providerBoundaryChoiceContestedMemoryRefs,
  ].filter((refs) => (refs?.length ?? 0) > 0).length;
}

function providerBoundaryRefsForEvent(
  payload: Record<string, unknown>,
  sourceRefs: RefId[],
  records: ReadonlyMap<RefId, ContextRefRecord>,
): RefId[] {
  const refs = new Set<RefId>();
  const serializedPayload = JSON.stringify(payload);
  for (const ref of sourceRefs) {
    addProviderBoundaryRefsFromRef(ref, records, refs);
  }
  for (const record of records.values()) {
    if (record.refType === "provider_boundary" && serializedPayload.includes(record.refId)) {
      refs.add(record.refId);
    }
  }
  return [...refs];
}

function addProviderBoundaryRefsFromRef(
  ref: RefId,
  records: ReadonlyMap<RefId, ContextRefRecord>,
  refs: Set<RefId>,
): void {
  const record = records.get(ref);
  if (record?.refType === "provider_boundary") {
    refs.add(ref);
    return;
  }
  for (const sourceRef of record?.sourceRefs ?? []) {
    if (records.get(sourceRef)?.refType === "provider_boundary") {
      refs.add(sourceRef);
    }
  }
}

function providerBoundaryRefsMentionedInArchive(
  payload: Record<string, unknown>,
  records: ReadonlyMap<RefId, ContextRefRecord>,
): RefId[] {
  const serializedPayload = JSON.stringify(payload);
  return [...records.values()]
    .filter((record) => record.refType === "provider_boundary")
    .filter((record) => serializedPayload.includes(record.refId))
    .map((record) => record.refId);
}

function providerBoundaryChoiceSearchText(
  event: RoomEvent,
  payload: Record<string, unknown>,
  records: ReadonlyMap<RefId, ContextRefRecord>,
): string {
  const directText = `${event.event_type} ${event.refs.join(" ")} ${JSON.stringify(payload)}`;
  const recordText = event.refs
    .map((ref) => records.get(ref)?.states)
    .filter((states): states is ContextRefRecord["states"] => states !== undefined)
    .map((states) => JSON.stringify(states))
    .join(" ");
  return `${directText} ${recordText}`.toLowerCase();
}

function providerBoundaryChoiceMentionsRepair(text: string): boolean {
  return /\b(provider|runtime|diagnostic|repair|fix|snapshot|version)\b|运行时|诊断|修复|快照|版本/.test(text);
}

function providerBoundaryChoiceMentionsRetry(text: string): boolean {
  return /\b(retry|later|again|recheck)\b|重试|稍后|之后|复查/.test(text);
}

function providerBoundaryChoiceAgentId(event: RoomEvent, payload: Record<string, unknown>): AgentId | undefined {
  if (event.actor.kind === "agent") {
    return event.actor.id;
  }
  return (
    stringValue(payload.agentId) ??
    stringValue(payload.agent_id) ??
    stringValue(payload.requestedBy) ??
    stringValue(payload.requested_by) ??
    stringValue(payload.proposedBy) ??
    stringValue(payload.proposed_by) ??
    stringValue(payload.retiredBy) ??
    stringValue(payload.retired_by) ??
    stringValue(payload.contestedBy) ??
    stringValue(payload.contested_by) ??
    stringValue(payload.approvedBy) ??
    stringValue(payload.approved_by) ??
    stringValue(payload.deniedBy) ??
    stringValue(payload.denied_by) ??
    stringValue(payload.expiredBy) ??
    stringValue(payload.expired_by) ??
    stringValue(payload.decidedBy) ??
    stringValue(payload.decided_by)
  );
}

function mixedReviewTraceFromEvent(
  event: RoomEvent,
  payload: Record<string, unknown>,
  fallbackTopicId: TopicId | undefined,
): MixedReviewContextTrace | undefined {
  const base = {
    eventId: event.event_id,
    responderId: mixedReviewResponderId(event, payload),
    response: mixedReviewResponse(event, payload),
    topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? fallbackTopicId,
    sourceMessageId: mixedReviewSourceMessageId(event, payload),
  };
  if (event.event_type === "memory.reviewed") {
    const targetRef = memoryRefFromPayload(event, payload);
    return { ...base, subject: "memory claim", targetRef };
  }
  if (event.event_type === "protocol.reviewed") {
    const targetRef = protocolRefFromPayload(event, payload);
    return { ...base, subject: "protocol", targetRef };
  }
  if (event.event_type === "handoff.reviewed") {
    const targetRef = handoffRefFromPayload(event, payload);
    return { ...base, subject: "handoff", targetRef };
  }
  if (event.event_type === "persona_delta.reviewed") {
    const targetRef = personaDeltaRefFromPayload(event, payload);
    return { ...base, subject: "persona delta", targetRef };
  }
  if (event.event_type === "topic.reviewed") {
    const targetRef = topicProposalRefFromPayload(event, payload);
    return { ...base, subject: "topic proposal", targetRef };
  }
  if (event.event_type === "open_question.responded") {
    const targetRef = openQuestionRefFromPayload(event, payload);
    return { ...base, subject: "open question", targetRef, response: stringValue(payload.response) ?? "responded" };
  }
  if (event.event_type === "agent.invitation_reviewed") {
    const targetRef = invitationRefFromPayload(event, payload);
    return { ...base, subject: "invitation", targetRef };
  }
  if (event.event_type === "side_effect.reviewed") {
    const targetRef = sideEffectRefFromPayload(event, payload);
    return { ...base, subject: "side-effect request", targetRef };
  }
  if (event.event_type === "workspace.artifact_reviewed") {
    const targetRef = workspaceArtifactRefFromPayload(event, payload);
    return { ...base, subject: "workspace artifact", targetRef };
  }
  if (event.event_type === "skill.capsule_reviewed") {
    const targetRef = skillCapsuleRefFromPayload(event, payload);
    return { ...base, subject: "skill capsule", targetRef };
  }
  if (event.event_type === "capability.reviewed") {
    const targetRef = capabilityRefFromPayload(event, payload);
    return { ...base, subject: "capability hint", targetRef };
  }
  if (event.event_type === "archive.repair_reviewed") {
    const targetRef = archiveRepairRefFromPayload(event, payload);
    return { ...base, subject: "archive repair", targetRef };
  }
  return undefined;
}

function mixedReviewSourceMessageId(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.sourceMessageId) ??
    stringValue(payload.source_message_id) ??
    stringValue(payload.sourceMessageRef) ??
    stringValue(payload.source_message_ref) ??
    event.causation_id ??
    event.correlation_id ??
    event.event_id
  );
}

function mixedReviewPressureRef(sourceMessageId: RefId, correlation: string): RefId {
  return `mixed_review:${sourceMessageId}:${correlation}`;
}

function mixedReviewResponderId(event: RoomEvent, payload: Record<string, unknown>): AgentId {
  return (
    stringValue(payload.agentId) ??
    stringValue(payload.agent_id) ??
    stringValue(payload.byAgentId) ??
    stringValue(payload.by_agent_id) ??
    event.actor.id
  );
}

function mixedReviewResponse(event: RoomEvent, payload: Record<string, unknown>): string {
  return stringValue(payload.response) ?? (event.event_type === "open_question.responded" ? "responded" : "reviewed");
}

function isMixedReviewPressureGroup(traces: readonly MixedReviewContextTrace[]): boolean {
  if (traces.length < 2) return false;
  const subjects = new Set(traces.map((trace) => trace.subject));
  const targets = new Set(traces.map((trace) => `${trace.subject}:${trace.targetRef}`));
  return subjects.size >= 2 && targets.size >= 2;
}

function mixedReviewPressureStatesFromTraces(traces: readonly MixedReviewContextTrace[]): ContextRefRecord["states"] {
  const responseKindCounts: Record<string, number> = {};
  for (const trace of traces) {
    responseKindCounts[trace.response] = (responseKindCounts[trace.response] ?? 0) + 1;
  }
  return cleanStates({
    mixedReviewSourceMessageId: traces.at(-1)?.sourceMessageId,
    mixedReviewTopicId: traces.find((trace) => trace.topicId)?.topicId,
    mixedReviewAgentIds: unique(traces.map((trace) => trace.responderId)).slice(0, 12),
    mixedReviewResponseKindCounts: responseKindCounts,
    mixedReviewObjectCount: traces.length,
    mixedReviewTouchedRefs: unique(traces.map((trace) => trace.targetRef)).slice(0, 12),
    mixedReviewTouchedObjects: unique(traces.map((trace) => `${trace.subject} ${trace.targetRef}`)).slice(0, 12),
    mixedReviewTraceEventRefs: unique(traces.map((trace) => trace.eventId)).slice(0, 12),
    mixedReviewBoundaryNote:
      "mixed social review pressure is projection only; individual review traces remain ledgered and no lifecycle state changes are inferred",
  });
}

function mixedReviewPressureTokenEstimate(states: ContextRefRecord["states"]): number {
  return estimateTokens(
    [
      states.mixedReviewSourceMessageId,
      states.mixedReviewTopicId,
      ...(states.mixedReviewAgentIds ?? []),
      ...(states.mixedReviewTouchedRefs ?? []),
      ...(states.mixedReviewTouchedObjects ?? []),
      ...(states.mixedReviewTraceEventRefs ?? []),
      JSON.stringify(states.mixedReviewResponseKindCounts ?? {}),
      states.mixedReviewBoundaryNote,
      states.mixedReviewPressureLastReview,
      states.mixedReviewPressureLastReviewSummary,
      states.mixedReviewPressureLastReviewedBy,
      states.mixedReviewPressureLastReviewRef,
      states.mixedReviewPressureReviewBoundaryNote,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function sideEffectRefFromPayload(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.requestId) ??
    stringValue(payload.request_id) ??
    stringValue(payload.approvalId) ??
    stringValue(payload.approval_id) ??
    event.refs[0] ??
    event.event_id
  );
}

function protocolRefFromPayload(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.protocolId) ??
    stringValue(payload.protocol_id) ??
    stringValue(payload.protocolRef) ??
    stringValue(payload.protocol_ref) ??
    event.refs[0] ??
    event.event_id
  );
}

function handoffRefFromPayload(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.handoffId) ??
    stringValue(payload.handoff_id) ??
    stringValue(payload.handoffRef) ??
    stringValue(payload.handoff_ref) ??
    event.refs[0] ??
    event.event_id
  );
}

function personaDeltaRefFromPayload(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.deltaId) ??
    stringValue(payload.delta_id) ??
    stringValue(payload.deltaRef) ??
    stringValue(payload.delta_ref) ??
    stringValue(payload.personaDeltaRef) ??
    stringValue(payload.persona_delta_ref) ??
    event.refs[0] ??
    event.event_id
  );
}

function topicProposalRefFromPayload(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.topicProposalRef) ??
    stringValue(payload.topic_proposal_ref) ??
    stringValue(payload.proposalId) ??
    stringValue(payload.proposal_id) ??
    stringValue(payload.topicProposalId) ??
    stringValue(payload.topic_proposal_id) ??
    event.refs[0] ??
    event.event_id
  );
}

function openQuestionRefFromPayload(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.questionRef) ??
    stringValue(payload.question_ref) ??
    stringValue(payload.openQuestionRef) ??
    stringValue(payload.open_question_ref) ??
    event.refs[0] ??
    event.event_id
  );
}

function invitationRefFromPayload(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.invitationRef) ??
    stringValue(payload.invitation_ref) ??
    stringValue(payload.invitationId) ??
    stringValue(payload.invitation_id) ??
    event.refs[0] ??
    event.event_id
  );
}

function workspaceArtifactRefFromPayload(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.artifactRef) ??
    stringValue(payload.artifact_ref) ??
    stringValue(payload.artifactId) ??
    stringValue(payload.artifact_id) ??
    event.refs[0] ??
    event.event_id
  );
}

function skillCapsuleRefFromPayload(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.capsuleRef) ??
    stringValue(payload.capsule_ref) ??
    stringValue(payload.capsuleId) ??
    stringValue(payload.capsule_id) ??
    event.refs[0] ??
    event.event_id
  );
}

function capabilityRefFromPayload(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.capabilityRef) ??
    stringValue(payload.capability_ref) ??
    stringValue(payload.capabilityId) ??
    stringValue(payload.capability_id) ??
    event.refs[0] ??
    event.event_id
  );
}

function archiveRepairRefFromPayload(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.repairRef) ??
    stringValue(payload.repair_ref) ??
    stringValue(payload.repairId) ??
    stringValue(payload.repair_id) ??
    event.refs[0] ??
    event.event_id
  );
}

function memoryRefFromPayload(event: RoomEvent, payload: Record<string, unknown>): RefId {
  return (
    stringValue(payload.memoryId) ??
    stringValue(payload.memory_id) ??
    stringValue(payload.memoryRef) ??
    stringValue(payload.memory_ref) ??
    event.refs[0] ??
    event.event_id
  );
}

function intentionKindFromPayload(payload: Record<string, unknown>): string | undefined {
  const intention = objectPayload(payload.intention);
  return stringValue(intention.kind) ?? stringValue(payload.kind);
}

function appendBoundedUnique(existing: string[] | undefined, value: string, limit = 12): string[] {
  const next = (existing ?? []).filter((item) => item !== value);
  next.push(value);
  return next.slice(-limit);
}

function sideEffectStatesFromPayload(
  event: RoomEvent,
  payload: Record<string, unknown>,
): ContextRefRecord["states"] {
  const sourcePressureRefs = unique(
    arrayOfStrings(payload.sourcePressureRefs)
      .concat(arrayOfStrings(payload.source_pressure_refs))
      .concat(arrayOfStrings(payload.contextRefs))
      .concat(arrayOfStrings(payload.context_refs))
      .concat(event.refs)
      .filter(isMixedReviewPressureRef),
  );
  if (event.event_type === "side_effect.reviewed") {
    return cleanStates({
      sideEffectLastReview: stringValue(payload.response) ?? "reviewed",
      sideEffectLastReviewSummary: boundedString(stringValue(payload.summary), 1_000),
      sideEffectLastReviewedBy: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      sideEffectLastReviewRef: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      sideEffectSourcePressureRefs: sourcePressureRefs,
      sideEffectReviewBoundaryNote:
        boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 1_000) ??
        "side-effect review is a social trace; it does not approve, deny, expire, execute, report a result, or mutate external state",
    });
  }
  return cleanStates({
    sideEffectStatus: stringValue(payload.status) ?? event.event_type.replace("side_effect.", ""),
    sideEffectKind: stringValue(payload.kind) ?? stringValue(payload.actionKind) ?? stringValue(payload.action_kind),
    sideEffectTarget: boundedString(stringValue(payload.target), 800),
    sideEffectRequestedBy: stringValue(payload.requestedBy) ?? stringValue(payload.requested_by),
    sideEffectReason: boundedString(stringValue(payload.reason), 800),
    sideEffectRequestReason: event.event_type === "side_effect.requested" ? boundedString(stringValue(payload.reason), 800) : undefined,
    sideEffectSourcePressureRefs: sourcePressureRefs,
    sideEffectExpectedImpact: boundedString(stringValue(payload.expectedImpact) ?? stringValue(payload.expected_impact), 800),
    sideEffectProposedCommand: boundedString(stringValue(payload.proposedCommand) ?? stringValue(payload.proposed_command), 800),
    sideEffectApprovalId: stringValue(payload.approvalId) ?? stringValue(payload.approval_id),
    sideEffectApprovedBy: stringValue(payload.approvedBy) ?? stringValue(payload.approved_by),
    sideEffectDeniedBy: stringValue(payload.deniedBy) ?? stringValue(payload.denied_by),
    sideEffectExpiredBy: stringValue(payload.expiredBy) ?? stringValue(payload.expired_by),
    sideEffectExpiredAt: stringValue(payload.expiredAt) ?? stringValue(payload.expired_at),
    sideEffectDecisionReason:
      event.event_type === "side_effect.approved" ||
      event.event_type === "side_effect.denied" ||
      event.event_type === "side_effect.expired"
        ? boundedString(stringValue(payload.reason), 800)
        : undefined,
    sideEffectResultStatus: event.event_type === "side_effect.result_reported" ? stringValue(payload.status) : undefined,
    sideEffectResultSummary:
      event.event_type === "side_effect.result_reported" ? boundedString(stringValue(payload.summary), 800) : undefined,
    sideEffectArtifactRefs: boundedArrayOfStrings(payload.artifactRefs, payload.artifact_refs),
  });
}

function sideEffectTokenEstimate(payload: Record<string, unknown>): number {
  return estimateTokens(
    [
      stringValue(payload.kind) ?? stringValue(payload.actionKind) ?? stringValue(payload.action_kind),
      stringValue(payload.target),
      stringValue(payload.reason),
      stringValue(payload.expectedImpact) ?? stringValue(payload.expected_impact),
      stringValue(payload.proposedCommand) ?? stringValue(payload.proposed_command),
      stringValue(payload.summary),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function workspaceArtifactStatesFromPayload(
  event: RoomEvent,
  payload: Record<string, unknown>,
): ContextRefRecord["states"] {
  const sourcePressureRefs = unique(
    arrayOfStrings(payload.sourcePressureRefs)
      .concat(arrayOfStrings(payload.source_pressure_refs))
      .concat(arrayOfStrings(payload.contextRefs))
      .concat(arrayOfStrings(payload.context_refs))
      .concat(event.refs)
      .filter(isMixedReviewPressureRef),
  );
  if (event.event_type === "workspace.artifact_reviewed") {
    return cleanStates({
      workspaceArtifactLastReview: stringValue(payload.response) ?? "reviewed",
      workspaceArtifactLastReviewSummary: boundedString(stringValue(payload.summary), 1_000),
      workspaceArtifactLastReviewedBy: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      workspaceArtifactLastReviewRef: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      workspaceArtifactSourcePressureRefs: sourcePressureRefs,
      workspaceArtifactReviewBoundaryNote:
        boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 1_000) ??
        "workspace artifact review is a social trace; it does not copy private workspace contents, promote public memory, execute tools, or mutate the artifact",
    });
  }
  return cleanStates({
    workspaceArtifactStatus: stringValue(payload.status) ?? "shared",
    workspaceArtifactId: stringValue(payload.artifactId) ?? stringValue(payload.artifact_id),
    workspaceId: stringValue(payload.workspaceId) ?? stringValue(payload.workspace_id),
    workspaceAgentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    workspacePathRef: boundedString(stringValue(payload.pathRef) ?? stringValue(payload.path_ref), 800),
    workspaceArtifactSummary: boundedString(stringValue(payload.summary), 800),
    workspaceArtifactSourcePressureRefs: sourcePressureRefs,
    workspaceBoundaryNote:
      boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 800) ??
      "artifact ref is room-visible; private workspace contents are not copied into memory",
  });
}

function workspaceArtifactTokenEstimate(payload: Record<string, unknown>): number {
  return estimateTokens(
    [
      stringValue(payload.pathRef) ?? stringValue(payload.path_ref),
      stringValue(payload.summary),
      stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function skillCapsuleStatesFromPayload(event: RoomEvent, payload: Record<string, unknown>): ContextRefRecord["states"] {
  const sourcePressureRefs = unique(
    arrayOfStrings(payload.sourcePressureRefs)
      .concat(arrayOfStrings(payload.source_pressure_refs))
      .concat(arrayOfStrings(payload.contextRefs))
      .concat(arrayOfStrings(payload.context_refs))
      .concat(event.refs)
      .filter(isMixedReviewPressureRef),
  );
  if (event.event_type === "skill.capsule_reviewed") {
    return cleanStates({
      skillCapsuleLastReview: stringValue(payload.response) ?? "reviewed",
      skillCapsuleLastReviewSummary: boundedString(stringValue(payload.summary), 1_000),
      skillCapsuleLastReviewedBy: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      skillCapsuleLastReviewRef: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      skillCapsuleSourcePressureRefs: sourcePressureRefs,
      skillCapsuleReviewBoundaryNote:
        boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 1_000) ??
        "skill capsule review is a social trace; it does not register a skill, assign a role, execute tools, bypass approvals, or mutate capability state",
    });
  }
  const sideEffectKinds = boundedArrayOfStrings(payload.sideEffectKinds, payload.side_effect_kinds);
  return cleanStates({
    skillCapsuleStatus: stringValue(payload.status) ?? "registered",
    skillCapsuleId: stringValue(payload.capsuleId) ?? stringValue(payload.capsule_id),
    skillAgentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    skillLabel: boundedString(stringValue(payload.label), 800),
    skillSummary: boundedString(stringValue(payload.summary), 1_000),
    skillTriggerHints: boundedArrayOfStrings(payload.triggerHints, payload.trigger_hints),
    skillSideEffectKinds: sideEffectKinds,
    skillApprovalRequired:
      booleanValue(payload.approvalRequired) ?? booleanValue(payload.approval_required) ?? sideEffectKinds.length > 0,
    skillDisclosurePolicy: stringValue(payload.disclosurePolicy) ?? stringValue(payload.disclosure_policy),
    skillInstructionRef: stringValue(payload.instructionRef) ?? stringValue(payload.instruction_ref),
    skillInputContract: boundedString(stringValue(payload.inputContract) ?? stringValue(payload.input_contract), 1_000),
    skillOutputContract: boundedString(stringValue(payload.outputContract) ?? stringValue(payload.output_contract), 1_000),
    skillApprovalBoundaryNote: boundedString(approvalProfileBoundaryNote(payload), 1_000),
    skillCapsuleSourcePressureRefs: sourcePressureRefs,
    skillBoundaryNote:
      boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 800) ??
      "skill capsule is a possible action organ; it cannot execute or publish without an explicit room event and required approvals",
  });
}

function skillCapsuleTokenEstimate(payload: Record<string, unknown>): number {
  return estimateTokens(
    [
      stringValue(payload.label),
      stringValue(payload.summary),
      stringValue(payload.instructionRef) ?? stringValue(payload.instruction_ref),
      stringValue(payload.inputContract) ?? stringValue(payload.input_contract),
      stringValue(payload.outputContract) ?? stringValue(payload.output_contract),
      ...boundedArrayOfStrings(payload.triggerHints, payload.trigger_hints),
      ...boundedArrayOfStrings(payload.sideEffectKinds, payload.side_effect_kinds),
      stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function approvalProfileBoundaryNote(payload: Record<string, unknown>): string | undefined {
  const camel = objectPayload(payload.approvalProfile);
  const snake = objectPayload(payload.approval_profile);
  return (
    stringValue(camel.boundaryNote) ??
    stringValue(camel.boundary_note) ??
    stringValue(snake.boundaryNote) ??
    stringValue(snake.boundary_note)
  );
}

function capabilityStatesFromPayload(event: RoomEvent, payload: Record<string, unknown>): ContextRefRecord["states"] {
  const sourcePressureRefs = unique(
    arrayOfStrings(payload.sourcePressureRefs)
      .concat(arrayOfStrings(payload.source_pressure_refs))
      .concat(arrayOfStrings(payload.contextRefs))
      .concat(arrayOfStrings(payload.context_refs))
      .concat(event.refs)
      .filter(isMixedReviewPressureRef),
  );
  if (event.event_type === "capability.reviewed") {
    return cleanStates({
      capabilityLastReview: stringValue(payload.response) ?? "reviewed",
      capabilityLastReviewSummary: boundedString(stringValue(payload.summary), 1_000),
      capabilityLastReviewedBy: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      capabilityLastReviewRef: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      capabilitySourcePressureRefs: sourcePressureRefs,
      capabilityReviewBoundaryNote:
        boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 1_000) ??
        "capability review is a social trace; it does not change wake score, assign responsibility, certify competence, mutate reputation, or force speech",
    });
  }

  return cleanStates({
    capabilityState:
      event.event_type === "capability_card.outcome_recorded" ? stringValue(payload.outcome) ?? "outcome_recorded" : "declared",
    capabilityId: stringValue(payload.capabilityId) ?? stringValue(payload.capability_id),
    capabilityAgentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    capabilityType: stringValue(payload.capabilityType) ?? stringValue(payload.capability_type),
    capabilityDomainTags: boundedArrayOfStrings(payload.domainTags, payload.domain_tags),
    capabilityDeclaredConfidence: numberValue(payload.declaredConfidence) ?? numberValue(payload.declared_confidence),
    capabilitySourcePressureRefs: sourcePressureRefs,
    capabilityBoundaryNote:
      boundedString(stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note), 800) ??
      "capability card is an advisory routing hint, not authority or responsibility",
  });
}

function capabilityTokenEstimate(payload: Record<string, unknown>): number {
  return estimateTokens(
    [
      stringValue(payload.capabilityType) ?? stringValue(payload.capability_type),
      ...boundedArrayOfStrings(payload.domainTags, payload.domain_tags),
      stringValue(payload.outcome),
      stringValue(payload.reason),
      stringValue(payload.summary),
      stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function archiveObjectPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const nested = objectPayload(payload.archive);
  return Object.keys(nested).length > 0 ? nested : payload;
}

function archiveIdFromPayload(event: RoomEvent, archivePayload: Record<string, unknown>): RefId {
  return (
    stringValue(archivePayload.archiveId) ??
    stringValue(archivePayload.archive_id) ??
    stringValue(archivePayload.date) ??
    event.event_id
  );
}

function archiveTopicIdsFromPayload(archivePayload: Record<string, unknown>): TopicId[] {
  return unique(
    arrayOfStrings(archivePayload.topicIds)
      .concat(arrayOfStrings(archivePayload.topic_ids))
      .concat(arrayOfStrings(archivePayload.openTopics))
      .concat(arrayOfStrings(archivePayload.open_topics)),
  );
}

function archiveStatesFromPayload(
  event: RoomEvent,
  archivePayload: Record<string, unknown>,
): ContextRefRecord["states"] {
  const range = objectPayload(archivePayload.inputLedgerRange);
  const snakeRange = objectPayload(archivePayload.input_ledger_range);
  const reviewTraces = archiveReviewTracesFromPayload(archivePayload);
  const mixedReviewPressures = archiveMixedReviewPressuresFromPayload(archivePayload);
  const mixedReviewPressureReviews = archiveMixedReviewPressureReviewsFromPayload(archivePayload);
  const latestMixedReviewPressureReview = latestArchiveMixedReviewPressureReview(mixedReviewPressureReviews);
  const readableSkeleton = archiveReadableSkeletonFromPayload(
    event,
    archivePayload,
    reviewTraces,
    mixedReviewPressures,
    mixedReviewPressureReviews,
  );
  return {
    archiveDate: stringValue(archivePayload.date) ?? event.occurred_at.slice(0, 10),
    archiveSummary: boundedString(stringValue(archivePayload.summary), 1_200),
    archiveReadableSkeleton: readableSkeleton.skeleton,
    archiveReviewableSections: readableSkeleton.sections,
    archiveOmittedReadableSections: readableSkeleton.omittedSections,
    archiveTimezone: stringValue(archivePayload.timezone),
    archiveCompressionNote:
      stringValue(archivePayload.compressionNote) ??
      stringValue(archivePayload.compression_note) ??
      "archive_is_compression_not_consensus",
    archiveEventCount:
      numericRecordSum(archivePayload.eventCounts) ??
      numericRecordSum(archivePayload.event_counts) ??
      numberValue(archivePayload.eventCount) ??
      numberValue(archivePayload.event_count),
    archiveMessageHighlightCount: maxArrayCount(archivePayload.messageHighlights, archivePayload.message_highlights),
    archiveDecisionCount: maxArrayCount(archivePayload.decisions),
    archiveDisagreementCount: maxArrayCount(archivePayload.disagreements),
    archiveOpenQuestionCount: maxArrayCount(archivePayload.openQuestions, archivePayload.open_questions),
    archiveOpenQuestionTraceCount: maxArrayCount(
      archivePayload.openQuestionTraces,
      archivePayload.open_question_traces,
      archivePayload.openQuestionRecords,
      archivePayload.open_question_records,
    ),
    archiveMemoryChangeCount: maxArrayCount(archivePayload.memoryChanges, archivePayload.memory_changes),
    archiveTopicProposalCount: maxArrayCount(archivePayload.topicProposals, archivePayload.topic_proposals),
    archiveHandoffCount: maxArrayCount(
      archivePayload.handoffs,
      archivePayload.handoffExchanges,
      archivePayload.handoff_exchanges,
    ),
    archiveProtocolCount: maxArrayCount(
      archivePayload.protocols,
      archivePayload.protocolExchanges,
      archivePayload.protocol_exchanges,
    ),
    archiveInvitationCount: maxArrayCount(
      archivePayload.invitations,
      archivePayload.invitationExchanges,
      archivePayload.invitation_exchanges,
    ),
    archiveSilenceCount: maxArrayCount(
      archivePayload.silences,
      archivePayload.deliberateSilences,
      archivePayload.deliberate_silences,
    ),
    archivePersonaDeltaCount: maxArrayCount(archivePayload.personaDeltas, archivePayload.persona_deltas),
    archiveSideEffectBoundaryCount: maxArrayCount(
      archivePayload.sideEffectBoundaries,
      archivePayload.side_effect_boundaries,
    ),
    archiveWorkspaceBoundaryCount: maxArrayCount(
      archivePayload.workspaceBoundaries,
      archivePayload.workspace_boundaries,
    ),
    archiveWorkspaceArtifactCount: maxArrayCount(archivePayload.workspaceArtifacts, archivePayload.workspace_artifacts),
    archiveSkillCapsuleCount: maxArrayCount(archivePayload.skillCapsules, archivePayload.skill_capsules),
    archiveCapabilityReviewCount: maxArrayCount(archivePayload.capabilityReviews, archivePayload.capability_reviews),
    archivePressureBoundaryCount: maxArrayCount(archivePayload.pressureBoundaries, archivePayload.pressure_boundaries),
    archiveProviderBoundaryCount: maxArrayCount(archivePayload.providerBoundaries, archivePayload.provider_boundaries),
    archiveMemoryPressureBoundaryCount: maxArrayCount(
      archivePayload.memoryPressureBoundaries,
      archivePayload.memory_pressure_boundaries,
    ),
    archiveReviewTraceCount: reviewTraces.length,
    archiveReviewTraceTypes: unique(reviewTraces.map((trace) => trace.type)).sort(),
    archiveReviewSubjectRefs: unique(reviewTraces.map((trace) => trace.subjectRef)).sort().slice(0, 8),
    archiveReviewEventRefs: unique(reviewTraces.map((trace) => trace.eventRef)).sort().slice(0, 8),
    archiveReviewBoundaryNote:
      reviewTraces.length > 0
        ? "Archive carries social review traces as pressure, not closure, consensus, or object lifecycle transitions."
        : undefined,
    archiveMixedReviewPressureCount: mixedReviewPressures.length,
    archiveMixedReviewSourceMessageRefs: unique(
      mixedReviewPressures.flatMap((pressure) => (pressure.sourceMessageId ? [pressure.sourceMessageId] : [])),
    )
      .sort()
      .slice(0, 8),
    archiveMixedReviewTouchedRefs: unique(mixedReviewPressures.flatMap((pressure) => pressure.touchedRefs))
      .sort()
      .slice(0, 8),
    archiveMixedReviewTraceEventRefs: unique(mixedReviewPressures.flatMap((pressure) => pressure.traceEventIds))
      .sort()
      .slice(0, 8),
    archiveMixedReviewBoundaryNote:
      mixedReviewPressures.length > 0
        ? "Archive carries mixed social review pressure groups as unresolved context, not closure, consensus, or object lifecycle transitions."
        : undefined,
    archiveMixedReviewPressureReviewCount: mixedReviewPressureReviews.length,
    archiveMixedReviewPressureReviewedRefs: unique(mixedReviewPressureReviews.map((review) => review.pressureRef))
      .sort()
      .slice(0, 8),
    archiveMixedReviewPressureReviewEventRefs: unique(
      mixedReviewPressureReviews.flatMap((review) => (review.eventIds.length > 0 ? review.eventIds : [review.reviewId])),
    )
      .sort()
      .slice(0, 8),
    archiveMixedReviewPressureReviewResponses: mixedReviewPressureReviews
      .map((review) =>
        boundedString(
          `${review.agentId ?? "agent"} ${review.response} ${review.pressureRef}: ${review.summary}`,
          300,
        ),
      )
      .filter((value): value is string => Boolean(value))
      .slice(0, 6),
    archiveMixedReviewPressureReviewResponseKindCounts: countByStringValues(
      mixedReviewPressureReviews.map((review) => review.response),
    ),
    archiveMixedReviewPressureReviewAgentIds: unique(
      mixedReviewPressureReviews.flatMap((review) => (review.agentId ? [review.agentId] : [])),
    )
      .sort()
      .slice(0, 8),
    archiveMixedReviewPressureReviewLatest: latestMixedReviewPressureReview
      ? boundedString(
          `${latestMixedReviewPressureReview.agentId ?? "agent"} ${latestMixedReviewPressureReview.response} ${latestMixedReviewPressureReview.pressureRef}: ${latestMixedReviewPressureReview.summary}`,
          360,
        )
      : undefined,
    archiveMixedReviewPressureReviewEvolutionNote:
      mixedReviewPressureReviews.length > 1
        ? "Multiple mixed review pressure reviews are an evolution trace across room time. Later reviews may question, narrow, retire, caution, defer, or leave pressure alone; they do not apply a state transition by themselves."
        : mixedReviewPressureReviews.length === 1
          ? "Single mixed review pressure review is a social trace, not a lifecycle transition."
          : undefined,
    archiveMixedReviewPressureReviewBoundaryNote:
      mixedReviewPressureReviews.length > 0
        ? "Archive carries mixed review pressure reviews as social traces only; they do not close, narrow, retire, delete, resolve, or mutate the underlying pressure."
        : undefined,
    archiveContestedCount: maxArrayCount(archivePayload.contestedItems, archivePayload.contested_items),
    archiveInputFromOffset: numberValue(range.fromOffset) ?? numberValue(snakeRange.from_offset),
    archiveInputToOffset: numberValue(range.toOffset) ?? numberValue(snakeRange.to_offset),
    archiveRevisionOf: stringValue(archivePayload.revisionOf) ?? stringValue(archivePayload.revision_of),
    archiveAppliedRepairRef: stringValue(archivePayload.appliedRepairRef) ?? stringValue(archivePayload.applied_repair_ref),
    archiveRevisionReason: boundedString(
      stringValue(archivePayload.revisionReason) ?? stringValue(archivePayload.revision_reason),
      1_000,
    ),
    archiveProvenanceRefs: arrayOfStrings(archivePayload.provenanceRefs).concat(
      arrayOfStrings(archivePayload.provenance_refs),
    ),
  };
}

function archiveReviewStatesFromPayload(payload: Record<string, unknown>): ContextRefRecord["states"] {
  return {
    archiveRef: stringValue(payload.archiveRef) ?? stringValue(payload.archive_ref),
    archiveReviewAssessment: stringValue(payload.assessment),
    archiveReviewSummary: boundedString(stringValue(payload.summary), 1_000),
    archiveReviewReason: boundedString(stringValue(payload.reason), 1_000),
    archiveBoundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "archive review is room-visible critique, not archive mutation",
  };
}

function archiveReviewRequestStatesFromPayload(payload: Record<string, unknown>): ContextRefRecord["states"] {
  return {
    archiveRef: stringValue(payload.archiveRef) ?? stringValue(payload.archive_ref),
    archiveReviewSummary: boundedString(stringValue(payload.summary), 1_000),
    archiveReviewReason: boundedString(stringValue(payload.reason), 1_000),
    archiveRepairStatus: stringValue(payload.status) ?? "open",
    archiveBoundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "daily archive review request is a room rhythm invitation, not a command to speak",
  };
}

type ArchiveReviewTraceSummary = {
  type: string;
  subjectRef: string;
  eventRef: string;
};

type ArchiveMixedReviewPressureSummary = {
  sourceMessageId?: string;
  touchedRefs: string[];
  traceEventIds: string[];
};

type ArchiveMixedReviewPressureReviewSummary = {
  reviewId: string;
  pressureRef: string;
  agentId?: string;
  response: string;
  summary: string;
  eventIds: string[];
};

type ArchiveReadableSkeleton = {
  skeleton?: string;
  sections: string[];
  omittedSections: string[];
};

function archiveReviewTracesFromPayload(archivePayload: Record<string, unknown>): ArchiveReviewTraceSummary[] {
  const traces: ArchiveReviewTraceSummary[] = [];
  for (const protocol of arrayOfRecords(archivePayload.protocols).concat(arrayOfRecords(archivePayload.protocol_exchanges))) {
    const subjectRef = stringValue(protocol.protocolId) ?? stringValue(protocol.protocol_id);
    traces.push(...reviewTracesFromNested(protocol.reviews, "protocol", subjectRef));
  }
  for (const handoff of arrayOfRecords(archivePayload.handoffs).concat(arrayOfRecords(archivePayload.handoff_exchanges))) {
    const subjectRef = stringValue(handoff.handoffId) ?? stringValue(handoff.handoff_id);
    traces.push(...reviewTracesFromNested(handoff.reviews, "handoff", subjectRef));
  }
  for (const proposal of arrayOfRecords(archivePayload.topicProposals).concat(arrayOfRecords(archivePayload.topic_proposals))) {
    const subjectRef =
      stringValue(proposal.proposalId) ??
      stringValue(proposal.proposal_id) ??
      stringValue(proposal.topicProposalId) ??
      stringValue(proposal.topic_proposal_id);
    traces.push(...reviewTracesFromNested(proposal.reviews, "topic_proposal", subjectRef));
  }
  for (const question of arrayOfRecords(archivePayload.openQuestionTraces).concat(arrayOfRecords(archivePayload.open_question_traces))) {
    const subjectRef = stringValue(question.questionId) ?? stringValue(question.question_id);
    traces.push(...reviewTracesFromNested(question.responses, "open_question", subjectRef));
  }
  for (const delta of arrayOfRecords(archivePayload.personaDeltas).concat(arrayOfRecords(archivePayload.persona_deltas))) {
    const status = stringValue(delta.status);
    const subjectRef = stringValue(delta.deltaId) ?? stringValue(delta.delta_id);
    const eventRef = stringValue(delta.eventId) ?? stringValue(delta.event_id);
    if (status === "reviewed" && subjectRef && eventRef) {
      traces.push({ type: "persona_delta", subjectRef, eventRef });
    }
  }
  return traces;
}

function archiveMixedReviewPressuresFromPayload(
  archivePayload: Record<string, unknown>,
): ArchiveMixedReviewPressureSummary[] {
  return arrayOfRecords(archivePayload.mixedReviewPressures)
    .concat(arrayOfRecords(archivePayload.mixed_review_pressures))
    .map((pressure) => ({
      sourceMessageId: stringValue(pressure.sourceMessageId) ?? stringValue(pressure.source_message_id),
      touchedRefs: arrayOfStrings(pressure.touchedRefs).concat(arrayOfStrings(pressure.touched_refs)),
      traceEventIds: arrayOfStrings(pressure.traceEventIds).concat(arrayOfStrings(pressure.trace_event_ids)),
    }));
}

function archiveMixedReviewPressureReviewsFromPayload(
  archivePayload: Record<string, unknown>,
): ArchiveMixedReviewPressureReviewSummary[] {
  return arrayOfRecords(archivePayload.mixedReviewPressureReviews)
    .concat(arrayOfRecords(archivePayload.mixed_review_pressure_reviews))
    .map((review) => ({
      reviewId: stringValue(review.reviewId) ?? stringValue(review.review_id) ?? "",
      pressureRef:
        stringValue(review.pressureRef) ??
        stringValue(review.pressure_ref) ??
        stringValue(review.mixedReviewPressureRef) ??
        stringValue(review.mixed_review_pressure_ref) ??
        "",
      agentId: stringValue(review.agentId) ?? stringValue(review.agent_id),
      response: stringValue(review.response) ?? "reviewed",
      summary: boundedString(stringValue(review.summary), 800) ?? "",
      eventIds: arrayOfStrings(review.eventIds)
        .concat(arrayOfStrings(review.event_ids))
        .concat(optionalStringRef(stringValue(review.eventId) ?? stringValue(review.event_id))),
    }))
    .filter((review) => review.pressureRef);
}

function latestArchiveMixedReviewPressureReview(
  reviews: readonly ArchiveMixedReviewPressureReviewSummary[],
): ArchiveMixedReviewPressureReviewSummary | undefined {
  return reviews.length > 0 ? reviews[reviews.length - 1] : undefined;
}

function archiveReadableSkeletonFromPayload(
  event: RoomEvent,
  archivePayload: Record<string, unknown>,
  reviewTraces: readonly ArchiveReviewTraceSummary[],
  mixedReviewPressures: readonly ArchiveMixedReviewPressureSummary[],
  mixedReviewPressureReviews: readonly ArchiveMixedReviewPressureReviewSummary[],
): ArchiveReadableSkeleton {
  const sections: string[] = [];
  const omittedSections: string[] = [];
  const lines: string[] = [];
  const maxChars = 2_400;

  const appendLine = (label: string, line: string): void => {
    const trimmed = boundedString(line.replace(/\s+/g, " ").trim(), 420);
    if (!trimmed) return;
    const nextLength = lines.join("\n").length + trimmed.length + (lines.length > 0 ? 1 : 0);
    if (nextLength > maxChars) {
      omittedSections.push(`${label}: omitted from readable skeleton budget`);
      return;
    }
    lines.push(trimmed);
  };

  const addSection = (label: string, items: readonly string[], limit = 3): void => {
    const cleaned = items.map((item) => boundedString(item.replace(/\s+/g, " ").trim(), 220)).filter((item): item is string => Boolean(item));
    if (cleaned.length === 0) return;
    sections.push(label);
    if (cleaned.length > limit) {
      omittedSections.push(`${label}: ${cleaned.length - limit} more item(s) not shown`);
    }
    appendLine(label, `${label}: ${cleaned.slice(0, limit).join(" | ")}`);
  };

  const archiveDate = stringValue(archivePayload.date) ?? event.occurred_at.slice(0, 10);
  const archiveTimezone = stringValue(archivePayload.timezone);
  const summary = boundedString(stringValue(archivePayload.summary), 500);
  const range = objectPayload(archivePayload.inputLedgerRange);
  const snakeRange = objectPayload(archivePayload.input_ledger_range);
  const fromOffset = numberValue(range.fromOffset) ?? numberValue(snakeRange.from_offset);
  const toOffset = numberValue(range.toOffset) ?? numberValue(snakeRange.to_offset);
  const eventCount =
    numericRecordSum(archivePayload.eventCounts) ??
    numericRecordSum(archivePayload.event_counts) ??
    numberValue(archivePayload.eventCount) ??
    numberValue(archivePayload.event_count);

  appendLine("Boundary", "Boundary: this is a compressed daily time skeleton, not consensus, truth, or rewritten chat history.");
  appendLine(
    "Day",
    `Day: ${archiveDate}${archiveTimezone ? ` ${archiveTimezone}` : ""}${
      typeof fromOffset === "number" || typeof toOffset === "number"
        ? `; ledger window ${fromOffset ?? "?"}-${toOffset ?? "?"}`
        : ""
    }${typeof eventCount === "number" ? `; ${eventCount} ledger event(s)` : ""}.`,
  );
  appendLine("Summary", `Summary: ${summary ?? "no human summary recorded"}.`);
  const eventCountsLine = archiveEventCountsLine(archivePayload);
  if (eventCountsLine) appendLine("Event counts", eventCountsLine);

  addSection(
    "Message highlights",
    archiveRecords(archivePayload, "messageHighlights", "message_highlights").map(archivePlainItemLine),
    6,
  );
  addSection("Decisions", archiveRecords(archivePayload, "decisions").map(archivePlainItemLine));
  addSection("Disagreements", archiveRecords(archivePayload, "disagreements").map(archivePlainItemLine));
  addSection(
    "Open questions",
    archiveRecords(archivePayload, "openQuestions", "open_questions").map(archiveOpenQuestionLine),
  );
  addSection(
    "Memory changes",
    archiveRecords(archivePayload, "memoryChanges", "memory_changes").map(archiveMemoryChangeLine),
  );
  addSection(
    "Review traces",
    reviewTraces.map((trace) => `${trace.type} review on ${trace.subjectRef} via ${trace.eventRef}`),
    4,
  );
  addSection(
    "Mixed review pressures",
    mixedReviewPressures.map(
      (pressure) =>
        `source ${pressure.sourceMessageId ?? "unknown"} touched ${
          pressure.touchedRefs.length > 0 ? pressure.touchedRefs.slice(0, 4).join(", ") : "unlisted refs"
        }`,
    ),
  );
  addSection(
    "Mixed review pressure reviews",
    mixedReviewPressureReviews.map(
      (review) => `${review.agentId ?? "agent"} ${review.response} ${review.pressureRef}: ${review.summary}`,
    ),
  );
  addSection(
    "Topic proposals",
    archiveRecords(archivePayload, "topicProposals", "topic_proposals").map((record) =>
      archiveSocialRecordLine(record, ["proposalId", "proposal_id"], ["title", "summary", "reason"], "status"),
    ),
  );
  addSection(
    "Handoffs",
    archiveRecords(archivePayload, "handoffs", "handoffExchanges", "handoff_exchanges").map((record) =>
      archiveSocialRecordLine(record, ["handoffId", "handoff_id"], ["reason", "requestedResponse", "requested_response"], "status"),
    ),
  );
  addSection(
    "Protocols",
    archiveRecords(archivePayload, "protocols", "protocolExchanges", "protocol_exchanges").map((record) =>
      archiveSocialRecordLine(record, ["protocolId", "protocol_id"], ["summary", "reason", "scope"], "status"),
    ),
  );
  addSection(
    "Invitations",
    archiveRecords(archivePayload, "invitations", "invitationExchanges", "invitation_exchanges").map((record) =>
      archiveSocialRecordLine(record, ["invitationId", "invitation_id"], ["reason", "boundaryNote", "boundary_note"], "status"),
    ),
  );
  addSection(
    "Deliberate silences",
    archiveRecords(archivePayload, "silences", "deliberateSilences", "deliberate_silences").map((record) =>
      archiveSocialRecordLine(record, ["silenceId", "silence_id"], ["reason", "boundaryNote", "boundary_note"], "agentId"),
    ),
  );
  addSection(
    "Persona deltas",
    archiveRecords(archivePayload, "personaDeltas", "persona_deltas").map((record) =>
      archiveSocialRecordLine(record, ["deltaId", "delta_id"], ["summary", "reason", "valueSummary", "value_summary"], "status"),
    ),
  );
  addSection(
    "Side-effect boundaries",
    archiveRecords(archivePayload, "sideEffectBoundaries", "side_effect_boundaries").map((record) =>
      archiveSocialRecordLine(record, ["requestId", "request_id"], ["reason", "target", "boundaryNote", "boundary_note"], "status"),
    ),
  );
  addSection(
    "Pressure boundaries",
    archiveRecords(archivePayload, "pressureBoundaries", "pressure_boundaries").map((record) =>
      archiveSocialRecordLine(record, ["messageId", "message_id"], ["reason", "boundaryNote", "boundary_note"], "activeBackgroundTurns"),
    ),
  );
  addSection(
    "Workspace boundaries",
    archiveRecords(archivePayload, "workspaceBoundaries", "workspace_boundaries").map((record) =>
      archiveSocialRecordLine(record, ["workspaceId", "workspace_id"], ["visibility", "boundaryNote", "boundary_note"], "agentId"),
    ),
  );
  addSection(
    "Workspace artifacts",
    archiveRecords(archivePayload, "workspaceArtifacts", "workspace_artifacts").map((record) =>
      archiveSocialRecordLine(record, ["artifactId", "artifact_id"], ["summary", "pathRef", "path_ref", "boundaryNote", "boundary_note"], "status"),
    ),
  );
  addSection(
    "Skill capsules",
    archiveRecords(archivePayload, "skillCapsules", "skill_capsules").map((record) =>
      archiveSocialRecordLine(record, ["capsuleId", "capsule_id"], ["label", "boundaryNote", "boundary_note"], "status"),
    ),
  );
  addSection(
    "Capability reviews",
    archiveRecords(archivePayload, "capabilityReviews", "capability_reviews").map((record) =>
      archiveSocialRecordLine(record, ["reviewId", "review_id"], ["summary", "response", "boundaryNote", "boundary_note"], "response"),
    ),
  );
  addSection(
    "Provider boundaries",
    archiveRecords(archivePayload, "providerBoundaries", "provider_boundaries").map((record) =>
      archiveSocialRecordLine(record, ["agentId", "agent_id"], ["providerLabel", "provider_label", "diagnostic", "boundaryNote", "boundary_note"], "status"),
    ),
  );
  addSection(
    "Memory pressure",
    archiveRecords(archivePayload, "memoryPressureBoundaries", "memory_pressure_boundaries").map((record) =>
      archiveSocialRecordLine(record, ["triggeringMemoryId", "triggering_memory_id"], ["reason", "boundaryNote", "boundary_note"], "pendingProposalCount"),
    ),
  );
  addSection("Contested refs", arrayOfStrings(archivePayload.contestedItems).concat(arrayOfStrings(archivePayload.contested_items)), 5);

  return {
    skeleton: lines.length > 0 ? lines.join("\n") : undefined,
    sections: unique(sections),
    omittedSections: unique(omittedSections),
  };
}

function archiveEventCountsLine(archivePayload: Record<string, unknown>): string | undefined {
  const counts = objectPayload(archivePayload.eventCounts);
  const snakeCounts = objectPayload(archivePayload.event_counts);
  const merged = { ...snakeCounts, ...counts };
  const pairs = Object.entries(merged)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]))
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 8)
    .map(([key, value]) => `${key}=${value}`);
  return pairs.length > 0 ? `Event counts: ${pairs.join(", ")}.` : undefined;
}

function archiveRecords(archivePayload: Record<string, unknown>, ...fields: string[]): Record<string, unknown>[] {
  return fields.flatMap((field) => arrayOfRecords(archivePayload[field]));
}

function archivePlainItemLine(record: Record<string, unknown>): string {
  const summary = archiveFirstString(record, "summary", "title", "question", "reason", "content") ?? summarizeUnknown(record, 180) ?? "item";
  const actor = archiveFirstString(record, "actorId", "actor_id", "agentId", "agent_id", "proposedBy", "proposed_by");
  const topic = archiveFirstString(record, "topicId", "topic_id");
  return [actor ? `${actor}: ${summary}` : summary, topic ? `(topic ${topic})` : undefined].filter(Boolean).join(" ");
}

function archiveOpenQuestionLine(record: Record<string, unknown>): string {
  const question = archiveFirstString(record, "question", "summary", "reason") ?? summarizeUnknown(record, 180) ?? "open question";
  const responses = archiveNestedResponses(record);
  return [question, responses ? `responses: ${responses}` : undefined].filter(Boolean).join("; ");
}

function archiveMemoryChangeLine(record: Record<string, unknown>): string {
  const memoryId = archiveFirstString(record, "memoryId", "memory_id") ?? "memory";
  const fromState = archiveFirstString(record, "fromState", "from_state");
  const toState = archiveFirstString(record, "toState", "to_state");
  const summary = archiveFirstString(record, "summary", "reason") ?? "state changed";
  const transition = [fromState, toState].filter(Boolean).join(" -> ");
  return `${memoryId}${transition ? ` (${transition})` : ""}: ${summary}`;
}

function archiveSocialRecordLine(
  record: Record<string, unknown>,
  idFields: readonly string[],
  textFields: readonly string[],
  statusField?: string,
): string {
  const id = archiveFirstString(record, ...idFields);
  const status = statusField
    ? archiveFirstString(record, statusField, snakeCaseField(statusField))
    : archiveFirstString(record, "status", "state", "response");
  const text = archiveFirstString(record, ...textFields) ?? summarizeUnknown(record, 180) ?? "recorded";
  const responses = archiveNestedResponses(record);
  return [
    id ? `${id}:` : undefined,
    status ? `[${status}]` : undefined,
    text,
    responses ? `responses: ${responses}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

function archiveNestedResponses(record: Record<string, unknown>): string | undefined {
  const responses = arrayOfRecords(record.responses)
    .concat(arrayOfRecords(record.reviews))
    .map((response) => archiveFirstString(response, "response", "summary", "reason", "proposedRevision", "proposed_revision"))
    .filter((value): value is string => Boolean(value))
    .slice(0, 2);
  return responses.length > 0 ? responses.join(" / ") : undefined;
}

function archiveFirstString(record: Record<string, unknown>, ...fields: readonly string[]): string | undefined {
  for (const field of fields) {
    const value = record[field];
    const text =
      stringValue(value) ??
      (typeof value === "number" && Number.isFinite(value) ? String(value) : undefined) ??
      (typeof value === "boolean" ? String(value) : undefined);
    if (text) return boundedString(text, 180);
  }
  return undefined;
}

function snakeCaseField(field: string): string {
  return field.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

function countByStringValues(values: readonly string[]): Record<string, number> | undefined {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    const key = value.trim();
    if (key.length > 0) {
      acc[key] = (acc[key] ?? 0) + 1;
    }
    return acc;
  }, {});
  return Object.keys(counts).length > 0 ? counts : undefined;
}

function reviewTracesFromNested(value: unknown, type: string, subjectRef: string | undefined): ArchiveReviewTraceSummary[] {
  if (!subjectRef) return [];
  return arrayOfRecords(value).flatMap((review) => {
    const eventRef = stringValue(review.eventId) ?? stringValue(review.event_id);
    return eventRef ? [{ type, subjectRef, eventRef }] : [];
  });
}

function archiveRepairProposalStatesFromPayload(payload: Record<string, unknown>): ContextRefRecord["states"] {
  return {
    archiveRef: stringValue(payload.archiveRef) ?? stringValue(payload.archive_ref),
    archiveRepairSummary: boundedString(stringValue(payload.summary), 1_000),
    archiveRepairReason: boundedString(stringValue(payload.reason), 1_000),
    archiveRepairProposedRepair: boundedString(
      stringValue(payload.proposedRepair) ?? stringValue(payload.proposed_repair),
      1_200,
    ),
    archiveRepairRevisedFromRef: stringValue(payload.revisedFromRepairRef) ?? stringValue(payload.revised_from_repair_ref),
    archiveRepairRevisedBy: stringValue(payload.revisedBy) ?? stringValue(payload.revised_by),
    archiveRepairStatus: stringValue(payload.status) ?? "proposed",
    archiveBoundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "archive repair proposal does not rewrite the archive until later room action accepts it",
  };
}

function archiveRepairResponseStatesFromPayload(payload: Record<string, unknown>): ContextRefRecord["states"] {
  return {
    archiveRef: stringValue(payload.repairRef) ?? stringValue(payload.repair_ref),
    archiveRepairResponse: stringValue(payload.response),
    archiveRepairResponseReason: boundedString(stringValue(payload.reason), 1_000),
    archiveRepairProposedRevision: boundedString(
      stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision),
      1_200,
    ),
    archiveRepairStatus: stringValue(payload.status),
    archiveRepairResponseAgentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    archiveBoundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "archive repair response changes repair proposal state only; archive content is unchanged",
  };
}

function archiveRepairReviewStatesFromPayload(payload: Record<string, unknown>): ContextRefRecord["states"] {
  return {
    archiveRef: stringValue(payload.repairRef) ?? stringValue(payload.repair_ref),
    archiveRepairReviewResponse: stringValue(payload.response),
    archiveRepairReviewSummary: boundedString(stringValue(payload.summary), 1_200),
    archiveRepairReviewAgentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    archiveRepairReviewSourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
    archiveRepairStatus: "reviewed",
    archiveBoundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "archive repair review is discussion pressure only; archive content and repair state are unchanged",
  };
}

function archiveRepairApplicationStatesFromPayload(payload: Record<string, unknown>): ContextRefRecord["states"] {
  return {
    archiveRef: stringValue(payload.archiveRef) ?? stringValue(payload.archive_ref),
    archiveAppliedRepairRef: stringValue(payload.repairRef) ?? stringValue(payload.repair_ref),
    archiveRepairApplicationId: stringValue(payload.applicationId) ?? stringValue(payload.application_id),
    archiveRepairRevisedArchiveRef: stringValue(payload.revisedArchiveRef) ?? stringValue(payload.revised_archive_ref),
    archiveRepairAppliedBy: stringValue(payload.appliedBy) ?? stringValue(payload.applied_by),
    archiveRepairReason: boundedString(stringValue(payload.reason), 1_000),
    archiveRepairProposedRepair: boundedString(
      stringValue(payload.proposedRepair) ?? stringValue(payload.proposed_repair),
      1_200,
    ),
    archiveRepairStatus: stringValue(payload.status) ?? "applied",
    archiveRepairAcceptedResponseRefs: arrayOfStrings(payload.acceptedResponseRefs).concat(
      arrayOfStrings(payload.accepted_response_refs),
    ),
    archiveBoundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "explicit room action creates a new archive revision; the original archive remains unchanged",
  };
}

function archiveTokenEstimate(states: ContextRefRecord["states"]): number {
  const countSummary = [
    states.archiveEventCount,
    states.archiveMessageHighlightCount,
    states.archiveDecisionCount,
    states.archiveDisagreementCount,
    states.archiveOpenQuestionCount,
    states.archiveOpenQuestionTraceCount,
    states.archiveMemoryChangeCount,
    states.archiveTopicProposalCount,
    states.archiveHandoffCount,
    states.archiveProtocolCount,
    states.archiveInvitationCount,
    states.archiveSilenceCount,
    states.archivePersonaDeltaCount,
    states.archiveSideEffectBoundaryCount,
    states.archiveWorkspaceBoundaryCount,
    states.archiveWorkspaceArtifactCount,
    states.archiveSkillCapsuleCount,
    states.archiveCapabilityReviewCount,
    states.archivePressureBoundaryCount,
    states.archiveProviderBoundaryCount,
    states.archiveMemoryPressureBoundaryCount,
    states.archiveReviewTraceCount,
    states.archiveMixedReviewPressureCount,
    states.archiveMixedReviewPressureReviewCount,
    states.archiveContestedCount,
  ]
    .filter((value): value is number => typeof value === "number")
    .join(" ");
  return estimateTokens(
    [
      states.archiveSummary,
      states.archiveReadableSkeleton,
      states.archiveCompressionNote,
      states.archiveRevisionOf,
      states.archiveAppliedRepairRef,
      states.archiveRevisionReason,
      states.archiveReviewBoundaryNote,
      states.archiveMixedReviewBoundaryNote,
      states.archiveMixedReviewPressureReviewBoundaryNote,
      states.archiveMixedReviewPressureReviewLatest,
      states.archiveMixedReviewPressureReviewEvolutionNote,
      summarizeUnknown(states.archiveMixedReviewPressureReviewResponseKindCounts, 400),
      ...(states.archiveMixedReviewSourceMessageRefs ?? []),
      ...(states.archiveMixedReviewTouchedRefs ?? []),
      ...(states.archiveMixedReviewTraceEventRefs ?? []),
      ...(states.archiveMixedReviewPressureReviewedRefs ?? []),
      ...(states.archiveMixedReviewPressureReviewEventRefs ?? []),
      ...(states.archiveMixedReviewPressureReviewResponses ?? []),
      ...(states.archiveMixedReviewPressureReviewAgentIds ?? []),
      countSummary,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function archiveSocialTokenEstimate(states: ContextRefRecord["states"]): number {
  return estimateTokens(
    [
      states.archiveRef,
      states.archiveReviewAssessment,
      states.archiveReviewSummary,
      states.archiveReviewReason,
      states.archiveRepairSummary,
      states.archiveRepairReason,
      states.archiveRepairProposedRepair,
      states.archiveRepairResponse,
      states.archiveRepairResponseReason,
      states.archiveRepairProposedRevision,
      states.archiveRepairReviewResponse,
      states.archiveRepairReviewSummary,
      states.archiveRepairRevisedArchiveRef,
      states.archiveRepairAppliedBy,
      states.archiveBoundaryNote,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function addOmission(
  omitted: Map<string, ContextPacketOmission>,
  refType: ContextRefType,
  reason: ContextPacketOmission["reason"],
): void {
  const key = `${refType}:${reason}`;
  const current = omitted.get(key);
  if (current) {
    current.count += 1;
  } else {
    omitted.set(key, { refType, reason, count: 1 });
  }
}

function memoryStateFromEvent(eventType: string): MemoryState | undefined {
  const state = eventType.replace("memory.", "");
  return MEMORY_STATES.includes(state as MemoryState) ? (state as MemoryState) : undefined;
}

function topicStatusFromPayload(payload: Record<string, unknown>): TopicWindow["status"] | undefined {
  const status = stringValue(payload.status);
  if (status === "active" || status === "paused" || status === "merged" || status === "retired") {
    return status;
  }
  return undefined;
}

function protocolIsInactive(status: string | undefined): boolean {
  return status === "rejected" || status === "expired" || status === "retired";
}

function protocolIsActiveState(status: string | undefined): boolean {
  return status === "active";
}

function protocolFragmentType(record: ContextRefRecord): "protocol_active" | "protocol_proposal" {
  return protocolIsActiveState(record.states.protocolState) ? "protocol_active" : "protocol_proposal";
}

function protocolContextPlacement(
  eventType: string,
  status: string | undefined,
  response: string | undefined,
): "active" | "proposal" | "inactive" {
  const state = status ?? protocolStateFromResponse(response) ?? eventType.replace("protocol.", "");
  if (protocolIsInactive(state)) {
    return "inactive";
  }
  return protocolIsActiveState(state) ? "active" : "proposal";
}

function protocolStateFromResponse(response: string | undefined): string | undefined {
  switch (response) {
    case "accept":
      return "active";
    case "reject":
      return "rejected";
    case "challenge":
      return "challenged";
    case "revise":
      return "revised";
    default:
      return undefined;
  }
}

function handoffIsInactive(status: string | undefined): boolean {
  return (
    status === "rejected" ||
    status === "redirected" ||
    status === "completed" ||
    status === "expired" ||
    status === "handoff.responded"
  );
}

function handoffStateFromResponse(response: string | undefined): string | undefined {
  switch (response) {
    case "accepted":
    case "accept":
      return "accepted";
    case "rejected":
    case "reject":
      return "rejected";
    case "partially_accepted":
    case "partially_accept":
      return "partially_accepted";
    case "redirected":
    case "delegate":
    case "delegate_handoff":
    case "delegate_to_other":
      return "redirected";
    case "challenged":
    case "challenge":
    case "challenge_handoff":
      return "challenged";
    default:
      return undefined;
  }
}

function personaDeltaIsInactive(status: string | undefined): boolean {
  return status === "rejected" || status === "retired" || status === "reject" || status === "retire";
}

function archiveRepairResponseIsInactive(status: string | undefined): boolean {
  return status === "rejected" || status === "retired" || status === "reject" || status === "retire";
}

function isMixedReviewPressureRef(ref: RefId): boolean {
  return ref.startsWith("mixed_review:");
}

function refsFromPayload(payload: Record<string, unknown>, envelopeRefs: RefId[]): RefId[] {
  return unique(
    envelopeRefs
      .concat(arrayOfStrings(payload.contextRefs))
      .concat(arrayOfStrings(payload.context_refs))
      .concat(arrayOfStrings(payload.sourceRefs))
      .concat(arrayOfStrings(payload.source_refs))
      .concat(arrayOfStrings(payload.sourcePressureRefs))
      .concat(arrayOfStrings(payload.source_pressure_refs))
      .concat(arrayOfStrings(payload.evidenceRefs))
      .concat(arrayOfStrings(payload.evidence_refs))
      .concat(optionalStringRef(payload.sourceMessageId))
      .concat(optionalStringRef(payload.source_message_id))
      .concat(optionalStringRef(payload.intentionEventId))
      .concat(optionalStringRef(payload.intention_event_id)),
  );
}

function evidenceTextFromPayload(payload: Record<string, unknown>): string | undefined {
  const intention = objectPayload(payload.intention);
  return boundedString(
    [
      stringValue(payload.content),
      stringValue(payload.summary),
      stringValue(payload.reason),
      stringValue(payload.question),
      stringValue(payload.openQuestion) ?? stringValue(payload.open_question),
      stringValue(payload.proposedRepair) ?? stringValue(payload.proposed_repair),
      stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
      stringValue(intention.content),
      stringValue(intention.summary),
      stringValue(intention.reason),
      stringValue(intention.question),
    ]
      .filter(Boolean)
      .join(" "),
    700,
  );
}

function latestFirst(refs: RefId[]): RefId[] {
  return [...refs].reverse();
}

function pushUniqueBounded(values: RefId[], value: RefId, limit: number): void {
  removeValue(values, value);
  values.push(value);
  while (values.length > limit) values.shift();
}

function removeValue(values: RefId[], value: RefId): void {
  const index = values.indexOf(value);
  if (index >= 0) values.splice(index, 1);
}

function objectPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(objectPayload).filter((item) => Object.keys(item).length > 0) : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function optionalStringRef(value: unknown): string[] {
  return typeof value === "string" && value.length > 0 ? [value] : [];
}

function boundedArrayOfStrings(...values: unknown[]): string[] {
  const strings = values.flatMap(arrayOfStrings);
  return strings.slice(0, 12).map((item) => boundedString(item, 240) ?? item);
}

function maxArrayCount(...values: unknown[]): number {
  return Math.max(0, ...values.map((value) => (Array.isArray(value) ? value.length : 0)));
}

function numericRecordSum(value: unknown): number | undefined {
  const record = objectPayload(value);
  const numbers = Object.values(record).filter((item): item is number => typeof item === "number" && Number.isFinite(item));
  if (numbers.length === 0) return undefined;
  return numbers.reduce((total, item) => total + item, 0);
}

function boundedString(value: string | undefined, maxLength: number): string | undefined {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 15)}... [truncated]`;
}

function truncateText(value: string, maxLength: number): string {
  return boundedString(value, maxLength) ?? "";
}

function summarizeUnknown(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return boundedString(value, maxLength);
  try {
    return boundedString(JSON.stringify(value), maxLength);
  } catch {
    return boundedString(String(value), maxLength);
  }
}

function cleanStates(states: ContextRefRecord["states"]): ContextRefRecord["states"] {
  return Object.fromEntries(
    Object.entries(states).filter(([, value]) => value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0)),
  ) as ContextRefRecord["states"];
}

function optionalTag(value: string | undefined): string[] {
  return value ? [value] : [];
}

function unique(values: RefId[]): RefId[] {
  return [...new Set(values)];
}

function estimateTokens(text: string): number {
  if (!text) return 1;
  return Math.max(1, Math.ceil(text.length / 4));
}
