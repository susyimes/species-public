import { MemoryState, Projection, RefId, RoomEvent, RoomId, TopicId } from "../types";
import { MemoryClaimStore } from "../memory/memory";

export type ArchiveLedgerRange = {
  fromOffset: number;
  toOffset: number;
};

export type ArchiveItem = {
  summary: string;
  sourceRefs: RefId[];
  eventIds: string[];
  topicId?: TopicId;
  actorId?: string;
};

export type ArchiveMemoryChange = {
  memoryId: string;
  fromState?: MemoryState;
  toState: MemoryState;
  summary?: string;
  reason?: string;
  sourcePressureRefs: RefId[];
  sourceRefs: RefId[];
  eventId: string;
  actorId: string;
};

export type ArchiveTopicProposal = {
  proposalId: string;
  status: string;
  action?: string;
  title: string;
  reason?: string;
  currentTopicId?: TopicId;
  targetTopicId?: TopicId;
  boundaryNote?: string;
  sourcePressureRefs: RefId[];
  sourceRefs: RefId[];
  eventIds: string[];
  proposedBy?: string;
  revisedFromTopicProposalRef?: string;
  revisedBy?: string;
  responseCount: number;
  responses: ArchiveTopicProposalResponse[];
  reviews: ArchiveTopicProposalReview[];
  appliedBy?: string;
  resultingTopicId?: TopicId;
  appliedTopicEventIds?: string[];
  applicationReason?: string;
  actorId: string;
};

export type ArchiveTopicProposalResponse = {
  agentId?: string;
  response: string;
  reason?: string;
  proposedRevision?: string;
  sourceRefs: RefId[];
  eventId: string;
  actorId: string;
};

export type ArchiveTopicProposalReview = {
  reviewId: string;
  agentId?: string;
  response: string;
  summary?: string;
  sourceMessageId?: RefId;
  boundaryNote: string;
  sourceRefs: RefId[];
  eventId: string;
  actorId: string;
};

export type ArchiveOpenQuestion = {
  questionId: string;
  topicId?: TopicId;
  question: string;
  raisedBy?: string;
  refinedFromQuestionRef?: RefId;
  refinedBy?: string;
  sourcePressureRefs: RefId[];
  sourceMessageId?: RefId;
  boundaryNote: string;
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
  responses: ArchiveOpenQuestionResponse[];
};

export type ArchiveOpenQuestionResponse = {
  responseId: string;
  agentId?: string;
  response: string;
  summary?: string;
  sourceMessageId?: RefId;
  sourceRefs: RefId[];
  eventId: string;
  actorId: string;
  boundaryNote: string;
};

export type ArchiveHandoffResponse = {
  byAgentId?: string;
  response: string;
  reason?: string;
  redirectTo?: string;
  acceptedScopeSummary?: string;
  sourceRefs: RefId[];
  eventId: string;
  actorId: string;
};

export type ArchiveHandoffReview = {
  agentId?: string;
  response: string;
  summary?: string;
  sourceMessageId?: string;
  boundaryNote?: string;
  sourceRefs: RefId[];
  eventId: string;
  actorId: string;
};

export type ArchiveHandoffExchange = {
  handoffId: string;
  status: string;
  topicId?: TopicId;
  fromAgentId?: string;
  toAgentId?: string;
  delegatedFromHandoffRef?: string;
  delegatedBy?: string;
  reason?: string;
  requestedResponse?: string;
  responseCount: number;
  responses: ArchiveHandoffResponse[];
  reviews?: ArchiveHandoffReview[];
  boundaryNote: string;
  sourcePressureRefs: RefId[];
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchiveProtocolResponse = {
  agentId?: string;
  response: string;
  reason?: string;
  proposedRevision?: string;
  sourceRefs: RefId[];
  eventId: string;
  actorId: string;
};

export type ArchiveProtocolReview = {
  agentId?: string;
  response: string;
  summary?: string;
  sourceMessageId?: string;
  boundaryNote?: string;
  sourceRefs: RefId[];
  eventId: string;
  actorId: string;
};

export type ArchiveProtocolExchange = {
  protocolId: string;
  status: string;
  topicId?: TopicId;
  proposedBy?: string;
  revisedFromProtocolRef?: string;
  revisedBy?: string;
  summary?: string;
  scope?: string;
  expiresAt?: string;
  expiryPolicy?: string;
  reason?: string;
  responseCount: number;
  responses: ArchiveProtocolResponse[];
  reviews?: ArchiveProtocolReview[];
  boundaryNote: string;
  sourceRefs: RefId[];
  sourcePressureRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchiveInvitation = {
  invitationId: string;
  status: string;
  topicId?: TopicId;
  fromAgentId?: string;
  toAgentId?: string;
  delegatedFromInvitationRef?: string;
  delegatedBy?: string;
  reason?: string;
  responseCount: number;
  responses: ArchiveInvitationResponse[];
  boundaryNote: string;
  sourcePressureRefs: RefId[];
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchiveInvitationResponse = {
  agentId?: string;
  response: string;
  reason?: string;
  redirectTo?: string;
  sourceRefs: RefId[];
  eventId: string;
  actorId: string;
};

export type ArchiveSilence = {
  silenceId: string;
  agentId?: string;
  topicId?: TopicId;
  invitationId?: string;
  triggeringEventId?: RefId;
  reason?: string;
  boundaryNote: string;
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchivePersonaDelta = {
  deltaId: string;
  status: string;
  reviewId?: string;
  agentId?: string;
  proposedBy?: string;
  revisedFromDeltaRef?: string;
  revisedBy?: string;
  respondingAgentId?: string;
  reviewingAgentId?: string;
  response?: string;
  proposedRevision?: string;
  field?: string;
  operation?: string;
  valueSummary?: string;
  valueDate?: string;
  valueSourceRef?: RefId;
  summary?: string;
  sourceMessageId?: string;
  reason?: string;
  boundaryNote?: string;
  sourcePressureRefs: RefId[];
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchiveAgentRoleClaim = {
  roleClaimId: string;
  deltaId: string;
  agentId?: string;
  label: string;
  status: string;
  proposedBy?: string;
  evidenceRefs: RefId[];
  sourcePressureRefs: RefId[];
  contestRefs: RefId[];
  responseRefs: RefId[];
  eventIds: string[];
  actorIds: string[];
  boundaryNote: string;
};

export type ArchiveAgentDailyMood = {
  deltaId: string;
  agentId?: string;
  date?: string;
  posture: string;
  status: string;
  proposedBy?: string;
  acceptedBy?: string;
  sourceRef?: RefId;
  evidenceRefs: RefId[];
  responseRefs: RefId[];
  eventIds: string[];
  actorIds: string[];
  boundaryNote: string;
};

export type ArchiveAgentContinuity = {
  agentId: string;
  roleClaims: ArchiveAgentRoleClaim[];
  dailyMoods: ArchiveAgentDailyMood[];
  sourceRefs: RefId[];
  eventIds: string[];
  boundaryNote: string;
};

export type ArchiveSideEffectBoundary = {
  requestId: string;
  approvalId?: string;
  status: string;
  kind?: string;
  target?: string;
  requestedBy?: string;
  decidedBy?: string;
  resultId?: string;
  reason?: string;
  expectedImpact?: string;
  decisionReason?: string;
  resultSummary?: string;
  boundaryNote: string;
  sourcePressureRefs: RefId[];
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchiveWorkspaceArtifact = {
  artifactId: string;
  workspaceId: string;
  agentId?: string;
  pathRef?: string;
  status?: string;
  reviewId?: string;
  response?: string;
  reviewedBy?: string;
  sourceMessageId?: string;
  summary: string;
  boundaryNote: string;
  sourcePressureRefs: RefId[];
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchiveWorkspaceBoundary = {
  workspaceId: string;
  agentId?: string;
  visibility?: string;
  scratchPath?: string;
  retentionPolicy?: string;
  publicContributionPolicy?: string;
  boundaryNote: string;
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchiveSkillCapsule = {
  capsuleId: string;
  agentId?: string;
  label?: string;
  triggerHints: string[];
  sideEffectKinds: string[];
  approvalRequired: boolean;
  status: string;
  source?: string;
  reviewId?: string;
  response?: string;
  reviewedBy?: string;
  sourceMessageId?: string;
  summary?: string;
  boundaryNote: string;
  sourcePressureRefs: RefId[];
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchiveCapabilityReview = {
  reviewId: string;
  capabilityRef: RefId;
  topicId?: TopicId;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: string;
  boundaryNote: string;
  sourcePressureRefs: RefId[];
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchiveMixedReviewPressure = {
  pressureId: RefId;
  sourceMessageId?: RefId;
  topicId?: TopicId;
  agentIds: string[];
  responseKindCounts: Record<string, number>;
  objectCount: number;
  touchedRefs: RefId[];
  touchedObjects: string[];
  traceEventIds: string[];
  boundaryNote: string;
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchiveMixedReviewPressureReview = {
  reviewId: string;
  pressureRef: RefId;
  topicId?: TopicId;
  agentId?: string;
  response: string;
  summary: string;
  sourceMessageId?: RefId;
  contextRefs: RefId[];
  boundaryNote: string;
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchivePressureBoundary = {
  boundaryId: string;
  reason: string;
  topicId?: TopicId;
  messageEventId?: RefId;
  activeBackgroundTurns?: number;
  queuedBackgroundTurns?: number;
  maxConcurrentBackgroundTurns?: number;
  boundaryNote: string;
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchiveProviderBoundary = {
  boundaryId: string;
  agentId?: string;
  providerKind?: string;
  providerLabel?: string;
  topicId?: TopicId;
  triggeringEventId?: RefId;
  packetId?: string;
  diagnostic?: string;
  boundaryNote: string;
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type ArchiveMemoryPressureBoundary = {
  boundaryId: string;
  reason: string;
  topicId?: TopicId;
  triggeringMemoryId?: RefId;
  pendingProposalCount: number;
  threshold: number;
  proposedMemoryRefs: RefId[];
  boundaryNote: string;
  sourceRefs: RefId[];
  eventIds: string[];
  actorId: string;
};

export type DailyArchive = {
  archiveId: string;
  roomId: RoomId;
  date: string;
  timezone: string;
  revisionOf?: RefId;
  appliedRepairRef?: RefId;
  revisionReason?: string;
  provenanceRefs?: RefId[];
  inputLedgerRange: ArchiveLedgerRange;
  summary: string;
  messageHighlights: ArchiveItem[];
  decisions: ArchiveItem[];
  disagreements: ArchiveItem[];
  openQuestions: ArchiveItem[];
  openQuestionTraces: ArchiveOpenQuestion[];
  memoryChanges: ArchiveMemoryChange[];
  topicProposals: ArchiveTopicProposal[];
  handoffs: ArchiveHandoffExchange[];
  protocols: ArchiveProtocolExchange[];
  invitations: ArchiveInvitation[];
  silences: ArchiveSilence[];
  personaDeltas: ArchivePersonaDelta[];
  agentContinuity: ArchiveAgentContinuity[];
  sideEffectBoundaries: ArchiveSideEffectBoundary[];
  workspaceBoundaries: ArchiveWorkspaceBoundary[];
  workspaceArtifacts: ArchiveWorkspaceArtifact[];
  skillCapsules: ArchiveSkillCapsule[];
  capabilityReviews: ArchiveCapabilityReview[];
  mixedReviewPressures: ArchiveMixedReviewPressure[];
  mixedReviewPressureReviews: ArchiveMixedReviewPressureReview[];
  pressureBoundaries: ArchivePressureBoundary[];
  providerBoundaries: ArchiveProviderBoundary[];
  memoryPressureBoundaries: ArchiveMemoryPressureBoundary[];
  contestedItems: RefId[];
  topicIds: TopicId[];
  eventCounts: Record<string, number>;
  outputRefs: Record<string, RefId>;
  createdBy: string;
  createdAt: string;
  compressionNote: "archive_is_compression_not_consensus";
};

export type DailyArchiveBuildOptions = {
  roomId: RoomId;
  date: string;
  timezone?: string;
  fromOffset?: number;
  toOffset?: number;
  archiveId?: string;
  createdBy?: string;
  createdAt?: string;
  outputRefs?: Record<string, RefId>;
  summary?: string;
};

export type ArchiveView = {
  archives: DailyArchive[];
};

export class DailyArchiveBuilder {
  build(events: RoomEvent[], options: DailyArchiveBuildOptions): DailyArchive {
    const timezone = options.timezone ?? "UTC";
    const fromOffset = options.fromOffset ?? 0;
    const toOffset = options.toOffset ?? Math.max(0, events.length - 1);
    const selectedEvents = events.slice(fromOffset, toOffset + 1);
    const eventCounts: Record<string, number> = {};
    const messageHighlights: ArchiveItem[] = [];
    const decisions: ArchiveItem[] = [];
    const disagreements: ArchiveItem[] = [];
    const openQuestions: ArchiveItem[] = [];
    const openQuestionTraces: ArchiveOpenQuestion[] = [];
    const memoryChanges: ArchiveMemoryChange[] = [];
    const topicProposalsById = new Map<string, ArchiveTopicProposal>();
    const handoffsById = new Map<string, ArchiveHandoffExchange>();
    const protocolsById = new Map<string, ArchiveProtocolExchange>();
    const invitationsById = new Map<string, ArchiveInvitation>();
    const silences: ArchiveSilence[] = [];
    const personaDeltas: ArchivePersonaDelta[] = [];
    const sideEffectBoundaries: ArchiveSideEffectBoundary[] = [];
    const workspaceBoundaries: ArchiveWorkspaceBoundary[] = [];
    const workspaceArtifacts: ArchiveWorkspaceArtifact[] = [];
    const skillCapsules: ArchiveSkillCapsule[] = [];
    const capabilityReviews: ArchiveCapabilityReview[] = [];
    const mixedReviewGroups = new Map<string, ArchiveMixedReviewTrace[]>();
    const mixedReviewPressureReviews: ArchiveMixedReviewPressureReview[] = [];
    const pressureBoundaries: ArchivePressureBoundary[] = [];
    const providerBoundaries: ArchiveProviderBoundary[] = [];
    const memoryPressureBoundaries: ArchiveMemoryPressureBoundary[] = [];
    const topicIds = new Set<TopicId>();
    const providerDegradedIntentionEventIds = degradedIntentionEventIds(selectedEvents);
    const messageTopicIds = messageTopicIndex(selectedEvents);

    for (const event of selectedEvents) {
      eventCounts[event.event_type] = (eventCounts[event.event_type] ?? 0) + 1;
      const payload = objectPayload(event.payload);
      const topicId =
        stringValue(payload.topicId) ??
        stringValue(payload.topic_id) ??
        stringValue(payload.currentTopicId) ??
        stringValue(payload.current_topic_id);
      if (topicId) topicIds.add(topicId);
      const targetTopicId = stringValue(payload.targetTopicId) ?? stringValue(payload.target_topic_id);
      if (targetTopicId) topicIds.add(targetTopicId);
      const eventMessageId = messageIdFromEvent(event);
      const messageHighlight = messageHighlightFromEvent(
        event,
        topicId ?? (eventMessageId ? messageTopicIds.get(eventMessageId) : undefined),
      );
      if (messageHighlight) {
        messageHighlights.push(messageHighlight);
        if (messageHighlight.topicId) topicIds.add(messageHighlight.topicId);
      }

      for (const decision of textArray(payload.decisions).concat(textArray(payload.decision))) {
        decisions.push(itemFromEvent(event, decision, topicId));
      }

      if (event.event_type === "protocol.responded" && acceptedStatus(payload)) {
        const summary = stringValue(payload.summary) ?? stringValue(payload.reason);
        if (summary) decisions.push(itemFromEvent(event, summary, topicId));
      }

      const disagreementTexts = textArray(payload.disagreements).concat(textArray(payload.disagreement));
      for (const disagreement of disagreementTexts) {
        disagreements.push(itemFromEvent(event, disagreement, topicId));
      }

      if (event.event_type === "memory.contested") {
        disagreements.push(
          itemFromEvent(
            event,
            stringValue(payload.reason) ??
              stringValue(payload.summary) ??
              "A memory claim was contested and remains part of the room record.",
            topicId,
          ),
        );
      }

      if (event.event_type === "protocol.responded" && rejectedOrChallengedStatus(payload)) {
        disagreements.push(
          itemFromEvent(event, stringValue(payload.reason) ?? "A protocol proposal was rejected or challenged.", topicId),
        );
      }

      for (const question of textArray(payload.openQuestions)
        .concat(textArray(payload.open_questions))
        .concat(textArray(payload.openQuestion))
        .concat(textArray(payload.open_question))
        .concat(questionFromMessage(event))) {
        openQuestions.push(itemFromEvent(event, question, topicId));
      }

      const openQuestionTrace = openQuestionFromEvent(event, topicId);
      if (openQuestionTrace) openQuestionTraces.push(openQuestionTrace);
      const openQuestionResponse = openQuestionResponseFromEvent(event);
      if (openQuestionResponse) {
        const questionId = questionRefFromResponseEvent(event);
        if (questionId) {
          let trace = openQuestionTraces.find((item) => item.questionId === questionId);
          if (!trace) {
            trace = {
              questionId,
              topicId,
              question: "",
              sourcePressureRefs: [],
              boundaryNote: "open question is room-visible unresolved context, not a demand for immediate answer",
              sourceRefs: [],
              eventIds: [],
              actorId: event.actor.id,
              responses: [],
            };
            openQuestionTraces.push(trace);
          }
          trace.responses.push(openQuestionResponse);
          trace.sourceRefs = unique(trace.sourceRefs.concat(openQuestionResponse.sourceRefs));
          trace.eventIds = unique(trace.eventIds.concat(openQuestionResponse.eventId));
        }
      }

      const memoryState = memoryStateFromEvent(event.event_type);
      if (memoryState) {
        memoryChanges.push(memoryChangeFromEvent(event, memoryState));
      }

      applyTopicProposalEvent(topicProposalsById, event, topicId);

      applyHandoffEvent(handoffsById, event, topicId);
      applyProtocolEvent(protocolsById, event, topicId);

      applyInvitationEvent(invitationsById, event, topicId);

      const silence = silenceFromEvent(event, providerDegradedIntentionEventIds, topicId);
      if (silence) silences.push(silence);

      const personaDelta = personaDeltaFromEvent(event);
      if (personaDelta) personaDeltas.push(personaDelta);

      const sideEffectBoundary = sideEffectBoundaryFromEvent(event, topicId);
      if (sideEffectBoundary) sideEffectBoundaries.push(sideEffectBoundary);

      const workspaceBoundary = workspaceBoundaryFromEvent(event);
      if (workspaceBoundary) workspaceBoundaries.push(workspaceBoundary);

      const workspaceArtifact = workspaceArtifactFromEvent(event);
      if (workspaceArtifact) workspaceArtifacts.push(workspaceArtifact);

      const skillCapsule = skillCapsuleFromEvent(event);
      if (skillCapsule) skillCapsules.push(skillCapsule);

      const capabilityReview = capabilityReviewFromEvent(event, topicId);
      if (capabilityReview) capabilityReviews.push(capabilityReview);

      collectMixedReviewTrace(mixedReviewGroups, event, payload, topicId);
      const mixedReviewPressureReview = mixedReviewPressureReviewFromEvent(event, topicId);
      if (mixedReviewPressureReview) mixedReviewPressureReviews.push(mixedReviewPressureReview);

      const pressureBoundary = pressureBoundaryFromEvent(event, topicId);
      if (pressureBoundary) pressureBoundaries.push(pressureBoundary);

      const providerBoundary = providerBoundaryFromEvent(event, topicId);
      if (providerBoundary) providerBoundaries.push(providerBoundary);

      const memoryPressureBoundary = memoryPressureBoundaryFromEvent(event, topicId);
      if (memoryPressureBoundary) memoryPressureBoundaries.push(memoryPressureBoundary);
    }

    const memoryProjection = archiveMemoryProjection(selectedEvents);
    disagreements.push(...memoryProjection.boundaries);
    const contestedItems = memoryProjection.contestedItems;
    const dedupedPersonaDeltas = dedupePersonaDeltas(personaDeltas);
    const mixedReviewPressures = mixedReviewPressuresFromGroups(mixedReviewGroups);

    return {
      archiveId: options.archiveId ?? `day_${options.date.replaceAll("-", "_")}`,
      roomId: options.roomId,
      date: options.date,
      timezone,
      inputLedgerRange: { fromOffset, toOffset },
      summary:
        options.summary ??
        `${selectedEvents.length} ledger events compressed for ${options.date}; disagreements and contested claims are preserved separately.`,
      messageHighlights: boundedArchiveItems(dedupeItems(messageHighlights), 48),
      decisions: dedupeItems(decisions),
      disagreements: dedupeItems(disagreements),
      openQuestions: dedupeItems(openQuestions),
      openQuestionTraces: dedupeOpenQuestions(openQuestionTraces),
      memoryChanges,
      topicProposals: [...topicProposalsById.values()]
        .map(cloneTopicProposal)
        .sort((a, b) => a.proposalId.localeCompare(b.proposalId)),
      handoffs: [...handoffsById.values()].map(cloneHandoffExchange).sort((a, b) => a.handoffId.localeCompare(b.handoffId)),
      protocols: [...protocolsById.values()]
        .map(cloneProtocolExchange)
        .sort((a, b) => a.protocolId.localeCompare(b.protocolId)),
      invitations: [...invitationsById.values()].map(cloneInvitation).sort((a, b) => a.invitationId.localeCompare(b.invitationId)),
      silences: dedupeSilences(silences),
      personaDeltas: dedupedPersonaDeltas,
      agentContinuity: agentContinuityFromPersonaDeltas(dedupedPersonaDeltas),
      sideEffectBoundaries: dedupeSideEffectBoundaries(sideEffectBoundaries),
      workspaceBoundaries: dedupeWorkspaceBoundaries(workspaceBoundaries),
      workspaceArtifacts: dedupeWorkspaceArtifacts(workspaceArtifacts),
      skillCapsules: dedupeSkillCapsules(skillCapsules),
      capabilityReviews: dedupeCapabilityReviews(capabilityReviews),
      mixedReviewPressures: dedupeMixedReviewPressures(mixedReviewPressures),
      mixedReviewPressureReviews: dedupeMixedReviewPressureReviews(mixedReviewPressureReviews),
      pressureBoundaries: dedupePressureBoundaries(pressureBoundaries),
      providerBoundaries: dedupeProviderBoundaries(providerBoundaries),
      memoryPressureBoundaries: dedupeMemoryPressureBoundaries(memoryPressureBoundaries),
      contestedItems,
      topicIds: [...topicIds].sort(),
      eventCounts,
      outputRefs: options.outputRefs ?? {},
      createdBy: options.createdBy ?? "archive_worker",
      createdAt: options.createdAt ?? new Date(0).toISOString(),
      compressionNote: "archive_is_compression_not_consensus",
    };
  }
}

export class ArchiveStore implements Projection<ArchiveView> {
  private readonly archives = new Map<string, DailyArchive>();

  static fromEvents(events: RoomEvent[]): ArchiveStore {
    const store = new ArchiveStore();
    for (const event of events) store.apply(event);
    return store;
  }

  apply(event: RoomEvent): void {
    if (event.event_type !== "daily_archive.created") return;
    const payload = objectPayload(event.payload);
    const archive = archiveFromPayload(event, payload);
    this.archives.set(archive.archiveId, archive);
  }

  get(archiveId: string): DailyArchive | undefined {
    const archive = this.archives.get(archiveId);
    return archive ? cloneArchive(archive) : undefined;
  }

  view(): ArchiveView {
    return {
      archives: [...this.archives.values()].map(cloneArchive).sort((a, b) => a.archiveId.localeCompare(b.archiveId)),
    };
  }
}

function itemFromEvent(event: RoomEvent, summary: string, topicId?: TopicId): ArchiveItem {
  return {
    summary,
    sourceRefs: refsFromPayload(objectPayload(event.payload), event.refs),
    eventIds: [event.event_id],
    topicId,
    actorId: event.actor.id,
  };
}

function messageHighlightFromEvent(event: RoomEvent, topicId?: TopicId): ArchiveItem | undefined {
  if (event.event_type !== "message.created") return undefined;
  const payload = objectPayload(event.payload);
  const authorKind = stringValue(payload.authorKind) ?? stringValue(payload.author_kind) ?? event.actor.kind;
  if (authorKind === "system") return undefined;
  const content = summarizeUnknown(stringValue(payload.content), 280);
  if (!content) return undefined;
  return itemFromEvent(event, content, topicId);
}

function messageTopicIndex(events: readonly RoomEvent[]): Map<string, TopicId> {
  const index = new Map<string, TopicId>();
  for (const event of events) {
    const payload = objectPayload(event.payload);
    const messageId = messageIdFromEvent(event);
    const topicId =
      stringValue(payload.topicId) ??
      stringValue(payload.topic_id) ??
      stringValue(payload.currentTopicId) ??
      stringValue(payload.current_topic_id);
    if (messageId && topicId) {
      index.set(messageId, topicId);
    }
    if (event.event_type === "topic.created") {
      const createdFromMessageId =
        stringValue(payload.createdFromMessageId) ??
        stringValue(payload.created_from_message_id) ??
        stringValue(payload.sourceMessageId) ??
        stringValue(payload.source_message_id);
      if (createdFromMessageId && topicId) {
        index.set(createdFromMessageId, topicId);
      }
    }
  }
  return index;
}

function messageIdFromEvent(event: RoomEvent): string | undefined {
  const payload = objectPayload(event.payload);
  return stringValue(payload.messageId) ?? stringValue(payload.message_id);
}

function boundedArchiveItems(items: ArchiveItem[], limit: number): ArchiveItem[] {
  if (items.length <= limit) return items;
  const firstCount = Math.min(12, Math.floor(limit / 3));
  return dedupeItems(items.slice(0, firstCount).concat(items.slice(-(limit - firstCount))));
}

function archiveMemoryProjection(events: readonly RoomEvent[]): {
  contestedItems: RefId[];
  boundaries: ArchiveItem[];
} {
  const store = new MemoryClaimStore();
  const boundaries: ArchiveItem[] = [];
  for (const event of events) {
    try {
      store.apply(event);
    } catch (error) {
      const payload = objectPayload(event.payload);
      const topicId = stringValue(payload.topicId) ?? stringValue(payload.topic_id);
      boundaries.push(
        itemFromEvent(
          event,
          `Memory projection boundary: ${error instanceof Error ? error.message : String(error)}. Archive preserved the ledger event as state-history pressure, not public-memory truth.`,
          topicId,
        ),
      );
    }
  }
  return {
    contestedItems: store
      .view()
      .claims.filter((claim) => claim.state === "contested")
      .map((claim) => claim.memoryId)
      .sort(),
    boundaries,
  };
}

function memoryChangeFromEvent(event: RoomEvent, toState: MemoryState): ArchiveMemoryChange {
  const payload = objectPayload(event.payload);
  return {
    memoryId: stringValue(payload.memoryId) ?? stringValue(payload.memory_id) ?? `${event.event_id}:memory`,
    fromState: memoryStateValue(payload.fromState) ?? memoryStateValue(payload.from_state),
    toState,
    summary: stringValue(payload.summary),
    reason: stringValue(payload.reason),
    sourcePressureRefs: pressureRefsFromPayload(payload, event.refs),
    sourceRefs: refsFromPayload(payload, event.refs),
    eventId: event.event_id,
    actorId: event.actor.id,
  };
}

function openQuestionFromEvent(event: RoomEvent, topicId?: TopicId): ArchiveOpenQuestion | undefined {
  if (event.event_type !== "topic.updated") return undefined;
  const payload = objectPayload(event.payload);
  const question = stringValue(payload.openQuestion) ?? stringValue(payload.open_question);
  if (!question) return undefined;
  return {
    questionId:
      stringValue(payload.openQuestionRef) ??
      stringValue(payload.open_question_ref) ??
      event.event_id,
    topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? topicId,
    question,
    raisedBy: stringValue(payload.raisedBy) ?? stringValue(payload.raised_by) ?? event.actor.id,
    refinedFromQuestionRef:
      stringValue(payload.refinedFromQuestionRef) ?? stringValue(payload.refined_from_question_ref),
    refinedBy: stringValue(payload.refinedBy) ?? stringValue(payload.refined_by),
    sourcePressureRefs: pressureRefsFromPayload(payload, event.refs),
    sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id) ?? stringValue(payload.messageId),
    boundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "open question is room-visible unresolved context, not a demand for immediate answer",
    sourceRefs: refsFromPayload(payload, event.refs),
    eventIds: [event.event_id],
    actorId: event.actor.id,
    responses: [],
  };
}

function questionRefFromResponseEvent(event: RoomEvent): RefId | undefined {
  if (event.event_type !== "open_question.responded") return undefined;
  const payload = objectPayload(event.payload);
  return (
    stringValue(payload.questionRef) ??
    stringValue(payload.question_ref) ??
    stringValue(payload.openQuestionRef) ??
    stringValue(payload.open_question_ref)
  );
}

function openQuestionResponseFromEvent(event: RoomEvent): ArchiveOpenQuestionResponse | undefined {
  if (event.event_type !== "open_question.responded") return undefined;
  const payload = objectPayload(event.payload);
  return {
    responseId: stringValue(payload.responseId) ?? stringValue(payload.response_id) ?? event.event_id,
    agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    response: stringValue(payload.response) ?? "responded",
    summary: stringValue(payload.summary),
    sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
    sourceRefs: refsFromPayload(payload, event.refs),
    eventId: event.event_id,
    actorId: event.actor.id,
    boundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "open question response is a social trace; it does not resolve or close the question",
  };
}

function archiveFromPayload(event: RoomEvent, payload: Record<string, unknown>): DailyArchive {
  const archiveObject = objectValue(payload.archive);
  if (archiveObject) {
    payload = { ...payload, ...archiveObject };
  }

  const archiveId =
    stringValue(payload.archiveId) ??
    stringValue(payload.archive_id) ??
    stringValue(payload.date) ??
    event.event_id;
  const range = objectValue(payload.inputLedgerRange) ?? objectValue(payload.input_ledger_range);

  return {
    archiveId,
    roomId: event.room_id,
    date: stringValue(payload.date) ?? event.occurred_at.slice(0, 10),
    timezone: stringValue(payload.timezone) ?? "UTC",
    inputLedgerRange: {
      fromOffset: numberValue(range?.fromOffset) ?? numberValue(range?.from_offset) ?? 0,
      toOffset: numberValue(range?.toOffset) ?? numberValue(range?.to_offset) ?? 0,
    },
    revisionOf: stringValue(payload.revisionOf) ?? stringValue(payload.revision_of),
    appliedRepairRef: stringValue(payload.appliedRepairRef) ?? stringValue(payload.applied_repair_ref),
    revisionReason: stringValue(payload.revisionReason) ?? stringValue(payload.revision_reason),
    provenanceRefs: arrayOfStrings(payload.provenanceRefs).concat(arrayOfStrings(payload.provenance_refs)),
    summary: stringValue(payload.summary) ?? "",
    messageHighlights: arrayOfObjects(payload.messageHighlights)
      .concat(arrayOfObjects(payload.message_highlights))
      .map(itemFromPlainObject),
    decisions: arrayOfObjects(payload.decisions).map(itemFromPlainObject),
    disagreements: arrayOfObjects(payload.disagreements).map(itemFromPlainObject),
    openQuestions: arrayOfObjects(payload.openQuestions).concat(arrayOfObjects(payload.open_questions)).map(itemFromPlainObject),
    openQuestionTraces: arrayOfObjects(payload.openQuestionTraces)
      .concat(arrayOfObjects(payload.open_question_traces))
      .concat(arrayOfObjects(payload.openQuestionRecords))
      .concat(arrayOfObjects(payload.open_question_records))
      .map(openQuestionFromPlainObject),
    memoryChanges: arrayOfObjects(payload.memoryChanges)
      .concat(arrayOfObjects(payload.memory_changes))
      .map(memoryChangeFromPlainObject),
    topicProposals: arrayOfObjects(payload.topicProposals)
      .concat(arrayOfObjects(payload.topic_proposals))
      .map(topicProposalFromPlainObject),
    handoffs: arrayOfObjects(payload.handoffs)
      .concat(arrayOfObjects(payload.handoffExchanges))
      .concat(arrayOfObjects(payload.handoff_exchanges))
      .map(handoffExchangeFromPlainObject),
    protocols: arrayOfObjects(payload.protocols)
      .concat(arrayOfObjects(payload.protocolExchanges))
      .concat(arrayOfObjects(payload.protocol_exchanges))
      .map(protocolExchangeFromPlainObject),
    invitations: arrayOfObjects(payload.invitations)
      .concat(arrayOfObjects(payload.invitationExchanges))
      .concat(arrayOfObjects(payload.invitation_exchanges))
      .map(invitationFromPlainObject),
    silences: arrayOfObjects(payload.silences)
      .concat(arrayOfObjects(payload.deliberateSilences))
      .concat(arrayOfObjects(payload.deliberate_silences))
      .map(silenceFromPlainObject),
    personaDeltas: arrayOfObjects(payload.personaDeltas)
      .concat(arrayOfObjects(payload.persona_deltas))
      .map(personaDeltaFromPlainObject),
    agentContinuity: arrayOfObjects(payload.agentContinuity)
      .concat(arrayOfObjects(payload.agent_continuity))
      .map(agentContinuityFromPlainObject),
    sideEffectBoundaries: arrayOfObjects(payload.sideEffectBoundaries)
      .concat(arrayOfObjects(payload.side_effect_boundaries))
      .map(sideEffectBoundaryFromPlainObject),
    workspaceBoundaries: arrayOfObjects(payload.workspaceBoundaries)
      .concat(arrayOfObjects(payload.workspace_boundaries))
      .map(workspaceBoundaryFromPlainObject),
    workspaceArtifacts: arrayOfObjects(payload.workspaceArtifacts)
      .concat(arrayOfObjects(payload.workspace_artifacts))
      .map(workspaceArtifactFromPlainObject),
    skillCapsules: arrayOfObjects(payload.skillCapsules)
      .concat(arrayOfObjects(payload.skill_capsules))
      .map(skillCapsuleFromPlainObject),
    capabilityReviews: arrayOfObjects(payload.capabilityReviews)
      .concat(arrayOfObjects(payload.capability_reviews))
      .map(capabilityReviewFromPlainObject),
    mixedReviewPressures: arrayOfObjects(payload.mixedReviewPressures)
      .concat(arrayOfObjects(payload.mixed_review_pressures))
      .map(mixedReviewPressureFromPlainObject),
    mixedReviewPressureReviews: arrayOfObjects(payload.mixedReviewPressureReviews)
      .concat(arrayOfObjects(payload.mixed_review_pressure_reviews))
      .map(mixedReviewPressureReviewFromPlainObject),
    pressureBoundaries: arrayOfObjects(payload.pressureBoundaries)
      .concat(arrayOfObjects(payload.pressure_boundaries))
      .map(pressureBoundaryFromPlainObject),
    providerBoundaries: arrayOfObjects(payload.providerBoundaries)
      .concat(arrayOfObjects(payload.provider_boundaries))
      .map(providerBoundaryFromPlainObject),
    memoryPressureBoundaries: arrayOfObjects(payload.memoryPressureBoundaries)
      .concat(arrayOfObjects(payload.memory_pressure_boundaries))
      .map(memoryPressureBoundaryFromPlainObject),
    contestedItems: arrayOfStrings(payload.contestedItems).concat(arrayOfStrings(payload.contested_items)).sort(),
    topicIds: arrayOfStrings(payload.topicIds).concat(arrayOfStrings(payload.topic_ids)).sort(),
    eventCounts: objectOfNumbers(payload.eventCounts) ?? objectOfNumbers(payload.event_counts) ?? {},
    outputRefs: objectOfStrings(payload.outputRefs) ?? objectOfStrings(payload.output_refs) ?? {},
    createdBy: stringValue(payload.createdBy) ?? stringValue(payload.created_by) ?? event.actor.id,
    createdAt: stringValue(payload.createdAt) ?? stringValue(payload.created_at) ?? event.occurred_at,
    compressionNote: "archive_is_compression_not_consensus",
  };
}

function itemFromPlainObject(item: Record<string, unknown>): ArchiveItem {
  return {
    summary: stringValue(item.summary) ?? "",
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    topicId: stringValue(item.topicId) ?? stringValue(item.topic_id),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id),
  };
}

function memoryChangeFromPlainObject(item: Record<string, unknown>): ArchiveMemoryChange {
  return {
    memoryId: stringValue(item.memoryId) ?? stringValue(item.memory_id) ?? "",
    fromState: memoryStateValue(item.fromState) ?? memoryStateValue(item.from_state),
    toState: memoryStateValue(item.toState) ?? memoryStateValue(item.to_state) ?? "observed",
    summary: stringValue(item.summary),
    reason: stringValue(item.reason),
    sourcePressureRefs: arrayOfStrings(item.sourcePressureRefs).concat(arrayOfStrings(item.source_pressure_refs)),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventId: stringValue(item.eventId) ?? stringValue(item.event_id) ?? "",
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function topicProposalFromEvent(event: RoomEvent, topicId?: TopicId): ArchiveTopicProposal | undefined {
  if (event.event_type !== "topic.proposed") return undefined;
  const payload = objectPayload(event.payload);
  return {
    proposalId: stringValue(payload.proposalId) ?? stringValue(payload.proposal_id) ?? event.event_id,
    status: stringValue(payload.status) ?? "proposed",
    action: stringValue(payload.action),
    title: stringValue(payload.title) ?? "Untitled topic proposal",
    reason: stringValue(payload.reason),
    currentTopicId: topicId,
    targetTopicId: stringValue(payload.targetTopicId) ?? stringValue(payload.target_topic_id),
    boundaryNote: stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
    sourcePressureRefs: pressureRefsFromPayload(payload, event.refs),
    sourceRefs: refsFromPayload(payload, event.refs),
    eventIds: [event.event_id],
    proposedBy: stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by),
    revisedFromTopicProposalRef:
      stringValue(payload.revisedFromTopicProposalRef) ?? stringValue(payload.revised_from_topic_proposal_ref),
    revisedBy: stringValue(payload.revisedBy) ?? stringValue(payload.revised_by),
    responseCount: 0,
    responses: [],
    reviews: [],
    actorId: event.actor.id,
  };
}

function applyTopicProposalEvent(
  proposalsById: Map<string, ArchiveTopicProposal>,
  event: RoomEvent,
  topicId?: TopicId,
): void {
  if (
    event.event_type !== "topic.proposed" &&
    event.event_type !== "topic.responded" &&
    event.event_type !== "topic.reviewed" &&
    event.event_type !== "topic.applied"
  ) {
    return;
  }
  const payload = objectPayload(event.payload);
  const proposalId =
    stringValue(payload.proposalId) ??
    stringValue(payload.proposal_id) ??
    stringValue(payload.topicProposalId) ??
    stringValue(payload.topic_proposal_id) ??
    stringValue(payload.topicProposalRef) ??
    stringValue(payload.topic_proposal_ref) ??
    event.event_id;

  if (event.event_type === "topic.proposed") {
    proposalsById.set(proposalId, topicProposalFromEvent(event, topicId) ?? emptyArchiveTopicProposal(proposalId, topicId));
    return;
  }

  const current = proposalsById.get(proposalId) ?? emptyArchiveTopicProposal(proposalId, topicId);
  if (event.event_type === "topic.applied") {
    current.status = "applied";
    current.action = stringValue(payload.action) ?? current.action;
    current.targetTopicId = stringValue(payload.targetTopicId) ?? stringValue(payload.target_topic_id) ?? current.targetTopicId;
    current.appliedBy = stringValue(payload.appliedBy) ?? stringValue(payload.applied_by) ?? event.actor.id;
    current.resultingTopicId = stringValue(payload.resultingTopicId) ?? stringValue(payload.resulting_topic_id);
    current.appliedTopicEventIds = arrayOfStrings(payload.appliedTopicEventIds).concat(
      arrayOfStrings(payload.applied_topic_event_ids),
    );
    current.applicationReason = stringValue(payload.reason);
    current.sourceRefs = unique(current.sourceRefs.concat(refsFromPayload(payload, event.refs)));
    current.sourcePressureRefs = unique(current.sourcePressureRefs.concat(pressureRefsFromPayload(payload, event.refs)));
    current.eventIds = unique(current.eventIds.concat(event.event_id));
    current.boundaryNote =
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "topic application is room-visible topic movement, not hidden scheduler control";
    proposalsById.set(proposalId, current);
    return;
  }

  if (event.event_type === "topic.reviewed") {
    current.reviews.push({
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary),
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "topic suggestion review is a social trace; it does not accept, reject, challenge, revise, apply, or move the active topic",
      sourceRefs: refsFromPayload(payload, event.refs),
      eventId: event.event_id,
      actorId: event.actor.id,
    });
    current.sourceRefs = unique(current.sourceRefs.concat(refsFromPayload(payload, event.refs)));
    current.sourcePressureRefs = unique(current.sourcePressureRefs.concat(pressureRefsFromPayload(payload, event.refs)));
    current.eventIds = unique(current.eventIds.concat(event.event_id));
    current.boundaryNote =
      current.boundaryNote ?? "topic proposal exchange remains social context, not automatic topic control";
    proposalsById.set(proposalId, current);
    return;
  }

  current.status = stringValue(payload.response) ?? "responded";
  current.responseCount += 1;
  current.responses.push({
    agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: stringValue(payload.response) ?? "responded",
    reason: stringValue(payload.reason),
    proposedRevision: stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision),
    sourceRefs: refsFromPayload(payload, event.refs),
    eventId: event.event_id,
    actorId: event.actor.id,
  });
  current.sourceRefs = unique(current.sourceRefs.concat(refsFromPayload(payload, event.refs)));
  current.sourcePressureRefs = unique(current.sourcePressureRefs.concat(pressureRefsFromPayload(payload, event.refs)));
  current.eventIds = unique(current.eventIds.concat(event.event_id));
  current.boundaryNote =
    stringValue(payload.boundaryNote) ??
    stringValue(payload.boundary_note) ??
    current.boundaryNote ??
    "topic proposal exchange remains social context, not automatic topic control";
  proposalsById.set(proposalId, current);
}

function emptyArchiveTopicProposal(proposalId: string, topicId?: TopicId): ArchiveTopicProposal {
  return {
    proposalId,
    status: "proposed",
    title: "Topic proposal response without original proposal in archive range",
    currentTopicId: topicId,
    boundaryNote: "topic proposal exchange remains social context, not automatic topic control",
    sourcePressureRefs: [],
    sourceRefs: [],
    eventIds: [],
    responseCount: 0,
    responses: [],
    reviews: [],
    actorId: "",
  };
}

function applyHandoffEvent(
  handoffsById: Map<string, ArchiveHandoffExchange>,
  event: RoomEvent,
  topicId?: TopicId,
): void {
  if (
    event.event_type !== "handoff.proposed" &&
    event.event_type !== "handoff.responded" &&
    event.event_type !== "handoff.reviewed"
  ) {
    return;
  }
  const payload = objectPayload(event.payload);
  const handoffId =
    stringValue(payload.handoffId) ??
    stringValue(payload.handoff_id) ??
    stringValue(payload.handoffRef) ??
    stringValue(payload.handoff_ref) ??
    event.event_id;
  const sourceRefs = refsFromPayload(payload, event.refs);
  const current =
    handoffsById.get(handoffId) ??
    ({
      handoffId,
      status: "proposed",
      topicId,
      responseCount: 0,
      responses: [],
      reviews: [],
      boundaryNote: "handoff remains a social proposal, not a forced transfer",
      sourcePressureRefs: [],
      sourceRefs: [],
      eventIds: [],
      actorId: event.actor.id,
    } satisfies ArchiveHandoffExchange);

  current.topicId = stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? current.topicId ?? topicId;
  current.sourceRefs = unique(current.sourceRefs.concat(sourceRefs));
  current.sourcePressureRefs = unique(current.sourcePressureRefs.concat(pressureRefsFromPayload(payload, event.refs)));
  current.eventIds = unique(current.eventIds.concat(event.event_id));

  if (event.event_type === "handoff.proposed") {
    current.status = stringValue(payload.status) ?? current.status;
    current.fromAgentId =
      stringValue(payload.fromAgentId) ?? stringValue(payload.from_agent_id) ?? current.fromAgentId ?? event.actor.id;
    current.toAgentId = stringValue(payload.toAgentId) ?? stringValue(payload.to_agent_id) ?? current.toAgentId;
    current.delegatedFromHandoffRef =
      stringValue(payload.delegatedFromHandoffRef) ??
      stringValue(payload.delegated_from_handoff_ref) ??
      current.delegatedFromHandoffRef;
    current.delegatedBy = stringValue(payload.delegatedBy) ?? stringValue(payload.delegated_by) ?? current.delegatedBy;
    current.reason = stringValue(payload.reason) ?? current.reason;
    current.requestedResponse =
      stringValue(payload.requestedResponse) ?? stringValue(payload.requested_response) ?? current.requestedResponse;
    current.actorId = event.actor.id;
  } else if (event.event_type === "handoff.responded") {
    const response = stringValue(payload.response) ?? stringValue(payload.status) ?? "responded";
    current.status = stringValue(payload.status) ?? handoffStatusFromResponse(response) ?? response;
    current.responses.push({
      byAgentId: stringValue(payload.byAgentId) ?? stringValue(payload.by_agent_id) ?? event.actor.id,
      response,
      reason: stringValue(payload.reason),
      redirectTo: stringValue(payload.redirectTo) ?? stringValue(payload.redirect_to),
      acceptedScopeSummary: summarizeUnknown(
        objectValue(payload.acceptedScope) ?? objectValue(payload.accepted_scope) ?? {},
        800,
      ),
      sourceRefs,
      eventId: event.event_id,
      actorId: event.actor.id,
    });
    current.responseCount = current.responses.length;
  } else if (event.event_type === "handoff.reviewed") {
    current.reviews = current.reviews ?? [];
    current.reviews.push({
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary),
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      boundaryNote: stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
      sourceRefs,
      eventId: event.event_id,
      actorId: event.actor.id,
    });
  }

  handoffsById.set(handoffId, current);
}

function applyProtocolEvent(
  protocolsById: Map<string, ArchiveProtocolExchange>,
  event: RoomEvent,
  topicId?: TopicId,
): void {
  if (
    event.event_type !== "protocol.proposed" &&
    event.event_type !== "protocol.responded" &&
    event.event_type !== "protocol.reviewed" &&
    event.event_type !== "protocol.retired" &&
    event.event_type !== "protocol.expired"
  ) {
    return;
  }
  const payload = objectPayload(event.payload);
  const protocolId =
    stringValue(payload.protocolId) ??
    stringValue(payload.protocol_id) ??
    stringValue(payload.protocolRef) ??
    stringValue(payload.protocol_ref) ??
    stringValue(payload.proposalId) ??
    stringValue(payload.proposal_id) ??
    event.event_id;
  const sourceRefs = refsFromPayload(payload, event.refs);
  const current =
    protocolsById.get(protocolId) ??
    ({
      protocolId,
      status: "proposed",
      topicId,
      responseCount: 0,
      responses: [],
      reviews: [],
      boundaryNote: "protocol is temporary room etiquette, not permanent control flow",
      sourceRefs: [],
      sourcePressureRefs: [],
      eventIds: [],
      actorId: event.actor.id,
    } satisfies ArchiveProtocolExchange);

  current.topicId = stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? current.topicId ?? topicId;
  current.sourceRefs = unique(current.sourceRefs.concat(sourceRefs));
  current.sourcePressureRefs = unique(current.sourcePressureRefs.concat(pressureRefsFromPayload(payload, event.refs)));
  current.eventIds = unique(current.eventIds.concat(event.event_id));

  if (event.event_type === "protocol.proposed") {
    current.status = stringValue(payload.status) ?? current.status;
    current.proposedBy =
      stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by) ?? current.proposedBy ?? event.actor.id;
    current.revisedFromProtocolRef =
      stringValue(payload.revisedFromProtocolRef) ??
      stringValue(payload.revised_from_protocol_ref) ??
      current.revisedFromProtocolRef;
    current.revisedBy = stringValue(payload.revisedBy) ?? stringValue(payload.revised_by) ?? current.revisedBy;
    current.summary = stringValue(payload.summary) ?? current.summary;
    current.scope = stringValue(payload.scope) ?? current.scope;
    current.expiresAt = stringValue(payload.expiresAt) ?? stringValue(payload.expires_at) ?? current.expiresAt;
    current.expiryPolicy =
      stringValue(payload.expiryPolicy) ?? stringValue(payload.expiry_policy) ?? current.expiryPolicy;
    current.reason = stringValue(payload.reason) ?? current.reason;
    current.boundaryNote =
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      current.boundaryNote ??
      "protocol is temporary room etiquette, not permanent control flow";
    current.actorId = event.actor.id;
  } else if (event.event_type === "protocol.responded") {
    const response = stringValue(payload.response) ?? stringValue(payload.status) ?? "responded";
    current.status = stringValue(payload.status) ?? protocolStatusFromResponse(response) ?? response;
    current.responses.push({
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response,
      reason: stringValue(payload.reason),
      proposedRevision: stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision),
      sourceRefs,
      eventId: event.event_id,
      actorId: event.actor.id,
    });
    current.responseCount = current.responses.length;
  } else if (event.event_type === "protocol.reviewed") {
    current.reviews = current.reviews ?? [];
    current.reviews.push({
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response: stringValue(payload.response) ?? "reviewed",
      summary: stringValue(payload.summary),
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      boundaryNote: stringValue(payload.boundaryNote) ?? stringValue(payload.boundary_note),
      sourceRefs,
      eventId: event.event_id,
      actorId: event.actor.id,
    });
  } else {
    current.status = event.event_type.replace("protocol.", "");
    current.reason = stringValue(payload.reason) ?? current.reason;
    current.expiresAt = stringValue(payload.expiredAt) ?? stringValue(payload.expired_at) ?? current.expiresAt;
  }

  protocolsById.set(protocolId, current);
}

function applyInvitationEvent(
  invitationsById: Map<string, ArchiveInvitation>,
  event: RoomEvent,
  topicId?: TopicId,
): void {
  if (event.event_type !== "agent.invited" && event.event_type !== "agent.invitation_responded") return;
  const payload = objectPayload(event.payload);
  if (event.event_type === "agent.invited" && stringValue(payload.invitedBy) !== "agent_intention") return;
  const invitationId =
    stringValue(payload.invitationId) ??
    stringValue(payload.invitation_id) ??
    stringValue(payload.invitationRef) ??
    stringValue(payload.invitation_ref) ??
    event.event_id;
  const sourceRefs = refsFromPayload(payload, event.refs);
  const current =
    invitationsById.get(invitationId) ??
    ({
      invitationId,
      status: "invited",
      topicId,
      responseCount: 0,
      responses: [],
      boundaryNote: "invitation is a social knock, not a speaking command",
      sourcePressureRefs: [],
      sourceRefs: [],
      eventIds: [],
      actorId: event.actor.id,
    } satisfies ArchiveInvitation);

  current.topicId = stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? current.topicId ?? topicId;
  current.sourceRefs = unique(current.sourceRefs.concat(sourceRefs));
  current.sourcePressureRefs = unique(current.sourcePressureRefs.concat(pressureRefsFromPayload(payload, event.refs)));
  current.eventIds = unique(current.eventIds.concat(event.event_id));

  if (event.event_type === "agent.invited") {
    current.status = stringValue(payload.status) ?? current.status;
    current.fromAgentId = current.fromAgentId ?? event.actor.id;
    current.toAgentId = stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? current.toAgentId;
    current.delegatedFromInvitationRef =
      stringValue(payload.delegatedFromInvitationRef) ??
      stringValue(payload.delegated_from_invitation_ref) ??
      current.delegatedFromInvitationRef;
    current.delegatedBy = stringValue(payload.delegatedBy) ?? stringValue(payload.delegated_by) ?? current.delegatedBy;
    current.reason = stringValue(payload.reason) ?? current.reason;
    current.boundaryNote =
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      current.boundaryNote ??
      "invitation is a social knock, not a speaking command";
    current.actorId = event.actor.id;
  } else {
    const response = stringValue(payload.response) ?? stringValue(payload.status) ?? "responded";
    current.status = invitationStatusFromResponse(response) ?? response;
    current.responses.push({
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      response,
      reason: stringValue(payload.reason),
      redirectTo: stringValue(payload.redirectTo) ?? stringValue(payload.redirect_to),
      sourceRefs,
      eventId: event.event_id,
      actorId: event.actor.id,
    });
    current.responseCount = current.responses.length;
  }

  invitationsById.set(invitationId, current);
}

function silenceFromEvent(
  event: RoomEvent,
  providerDegradedIntentionEventIds: ReadonlySet<string>,
  topicId?: TopicId,
): ArchiveSilence | undefined {
  if (event.event_type !== "agent.intention_recorded" || providerDegradedIntentionEventIds.has(event.event_id)) {
    return undefined;
  }
  const payload = objectPayload(event.payload);
  const intention = objectValue(payload.intention);
  if (stringValue(intention?.kind) !== "stay_silent") return undefined;
  const reason = stringValue(intention?.reason) ?? "";
  if (reason.toLowerCase().startsWith("live provider degraded:")) return undefined;
  return {
    silenceId: event.event_id,
    agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? topicId,
    invitationId: stringValue(payload.invitationId) ?? stringValue(payload.invitation_id),
    triggeringEventId: stringValue(payload.triggeringEventId) ?? stringValue(payload.triggering_event_id),
    reason,
    boundaryNote: "deliberate silence is a valid room expression, not provider failure or agreement",
    sourceRefs: unique(
      refsFromPayload(payload, event.refs)
        .concat(optionalString(payload.invitationId))
        .concat(optionalString(payload.invitation_id))
        .concat(optionalString(payload.triggeringEventId))
        .concat(optionalString(payload.triggering_event_id)),
    ),
    eventIds: [event.event_id],
    actorId: event.actor.id,
  };
}

function personaDeltaFromEvent(event: RoomEvent): ArchivePersonaDelta | undefined {
  if (!event.event_type.startsWith("persona_delta.")) return undefined;
  const payload = objectPayload(event.payload);
  const proposedChange = objectValue(payload.proposedChange) ?? objectValue(payload.proposed_change);
  const response = stringValue(payload.response);
  const isReview = event.event_type === "persona_delta.reviewed";
  return {
    deltaId:
      stringValue(payload.deltaId) ??
      stringValue(payload.delta_id) ??
      stringValue(payload.deltaRef) ??
      stringValue(payload.delta_ref) ??
      event.event_id,
    status: isReview ? "reviewed" : stringValue(payload.status) ?? response ?? event.event_type.replace("persona_delta.", ""),
    reviewId: isReview ? stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id : undefined,
    agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    proposedBy: stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by),
    revisedFromDeltaRef: stringValue(payload.revisedFromDeltaRef) ?? stringValue(payload.revised_from_delta_ref),
    revisedBy: stringValue(payload.revisedBy) ?? stringValue(payload.revised_by),
    respondingAgentId: response && !isReview ? stringValue(payload.agentId) ?? stringValue(payload.agent_id) : undefined,
    reviewingAgentId: isReview ? stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id : undefined,
    response,
    proposedRevision: stringValue(payload.proposedRevision) ?? stringValue(payload.proposed_revision),
    field: stringValue(proposedChange?.field),
    operation: stringValue(proposedChange?.operation),
    valueSummary: summarizePersonaValue(proposedChange?.value),
    valueDate: stringValue(objectValue(proposedChange?.value)?.date),
    valueSourceRef: stringValue(objectValue(proposedChange?.value)?.sourceRef),
    summary: stringValue(payload.summary),
    sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
    reason: stringValue(payload.reason),
    boundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      (isReview
        ? "identity proposal review is a social trace; it does not accept, reject, contest, retire, revise, or mutate identity"
        : event.event_type === "persona_delta.proposed"
        ? "identity proposal is room-visible, contestable, and not a fixed assignment"
        : undefined),
    sourcePressureRefs: pressureRefsFromPayload(payload, event.refs),
    sourceRefs: refsFromPayload(payload, event.refs),
    eventIds: [event.event_id],
    actorId: event.actor.id,
  };
}

function sideEffectBoundaryFromEvent(event: RoomEvent, topicId?: TopicId): ArchiveSideEffectBoundary | undefined {
  if (!event.event_type.startsWith("side_effect.")) return undefined;
  const payload = objectPayload(event.payload);
  const requestId =
    stringValue(payload.requestId) ??
    stringValue(payload.request_id) ??
    stringValue(payload.sideEffectRef) ??
    stringValue(payload.side_effect_ref) ??
    stringValue(payload.approvalId) ??
    stringValue(payload.approval_id) ??
    event.event_id;
  const approvalId = stringValue(payload.approvalId) ?? stringValue(payload.approval_id);
  const status =
    stringValue(payload.status) ??
    (event.event_type === "side_effect.approved"
      ? "approved"
      : event.event_type === "side_effect.denied"
        ? "denied"
        : event.event_type === "side_effect.result_reported"
          ? "result_reported"
          : event.event_type.replace("side_effect.", ""));
  return {
    requestId,
    approvalId,
    status,
    kind: stringValue(payload.kind) ?? stringValue(payload.actionKind) ?? stringValue(payload.action_kind),
    target: stringValue(payload.target),
    requestedBy: stringValue(payload.requestedBy) ?? stringValue(payload.requested_by),
    decidedBy:
      stringValue(payload.approvedBy) ??
      stringValue(payload.approved_by) ??
      stringValue(payload.deniedBy) ??
      stringValue(payload.denied_by),
    resultId: stringValue(payload.resultId) ?? stringValue(payload.result_id),
    reason: stringValue(payload.reason) ?? stringValue(payload.summary),
    expectedImpact: stringValue(payload.expectedImpact) ?? stringValue(payload.expected_impact),
    decisionReason:
      event.event_type === "side_effect.approved" || event.event_type === "side_effect.denied"
        ? stringValue(payload.reason)
        : stringValue(payload.decisionReason) ?? stringValue(payload.decision_reason),
    resultSummary: event.event_type === "side_effect.result_reported" ? stringValue(payload.summary) : undefined,
    boundaryNote: sideEffectBoundaryNote(event.event_type, topicId),
    sourcePressureRefs: pressureRefsFromPayload(payload, event.refs),
    sourceRefs: refsFromPayload(payload, event.refs),
    eventIds: [event.event_id],
    actorId: event.actor.id,
  };
}

function topicProposalFromPlainObject(item: Record<string, unknown>): ArchiveTopicProposal {
  const responses = arrayOfObjects(item.responses).map(topicProposalResponseFromPlainObject);
  const reviews = arrayOfObjects(item.reviews).map(topicProposalReviewFromPlainObject);
  return {
    proposalId: stringValue(item.proposalId) ?? stringValue(item.proposal_id) ?? "",
    status: stringValue(item.status) ?? "proposed",
    action: stringValue(item.action),
    title: stringValue(item.title) ?? "",
    reason: stringValue(item.reason),
    currentTopicId: stringValue(item.currentTopicId) ?? stringValue(item.current_topic_id),
    targetTopicId: stringValue(item.targetTopicId) ?? stringValue(item.target_topic_id),
    boundaryNote: stringValue(item.boundaryNote) ?? stringValue(item.boundary_note),
    sourcePressureRefs: arrayOfStrings(item.sourcePressureRefs).concat(arrayOfStrings(item.source_pressure_refs)),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    proposedBy: stringValue(item.proposedBy) ?? stringValue(item.proposed_by),
    revisedFromTopicProposalRef:
      stringValue(item.revisedFromTopicProposalRef) ?? stringValue(item.revised_from_topic_proposal_ref),
    revisedBy: stringValue(item.revisedBy) ?? stringValue(item.revised_by),
    responseCount: numberValue(item.responseCount) ?? numberValue(item.response_count) ?? responses.length,
    responses,
    reviews,
    appliedBy: stringValue(item.appliedBy) ?? stringValue(item.applied_by),
    resultingTopicId: stringValue(item.resultingTopicId) ?? stringValue(item.resulting_topic_id),
    appliedTopicEventIds: arrayOfStrings(item.appliedTopicEventIds).concat(arrayOfStrings(item.applied_topic_event_ids)),
    applicationReason: stringValue(item.applicationReason) ?? stringValue(item.application_reason),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function topicProposalResponseFromPlainObject(item: Record<string, unknown>): ArchiveTopicProposalResponse {
  return {
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    response: stringValue(item.response) ?? "responded",
    reason: stringValue(item.reason),
    proposedRevision: stringValue(item.proposedRevision) ?? stringValue(item.proposed_revision),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventId: stringValue(item.eventId) ?? stringValue(item.event_id) ?? "",
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function topicProposalReviewFromPlainObject(item: Record<string, unknown>): ArchiveTopicProposalReview {
  return {
    reviewId: stringValue(item.reviewId) ?? stringValue(item.review_id) ?? "",
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    response: stringValue(item.response) ?? "reviewed",
    summary: stringValue(item.summary),
    sourceMessageId: stringValue(item.sourceMessageId) ?? stringValue(item.source_message_id),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "topic suggestion review is a social trace; it does not accept, reject, challenge, revise, apply, or move the active topic",
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventId: stringValue(item.eventId) ?? stringValue(item.event_id) ?? "",
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function openQuestionFromPlainObject(item: Record<string, unknown>): ArchiveOpenQuestion {
  return {
    questionId: stringValue(item.questionId) ?? stringValue(item.question_id) ?? "",
    topicId: stringValue(item.topicId) ?? stringValue(item.topic_id),
    question: stringValue(item.question) ?? stringValue(item.openQuestion) ?? stringValue(item.open_question) ?? "",
    raisedBy: stringValue(item.raisedBy) ?? stringValue(item.raised_by),
    refinedFromQuestionRef:
      stringValue(item.refinedFromQuestionRef) ?? stringValue(item.refined_from_question_ref),
    refinedBy: stringValue(item.refinedBy) ?? stringValue(item.refined_by),
    sourcePressureRefs: arrayOfStrings(item.sourcePressureRefs).concat(arrayOfStrings(item.source_pressure_refs)),
    sourceMessageId: stringValue(item.sourceMessageId) ?? stringValue(item.source_message_id),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "open question is room-visible unresolved context, not a demand for immediate answer",
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
    responses: arrayOfObjects(item.responses)
      .concat(arrayOfObjects(item.openQuestionResponses))
      .concat(arrayOfObjects(item.open_question_responses))
      .map(openQuestionResponseFromPlainObject),
  };
}

function openQuestionResponseFromPlainObject(item: Record<string, unknown>): ArchiveOpenQuestionResponse {
  return {
    responseId: stringValue(item.responseId) ?? stringValue(item.response_id) ?? "",
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    response: stringValue(item.response) ?? "responded",
    summary: stringValue(item.summary),
    sourceMessageId: stringValue(item.sourceMessageId) ?? stringValue(item.source_message_id),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventId: stringValue(item.eventId) ?? stringValue(item.event_id) ?? "",
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "open question response is a social trace; it does not resolve or close the question",
  };
}

function handoffExchangeFromPlainObject(item: Record<string, unknown>): ArchiveHandoffExchange {
  const responses = arrayOfObjects(item.responses).map(handoffResponseFromPlainObject);
  const reviews = arrayOfObjects(item.reviews).map(handoffReviewFromPlainObject);
  return {
    handoffId: stringValue(item.handoffId) ?? stringValue(item.handoff_id) ?? "",
    status: stringValue(item.status) ?? "proposed",
    topicId: stringValue(item.topicId) ?? stringValue(item.topic_id),
    fromAgentId: stringValue(item.fromAgentId) ?? stringValue(item.from_agent_id),
    toAgentId: stringValue(item.toAgentId) ?? stringValue(item.to_agent_id),
    delegatedFromHandoffRef:
      stringValue(item.delegatedFromHandoffRef) ?? stringValue(item.delegated_from_handoff_ref),
    delegatedBy: stringValue(item.delegatedBy) ?? stringValue(item.delegated_by),
    reason: stringValue(item.reason),
    requestedResponse: stringValue(item.requestedResponse) ?? stringValue(item.requested_response),
    responseCount: numberValue(item.responseCount) ?? numberValue(item.response_count) ?? responses.length,
    responses,
    reviews,
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "handoff remains a social proposal, not a forced transfer",
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    sourcePressureRefs: arrayOfStrings(item.sourcePressureRefs).concat(arrayOfStrings(item.source_pressure_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function handoffReviewFromPlainObject(item: Record<string, unknown>): ArchiveHandoffReview {
  return {
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    response: stringValue(item.response) ?? "reviewed",
    summary: stringValue(item.summary),
    sourceMessageId: stringValue(item.sourceMessageId) ?? stringValue(item.source_message_id),
    boundaryNote: stringValue(item.boundaryNote) ?? stringValue(item.boundary_note),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventId: stringValue(item.eventId) ?? stringValue(item.event_id) ?? "",
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function handoffResponseFromPlainObject(item: Record<string, unknown>): ArchiveHandoffResponse {
  return {
    byAgentId: stringValue(item.byAgentId) ?? stringValue(item.by_agent_id),
    response: stringValue(item.response) ?? stringValue(item.status) ?? "responded",
    reason: stringValue(item.reason),
    redirectTo: stringValue(item.redirectTo) ?? stringValue(item.redirect_to),
    acceptedScopeSummary: stringValue(item.acceptedScopeSummary) ?? stringValue(item.accepted_scope_summary),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventId: stringValue(item.eventId) ?? stringValue(item.event_id) ?? "",
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function protocolExchangeFromPlainObject(item: Record<string, unknown>): ArchiveProtocolExchange {
  const responses = arrayOfObjects(item.responses).map(protocolResponseFromPlainObject);
  return {
    protocolId: stringValue(item.protocolId) ?? stringValue(item.protocol_id) ?? "",
    status: stringValue(item.status) ?? "proposed",
    topicId: stringValue(item.topicId) ?? stringValue(item.topic_id),
    proposedBy: stringValue(item.proposedBy) ?? stringValue(item.proposed_by),
    revisedFromProtocolRef:
      stringValue(item.revisedFromProtocolRef) ?? stringValue(item.revised_from_protocol_ref),
    revisedBy: stringValue(item.revisedBy) ?? stringValue(item.revised_by),
    summary: stringValue(item.summary),
    scope: stringValue(item.scope),
    expiresAt: stringValue(item.expiresAt) ?? stringValue(item.expires_at),
    expiryPolicy: stringValue(item.expiryPolicy) ?? stringValue(item.expiry_policy),
    reason: stringValue(item.reason),
    responseCount: numberValue(item.responseCount) ?? numberValue(item.response_count) ?? responses.length,
    responses,
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "protocol is temporary room etiquette, not permanent control flow",
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    sourcePressureRefs: arrayOfStrings(item.sourcePressureRefs).concat(arrayOfStrings(item.source_pressure_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function protocolResponseFromPlainObject(item: Record<string, unknown>): ArchiveProtocolResponse {
  return {
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    response: stringValue(item.response) ?? stringValue(item.status) ?? "responded",
    reason: stringValue(item.reason),
    proposedRevision: stringValue(item.proposedRevision) ?? stringValue(item.proposed_revision),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventId: stringValue(item.eventId) ?? stringValue(item.event_id) ?? "",
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function invitationFromPlainObject(item: Record<string, unknown>): ArchiveInvitation {
  const responses = arrayOfObjects(item.responses).map(invitationResponseFromPlainObject);
  return {
    invitationId: stringValue(item.invitationId) ?? stringValue(item.invitation_id) ?? "",
    status: stringValue(item.status) ?? "invited",
    topicId: stringValue(item.topicId) ?? stringValue(item.topic_id),
    fromAgentId: stringValue(item.fromAgentId) ?? stringValue(item.from_agent_id),
    toAgentId: stringValue(item.toAgentId) ?? stringValue(item.to_agent_id),
    delegatedFromInvitationRef:
      stringValue(item.delegatedFromInvitationRef) ?? stringValue(item.delegated_from_invitation_ref),
    delegatedBy: stringValue(item.delegatedBy) ?? stringValue(item.delegated_by),
    reason: stringValue(item.reason),
    responseCount: numberValue(item.responseCount) ?? numberValue(item.response_count) ?? responses.length,
    responses,
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "invitation is a social knock, not a speaking command",
    sourcePressureRefs: arrayOfStrings(item.sourcePressureRefs).concat(arrayOfStrings(item.source_pressure_refs)),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function invitationResponseFromPlainObject(item: Record<string, unknown>): ArchiveInvitationResponse {
  return {
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    response: stringValue(item.response) ?? stringValue(item.status) ?? "responded",
    reason: stringValue(item.reason),
    redirectTo: stringValue(item.redirectTo) ?? stringValue(item.redirect_to),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventId: stringValue(item.eventId) ?? stringValue(item.event_id) ?? "",
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function silenceFromPlainObject(item: Record<string, unknown>): ArchiveSilence {
  return {
    silenceId: stringValue(item.silenceId) ?? stringValue(item.silence_id) ?? "",
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    topicId: stringValue(item.topicId) ?? stringValue(item.topic_id),
    invitationId: stringValue(item.invitationId) ?? stringValue(item.invitation_id),
    triggeringEventId: stringValue(item.triggeringEventId) ?? stringValue(item.triggering_event_id),
    reason: stringValue(item.reason),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "deliberate silence is a valid room expression, not provider failure or agreement",
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function personaDeltaFromPlainObject(item: Record<string, unknown>): ArchivePersonaDelta {
  return {
    deltaId: stringValue(item.deltaId) ?? stringValue(item.delta_id) ?? "",
    status: stringValue(item.status) ?? "",
    reviewId: stringValue(item.reviewId) ?? stringValue(item.review_id),
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    proposedBy: stringValue(item.proposedBy) ?? stringValue(item.proposed_by),
    revisedFromDeltaRef: stringValue(item.revisedFromDeltaRef) ?? stringValue(item.revised_from_delta_ref),
    revisedBy: stringValue(item.revisedBy) ?? stringValue(item.revised_by),
    respondingAgentId: stringValue(item.respondingAgentId) ?? stringValue(item.responding_agent_id),
    reviewingAgentId: stringValue(item.reviewingAgentId) ?? stringValue(item.reviewing_agent_id),
    response: stringValue(item.response),
    proposedRevision: stringValue(item.proposedRevision) ?? stringValue(item.proposed_revision),
    field: stringValue(item.field),
    operation: stringValue(item.operation),
    valueSummary: stringValue(item.valueSummary) ?? stringValue(item.value_summary),
    valueDate: stringValue(item.valueDate) ?? stringValue(item.value_date),
    valueSourceRef: stringValue(item.valueSourceRef) ?? stringValue(item.value_source_ref),
    summary: stringValue(item.summary),
    sourceMessageId: stringValue(item.sourceMessageId) ?? stringValue(item.source_message_id),
    reason: stringValue(item.reason),
    boundaryNote: stringValue(item.boundaryNote) ?? stringValue(item.boundary_note),
    sourcePressureRefs: arrayOfStrings(item.sourcePressureRefs).concat(arrayOfStrings(item.source_pressure_refs)),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function agentContinuityFromPlainObject(item: Record<string, unknown>): ArchiveAgentContinuity {
  return {
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id) ?? "",
    roleClaims: arrayOfObjects(item.roleClaims)
      .concat(arrayOfObjects(item.role_claims))
      .map(agentRoleClaimFromPlainObject),
    dailyMoods: arrayOfObjects(item.dailyMoods)
      .concat(arrayOfObjects(item.daily_moods))
      .map(agentDailyMoodFromPlainObject),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "agent continuity in archives is evidence sediment from persona deltas, not a fixed role, assignment, or public-memory truth",
  };
}

function agentRoleClaimFromPlainObject(item: Record<string, unknown>): ArchiveAgentRoleClaim {
  return {
    roleClaimId: stringValue(item.roleClaimId) ?? stringValue(item.role_claim_id) ?? "",
    deltaId: stringValue(item.deltaId) ?? stringValue(item.delta_id) ?? "",
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    label: stringValue(item.label) ?? "",
    status: stringValue(item.status) ?? "proposed",
    proposedBy: stringValue(item.proposedBy) ?? stringValue(item.proposed_by),
    evidenceRefs: arrayOfStrings(item.evidenceRefs).concat(arrayOfStrings(item.evidence_refs)),
    sourcePressureRefs: arrayOfStrings(item.sourcePressureRefs).concat(arrayOfStrings(item.source_pressure_refs)),
    contestRefs: arrayOfStrings(item.contestRefs).concat(arrayOfStrings(item.contest_refs)),
    responseRefs: arrayOfStrings(item.responseRefs).concat(arrayOfStrings(item.response_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorIds: arrayOfStrings(item.actorIds).concat(arrayOfStrings(item.actor_ids)),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "role claim is ledger-backed persona sediment, not a room assignment or model capability claim",
  };
}

function agentDailyMoodFromPlainObject(item: Record<string, unknown>): ArchiveAgentDailyMood {
  return {
    deltaId: stringValue(item.deltaId) ?? stringValue(item.delta_id) ?? "",
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    date: stringValue(item.date),
    posture: stringValue(item.posture) ?? "",
    status: stringValue(item.status) ?? "proposed",
    proposedBy: stringValue(item.proposedBy) ?? stringValue(item.proposed_by),
    acceptedBy: stringValue(item.acceptedBy) ?? stringValue(item.accepted_by),
    sourceRef: stringValue(item.sourceRef) ?? stringValue(item.source_ref),
    evidenceRefs: arrayOfStrings(item.evidenceRefs).concat(arrayOfStrings(item.evidence_refs)),
    responseRefs: arrayOfStrings(item.responseRefs).concat(arrayOfStrings(item.response_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorIds: arrayOfStrings(item.actorIds).concat(arrayOfStrings(item.actor_ids)),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "daily mood is reversible ledger-backed continuity, not a fixed role, duty, or memory truth",
  };
}

function sideEffectBoundaryFromPlainObject(item: Record<string, unknown>): ArchiveSideEffectBoundary {
  return {
    requestId: stringValue(item.requestId) ?? stringValue(item.request_id) ?? "",
    approvalId: stringValue(item.approvalId) ?? stringValue(item.approval_id),
    status: stringValue(item.status) ?? "",
    kind: stringValue(item.kind),
    target: stringValue(item.target),
    requestedBy: stringValue(item.requestedBy) ?? stringValue(item.requested_by),
    decidedBy: stringValue(item.decidedBy) ?? stringValue(item.decided_by),
    resultId: stringValue(item.resultId) ?? stringValue(item.result_id),
    reason: stringValue(item.reason),
    expectedImpact: stringValue(item.expectedImpact) ?? stringValue(item.expected_impact),
    decisionReason: stringValue(item.decisionReason) ?? stringValue(item.decision_reason),
    resultSummary: stringValue(item.resultSummary) ?? stringValue(item.result_summary),
    boundaryNote: stringValue(item.boundaryNote) ?? stringValue(item.boundary_note) ?? "side-effect boundary event",
    sourcePressureRefs: arrayOfStrings(item.sourcePressureRefs).concat(arrayOfStrings(item.source_pressure_refs)),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function workspaceArtifactFromEvent(event: RoomEvent): ArchiveWorkspaceArtifact | undefined {
  if (event.event_type !== "workspace.artifact_shared" && event.event_type !== "workspace.artifact_reviewed") return undefined;
  const payload = objectPayload(event.payload);
  if (event.event_type === "workspace.artifact_reviewed") {
    return {
      artifactId:
        stringValue(payload.artifactRef) ??
        stringValue(payload.artifact_ref) ??
        stringValue(payload.artifactId) ??
        stringValue(payload.artifact_id) ??
        event.event_id,
      workspaceId: stringValue(payload.workspaceId) ?? stringValue(payload.workspace_id) ?? "",
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
      status: "reviewed",
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      response: stringValue(payload.response) ?? "reviewed",
      reviewedBy: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      summary: stringValue(payload.summary) ?? "Workspace artifact reviewed.",
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "workspace artifact review is a social trace; it does not copy private workspace contents, promote public memory, execute tools, or mutate the artifact",
      sourcePressureRefs: pressureRefsFromPayload(payload, event.refs),
      sourceRefs: refsFromPayload(payload, event.refs),
      eventIds: [event.event_id],
      actorId: event.actor.id,
    };
  }
  return {
    artifactId: stringValue(payload.artifactId) ?? stringValue(payload.artifact_id) ?? event.event_id,
    workspaceId: stringValue(payload.workspaceId) ?? stringValue(payload.workspace_id) ?? "",
    agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    pathRef: stringValue(payload.pathRef) ?? stringValue(payload.path_ref),
    status: stringValue(payload.status) ?? "shared",
    summary: stringValue(payload.summary) ?? "Shared workspace artifact ref.",
    boundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "artifact ref is room-visible; private workspace contents are not copied into memory",
    sourcePressureRefs: pressureRefsFromPayload(payload, event.refs),
    sourceRefs: refsFromPayload(payload, event.refs),
    eventIds: [event.event_id],
    actorId: event.actor.id,
  };
}

function workspaceBoundaryFromEvent(event: RoomEvent): ArchiveWorkspaceBoundary | undefined {
  if (event.event_type !== "workspace.provisioned") return undefined;
  const payload = objectPayload(event.payload);
  return {
    workspaceId: stringValue(payload.workspaceId) ?? stringValue(payload.workspace_id) ?? event.event_id,
    agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    visibility: stringValue(payload.visibility) ?? "private",
    scratchPath: stringValue(payload.scratchPath) ?? stringValue(payload.scratch_path),
    retentionPolicy: stringValue(payload.retentionPolicy) ?? stringValue(payload.retention_policy),
    publicContributionPolicy:
      stringValue(payload.publicContributionPolicy) ?? stringValue(payload.public_contribution_policy),
    boundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "private workspace metadata only; private files do not enter public memory automatically",
    sourceRefs: refsFromPayload(payload, event.refs),
    eventIds: [event.event_id],
    actorId: event.actor.id,
  };
}

function workspaceBoundaryFromPlainObject(item: Record<string, unknown>): ArchiveWorkspaceBoundary {
  return {
    workspaceId: stringValue(item.workspaceId) ?? stringValue(item.workspace_id) ?? "",
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    visibility: stringValue(item.visibility),
    scratchPath: stringValue(item.scratchPath) ?? stringValue(item.scratch_path),
    retentionPolicy: stringValue(item.retentionPolicy) ?? stringValue(item.retention_policy),
    publicContributionPolicy: stringValue(item.publicContributionPolicy) ?? stringValue(item.public_contribution_policy),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "private workspace metadata only; private files do not enter public memory automatically",
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function workspaceArtifactFromPlainObject(item: Record<string, unknown>): ArchiveWorkspaceArtifact {
  return {
    artifactId: stringValue(item.artifactId) ?? stringValue(item.artifact_id) ?? "",
    workspaceId: stringValue(item.workspaceId) ?? stringValue(item.workspace_id) ?? "",
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    pathRef: stringValue(item.pathRef) ?? stringValue(item.path_ref),
    status: stringValue(item.status),
    reviewId: stringValue(item.reviewId) ?? stringValue(item.review_id),
    response: stringValue(item.response),
    reviewedBy: stringValue(item.reviewedBy) ?? stringValue(item.reviewed_by),
    sourceMessageId: stringValue(item.sourceMessageId) ?? stringValue(item.source_message_id),
    summary: stringValue(item.summary) ?? "",
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "artifact ref is room-visible; private workspace contents are not copied into memory",
    sourcePressureRefs: arrayOfStrings(item.sourcePressureRefs).concat(arrayOfStrings(item.source_pressure_refs)),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function skillCapsuleFromEvent(event: RoomEvent): ArchiveSkillCapsule | undefined {
  if (event.event_type !== "skill.capsule_registered" && event.event_type !== "skill.capsule_reviewed") return undefined;
  const payload = objectPayload(event.payload);
  if (event.event_type === "skill.capsule_reviewed") {
    return {
      capsuleId:
        stringValue(payload.capsuleRef) ??
        stringValue(payload.capsule_ref) ??
        stringValue(payload.capsuleId) ??
        stringValue(payload.capsule_id) ??
        event.event_id,
      agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
      triggerHints: [],
      sideEffectKinds: [],
      approvalRequired: true,
      status: "reviewed",
      reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
      response: stringValue(payload.response) ?? "reviewed",
      reviewedBy: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
      sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
      summary: stringValue(payload.summary) ?? "Skill capsule reviewed.",
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "skill capsule review is a social trace; it does not register a skill, assign a role, execute tools, bypass approvals, or mutate capability state",
      sourcePressureRefs: pressureRefsFromPayload(payload, event.refs),
      sourceRefs: refsFromPayload(payload, event.refs),
      eventIds: [event.event_id],
      actorId: event.actor.id,
    };
  }
  const sideEffectKinds = arrayOfStrings(payload.sideEffectKinds).concat(arrayOfStrings(payload.side_effect_kinds));
  return {
    capsuleId: stringValue(payload.capsuleId) ?? stringValue(payload.capsule_id) ?? event.event_id,
    agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    label: stringValue(payload.label),
    triggerHints: arrayOfStrings(payload.triggerHints).concat(arrayOfStrings(payload.trigger_hints)),
    sideEffectKinds,
    approvalRequired: booleanValue(payload.approvalRequired) ?? booleanValue(payload.approval_required) ?? sideEffectKinds.length > 0,
    status: stringValue(payload.status) ?? "registered",
    source: stringValue(payload.source),
    summary: stringValue(payload.summary),
    boundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "skill capsule is a possible action organ; it cannot execute or publish without an explicit room event and required approvals",
    sourcePressureRefs: pressureRefsFromPayload(payload, event.refs),
    sourceRefs: refsFromPayload(payload, event.refs),
    eventIds: [event.event_id],
    actorId: event.actor.id,
  };
}

function skillCapsuleFromPlainObject(item: Record<string, unknown>): ArchiveSkillCapsule {
  const sideEffectKinds = arrayOfStrings(item.sideEffectKinds).concat(arrayOfStrings(item.side_effect_kinds));
  return {
    capsuleId: stringValue(item.capsuleId) ?? stringValue(item.capsule_id) ?? "",
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    label: stringValue(item.label),
    triggerHints: arrayOfStrings(item.triggerHints).concat(arrayOfStrings(item.trigger_hints)),
    sideEffectKinds,
    approvalRequired:
      booleanValue(item.approvalRequired) ?? booleanValue(item.approval_required) ?? sideEffectKinds.length > 0,
    status: stringValue(item.status) ?? "registered",
    source: stringValue(item.source),
    reviewId: stringValue(item.reviewId) ?? stringValue(item.review_id),
    response: stringValue(item.response),
    reviewedBy: stringValue(item.reviewedBy) ?? stringValue(item.reviewed_by),
    sourceMessageId: stringValue(item.sourceMessageId) ?? stringValue(item.source_message_id),
    summary: stringValue(item.summary),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "skill capsule is a possible action organ; it cannot execute or publish without an explicit room event and required approvals",
    sourcePressureRefs: arrayOfStrings(item.sourcePressureRefs).concat(arrayOfStrings(item.source_pressure_refs)),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function pressureBoundaryFromEvent(event: RoomEvent, topicId?: TopicId): ArchivePressureBoundary | undefined {
  if (event.event_type !== "room.pressure_detected") return undefined;
  const payload = objectPayload(event.payload);
  return {
    boundaryId: event.event_id,
    reason: stringValue(payload.reason) ?? "room_pressure_detected",
    topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? topicId,
    messageEventId: stringValue(payload.messageEventId) ?? stringValue(payload.message_event_id),
    activeBackgroundTurns: numberValue(payload.activeBackgroundTurns) ?? numberValue(payload.active_background_turns),
    queuedBackgroundTurns: numberValue(payload.queuedBackgroundTurns) ?? numberValue(payload.queued_background_turns),
    maxConcurrentBackgroundTurns:
      numberValue(payload.maxConcurrentBackgroundTurns) ?? numberValue(payload.max_concurrent_background_turns),
    boundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "room pressure boundary recorded; message expression is preserved while wake may be delayed",
    sourceRefs: refsFromPayload(payload, event.refs),
    eventIds: [event.event_id],
    actorId: event.actor.id,
  };
}

function pressureBoundaryFromPlainObject(item: Record<string, unknown>): ArchivePressureBoundary {
  return {
    boundaryId: stringValue(item.boundaryId) ?? stringValue(item.boundary_id) ?? "",
    reason: stringValue(item.reason) ?? "room_pressure_detected",
    topicId: stringValue(item.topicId) ?? stringValue(item.topic_id),
    messageEventId: stringValue(item.messageEventId) ?? stringValue(item.message_event_id),
    activeBackgroundTurns: numberValue(item.activeBackgroundTurns) ?? numberValue(item.active_background_turns),
    queuedBackgroundTurns: numberValue(item.queuedBackgroundTurns) ?? numberValue(item.queued_background_turns),
    maxConcurrentBackgroundTurns:
      numberValue(item.maxConcurrentBackgroundTurns) ?? numberValue(item.max_concurrent_background_turns),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "room pressure boundary recorded; message expression is preserved while wake may be delayed",
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function providerBoundaryFromEvent(event: RoomEvent, topicId?: TopicId): ArchiveProviderBoundary | undefined {
  if (event.event_type !== "agent.provider_degraded") return undefined;
  const payload = objectPayload(event.payload);
  return {
    boundaryId: event.event_id,
    agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    providerKind: stringValue(payload.providerKind) ?? stringValue(payload.provider_kind),
    providerLabel: stringValue(payload.providerLabel) ?? stringValue(payload.provider_label),
    topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? topicId,
    triggeringEventId: stringValue(payload.triggeringEventId) ?? stringValue(payload.triggering_event_id),
    packetId: stringValue(payload.packetId) ?? stringValue(payload.packet_id),
    diagnostic: stringValue(payload.diagnostic),
    boundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "provider degradation is not agent silence",
    sourceRefs: refsFromPayload(payload, event.refs),
    eventIds: [event.event_id],
    actorId: event.actor.id,
  };
}

function providerBoundaryFromPlainObject(item: Record<string, unknown>): ArchiveProviderBoundary {
  return {
    boundaryId: stringValue(item.boundaryId) ?? stringValue(item.boundary_id) ?? "",
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    providerKind: stringValue(item.providerKind) ?? stringValue(item.provider_kind),
    providerLabel: stringValue(item.providerLabel) ?? stringValue(item.provider_label),
    topicId: stringValue(item.topicId) ?? stringValue(item.topic_id),
    triggeringEventId: stringValue(item.triggeringEventId) ?? stringValue(item.triggering_event_id),
    packetId: stringValue(item.packetId) ?? stringValue(item.packet_id),
    diagnostic: stringValue(item.diagnostic),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "provider degradation is not agent silence",
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function memoryPressureBoundaryFromEvent(event: RoomEvent, topicId?: TopicId): ArchiveMemoryPressureBoundary | undefined {
  if (event.event_type !== "room.memory_pressure_detected") return undefined;
  const payload = objectPayload(event.payload);
  return {
    boundaryId: event.event_id,
    reason: stringValue(payload.reason) ?? "pending_memory_proposal_limit",
    topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? topicId,
    triggeringMemoryId: stringValue(payload.triggeringMemoryId) ?? stringValue(payload.triggering_memory_id),
    pendingProposalCount:
      numberValue(payload.pendingProposalCount) ?? numberValue(payload.pending_proposal_count) ?? 0,
    threshold: numberValue(payload.threshold) ?? 0,
    proposedMemoryRefs: arrayOfStrings(payload.proposedMemoryRefs).concat(arrayOfStrings(payload.proposed_memory_refs)),
    boundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "public memory pressure boundary recorded; review pending proposals before adding more sediment",
    sourceRefs: refsFromPayload(payload, event.refs),
    eventIds: [event.event_id],
    actorId: event.actor.id,
  };
}

function memoryPressureBoundaryFromPlainObject(item: Record<string, unknown>): ArchiveMemoryPressureBoundary {
  return {
    boundaryId: stringValue(item.boundaryId) ?? stringValue(item.boundary_id) ?? "",
    reason: stringValue(item.reason) ?? "pending_memory_proposal_limit",
    topicId: stringValue(item.topicId) ?? stringValue(item.topic_id),
    triggeringMemoryId: stringValue(item.triggeringMemoryId) ?? stringValue(item.triggering_memory_id),
    pendingProposalCount:
      numberValue(item.pendingProposalCount) ?? numberValue(item.pending_proposal_count) ?? 0,
    threshold: numberValue(item.threshold) ?? 0,
    proposedMemoryRefs: arrayOfStrings(item.proposedMemoryRefs).concat(arrayOfStrings(item.proposed_memory_refs)),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "public memory pressure boundary recorded; review pending proposals before adding more sediment",
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function capabilityReviewFromEvent(event: RoomEvent, topicId?: TopicId): ArchiveCapabilityReview | undefined {
  if (event.event_type !== "capability.reviewed") return undefined;
  const payload = objectPayload(event.payload);
  const capabilityRef =
    stringValue(payload.capabilityRef) ??
    stringValue(payload.capability_ref) ??
    stringValue(payload.capabilityId) ??
    stringValue(payload.capability_id);
  if (!capabilityRef) return undefined;
  return {
    reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
    capabilityRef,
    topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? topicId,
    agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id),
    response: stringValue(payload.response) ?? "reviewed",
    summary: stringValue(payload.summary) ?? "Capability hint reviewed.",
    sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
    boundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "capability review is a social trace; it does not change wake score, assign responsibility, certify competence, mutate reputation, or force speech",
    sourcePressureRefs: pressureRefsFromPayload(payload, event.refs),
    sourceRefs: refsFromPayload(payload, event.refs),
    eventIds: [event.event_id],
    actorId: event.actor.id,
  };
}

function capabilityReviewFromPlainObject(item: Record<string, unknown>): ArchiveCapabilityReview {
  return {
    reviewId: stringValue(item.reviewId) ?? stringValue(item.review_id) ?? "",
    capabilityRef:
      stringValue(item.capabilityRef) ??
      stringValue(item.capability_ref) ??
      stringValue(item.capabilityId) ??
      stringValue(item.capability_id) ??
      "",
    topicId: stringValue(item.topicId) ?? stringValue(item.topic_id),
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    response: stringValue(item.response) ?? "reviewed",
    summary: stringValue(item.summary) ?? "",
    sourceMessageId: stringValue(item.sourceMessageId) ?? stringValue(item.source_message_id),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "capability review is a social trace; it does not change wake score, assign responsibility, certify competence, mutate reputation, or force speech",
    sourcePressureRefs: arrayOfStrings(item.sourcePressureRefs).concat(arrayOfStrings(item.source_pressure_refs)),
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

type ArchiveMixedReviewTrace = {
  eventId: string;
  subject: string;
  targetRef: RefId;
  responderId: string;
  response: string;
  topicId?: TopicId;
  sourceMessageId: RefId;
  correlation: string;
  sourceRefs: RefId[];
  actorId: string;
};

function collectMixedReviewTrace(
  groups: Map<string, ArchiveMixedReviewTrace[]>,
  event: RoomEvent,
  payload: Record<string, unknown>,
  fallbackTopicId?: TopicId,
): void {
  const trace = mixedReviewTraceFromEvent(event, payload, fallbackTopicId);
  if (!trace) return;
  const key = mixedReviewGroupKey(trace.sourceMessageId, event.correlation_id ?? event.event_id);
  const traces = (groups.get(key) ?? []).filter((item) => item.eventId !== trace.eventId);
  traces.push(trace);
  groups.set(key, traces);
}

function mixedReviewTraceFromEvent(
  event: RoomEvent,
  payload: Record<string, unknown>,
  fallbackTopicId?: TopicId,
): ArchiveMixedReviewTrace | undefined {
  const base = {
    eventId: event.event_id,
    responderId: mixedReviewResponderId(event, payload),
    response: mixedReviewResponse(event, payload),
    topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? fallbackTopicId,
    sourceMessageId: mixedReviewSourceMessageId(event, payload),
    correlation: event.correlation_id ?? event.event_id,
    sourceRefs: refsFromPayload(payload, event.refs),
    actorId: event.actor.id,
  };
  if (event.event_type === "memory.reviewed") {
    return { ...base, subject: "memory claim", targetRef: memoryRefFromPayload(event, payload) };
  }
  if (event.event_type === "protocol.reviewed") {
    return { ...base, subject: "protocol", targetRef: protocolRefFromPayload(event, payload) };
  }
  if (event.event_type === "handoff.reviewed") {
    return { ...base, subject: "handoff", targetRef: handoffRefFromPayload(event, payload) };
  }
  if (event.event_type === "persona_delta.reviewed") {
    return { ...base, subject: "persona delta", targetRef: personaDeltaRefFromPayload(event, payload) };
  }
  if (event.event_type === "topic.reviewed") {
    return { ...base, subject: "topic proposal", targetRef: topicProposalRefFromPayload(event, payload) };
  }
  if (event.event_type === "open_question.responded") {
    return {
      ...base,
      subject: "open question",
      targetRef: openQuestionRefFromPayload(event, payload),
      response: stringValue(payload.response) ?? "responded",
    };
  }
  if (event.event_type === "agent.invitation_reviewed") {
    return { ...base, subject: "invitation", targetRef: invitationRefFromPayload(event, payload) };
  }
  if (event.event_type === "side_effect.reviewed") {
    return { ...base, subject: "side-effect request", targetRef: sideEffectRefFromPayload(event, payload) };
  }
  if (event.event_type === "workspace.artifact_reviewed") {
    return { ...base, subject: "workspace artifact", targetRef: workspaceArtifactRefFromPayload(event, payload) };
  }
  if (event.event_type === "skill.capsule_reviewed") {
    return { ...base, subject: "skill capsule", targetRef: skillCapsuleRefFromPayload(event, payload) };
  }
  if (event.event_type === "capability.reviewed") {
    return { ...base, subject: "capability hint", targetRef: capabilityRefFromPayload(event, payload) };
  }
  if (event.event_type === "archive.repair_reviewed") {
    return { ...base, subject: "archive repair", targetRef: archiveRepairRefFromPayload(event, payload) };
  }
  return undefined;
}

function mixedReviewPressuresFromGroups(
  groups: Map<string, ArchiveMixedReviewTrace[]>,
): ArchiveMixedReviewPressure[] {
  const pressures: ArchiveMixedReviewPressure[] = [];
  for (const [key, traces] of groups.entries()) {
    if (!isMixedReviewPressureGroup(traces)) continue;
    const responseKindCounts: Record<string, number> = {};
    for (const trace of traces) {
      responseKindCounts[trace.response] = (responseKindCounts[trace.response] ?? 0) + 1;
    }
    const sourceMessageId = traces.at(-1)?.sourceMessageId;
    const correlation = traces.at(-1)?.correlation ?? key;
    pressures.push({
      pressureId: mixedReviewPressureRef(sourceMessageId ?? "unknown_source", correlation),
      sourceMessageId,
      topicId: traces.find((trace) => trace.topicId)?.topicId,
      agentIds: unique(traces.map((trace) => trace.responderId)).sort(),
      responseKindCounts,
      objectCount: traces.length,
      touchedRefs: unique(traces.map((trace) => trace.targetRef)).sort(),
      touchedObjects: unique(traces.map((trace) => `${trace.subject} ${trace.targetRef}`)).sort(),
      traceEventIds: unique(traces.map((trace) => trace.eventId)).sort(),
      boundaryNote:
        "mixed social review pressure is archived as unresolved room context; individual review traces remain ledgered and no lifecycle state changes are inferred",
      sourceRefs: unique(
        traces
          .flatMap((trace) => trace.sourceRefs)
          .concat(sourceMessageId ? [sourceMessageId] : [])
          .concat(traces.map((trace) => trace.targetRef))
          .concat(traces.map((trace) => trace.eventId)),
      ).sort(),
      eventIds: unique(traces.map((trace) => trace.eventId)).sort(),
      actorId: traces.at(-1)?.actorId ?? "",
    });
  }
  return pressures.sort((a, b) => a.pressureId.localeCompare(b.pressureId));
}

function isMixedReviewPressureGroup(traces: readonly ArchiveMixedReviewTrace[]): boolean {
  if (traces.length < 2) return false;
  const subjects = new Set(traces.map((trace) => trace.subject));
  const targets = new Set(traces.map((trace) => `${trace.subject}:${trace.targetRef}`));
  return subjects.size >= 2 && targets.size >= 2;
}

function mixedReviewPressureFromPlainObject(item: Record<string, unknown>): ArchiveMixedReviewPressure {
  return {
    pressureId: stringValue(item.pressureId) ?? stringValue(item.pressure_id) ?? "",
    sourceMessageId: stringValue(item.sourceMessageId) ?? stringValue(item.source_message_id),
    topicId: stringValue(item.topicId) ?? stringValue(item.topic_id),
    agentIds: arrayOfStrings(item.agentIds).concat(arrayOfStrings(item.agent_ids)).sort(),
    responseKindCounts:
      objectOfNumbers(item.responseKindCounts) ?? objectOfNumbers(item.response_kind_counts) ?? {},
    objectCount: numberValue(item.objectCount) ?? numberValue(item.object_count) ?? 0,
    touchedRefs: arrayOfStrings(item.touchedRefs).concat(arrayOfStrings(item.touched_refs)).sort(),
    touchedObjects: arrayOfStrings(item.touchedObjects).concat(arrayOfStrings(item.touched_objects)).sort(),
    traceEventIds: arrayOfStrings(item.traceEventIds).concat(arrayOfStrings(item.trace_event_ids)).sort(),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "mixed social review pressure is archived as unresolved room context",
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)).sort(),
    eventIds: arrayOfStrings(item.eventIds).concat(arrayOfStrings(item.event_ids)).sort(),
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function mixedReviewPressureReviewFromEvent(
  event: RoomEvent,
  topicId?: TopicId,
): ArchiveMixedReviewPressureReview | undefined {
  if (event.event_type !== "mixed_review_pressure.reviewed") return undefined;
  const payload = objectPayload(event.payload);
  const pressureRef =
    stringValue(payload.pressureRef) ??
    stringValue(payload.pressure_ref) ??
    stringValue(payload.mixedReviewPressureRef) ??
    stringValue(payload.mixed_review_pressure_ref);
  if (!pressureRef) return undefined;
  const contextRefs = arrayOfStrings(payload.contextRefs).concat(arrayOfStrings(payload.context_refs));
  return {
    reviewId: stringValue(payload.reviewId) ?? stringValue(payload.review_id) ?? event.event_id,
    pressureRef,
    topicId: stringValue(payload.topicId) ?? stringValue(payload.topic_id) ?? topicId,
    agentId: stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id,
    response: stringValue(payload.response) ?? "reviewed",
    summary: stringValue(payload.summary) ?? "Mixed review pressure was reviewed.",
    sourceMessageId: stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id),
    contextRefs,
    boundaryNote:
      stringValue(payload.boundaryNote) ??
      stringValue(payload.boundary_note) ??
      "mixed review pressure review is archived as a social trace; it does not close, narrow, retire, delete, resolve, or mutate the underlying pressure",
    sourceRefs: refsFromPayload(payload, event.refs),
    eventIds: [event.event_id],
    actorId: event.actor.id,
  };
}

function mixedReviewPressureReviewFromPlainObject(item: Record<string, unknown>): ArchiveMixedReviewPressureReview {
  const eventIds = arrayOfStrings(item.eventIds)
    .concat(arrayOfStrings(item.event_ids))
    .concat(optionalString(stringValue(item.eventId) ?? stringValue(item.event_id)));
  return {
    reviewId: stringValue(item.reviewId) ?? stringValue(item.review_id) ?? "",
    pressureRef:
      stringValue(item.pressureRef) ??
      stringValue(item.pressure_ref) ??
      stringValue(item.mixedReviewPressureRef) ??
      stringValue(item.mixed_review_pressure_ref) ??
      "",
    topicId: stringValue(item.topicId) ?? stringValue(item.topic_id),
    agentId: stringValue(item.agentId) ?? stringValue(item.agent_id),
    response: stringValue(item.response) ?? "reviewed",
    summary: stringValue(item.summary) ?? "",
    sourceMessageId: stringValue(item.sourceMessageId) ?? stringValue(item.source_message_id),
    contextRefs: arrayOfStrings(item.contextRefs).concat(arrayOfStrings(item.context_refs)),
    boundaryNote:
      stringValue(item.boundaryNote) ??
      stringValue(item.boundary_note) ??
      "mixed review pressure review is archived as a social trace; it does not close, narrow, retire, delete, resolve, or mutate the underlying pressure",
    sourceRefs: arrayOfStrings(item.sourceRefs).concat(arrayOfStrings(item.source_refs)),
    eventIds,
    actorId: stringValue(item.actorId) ?? stringValue(item.actor_id) ?? "",
  };
}

function dedupeMixedReviewPressures(pressures: ArchiveMixedReviewPressure[]): ArchiveMixedReviewPressure[] {
  const byId = new Map<string, ArchiveMixedReviewPressure>();
  for (const pressure of pressures) byId.set(pressure.pressureId, pressure);
  return [...byId.values()].sort((a, b) => a.pressureId.localeCompare(b.pressureId));
}

function dedupeMixedReviewPressureReviews(reviews: ArchiveMixedReviewPressureReview[]): ArchiveMixedReviewPressureReview[] {
  return dedupeBy(reviews, (review) => `${review.pressureRef}:${review.reviewId}:${review.eventIds.join(",")}`);
}

function cloneMixedReviewPressure(pressure: ArchiveMixedReviewPressure): ArchiveMixedReviewPressure {
  return {
    ...pressure,
    agentIds: [...pressure.agentIds],
    responseKindCounts: { ...pressure.responseKindCounts },
    touchedRefs: [...pressure.touchedRefs],
    touchedObjects: [...pressure.touchedObjects],
    traceEventIds: [...pressure.traceEventIds],
    sourceRefs: [...pressure.sourceRefs],
    eventIds: [...pressure.eventIds],
  };
}

function cloneMixedReviewPressureReview(review: ArchiveMixedReviewPressureReview): ArchiveMixedReviewPressureReview {
  return {
    ...review,
    contextRefs: [...review.contextRefs],
    sourceRefs: [...review.sourceRefs],
    eventIds: [...review.eventIds],
  };
}

function mixedReviewGroupKey(sourceMessageId: RefId, correlation: string): string {
  return `mixed_social_review:${sourceMessageId}:${correlation}`;
}

function mixedReviewPressureRef(sourceMessageId: RefId, correlation: string): RefId {
  return `mixed_review:${sourceMessageId}:${correlation}`;
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

function mixedReviewResponderId(event: RoomEvent, payload: Record<string, unknown>): string {
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

function cloneArchive(archive: DailyArchive): DailyArchive {
  return {
    ...archive,
    inputLedgerRange: { ...archive.inputLedgerRange },
    messageHighlights: (archive.messageHighlights ?? []).map(cloneItem),
    decisions: (archive.decisions ?? []).map(cloneItem),
    disagreements: (archive.disagreements ?? []).map(cloneItem),
    openQuestions: (archive.openQuestions ?? []).map(cloneItem),
    openQuestionTraces: (archive.openQuestionTraces ?? []).map((question) => ({
      ...question,
      sourcePressureRefs: [...(question.sourcePressureRefs ?? [])],
      sourceRefs: [...question.sourceRefs],
      eventIds: [...question.eventIds],
      responses: (question.responses ?? []).map((response) => ({
        ...response,
        sourceRefs: [...response.sourceRefs],
      })),
    })),
    memoryChanges: (archive.memoryChanges ?? []).map((change) => ({
      ...change,
      sourcePressureRefs: [...(change.sourcePressureRefs ?? [])],
      sourceRefs: [...change.sourceRefs],
    })),
    topicProposals: (archive.topicProposals ?? []).map(cloneTopicProposal),
    handoffs: (archive.handoffs ?? []).map(cloneHandoffExchange),
    protocols: (archive.protocols ?? []).map(cloneProtocolExchange),
    invitations: (archive.invitations ?? []).map(cloneInvitation),
    silences: (archive.silences ?? []).map((silence) => ({
      ...silence,
      sourceRefs: [...silence.sourceRefs],
      eventIds: [...silence.eventIds],
    })),
    personaDeltas: (archive.personaDeltas ?? []).map((delta) => ({
      ...delta,
      sourcePressureRefs: [...(delta.sourcePressureRefs ?? [])],
      sourceRefs: [...delta.sourceRefs],
      eventIds: [...delta.eventIds],
    })),
    agentContinuity: (archive.agentContinuity ?? []).map(cloneAgentContinuity),
    sideEffectBoundaries: (archive.sideEffectBoundaries ?? []).map((boundary) => ({
      ...boundary,
      sourcePressureRefs: [...(boundary.sourcePressureRefs ?? [])],
      sourceRefs: [...boundary.sourceRefs],
      eventIds: [...boundary.eventIds],
    })),
    workspaceBoundaries: (archive.workspaceBoundaries ?? []).map((boundary) => ({
      ...boundary,
      sourceRefs: [...boundary.sourceRefs],
      eventIds: [...boundary.eventIds],
    })),
    workspaceArtifacts: (archive.workspaceArtifacts ?? []).map((artifact) => ({
      ...artifact,
      sourcePressureRefs: [...(artifact.sourcePressureRefs ?? [])],
      sourceRefs: [...artifact.sourceRefs],
      eventIds: [...artifact.eventIds],
    })),
    skillCapsules: (archive.skillCapsules ?? []).map((capsule) => ({
      ...capsule,
      triggerHints: [...capsule.triggerHints],
      sideEffectKinds: [...capsule.sideEffectKinds],
      sourcePressureRefs: [...(capsule.sourcePressureRefs ?? [])],
      sourceRefs: [...capsule.sourceRefs],
      eventIds: [...capsule.eventIds],
    })),
    capabilityReviews: (archive.capabilityReviews ?? []).map((review) => ({
      ...review,
      sourcePressureRefs: [...(review.sourcePressureRefs ?? [])],
      sourceRefs: [...review.sourceRefs],
      eventIds: [...review.eventIds],
    })),
    mixedReviewPressures: (archive.mixedReviewPressures ?? []).map(cloneMixedReviewPressure),
    mixedReviewPressureReviews: (archive.mixedReviewPressureReviews ?? []).map(cloneMixedReviewPressureReview),
    pressureBoundaries: (archive.pressureBoundaries ?? []).map((boundary) => ({
      ...boundary,
      sourceRefs: [...boundary.sourceRefs],
      eventIds: [...boundary.eventIds],
    })),
    providerBoundaries: (archive.providerBoundaries ?? []).map((boundary) => ({
      ...boundary,
      sourceRefs: [...boundary.sourceRefs],
      eventIds: [...boundary.eventIds],
    })),
    memoryPressureBoundaries: (archive.memoryPressureBoundaries ?? []).map((boundary) => ({
      ...boundary,
      proposedMemoryRefs: [...boundary.proposedMemoryRefs],
      sourceRefs: [...boundary.sourceRefs],
      eventIds: [...boundary.eventIds],
    })),
    contestedItems: [...(archive.contestedItems ?? [])],
    topicIds: [...(archive.topicIds ?? [])],
    provenanceRefs: [...(archive.provenanceRefs ?? [])],
    eventCounts: { ...(archive.eventCounts ?? {}) },
    outputRefs: { ...(archive.outputRefs ?? {}) },
  };
}

function cloneItem(item: ArchiveItem): ArchiveItem {
  return {
    ...item,
    sourceRefs: [...item.sourceRefs],
    eventIds: [...item.eventIds],
  };
}

function cloneTopicProposal(proposal: ArchiveTopicProposal): ArchiveTopicProposal {
  return {
    ...proposal,
    sourcePressureRefs: [...(proposal.sourcePressureRefs ?? [])],
    sourceRefs: [...proposal.sourceRefs],
    eventIds: [...proposal.eventIds],
    appliedTopicEventIds: [...(proposal.appliedTopicEventIds ?? [])],
    responses: (proposal.responses ?? []).map((response) => ({
      ...response,
      sourceRefs: [...response.sourceRefs],
    })),
    reviews: (proposal.reviews ?? []).map((review) => ({
      ...review,
      sourceRefs: [...review.sourceRefs],
    })),
  };
}

function cloneAgentContinuity(continuity: ArchiveAgentContinuity): ArchiveAgentContinuity {
  return {
    ...continuity,
    roleClaims: (continuity.roleClaims ?? []).map((claim) => ({
      ...claim,
      evidenceRefs: [...claim.evidenceRefs],
      sourcePressureRefs: [...claim.sourcePressureRefs],
      contestRefs: [...claim.contestRefs],
      responseRefs: [...claim.responseRefs],
      eventIds: [...claim.eventIds],
      actorIds: [...claim.actorIds],
    })),
    dailyMoods: (continuity.dailyMoods ?? []).map((mood) => ({
      ...mood,
      evidenceRefs: [...mood.evidenceRefs],
      responseRefs: [...mood.responseRefs],
      eventIds: [...mood.eventIds],
      actorIds: [...mood.actorIds],
    })),
    sourceRefs: [...continuity.sourceRefs],
    eventIds: [...continuity.eventIds],
  };
}

function cloneHandoffExchange(handoff: ArchiveHandoffExchange): ArchiveHandoffExchange {
  return {
    ...handoff,
    responses: handoff.responses.map((response) => ({
      ...response,
      sourceRefs: [...response.sourceRefs],
    })),
    reviews: (handoff.reviews ?? []).map((review) => ({
      ...review,
      sourceRefs: [...review.sourceRefs],
    })),
    sourceRefs: [...handoff.sourceRefs],
    sourcePressureRefs: [...handoff.sourcePressureRefs],
    eventIds: [...handoff.eventIds],
  };
}

function cloneProtocolExchange(protocol: ArchiveProtocolExchange): ArchiveProtocolExchange {
  return {
    ...protocol,
    responses: protocol.responses.map((response) => ({
      ...response,
      sourceRefs: [...response.sourceRefs],
    })),
    reviews: (protocol.reviews ?? []).map((review) => ({
      ...review,
      sourceRefs: [...review.sourceRefs],
    })),
    sourceRefs: [...protocol.sourceRefs],
    sourcePressureRefs: [...protocol.sourcePressureRefs],
    eventIds: [...protocol.eventIds],
  };
}

function cloneInvitation(invitation: ArchiveInvitation): ArchiveInvitation {
  return {
    ...invitation,
    responses: (invitation.responses ?? []).map((response) => ({
      ...response,
      sourceRefs: [...response.sourceRefs],
    })),
    sourcePressureRefs: [...invitation.sourcePressureRefs],
    sourceRefs: [...invitation.sourceRefs],
    eventIds: [...invitation.eventIds],
  };
}

function dedupeItems(items: ArchiveItem[]): ArchiveItem[] {
  const seen = new Set<string>();
  const result: ArchiveItem[] = [];
  for (const item of items) {
    const key = `${item.summary}:${item.eventIds.join(",")}:${item.sourceRefs.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function dedupeTopicProposals(items: ArchiveTopicProposal[]): ArchiveTopicProposal[] {
  return dedupeBy(items, (item) => `${item.proposalId}:${item.eventIds.join(",")}:${item.sourceRefs.join(",")}`);
}

function dedupeOpenQuestions(items: ArchiveOpenQuestion[]): ArchiveOpenQuestion[] {
  return dedupeBy(items, (item) => `${item.questionId}:${item.eventIds.join(",")}:${item.sourceRefs.join(",")}`);
}

function dedupePersonaDeltas(items: ArchivePersonaDelta[]): ArchivePersonaDelta[] {
  return dedupeBy(items, (item) => `${item.deltaId}:${item.status}:${item.response ?? ""}:${item.eventIds.join(",")}`);
}

function agentContinuityFromPersonaDeltas(items: ArchivePersonaDelta[]): ArchiveAgentContinuity[] {
  const byAgent = new Map<string, ArchiveAgentContinuity>();
  const byDelta = new Map<string, ArchivePersonaDelta[]>();
  for (const item of items) {
    byDelta.set(item.deltaId, (byDelta.get(item.deltaId) ?? []).concat(item));
  }

  for (const item of items) {
    if (item.status !== "proposed" || (item.field !== "roleClaims" && item.field !== "dailyMood")) continue;
    const agentId = item.agentId ?? "unknown_agent";
    let continuity = byAgent.get(agentId);
    if (!continuity) {
      continuity = {
        agentId,
        roleClaims: [],
        dailyMoods: [],
        sourceRefs: [],
        eventIds: [],
        boundaryNote:
          "agent continuity in archives is evidence sediment from persona deltas, not a fixed role, assignment, or public-memory truth",
      };
      byAgent.set(agentId, continuity);
    }

    const related = byDelta.get(item.deltaId) ?? [item];
    if (item.field === "roleClaims") {
      continuity.roleClaims.push(roleClaimFromPersonaDelta(item, related));
    } else {
      continuity.dailyMoods.push(dailyMoodFromPersonaDelta(item, related));
    }
    continuity.sourceRefs = unique(continuity.sourceRefs.concat(related.flatMap((delta) => delta.sourceRefs)));
    continuity.eventIds = unique(continuity.eventIds.concat(related.flatMap((delta) => delta.eventIds)));
  }

  return [...byAgent.values()]
    .map((continuity) => ({
      ...continuity,
      roleClaims: continuity.roleClaims.sort((a, b) => a.deltaId.localeCompare(b.deltaId)),
      dailyMoods: continuity.dailyMoods.sort((a, b) => a.deltaId.localeCompare(b.deltaId)),
      sourceRefs: unique(continuity.sourceRefs),
      eventIds: unique(continuity.eventIds),
    }))
    .filter((continuity) => continuity.roleClaims.length > 0 || continuity.dailyMoods.length > 0)
    .sort((a, b) => a.agentId.localeCompare(b.agentId));
}

function roleClaimFromPersonaDelta(
  proposed: ArchivePersonaDelta,
  related: ArchivePersonaDelta[],
): ArchiveAgentRoleClaim {
  const responseDeltas = related.filter((delta) => delta.deltaId === proposed.deltaId && delta.response && delta.status !== "reviewed");
  const contestDeltas = responseDeltas.filter((delta) => contestedPersonaResponse(delta.response));
  return {
    roleClaimId: `role_claim_${proposed.deltaId}`,
    deltaId: proposed.deltaId,
    agentId: proposed.agentId,
    label: proposed.valueSummary ?? "role claim",
    status: latestPersonaStatus(proposed, related),
    proposedBy: proposed.proposedBy,
    evidenceRefs: unique(proposed.sourceRefs),
    sourcePressureRefs: unique(proposed.sourcePressureRefs),
    contestRefs: unique(contestDeltas.flatMap((delta) => delta.sourceRefs)),
    responseRefs: personaResponseRefs(responseDeltas),
    eventIds: unique(related.flatMap((delta) => delta.eventIds)),
    actorIds: unique(related.map((delta) => delta.actorId).filter(Boolean)),
    boundaryNote: "role claim is ledger-backed persona sediment, not a room assignment or model capability claim",
  };
}

function dailyMoodFromPersonaDelta(
  proposed: ArchivePersonaDelta,
  related: ArchivePersonaDelta[],
): ArchiveAgentDailyMood {
  const responseDeltas = related.filter((delta) => delta.deltaId === proposed.deltaId && delta.response && delta.status !== "reviewed");
  const accepted = [...responseDeltas].reverse().find((delta) => acceptedPersonaResponse(delta.response));
  return {
    deltaId: proposed.deltaId,
    agentId: proposed.agentId,
    date: proposed.valueDate,
    posture: proposed.valueSummary ?? "daily mood",
    status: latestPersonaStatus(proposed, related),
    proposedBy: proposed.proposedBy,
    acceptedBy: accepted?.respondingAgentId,
    sourceRef: proposed.valueSourceRef ?? firstMoodSourceRef(proposed),
    evidenceRefs: unique(proposed.sourceRefs),
    responseRefs: personaResponseRefs(responseDeltas),
    eventIds: unique(related.flatMap((delta) => delta.eventIds)),
    actorIds: unique(related.map((delta) => delta.actorId).filter(Boolean)),
    boundaryNote: "daily mood is reversible ledger-backed continuity, not a fixed role, duty, or memory truth",
  };
}

function latestPersonaStatus(proposed: ArchivePersonaDelta, related: ArchivePersonaDelta[]): string {
  const responses = related.filter((delta) => delta.deltaId === proposed.deltaId && delta.response && delta.status !== "reviewed");
  const latest = responses.at(-1);
  return personaStatusFromResponse(latest?.response ?? latest?.status) ?? proposed.status;
}

function personaStatusFromResponse(response: string | undefined): string | undefined {
  switch (response) {
    case "accept":
    case "accepted":
      return "accepted";
    case "reject":
    case "rejected":
      return "rejected";
    case "contest":
    case "contested":
    case "challenge":
    case "challenged":
      return "contested";
    case "retire":
    case "retired":
      return "retired";
    case "revise":
    case "revised":
      return "revised";
    default:
      return response;
  }
}

function acceptedPersonaResponse(response: string | undefined): boolean {
  return response === "accept" || response === "accepted";
}

function contestedPersonaResponse(response: string | undefined): boolean {
  return response === "contest" || response === "contested" || response === "reject" || response === "rejected";
}

function personaResponseRefs(responses: ArchivePersonaDelta[]): RefId[] {
  return unique(
    responses.flatMap((delta) =>
      delta.sourceRefs
        .filter((ref) => ref.startsWith("persona_delta_response_"))
        .concat(delta.eventIds),
    ),
  );
}

function firstMoodSourceRef(delta: ArchivePersonaDelta): RefId | undefined {
  return delta.sourceRefs.find(
    (ref) =>
      !ref.startsWith("persona_delta_") &&
      !ref.startsWith("mixed_review:") &&
      !delta.eventIds.includes(ref),
  );
}

function dedupeInvitations(items: ArchiveInvitation[]): ArchiveInvitation[] {
  return dedupeBy(items, (item) => `${item.invitationId}:${item.eventIds.join(",")}`);
}

function dedupeSilences(items: ArchiveSilence[]): ArchiveSilence[] {
  return dedupeBy(items, (item) => `${item.silenceId}:${item.eventIds.join(",")}`);
}

function dedupeSideEffectBoundaries(items: ArchiveSideEffectBoundary[]): ArchiveSideEffectBoundary[] {
  return dedupeBy(items, (item) => `${item.requestId}:${item.approvalId ?? ""}:${item.status}:${item.eventIds.join(",")}`);
}

function dedupeWorkspaceBoundaries(items: ArchiveWorkspaceBoundary[]): ArchiveWorkspaceBoundary[] {
  return dedupeBy(items, (item) => `${item.workspaceId}:${item.eventIds.join(",")}`);
}

function dedupeWorkspaceArtifacts(items: ArchiveWorkspaceArtifact[]): ArchiveWorkspaceArtifact[] {
  return dedupeBy(items, (item) => `${item.artifactId}:${item.workspaceId}:${item.eventIds.join(",")}`);
}

function dedupeSkillCapsules(items: ArchiveSkillCapsule[]): ArchiveSkillCapsule[] {
  return dedupeBy(items, (item) => `${item.capsuleId}:${item.eventIds.join(",")}`);
}

function dedupeCapabilityReviews(items: ArchiveCapabilityReview[]): ArchiveCapabilityReview[] {
  return dedupeBy(items, (item) => `${item.capabilityRef}:${item.reviewId}:${item.eventIds.join(",")}`);
}

function dedupePressureBoundaries(items: ArchivePressureBoundary[]): ArchivePressureBoundary[] {
  return dedupeBy(items, (item) => `${item.boundaryId}:${item.reason}:${item.eventIds.join(",")}`);
}

function dedupeProviderBoundaries(items: ArchiveProviderBoundary[]): ArchiveProviderBoundary[] {
  return dedupeBy(items, (item) => `${item.boundaryId}:${item.agentId ?? ""}:${item.eventIds.join(",")}`);
}

function dedupeMemoryPressureBoundaries(items: ArchiveMemoryPressureBoundary[]): ArchiveMemoryPressureBoundary[] {
  return dedupeBy(items, (item) => `${item.boundaryId}:${item.reason}:${item.eventIds.join(",")}`);
}

function dedupeBy<T>(items: T[], keyFor: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFor(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function summarizePersonaValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  const object = objectValue(value);
  if (!object) return undefined;
  const posture = stringValue(object.posture);
  if (posture) return posture;
  return JSON.stringify(object);
}

function summarizeUnknown(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return undefined;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text || text === "{}") return undefined;
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function sideEffectBoundaryNote(eventType: string, topicId?: TopicId): string {
  const topicPart = topicId ? ` for ${topicId}` : "";
  if (eventType === "side_effect.requested") {
    return `request recorded${topicPart}; it does not execute an external side effect`;
  }
  if (eventType === "side_effect.approved") {
    return `approval recorded${topicPart}; execution still needs a result event`;
  }
  if (eventType === "side_effect.denied") {
    return `denial recorded${topicPart}; execution remains blocked`;
  }
  if (eventType === "side_effect.result_reported") {
    return `result reported${topicPart}; archive preserves the approval boundary`;
  }
  if (eventType === "side_effect.reviewed") {
    return `review recorded${topicPart}; it does not approve, deny, execute, expire, or report a result`;
  }
  return `side-effect boundary event${topicPart}`;
}

function acceptedStatus(payload: Record<string, unknown>): boolean {
  const status = stringValue(payload.status);
  return status === "accepted" || status === "active" || status === "completed";
}

function rejectedOrChallengedStatus(payload: Record<string, unknown>): boolean {
  const status = stringValue(payload.status);
  return status === "rejected" || status === "challenged" || status === "contested";
}

function handoffStatusFromResponse(response: string | undefined): string | undefined {
  switch (response) {
    case "accepted":
    case "accept":
      return "accepted";
    case "rejected":
    case "reject":
      return "rejected";
    case "partially_accepted":
    case "partial":
    case "partially_accept":
      return "partially_accepted";
    case "redirected":
    case "delegate":
    case "delegate_handoff":
      return "redirected";
    case "challenged":
    case "challenge":
    case "challenge_handoff":
      return "challenged";
    default:
      return undefined;
  }
}

function invitationStatusFromResponse(response: string | undefined): string | undefined {
  switch (response) {
    case "accept":
    case "accepted":
      return "accepted";
    case "reject":
    case "rejected":
      return "rejected";
    case "challenge":
    case "challenged":
      return "challenged";
    case "delegate":
    case "delegated":
    case "redirected":
      return "delegated";
    default:
      return undefined;
  }
}

function protocolStatusFromResponse(response: string | undefined): string | undefined {
  switch (response) {
    case "accept":
    case "accepted":
      return "active";
    case "reject":
    case "rejected":
      return "rejected";
    case "challenge":
    case "challenged":
    case "contest":
    case "contested":
      return "challenged";
    case "revise":
    case "revised":
    case "propose_revision":
      return "revised";
    default:
      return undefined;
  }
}

function questionFromMessage(event: RoomEvent): string[] {
  if (event.event_type !== "message.created") return [];
  const content = stringValue(objectPayload(event.payload).content);
  if (!content || !content.includes("?")) return [];
  return [content];
}

function memoryStateFromEvent(eventType: string): MemoryState | undefined {
  const maybeState = eventType.replace("memory.", "");
  return memoryStateValue(maybeState);
}

function memoryStateValue(value: unknown): MemoryState | undefined {
  if (
    value === "observed" ||
    value === "proposed" ||
    value === "contested" ||
    value === "accepted" ||
    value === "stale" ||
    value === "retired"
  ) {
    return value;
  }
  return undefined;
}

function degradedIntentionEventIds(events: readonly RoomEvent[]): Set<string> {
  const refs = new Set<string>();
  for (const event of events) {
    if (event.event_type !== "agent.provider_degraded") continue;
    for (const ref of event.refs) refs.add(ref);
  }
  return refs;
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
      .concat(optionalString(payload.openQuestionRef))
      .concat(optionalString(payload.open_question_ref)),
  ).filter((ref): ref is RefId => typeof ref === "string" && ref.length > 0);
}

function pressureRefsFromPayload(payload: Record<string, unknown>, envelopeRefs: RefId[]): RefId[] {
  return refsFromPayload(payload, envelopeRefs).filter((ref) => ref.startsWith("mixed_review:"));
}

function objectPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function objectOfNumbers(value: unknown): Record<string, number> | undefined {
  const object = objectValue(value);
  if (!object) return undefined;
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(object)) {
    if (typeof item === "number") result[key] = item;
  }
  return result;
}

function objectOfStrings(value: unknown): Record<string, string> | undefined {
  const object = objectValue(value);
  if (!object) return undefined;
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(object)) {
    if (typeof item === "string") result[key] = item;
  }
  return result;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalString(value: unknown): string[] {
  const parsed = stringValue(value);
  return parsed ? [parsed] : [];
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function arrayOfObjects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function textArray(value: unknown): string[] {
  if (typeof value === "string" && value.length > 0) return [value];
  return arrayOfStrings(value);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
