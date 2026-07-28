import { readFileSync } from "node:fs";

import type {
  ActorKind,
  AgentId,
  EventActor,
  RefId,
  RoomEvent,
  RoomId,
  TopicId,
} from "../types";

export type ScenarioFixture = {
  scenario_id: string;
  purpose?: string;
  initial_room: {
    room_id: RoomId;
    date?: string;
    constraints?: Record<string, unknown>;
  };
  agents?: ScenarioAgent[];
  topics?: ScenarioTopic[];
  initial_memory?: ScenarioMemory[];
  initial_archives?: ScenarioArchive[];
  messages: ScenarioMessage[];
  scripted_intentions?: Record<AgentId, ScenarioIntention[]>;
  provider_degradations?: ScenarioProviderDegradation[];
  side_effect_decisions?: ScenarioSideEffectDecision[];
  side_effect_expirations?: ScenarioSideEffectExpiration[];
  side_effect_results?: ScenarioSideEffectResult[];
  protocol_expirations?: ScenarioProtocolExpiration[];
  archive_repair_applications?: ScenarioArchiveRepairApplication[];
  archives?: ScenarioArchive[];
};

export type ScenarioAgent = {
  agent_id: AgentId;
  capabilities?: string[];
};

export type ScenarioTopic = {
  topic_id: TopicId;
  title?: string;
  status?: string;
  summary?: string;
  open_questions?: string[];
};

export type ScenarioMemory = {
  memory_id: string;
  state: string;
  summary: string;
  source_refs?: RefId[];
  proposed_by?: AgentId;
  contested_by?: AgentId[];
  contest_refs?: RefId[];
};

export type ScenarioMessage = {
  message_id: string;
  author: string;
  authorKind?: ActorKind;
  author_kind?: ActorKind;
  topic_id?: TopicId;
  reply_to?: string;
  mentions?: AgentId[];
  context_refs?: RefId[];
  content: string;
};

export type ScenarioIntention = {
  type: string;
  after_message_id?: string;
  message_id?: string;
  topic_id?: TopicId;
  content?: string;
  question?: string;
  question_id?: RefId;
  reason?: string;
  context_refs?: RefId[];
  to_agent?: AgentId;
  toAgentId?: AgentId;
  requested_output?: string;
  requestedResponse?: string;
  return_to?: AgentId;
  handoff_id?: string;
  handoffRef?: RefId;
  protocol_id?: string;
  protocolRef?: RefId;
  targetAgentId?: AgentId;
  target_agent_id?: AgentId;
  deltaRef?: RefId;
  delta_ref?: RefId;
  field?: string;
  operation?: string;
  value?: unknown;
  proposedRevision?: string;
  topic_proposal_id?: string;
  topicProposalRef?: RefId;
  topic_proposal_ref?: RefId;
  action?: string;
  title?: string;
  targetTopicId?: TopicId;
  target_topic_id?: TopicId;
  provider_boundary_ref?: RefId;
  providerBoundaryRef?: RefId;
  provider_boundary_refs?: RefId[];
  providerBoundaryRefs?: RefId[];
  archive_ref?: RefId;
  archiveRef?: RefId;
  repair_id?: string;
  repair_ref?: RefId;
  repairRef?: RefId;
  revised_repair_id?: string;
  scope?: string;
  expires_at?: string;
  response?: string;
  proposed_revision?: string;
  assessment?: string;
  proposed_repair?: string;
  status?: string;
  memory_id?: string;
  memoryRef?: RefId;
  revised_from_memory_ref?: RefId;
  revisedFromMemoryRef?: RefId;
  summary?: string;
  source_refs?: RefId[];
  review_refs?: RefId[];
  request?: ScenarioSideEffectRequest;
};

export type ScenarioSideEffectRequest = {
  requestId: string;
  requestedBy?: AgentId;
  topicId?: TopicId;
  kind: string;
  reason: string;
  target: string;
  expectedImpact?: string;
  contextRefs?: RefId[];
  proposedCommand?: string;
  idempotencyKey?: string;
};

export type ScenarioSideEffectDecision = {
  after_message_id?: string;
  request_ref: RefId;
  status: "approved" | "denied";
  decided_by: string;
  reason: string;
  context_refs?: RefId[];
};

export type ScenarioSideEffectExpiration = {
  after_message_id?: string;
  request_ref: RefId;
  expired_by: string;
  reason: string;
  context_refs?: RefId[];
  expired_at?: string;
};

export type ScenarioSideEffectResult = {
  after_message_id?: string;
  approval_ref: RefId;
  result_id: RefId;
  reported_by?: string;
  agent_id?: AgentId;
  action_kind: string;
  target: string;
  status: "completed" | "failed" | "cancelled" | "blocked";
  summary: string;
  artifact_refs?: RefId[];
  claim_refs?: RefId[];
  follow_up_proposal_refs?: RefId[];
  context_refs?: RefId[];
  completed_at?: string;
};

export type ScenarioProtocolExpiration = {
  protocol_id: string;
  topic_id?: TopicId;
  reason: string;
  expired_at?: string;
  context_refs?: RefId[];
};

export type ScenarioProviderDegradation = {
  degradation_id?: RefId;
  after_message_id?: string;
  agent_id: AgentId;
  topic_id?: TopicId;
  triggering_event_ref?: RefId;
  packet_id?: string;
  provider_kind?: string;
  provider_label?: string;
  diagnostic: string;
  context_refs?: RefId[];
};

export type ScenarioArchive = {
  archive_id: string;
  date?: string;
  after_message_id?: string;
  review_requested?: boolean;
  revisionOf?: RefId;
  revision_of?: RefId;
  appliedRepairRef?: RefId;
  applied_repair_ref?: RefId;
  provenanceRefs?: RefId[];
  provenance_refs?: RefId[];
  summary: string;
  sourceRefs?: RefId[];
  source_refs?: RefId[];
  disagreements?: ScenarioArchiveEntry[];
  decisions?: ScenarioArchiveEntry[];
  openQuestions?: ScenarioArchiveEntry[];
  contestedItems?: ScenarioArchiveEntry[];
  rejectedHandoffs?: ScenarioArchiveEntry[];
  memoryDeltaRefs?: RefId[];
  sideEffectOutcomes?: ScenarioArchiveEntry[];
  silences?: ScenarioArchiveEntry[];
  providerBoundaries?: ScenarioArchiveEntry[];
  archiveReviews?: ScenarioArchiveEntry[];
};

export type ScenarioArchiveRepairApplication = {
  repair_ref: RefId;
  archive_ref: RefId;
  revised_archive_id: RefId;
  reason: string;
  accepted_response_refs?: RefId[];
  context_refs?: RefId[];
};

export type ScenarioArchiveEntry = {
  summary: string;
  sourceRefs: RefId[];
};

export type ScenarioRunResult = {
  fixture: ScenarioFixture;
  events: RoomEvent[];
};

export type ScenarioRunReport = {
  scenarioId: string;
  purpose?: string;
  eventCount: number;
  eventTypeCounts: Record<string, number>;
  agentExpression: ScenarioAgentExpressionReport[];
  stateTransitions: ScenarioStateTransitionReport[];
  archives: ScenarioArchiveCarryoverReport[];
  multiArchiveCarryoverRefs: ScenarioMultiArchiveCarryoverReport[];
  providerBoundaryRecoveries: ScenarioProviderBoundaryRecoveryReport[];
  socialReviewPressures: ScenarioSocialReviewPressureReport[];
  autonomySignals: {
    forcedSpeechMarkerCount: number;
    consensusClaimCount: number;
  sideEffectRequestCount: number;
  sideEffectApprovalCount: number;
  sideEffectDeniedCount: number;
  sideEffectExpiredCount: number;
  providerBoundaryCount: number;
  archiveReviewRequestCount: number;
};
};

export type ScenarioAgentExpressionReport = {
  agentId: AgentId;
  intentionCount: number;
  speechCount: number;
  silenceCount: number;
};

export type ScenarioSocialReviewSubjectType =
  | "memory"
  | "protocol"
  | "handoff"
  | "persona_delta"
  | "topic_proposal"
  | "open_question";

export type ScenarioSocialReviewTraceReport = {
  subjectType: ScenarioSocialReviewSubjectType;
  subjectRef: RefId;
  response: string;
  eventId: RefId;
};

export type ScenarioSocialReviewPressureReport = {
  sourceMessageId: RefId;
  agentId: AgentId;
  topicId?: TopicId;
  reviewEventIds: RefId[];
  subjectTypes: ScenarioSocialReviewSubjectType[];
  reviewedRefs: ScenarioSocialReviewTraceReport[];
  formalClosureEventIds: RefId[];
  laterFormalClosureEventIds: RefId[];
  archiveCarryoverIds: RefId[];
  archiveCarriedReviewEventIds: RefId[];
  archiveCarriedReviewedRefs: RefId[];
  hasMixedSubjectTypes: boolean;
  hasFormalClosure: boolean;
  hasLaterFormalClosure: boolean;
  isCarriedByArchive: boolean;
};

export type ScenarioStateTransitionReport = {
  subjectType: "memory" | "protocol" | "archive_repair" | "handoff" | "topic_proposal" | "provider_boundary" | "side_effect";
  subjectRef: RefId;
  states: string[];
  eventIds: string[];
};

export type ScenarioArchiveCarryoverReport = {
  archiveId: RefId;
  sourceRefCount: number;
  carriedRefs: RefId[];
  disagreementCount: number;
  contestedCount: number;
  rejectedHandoffCount: number;
  openQuestionCount: number;
  silenceCount: number;
  providerBoundaryCount: number;
  archiveReviewCount: number;
  revisionOf?: RefId;
  appliedRepairRef?: RefId;
  summaryClaimsConsensus: boolean;
};

export type ScenarioMultiArchiveCarryoverReport = {
  ref: RefId;
  archiveIds: RefId[];
  occurrenceCount: number;
  subjectType?: ScenarioStateTransitionReport["subjectType"];
  states: string[];
  unresolved: boolean;
};

export type ScenarioProviderBoundaryRecoveryReport = {
  agentId: AgentId;
  boundaryRefs: RefId[];
  retiredBoundaryRefs: RefId[];
  activeBoundaryRefs: RefId[];
  freshBoundaryRefsAfterRetirement: RefId[];
  reusedRetiredBoundaryRefsAfterRetirement: RefId[];
  pressureChoices: ScenarioProviderBoundaryPressureChoiceReport[];
  freshBoundaryPressureChoices: ScenarioProviderBoundaryPressureChoiceReport[];
  degradationCount: number;
  firstBoundaryEventId: RefId;
  laterIntentionKinds: string[];
  laterSpeechEventIds: RefId[];
  laterSilenceCount: number;
  recoveredBySpeech: boolean;
  retiredAfterRecovery: boolean;
  futureOutageCreatedFreshBoundary: boolean;
};

export type ScenarioProviderBoundaryPressureChoiceReport = {
  boundaryRef: RefId;
  choiceAgentIds: AgentId[];
  archiveCarryoverIds: RefId[];
  repairRequestEventIds: RefId[];
  replacementRepairRequestEventIds: RefId[];
  retryProposalEventIds: RefId[];
  silenceIntentionEventIds: RefId[];
  disagreementEventIds: RefId[];
  sideEffectApprovalEventIds: RefId[];
  sideEffectDeniedEventIds: RefId[];
  sideEffectExpiredEventIds: RefId[];
  sideEffectResultEventIds: RefId[];
  retryProtocolProposalEventIds: RefId[];
  retryRetirementEventIds: RefId[];
  providerBoundaryRetirementEventIds: RefId[];
  hasMixedChoices: boolean;
  repairStillRequiresApproval: boolean;
  repairDeniedAfterContest: boolean;
  repairReplacementAfterDenial: boolean;
  repairApprovedWithoutExecution: boolean;
  repairResultReported: boolean;
  repairResultWithoutBoundaryRetirement: boolean;
  providerBoundaryRetiredAfterResult: boolean;
  retryRetiredWithoutBoundaryRetirement: boolean;
  carriedAcrossArchives: boolean;
  hasMultiAgentPressure: boolean;
};

type HandoffRecord = {
  handoffId: string;
  fromAgent: AgentId;
  toAgent: AgentId;
  topicId?: TopicId;
};

type ProtocolRecord = {
  protocolId: string;
  proposedBy: AgentId;
  topicId?: TopicId;
};

type TopicProposalRecord = {
  proposalId: string;
  proposedBy: AgentId;
  currentTopicId: TopicId;
  action: string;
  title: string;
  targetTopicId?: TopicId;
  contextRefs: RefId[];
};

type ArchiveRepairRecord = {
  repairId: string;
  archiveRef: RefId;
  proposedBy: AgentId;
  topicId?: TopicId;
  proposedRepair: string;
  contextRefs: RefId[];
};

type ScenarioState = {
  counter: number;
  roomId: RoomId;
  scenarioId: string;
  baseDate: string;
  prevEventId: string | null;
  prevEventHash: string | null;
  handoffsById: Map<string, HandoffRecord>;
  latestHandoffByRecipient: Map<AgentId, string>;
  protocolsById: Map<string, ProtocolRecord>;
  latestProtocolId?: string;
  topicProposalsById: Map<string, TopicProposalRecord>;
  latestTopicProposalId?: string;
  archiveRepairsById: Map<string, ArchiveRepairRecord>;
  latestArchiveRepairId?: string;
  latestPersonaDeltaId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Scenario fixture field ${fieldName} must be a non-empty string.`);
  }

  return value;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function uniqueRefs(refs: readonly RefId[]): RefId[] {
  return [...new Set(refs.filter((ref) => ref.length > 0))];
}

function nextId(state: ScenarioState, prefix: string): string {
  state.counter += 1;
  return `${prefix}_${state.counter.toString().padStart(4, "0")}`;
}

function eventTime(state: ScenarioState): string {
  const seconds = state.counter.toString().padStart(2, "0");
  return `${state.baseDate}T00:00:${seconds}.000Z`;
}

function appendEvent<TPayload>(
  state: ScenarioState,
  events: RoomEvent[],
  command: {
    eventType: string;
    actor: EventActor;
    payload: TPayload;
    refs?: RefId[];
    causationId?: string | null;
    correlationId?: string;
    payloadSchema?: string;
  },
): RoomEvent<TPayload> {
  const eventId = nextId(state, "evt");
  const hashBase = state.prevEventHash ?? "root";
  const event: RoomEvent<TPayload> = {
    event_id: eventId,
    room_id: state.roomId,
    event_type: command.eventType,
    schema_version: "1",
    payload_schema: command.payloadSchema ?? `${command.eventType}.v1`,
    occurred_at: eventTime(state),
    appended_at: eventTime(state),
    actor: command.actor,
    causation_id: command.causationId ?? null,
    correlation_id: command.correlationId ?? `scenario:${state.scenarioId}`,
    idempotency_key: `${state.scenarioId}:${eventId}`,
    refs: command.refs ?? [],
    payload: command.payload,
    prev_event_id: state.prevEventId,
    prev_event_hash: state.prevEventHash,
    event_hash: `hash_${hashBase}_${eventId}`,
  };

  events.push(event);
  state.prevEventId = event.event_id;
  state.prevEventHash = event.event_hash;
  return event;
}

function actor(kind: ActorKind, id: string): EventActor {
  return { kind, id };
}

function currentTopicId(message: ScenarioMessage, fixture: ScenarioFixture): TopicId {
  if (message.topic_id !== undefined) {
    return message.topic_id;
  }

  const firstTopic = fixture.topics?.[0]?.topic_id;
  return firstTopic ?? "topic_general";
}

function refsFromIntention(intention: ScenarioIntention): RefId[] {
  return intention.context_refs ?? intention.source_refs ?? [];
}

function appendMessageEvent(
  state: ScenarioState,
  events: RoomEvent[],
  message: ScenarioMessage,
  fixture: ScenarioFixture,
  causationId?: string,
): RoomEvent {
  const topicId = currentTopicId(message, fixture);
  const authorKind = message.authorKind ?? message.author_kind ?? (message.author === "user" ? "user" : "agent");

  return appendEvent(state, events, {
    eventType: "message.created",
    actor: actor(authorKind, message.author),
    causationId,
    refs: message.context_refs ?? [],
    payload: {
      messageId: message.message_id,
      topicId,
      author: message.author,
      authorKind,
      replyTo: message.reply_to,
      mentions: message.mentions ?? [],
      contextRefs: message.context_refs ?? [],
      content: message.content,
    },
  });
}

function appendInitialMemory(state: ScenarioState, events: RoomEvent[], memory: ScenarioMemory): void {
  const eventTypeByState: Record<string, string> = {
    observed: "memory.observed",
    proposed: "memory.proposed",
    accepted: "memory.accepted",
    contested: "memory.contested",
    stale: "memory.stale",
    retired: "memory.retired",
  };

  const eventType = eventTypeByState[memory.state] ?? "memory.proposed";
  appendEvent(state, events, {
    eventType,
    actor: actor("system", "scenario_fixture"),
    refs: memory.source_refs ?? [],
    payload: {
      memoryId: memory.memory_id,
      state: memory.state,
      summary: memory.summary,
      sourceRefs: memory.source_refs ?? [],
      proposedBy: memory.proposed_by,
      contestedBy: memory.contested_by ?? [],
      contestRefs: memory.contest_refs ?? [],
    },
  });
}

function appendIntention(
  state: ScenarioState,
  events: RoomEvent[],
  fixture: ScenarioFixture,
  agentId: AgentId,
  intention: ScenarioIntention,
  triggeringMessage: ScenarioMessage | undefined,
): void {
  const kind = intention.type;
  const topicId = intention.topic_id ?? triggeringMessage?.topic_id ?? fixture.topics?.[0]?.topic_id ?? "topic_general";
  const refs = refsFromIntention(intention);
  const intentionEvent = appendEvent(state, events, {
    eventType: "agent.intention.recorded",
    actor: actor("agent", agentId),
    refs,
    payload: {
      agentId,
      kind,
      topicId,
      reason: intention.reason,
      contextRefs: refs,
    },
  });

  if (kind === "speak") {
    const messageEvent = appendMessageEvent(
      state,
      events,
      {
        message_id: intention.message_id ?? nextId(state, `msg_${agentId}`),
        author: agentId,
        authorKind: "agent",
        topic_id: topicId,
        context_refs: refs,
        content: intention.content ?? "",
      },
      fixture,
      intentionEvent.event_id,
    );
    appendSpeechReviewTraces({
      state,
      events,
      agentId,
      topicId,
      content: intention.content ?? "",
      refs,
      intentionEvent,
      messageEvent,
      triggeringMessage,
    });
    return;
  }

  if (kind === "ask_question") {
    const question = intention.question ?? intention.content ?? "";
    const messageEvent = appendMessageEvent(
      state,
      events,
      {
        message_id: intention.message_id ?? nextId(state, `msg_${agentId}`),
        author: agentId,
        authorKind: "agent",
        topic_id: topicId,
        context_refs: refs,
        content: question,
      },
      fixture,
      intentionEvent.event_id,
    );
    appendEvent(state, events, {
      eventType: "topic.updated",
      actor: actor("agent", agentId),
      causationId: messageEvent.event_id,
      refs: uniqueRefs([intentionEvent.event_id, messageEvent.event_id, ...refs]),
      payload: {
        topicId,
        messageId: stringValue(objectPayload(messageEvent.payload).messageId) ?? messageEvent.event_id,
        openQuestion: question,
        openQuestionRef: intention.question_id ?? nextId(state, "question"),
        raisedBy: agentId,
        sourceMessageId: stringValue(objectPayload(messageEvent.payload).messageId) ?? messageEvent.event_id,
        contextRefs: refs,
        boundaryNote: "open question is room-visible unresolved context, not a demand for immediate answer",
      },
    });
    return;
  }

  if (kind === "stay_silent") {
    return;
  }

  if (kind === "propose_topic") {
    const proposalId = intention.topic_proposal_id ?? nextId(state, "topic_proposal");
    const action = intention.action ?? "split";
    const title = intention.title ?? intention.summary ?? "Untitled topic proposal";
    const targetTopicId = intention.targetTopicId ?? intention.target_topic_id;
    const contextRefs = uniqueRefs([triggeringMessage?.message_id ?? "", ...refs].filter((ref) => ref.length > 0));
    state.topicProposalsById.set(proposalId, {
      proposalId,
      proposedBy: agentId,
      currentTopicId: topicId,
      action,
      title,
      targetTopicId,
      contextRefs,
    });
    state.latestTopicProposalId = proposalId;
    appendEvent(state, events, {
      eventType: "topic.proposed",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: contextRefs,
      payload: {
        proposalId,
        currentTopicId: topicId,
        proposedBy: agentId,
        action,
        title,
        reason: intention.reason ?? "",
        targetTopicId,
        contextRefs,
        status: "proposed",
        revisedFromTopicProposalRef: intention.topicProposalRef ?? intention.topic_proposal_ref,
        revisedBy: intention.topicProposalRef ?? intention.topic_proposal_ref ? agentId : undefined,
        boundaryNote: "topic suggestion only; it does not switch, split, pause, revive, or merge the active topic by itself",
      },
    });
    return;
  }

  if (kind === "respond_topic") {
    const proposalRef = intention.topicProposalRef ?? intention.topic_proposal_ref ?? state.latestTopicProposalId;
    if (proposalRef === undefined) {
      throw new Error(`respond_topic in ${fixture.scenario_id} has no topic proposal reference.`);
    }
    const response = intention.response ?? "accept";
    const contextRefs = uniqueRefs([proposalRef, ...refs]);
    const responseEvent = appendEvent(state, events, {
      eventType: "topic.responded",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: contextRefs,
      payload: {
        responseId: nextId(state, "topic_response"),
        topicProposalRef: proposalRef,
        topicId,
        agentId,
        response,
        reason: intention.reason ?? "",
        proposedRevision: response === "revise" ? intention.proposed_revision : undefined,
        contextRefs,
        boundaryNote: "topic suggestion response only; it does not switch, split, pause, revive, or merge the active topic by itself",
      },
    });

    if (response === "revise" && intention.proposed_revision !== undefined && intention.proposed_revision.trim().length > 0) {
      const original = state.topicProposalsById.get(proposalRef);
      const revisedProposalId = intention.topic_proposal_id ?? nextId(state, "topic_proposal");
      const revisedContextRefs = uniqueRefs([responseEvent.event_id, proposalRef, ...refs, ...(original?.contextRefs ?? [])]);
      state.topicProposalsById.set(revisedProposalId, {
        proposalId: revisedProposalId,
        proposedBy: agentId,
        currentTopicId: original?.currentTopicId ?? topicId,
        action: original?.action ?? intention.action ?? "split",
        title: intention.proposed_revision,
        targetTopicId: original?.targetTopicId ?? intention.targetTopicId ?? intention.target_topic_id,
        contextRefs: revisedContextRefs,
      });
      state.latestTopicProposalId = revisedProposalId;
      appendEvent(state, events, {
        eventType: "topic.proposed",
        actor: actor("agent", agentId),
        causationId: responseEvent.event_id,
        refs: revisedContextRefs,
        payload: {
          proposalId: revisedProposalId,
          currentTopicId: original?.currentTopicId ?? topicId,
          proposedBy: agentId,
          action: original?.action ?? intention.action ?? "split",
          title: intention.proposed_revision,
          reason: intention.reason ?? "",
          targetTopicId: original?.targetTopicId ?? intention.targetTopicId ?? intention.target_topic_id,
          contextRefs: revisedContextRefs,
          status: "proposed",
          revisedFromTopicProposalRef: proposalRef,
          revisedBy: agentId,
          boundaryNote: "topic suggestion only; it does not switch, split, pause, revive, or merge the active topic by itself",
        },
      });
    }
    return;
  }

  if (kind === "apply_topic") {
    const proposalRef = intention.topicProposalRef ?? intention.topic_proposal_ref ?? state.latestTopicProposalId;
    if (proposalRef === undefined) {
      throw new Error(`apply_topic in ${fixture.scenario_id} has no topic proposal reference.`);
    }
    const action = intention.action ?? state.topicProposalsById.get(proposalRef)?.action ?? "split";
    const contextRefs = uniqueRefs([proposalRef, ...refs]);
    appendEvent(state, events, {
      eventType: "topic.applied",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: contextRefs,
      payload: {
        applicationId: nextId(state, "topic_application"),
        topicProposalRef: proposalRef,
        action,
        sourceTopicId: topicId,
        targetTopicId: intention.targetTopicId ?? intention.target_topic_id,
        resultingTopicId: intention.targetTopicId ?? intention.target_topic_id ?? topicId,
        appliedBy: agentId,
        reason: intention.reason ?? "",
        contextRefs,
        boundaryNote: "topic application is room-visible topic movement, not hidden scheduler control",
      },
    });
    return;
  }

  if (kind === "propose_handoff") {
    const handoffId = intention.handoff_id ?? nextId(state, "handoff");
    const toAgent = intention.to_agent ?? intention.toAgentId;
    if (toAgent === undefined) {
      throw new Error(`propose_handoff in ${fixture.scenario_id} is missing to_agent.`);
    }

    state.handoffsById.set(handoffId, { handoffId, fromAgent: agentId, toAgent, topicId });
    state.latestHandoffByRecipient.set(toAgent, handoffId);
    appendEvent(state, events, {
      eventType: "handoff.proposed",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs,
      payload: {
        handoffId,
        fromAgent: agentId,
        toAgent,
        topicId,
        reason: intention.reason ?? "",
        contextRefs: refs,
        requestedOutput: intention.requested_output ?? intention.requestedResponse,
        returnTo: intention.return_to,
        status: "proposed",
      },
    });
    return;
  }

  if (
    kind === "reject_handoff" ||
    kind === "accept_handoff" ||
    kind === "partially_accept_handoff" ||
    kind === "challenge_handoff" ||
    kind === "redirect_handoff"
  ) {
    const handoffId = intention.handoff_id ?? intention.handoffRef ?? state.latestHandoffByRecipient.get(agentId);
    if (handoffId === undefined) {
      throw new Error(`${kind} in ${fixture.scenario_id} has no handoff reference.`);
    }

    const statusByKind: Record<string, string> = {
      reject_handoff: "rejected",
      accept_handoff: "accepted",
      partially_accept_handoff: "partially_accepted",
      challenge_handoff: "challenged",
      redirect_handoff: "redirected",
    };
    const handoff = state.handoffsById.get(handoffId);
    appendEvent(state, events, {
      eventType: "handoff.responded",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: [handoffId, ...refs],
      payload: {
        handoffId,
        responder: agentId,
        fromAgent: handoff?.fromAgent,
        toAgent: handoff?.toAgent ?? agentId,
        topicId: handoff?.topicId ?? topicId,
        status: intention.status ?? statusByKind[kind],
        reason: intention.reason ?? "",
        contextRefs: refs,
      },
    });
    return;
  }

  if (kind === "propose_protocol") {
    const protocolId = intention.protocol_id ?? nextId(state, "protocol");
    state.protocolsById.set(protocolId, { protocolId, proposedBy: agentId, topicId });
    state.latestProtocolId = protocolId;
    appendEvent(state, events, {
      eventType: "protocol.proposed",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs,
      payload: {
        protocolId,
        topicId,
        proposedBy: agentId,
        summary: intention.summary ?? "",
        scope: intention.scope ?? "current_topic",
        reason: intention.reason ?? "",
        contextRefs: refs,
        status: "proposed",
        expiresAt: intention.expires_at,
        expiryPolicy: intention.expires_at ? "explicit" : "system_default_24h",
        boundaryNote: "protocol is temporary room etiquette, not permanent control flow",
      },
    });
    return;
  }

  if (kind === "respond_protocol") {
    const protocolId = intention.protocol_id ?? intention.protocolRef ?? state.latestProtocolId;
    if (protocolId === undefined) {
      throw new Error(`respond_protocol in ${fixture.scenario_id} has no protocol reference.`);
    }
    const response = intention.response ?? intention.status ?? "accept";
    const statusByResponse: Record<string, string> = {
      accept: "active",
      reject: "rejected",
      challenge: "challenged",
      revise: "revised",
      retire: "retired",
    };
    const protocol = state.protocolsById.get(protocolId);
    appendEvent(state, events, {
      eventType: "protocol.responded",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: [protocolId, ...refs],
      payload: {
        protocolId,
        topicId: protocol?.topicId ?? topicId,
        agentId,
        response,
        status: intention.status ?? statusByResponse[response] ?? "responded",
        reason: intention.reason ?? "",
        proposedRevision: intention.proposed_revision,
        contextRefs: refs,
      },
    });
    return;
  }

  if (kind === "retire_protocol") {
    const protocolId = intention.protocol_id ?? intention.protocolRef ?? state.latestProtocolId;
    if (protocolId === undefined) {
      throw new Error(`retire_protocol in ${fixture.scenario_id} has no protocol reference.`);
    }
    const protocol = state.protocolsById.get(protocolId);
    appendEvent(state, events, {
      eventType: "protocol.retired",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: [protocolId, ...refs],
      payload: {
        protocolId,
        protocolRef: protocolId,
        topicId: protocol?.topicId ?? topicId,
        retiredBy: agentId,
        reason: intention.reason ?? "",
        contextRefs: refs,
        status: "retired",
        retiredAt: eventTime(state),
        boundaryNote: "protocol retirement removes temporary etiquette from current pressure without deleting history",
      },
    });
    return;
  }

  if (kind === "review_archive") {
    const archiveRef = intention.archive_ref ?? intention.archiveRef;
    if (archiveRef === undefined) {
      throw new Error(`review_archive in ${fixture.scenario_id} is missing archive_ref.`);
    }

    appendEvent(state, events, {
      eventType: "archive.reviewed",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: uniqueRefs([archiveRef, ...refs]),
      payload: {
        archiveRef,
        reviewedBy: agentId,
        topicId,
        assessment: intention.assessment ?? intention.status ?? "needs_repair",
        summary: intention.summary ?? "",
        reason: intention.reason ?? "",
        contextRefs: refs,
        boundaryNote: "archive review is critique of a time skeleton, not consensus or mutation",
      },
    });
    return;
  }

  if (kind === "propose_archive_repair") {
    const archiveRef = intention.archive_ref ?? intention.archiveRef;
    if (archiveRef === undefined) {
      throw new Error(`propose_archive_repair in ${fixture.scenario_id} is missing archive_ref.`);
    }
    const repairId = intention.repair_id ?? nextId(state, "archive_repair");
    const proposedRepair = intention.proposed_repair ?? intention.proposed_revision ?? "";
    const contextRefs = uniqueRefs([archiveRef, ...refs]);
    state.archiveRepairsById.set(repairId, {
      repairId,
      archiveRef,
      proposedBy: agentId,
      topicId,
      proposedRepair,
      contextRefs,
    });
    state.latestArchiveRepairId = repairId;
    appendEvent(state, events, {
      eventType: "archive.repair_proposed",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: contextRefs,
      payload: {
        repairId,
        archiveRef,
        topicId,
        proposedBy: agentId,
        summary: intention.summary ?? "",
        reason: intention.reason ?? "",
        proposedRepair,
        contextRefs,
        status: "proposed",
        boundaryNote: "archive repair proposal does not rewrite the archive until later room action accepts it",
      },
    });
    return;
  }

  if (kind === "respond_archive_repair") {
    const repairRef = intention.repair_ref ?? intention.repairRef ?? state.latestArchiveRepairId;
    if (repairRef === undefined) {
      throw new Error(`respond_archive_repair in ${fixture.scenario_id} has no repair reference.`);
    }
    const response = intention.response ?? "challenge";
    const statusByResponse: Record<string, string> = {
      accept: "accepted",
      reject: "rejected",
      challenge: "challenged",
      revise: "revised",
      retire: "retired",
    };
    const original = state.archiveRepairsById.get(repairRef);
    const responseEvent = appendEvent(state, events, {
      eventType: "archive.repair_responded",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: uniqueRefs([repairRef, ...refs]),
      payload: {
        responseId: nextId(state, "archive_repair_response"),
        repairRef,
        agentId,
        topicId: original?.topicId ?? topicId,
        response,
        status: intention.status ?? statusByResponse[response] ?? "responded",
        reason: intention.reason ?? "",
        proposedRevision: intention.proposed_revision,
        contextRefs: refs,
        boundaryNote: "archive repair response changes repair proposal state only; archive content is unchanged",
      },
    });

    if (response === "revise" && intention.proposed_revision !== undefined && intention.proposed_revision.trim().length > 0) {
      if (original === undefined) {
        throw new Error(`respond_archive_repair revision in ${fixture.scenario_id} references unknown repair ${repairRef}.`);
      }
      const revisedRepairId = intention.revised_repair_id ?? nextId(state, "archive_repair");
      const revisedContextRefs = uniqueRefs([responseEvent.event_id, repairRef, ...refs, ...original.contextRefs]);
      state.archiveRepairsById.set(revisedRepairId, {
        repairId: revisedRepairId,
        archiveRef: original.archiveRef,
        proposedBy: agentId,
        topicId: original.topicId ?? topicId,
        proposedRepair: intention.proposed_revision,
        contextRefs: revisedContextRefs,
      });
      state.latestArchiveRepairId = revisedRepairId;
      appendEvent(state, events, {
        eventType: "archive.repair_proposed",
        actor: actor("agent", agentId),
        causationId: responseEvent.event_id,
        refs: revisedContextRefs,
        payload: {
          repairId: revisedRepairId,
          archiveRef: original.archiveRef,
          topicId: original.topicId ?? topicId,
          proposedBy: agentId,
          summary: intention.proposed_revision,
          reason: intention.reason ?? "",
          proposedRepair: intention.proposed_revision,
          contextRefs: revisedContextRefs,
          status: "proposed",
          revisedFromRepairRef: repairRef,
          revisedBy: agentId,
          boundaryNote: "archive repair proposal does not rewrite the archive until later room action accepts it",
        },
      });
    }
    return;
  }

  if (kind === "propose_memory") {
    const memoryId = intention.memory_id ?? nextId(state, "memory");
    const revisedFromMemoryRef = intention.revised_from_memory_ref ?? intention.revisedFromMemoryRef;
    const memoryRefs = uniqueRefs([...(revisedFromMemoryRef ? [revisedFromMemoryRef] : []), ...refs]);
    appendEvent(state, events, {
      eventType: "memory.proposed",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: memoryRefs,
      payload: {
        memoryId,
        topicId,
        state: "proposed",
        summary: intention.summary ?? "",
        reason: intention.reason ?? "",
        sourceRefs: memoryRefs,
        proposedBy: agentId,
        revisedFromMemoryRef,
        revisedBy: revisedFromMemoryRef ? agentId : undefined,
        boundaryNote: revisedFromMemoryRef
          ? "memory revision opens a fresh proposal; it does not rewrite the previous memory claim"
          : "memory proposal is provisional room sediment, not truth",
      },
    });
    return;
  }

  if (kind === "contest_memory") {
    const memoryId = intention.memory_id ?? intention.memoryRef;
    if (memoryId === undefined) {
      throw new Error(`contest_memory in ${fixture.scenario_id} is missing memory_id.`);
    }

    appendEvent(state, events, {
      eventType: "memory.contested",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: [memoryId, ...refs],
      payload: {
        memoryId,
        topicId,
        state: "contested",
        contestedBy: agentId,
        reason: intention.reason ?? "",
        sourceRefs: refs,
      },
    });
    return;
  }

  if (kind === "accept_memory" || kind === "mark_memory_stale" || kind === "retire_memory") {
    const memoryId = intention.memory_id ?? intention.memoryRef;
    if (memoryId === undefined) {
      throw new Error(`${kind} in ${fixture.scenario_id} is missing memory_id.`);
    }

    const transitionByKind: Record<string, { eventType: string; state: string }> = {
      accept_memory: { eventType: "memory.accepted", state: "accepted" },
      mark_memory_stale: { eventType: "memory.stale", state: "stale" },
      retire_memory: { eventType: "memory.retired", state: "retired" },
    };
    const transition = transitionByKind[kind];
    appendEvent(state, events, {
      eventType: transition.eventType,
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: [memoryId, ...refs],
      payload: {
        memoryId,
        topicId,
        state: transition.state,
        reason: intention.reason ?? "",
        sourceRefs: refs,
        evidenceRefs: refs,
        reviewRefs: intention.review_refs ?? refs,
        byAgentId: agentId,
      },
    });
    return;
  }

  if (kind === "propose_persona_delta") {
    const deltaId = intention.deltaRef ?? intention.delta_ref ?? nextId(state, "persona_delta");
    const targetAgentId = intention.targetAgentId ?? intention.target_agent_id ?? agentId;
    const evidenceRefs = uniqueRefs([triggeringMessage?.message_id ?? "", ...refs]);
    state.latestPersonaDeltaId = deltaId;
    appendEvent(state, events, {
      eventType: "persona_delta.proposed",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: evidenceRefs,
      payload: {
        deltaId,
        agentId: targetAgentId,
        proposedBy: agentId,
        reason: intention.reason ?? "",
        proposedChange: {
          field: intention.field ?? "roleClaims",
          operation: intention.operation ?? "add",
          value: intention.value ?? intention.summary ?? "",
        },
        evidenceRefs,
        status: "proposed",
        createdAt: eventTime(state),
        responses: [],
        boundaryNote: "persona evolution proposal is a room-visible claim, not a fixed assignment",
      },
    });
    return;
  }

  if (kind === "respond_persona_delta") {
    const deltaRef = intention.deltaRef ?? intention.delta_ref ?? state.latestPersonaDeltaId;
    if (deltaRef === undefined) {
      throw new Error(`respond_persona_delta in ${fixture.scenario_id} has no persona delta reference.`);
    }
    const response = intention.response ?? "challenge";
    const statusByResponse: Record<string, string> = {
      accept: "accepted",
      reject: "rejected",
      challenge: "contested",
      contest: "contested",
      revise: "revised",
      retire: "retired",
    };
    const evidenceRefs = uniqueRefs([triggeringMessage?.message_id ?? "", deltaRef, ...refs]);
    const responseEvent = appendEvent(state, events, {
      eventType: "persona_delta.responded",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: evidenceRefs,
      payload: {
        responseId: nextId(state, "persona_delta_response"),
        deltaId: deltaRef,
        agentId,
        response,
        reason: intention.reason ?? "",
        proposedRevision: intention.proposedRevision ?? intention.proposed_revision,
        evidenceRefs,
        status: intention.status ?? statusByResponse[response] ?? "responded",
        createdAt: eventTime(state),
        boundaryNote: "persona delta response changes a public identity claim, not a hidden profile assignment",
      },
    });

    const proposedRevision = intention.proposedRevision ?? intention.proposed_revision;
    if (response === "revise" && proposedRevision !== undefined && proposedRevision.trim().length > 0) {
      const revisedDeltaId = nextId(state, "persona_delta");
      const revisedEvidenceRefs = uniqueRefs([responseEvent.event_id, deltaRef, ...evidenceRefs]);
      state.latestPersonaDeltaId = revisedDeltaId;
      appendEvent(state, events, {
        eventType: "persona_delta.proposed",
        actor: actor("agent", agentId),
        causationId: responseEvent.event_id,
        refs: revisedEvidenceRefs,
        payload: {
          deltaId: revisedDeltaId,
          agentId,
          proposedBy: agentId,
          reason: intention.reason ?? "",
          proposedChange: {
            field: intention.field ?? "roleClaims",
            operation: intention.operation ?? "add",
            value: proposedRevision,
          },
          evidenceRefs: revisedEvidenceRefs,
          status: "proposed",
          createdAt: eventTime(state),
          responses: [],
          revisedFromDeltaRef: deltaRef,
          revisedBy: agentId,
          boundaryNote: "persona evolution proposal is a room-visible claim, not a fixed assignment",
        },
      });
    }
    return;
  }

  if (kind === "request_side_effect") {
    if (intention.request === undefined) {
      throw new Error(`request_side_effect in ${fixture.scenario_id} is missing request.`);
    }

    appendEvent(state, events, {
      eventType: "side_effect.requested",
      actor: actor("agent", agentId),
      causationId: intentionEvent.event_id,
      refs: intention.request.contextRefs ?? refs,
      payload: {
        ...intention.request,
        requestedBy: intention.request.requestedBy ?? agentId,
        topicId: intention.request.topicId ?? topicId,
        contextRefs: intention.request.contextRefs ?? refs,
      },
    });
  }

  if (kind === "retire_provider_boundary") {
    const boundaryRefs = uniqueRefs(
      [
        ...(intention.provider_boundary_refs ?? intention.providerBoundaryRefs ?? []),
        intention.provider_boundary_ref ?? intention.providerBoundaryRef ?? "",
        ...refs.filter((ref) => ref.startsWith("provider_boundary_") || ref.startsWith("agent.provider_degraded")),
      ].filter((ref) => ref.length > 0),
    );
    if (boundaryRefs.length === 0) {
      throw new Error(`retire_provider_boundary in ${fixture.scenario_id} has no provider boundary reference.`);
    }

    for (const boundaryRef of boundaryRefs) {
      appendEvent(state, events, {
        eventType: "provider_boundary.retired",
        actor: actor("agent", agentId),
        causationId: intentionEvent.event_id,
        refs: uniqueRefs([boundaryRef, ...refs]),
        payload: {
          providerBoundaryRef: boundaryRef,
          retiredBy: agentId,
          topicId,
          status: "retired",
          reason: intention.reason ?? "",
          contextRefs: refs,
          boundaryNote:
            "provider boundary retirement removes old runtime pressure from current room context; it does not delete ledger or archive history",
        },
      });
    }
    return;
  }
}

function appendSpeechReviewTraces(input: {
  state: ScenarioState;
  events: RoomEvent[];
  agentId: AgentId;
  topicId: TopicId;
  content: string;
  refs: RefId[];
  intentionEvent: RoomEvent;
  messageEvent: RoomEvent;
  triggeringMessage?: ScenarioMessage;
}): void {
  const sourceMessageId = stringValue(objectPayload(input.messageEvent.payload).messageId) ?? input.messageEvent.event_id;
  const responseContextRefs = uniqueRefs([
    input.triggeringMessage?.message_id ?? "",
    input.messageEvent.event_id,
    ...input.refs,
  ]);

  for (const questionRef of openQuestionRefsForResponse(responseContextRefs).slice(0, 4)) {
    appendEvent(input.state, input.events, {
      eventType: "open_question.responded",
      actor: actor("agent", input.agentId),
      causationId: input.messageEvent.event_id,
      refs: uniqueRefs([input.intentionEvent.event_id, input.messageEvent.event_id, questionRef, ...responseContextRefs]),
      payload: {
        responseId: nextId(input.state, "question_response"),
        questionRef,
        topicId: input.topicId,
        agentId: input.agentId,
        response: openQuestionResponseKind(input.content),
        summary: input.content,
        sourceMessageId,
        contextRefs: responseContextRefs,
        boundaryNote: "open question response is a social trace; it does not resolve or close the question",
      },
    });
  }

  for (const memoryRef of memoryRefsForReview(responseContextRefs)) {
    appendEvent(input.state, input.events, {
      eventType: "memory.reviewed",
      actor: actor("agent", input.agentId),
      causationId: input.messageEvent.event_id,
      refs: uniqueRefs([input.intentionEvent.event_id, input.messageEvent.event_id, memoryRef, ...responseContextRefs]),
      payload: {
        reviewId: nextId(input.state, "memory_review"),
        memoryRef,
        topicId: input.topicId,
        agentId: input.agentId,
        response: memoryReviewResponseKind(input.content),
        summary: input.content,
        sourceMessageId,
        contextRefs: responseContextRefs,
        boundaryNote: "memory review is a social trace; it does not accept, contest, stale, retire, or turn the claim into truth",
      },
    });
  }

  for (const protocolRef of protocolRefsForReview(responseContextRefs)) {
    appendEvent(input.state, input.events, {
      eventType: "protocol.reviewed",
      actor: actor("agent", input.agentId),
      causationId: input.messageEvent.event_id,
      refs: uniqueRefs([input.intentionEvent.event_id, input.messageEvent.event_id, protocolRef, ...responseContextRefs]),
      payload: {
        reviewId: nextId(input.state, "protocol_review"),
        protocolRef,
        topicId: input.topicId,
        agentId: input.agentId,
        response: protocolReviewResponseKind(input.content),
        summary: input.content,
        sourceMessageId,
        contextRefs: responseContextRefs,
        boundaryNote:
          "protocol review is a social trace; it does not accept, reject, challenge, revise, retire, or activate etiquette",
      },
    });
  }

  for (const handoffRef of handoffRefsForReview(responseContextRefs)) {
    appendEvent(input.state, input.events, {
      eventType: "handoff.reviewed",
      actor: actor("agent", input.agentId),
      causationId: input.messageEvent.event_id,
      refs: uniqueRefs([input.intentionEvent.event_id, input.messageEvent.event_id, handoffRef, ...responseContextRefs]),
      payload: {
        reviewId: nextId(input.state, "handoff_review"),
        handoffRef,
        topicId: input.topicId,
        agentId: input.agentId,
        response: handoffReviewResponseKind(input.content),
        summary: input.content,
        sourceMessageId,
        contextRefs: responseContextRefs,
        boundaryNote:
          "handoff review is a social trace; it does not accept, reject, partially accept, delegate, challenge, complete, or transfer control",
      },
    });
  }

  for (const deltaRef of personaDeltaRefsForReview(responseContextRefs)) {
    appendEvent(input.state, input.events, {
      eventType: "persona_delta.reviewed",
      actor: actor("agent", input.agentId),
      causationId: input.messageEvent.event_id,
      refs: uniqueRefs([input.intentionEvent.event_id, input.messageEvent.event_id, deltaRef, ...responseContextRefs]),
      payload: {
        reviewId: nextId(input.state, "persona_delta_review"),
        deltaRef,
        agentId: input.agentId,
        topicId: input.topicId,
        response: personaDeltaReviewResponseKind(input.content),
        summary: input.content,
        sourceMessageId,
        contextRefs: responseContextRefs,
        boundaryNote: "persona delta review is a social trace; it does not accept, reject, contest, retire, revise, or mutate identity",
      },
    });
  }

  for (const topicProposalRef of topicProposalRefsForReview(responseContextRefs)) {
    appendEvent(input.state, input.events, {
      eventType: "topic.reviewed",
      actor: actor("agent", input.agentId),
      causationId: input.messageEvent.event_id,
      refs: uniqueRefs([input.intentionEvent.event_id, input.messageEvent.event_id, topicProposalRef, ...responseContextRefs]),
      payload: {
        reviewId: nextId(input.state, "topic_review"),
        topicProposalRef,
        topicId: input.topicId,
        agentId: input.agentId,
        response: topicProposalReviewResponseKind(input.content),
        summary: input.content,
        sourceMessageId,
        contextRefs: responseContextRefs,
        boundaryNote:
          "topic suggestion review is a social trace; it does not accept, reject, challenge, revise, apply, or move the active topic",
      },
    });
  }
}

function appendArchive(state: ScenarioState, events: RoomEvent[], archive: ScenarioArchive): void {
  const refs = archive.sourceRefs ?? archive.source_refs ?? [];
  const provenanceRefs = archive.provenanceRefs ?? archive.provenance_refs ?? [];
  const archiveEvent = appendEvent(state, events, {
    eventType: "daily_archive.created",
    actor: actor("system", "daily_archive"),
    refs: uniqueRefs([...refs, ...provenanceRefs]),
    payload: {
      archiveId: archive.archive_id,
      date: archive.date ?? state.baseDate,
      revisionOf: archive.revisionOf ?? archive.revision_of,
      appliedRepairRef: archive.appliedRepairRef ?? archive.applied_repair_ref,
      provenanceRefs,
      summary: archive.summary,
      sourceRefs: refs,
      disagreements: archive.disagreements ?? [],
      decisions: archive.decisions ?? [],
      openQuestions: archive.openQuestions ?? [],
      contestedItems: archive.contestedItems ?? [],
      rejectedHandoffs: archive.rejectedHandoffs ?? [],
      memoryDeltaRefs: archive.memoryDeltaRefs ?? [],
      sideEffectOutcomes: archive.sideEffectOutcomes ?? [],
      silences: archive.silences ?? [],
      providerBoundaries: archive.providerBoundaries ?? [],
      archiveReviews: archive.archiveReviews ?? [],
    },
  });

  if (archive.review_requested === true) {
    appendEvent(state, events, {
      eventType: "archive.review_requested",
      actor: actor("system", "archive_worker"),
      causationId: archiveEvent.event_id,
      refs: uniqueRefs([archive.archive_id, archiveEvent.event_id]),
      payload: {
        requestId: `archive_review_request_${archive.archive_id}`,
        archiveRef: archive.archive_id,
        date: archive.date ?? state.baseDate,
        requestedBy: "archive_worker",
        summary: `Review daily archive ${archive.archive_id} as a time skeleton, not consensus.`,
        reason:
          "Daily rhythm invites the room to inspect omissions, bias, contested memory, provider boundaries, or useful repair without forcing anyone to speak.",
        status: "open",
        contextRefs: [archive.archive_id, archiveEvent.event_id],
        boundaryNote:
          "daily archive review request is a room rhythm invitation, not a command to speak, accept, or repair the archive",
      },
    });
  }
}

function appendSideEffectDecision(
  state: ScenarioState,
  events: RoomEvent[],
  decision: ScenarioSideEffectDecision,
): void {
  const contextRefs = uniqueRefs([decision.request_ref, ...(decision.context_refs ?? [])]);
  const approved = decision.status === "approved";
  appendEvent(state, events, {
    eventType: approved ? "side_effect.approved" : "side_effect.denied",
    actor: actor("user", decision.decided_by),
    refs: contextRefs,
    payload: approved
      ? {
          approvalId: decision.request_ref,
          approvedBy: decision.decided_by,
          reason: decision.reason,
          scope: {
            kinds: [],
            targetPrefixes: [],
            allowedAgents: [],
          },
          decidedAt: eventTime(state),
          contextRefs,
          boundaryNote:
            "side-effect approval is explicit, scoped, and room-visible; approval is still not execution or memory truth",
        }
      : {
          approvalId: decision.request_ref,
          deniedBy: decision.decided_by,
          reason: decision.reason,
          decidedAt: eventTime(state),
          contextRefs,
          boundaryNote:
            "side-effect denial keeps the request auditable without executing it or turning repair pressure into room consensus",
      },
  });
}

function appendSideEffectExpiration(
  state: ScenarioState,
  events: RoomEvent[],
  expiration: ScenarioSideEffectExpiration,
): void {
  const contextRefs = uniqueRefs([expiration.request_ref, ...(expiration.context_refs ?? [])]);
  appendEvent(state, events, {
    eventType: "side_effect.expired",
    actor: actor("user", expiration.expired_by),
    refs: contextRefs,
    payload: {
      approvalId: expiration.request_ref,
      expiredBy: expiration.expired_by,
      reason: expiration.reason,
      expiredAt: expiration.expired_at ?? eventTime(state),
      contextRefs,
      boundaryNote:
        "side-effect expiry retires an unused permission; it does not execute diagnostics, report a result, or create memory truth",
    },
  });
}

function appendSideEffectResult(
  state: ScenarioState,
  events: RoomEvent[],
  result: ScenarioSideEffectResult,
): void {
  const contextRefs = uniqueRefs([
    result.approval_ref,
    ...(result.artifact_refs ?? []),
    ...(result.claim_refs ?? []),
    ...(result.follow_up_proposal_refs ?? []),
    ...(result.context_refs ?? []),
  ]);
  appendEvent(state, events, {
    eventType: "side_effect.result_reported",
    actor: actor("system", result.reported_by ?? "side_effect_gate"),
    refs: contextRefs,
    payload: {
      resultId: result.result_id,
      approvalId: result.approval_ref,
      agentId: result.agent_id ?? result.reported_by ?? "unknown_agent",
      actionKind: result.action_kind,
      target: result.target,
      status: result.status,
      summary: result.summary,
      artifactRefs: result.artifact_refs ?? [],
      claimRefs: result.claim_refs ?? [],
      followUpProposalRefs: result.follow_up_proposal_refs ?? [],
      contextRefs,
      completedAt: result.completed_at ?? eventTime(state),
      boundaryNote:
        "side-effect result is an auditable outcome only; it does not automatically repair a provider, retire a boundary, or become room memory",
    },
  });
}

function appendProviderDegradation(
  state: ScenarioState,
  events: RoomEvent[],
  degradation: ScenarioProviderDegradation,
  triggeringMessageEvent?: RoomEvent,
): void {
  const triggeringEventId = degradation.triggering_event_ref ?? triggeringMessageEvent?.event_id ?? state.prevEventId ?? "";
  const refs = uniqueRefs([triggeringEventId, ...(degradation.context_refs ?? [])].filter((ref) => ref.length > 0));
  appendEvent(state, events, {
    eventType: "agent.provider_degraded",
    actor: actor("system", "provider_boundary"),
    refs,
    causationId: triggeringMessageEvent?.event_id,
    payload: {
      degradationId: degradation.degradation_id,
      agentId: degradation.agent_id,
      topicId: degradation.topic_id,
      triggeringEventId,
      packetId: degradation.packet_id ?? nextId(state, "packet_provider_degraded"),
      providerKind: degradation.provider_kind,
      providerLabel: degradation.provider_label,
      diagnostic: degradation.diagnostic,
      boundaryNote: "provider degradation is not agent silence",
    },
  });
}

function appendArchiveRepairApplication(
  state: ScenarioState,
  events: RoomEvent[],
  application: ScenarioArchiveRepairApplication,
): void {
  const contextRefs = application.context_refs ?? [];
  const acceptedResponseRefs =
    application.accepted_response_refs ??
    events
      .filter((event) => {
        if (event.event_type !== "archive.repair_responded") {
          return false;
        }
        const payload = event.payload as { repairRef?: string; repair_ref?: string; status?: string; response?: string };
        return (
          (payload.repairRef ?? payload.repair_ref) === application.repair_ref &&
          (payload.status === "accepted" || payload.response === "accept")
        );
      })
      .map((event) => event.event_id);
  appendEvent(state, events, {
    eventType: "archive.repair_applied",
    actor: actor("system", "archive_repair_apply"),
    refs: uniqueRefs([
      application.repair_ref,
      application.archive_ref,
      application.revised_archive_id,
      ...acceptedResponseRefs,
      ...contextRefs,
    ]),
    payload: {
      repairRef: application.repair_ref,
      archiveRef: application.archive_ref,
      revisedArchiveRef: application.revised_archive_id,
      reason: application.reason,
      acceptedResponseRefs,
      contextRefs,
      appliedBy: "scenario_archive_repair_apply",
      boundaryNote: "accepted repair was explicitly applied as a new archive revision; original archive remains unchanged",
    },
  });
}

function appendProtocolExpiration(
  state: ScenarioState,
  events: RoomEvent[],
  expiration: ScenarioProtocolExpiration,
): void {
  const refs = expiration.context_refs ?? [];
  appendEvent(state, events, {
    eventType: "protocol.expired",
    actor: actor("system", "protocol_expiry"),
    refs: [expiration.protocol_id, ...refs],
    payload: {
      protocolId: expiration.protocol_id,
      topicId: expiration.topic_id,
      status: "expired",
      reason: expiration.reason,
      expiredAt: expiration.expired_at ?? eventTime(state),
      contextRefs: refs,
      boundaryNote: "temporary protocol left effective context without deleting its historical proposal",
    },
  });
}

export function loadScenarioFixture(filePath: string): ScenarioFixture {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!isRecord(parsed)) {
    throw new Error(`Scenario fixture ${filePath} must be a JSON object.`);
  }

  const fixture = parsed as ScenarioFixture;
  asString(fixture.scenario_id, "scenario_id");

  if (!isRecord(fixture.initial_room)) {
    throw new Error(`Scenario fixture ${fixture.scenario_id} is missing initial_room.`);
  }
  asString(fixture.initial_room.room_id, "initial_room.room_id");

  if (!Array.isArray(fixture.messages)) {
    throw new Error(`Scenario fixture ${fixture.scenario_id} must include messages.`);
  }

  for (const message of fixture.messages) {
    asString(message.message_id, "messages[].message_id");
    asString(message.author, "messages[].author");
    asString(message.content, "messages[].content");
  }

  return fixture;
}

export function runScenarioFixture(fixture: ScenarioFixture): ScenarioRunResult {
  const events: RoomEvent[] = [];
  const state: ScenarioState = {
    counter: 0,
    roomId: fixture.initial_room.room_id,
    scenarioId: fixture.scenario_id,
    baseDate: fixture.initial_room.date ?? "2026-06-17",
    prevEventId: null,
    prevEventHash: null,
    handoffsById: new Map(),
    latestHandoffByRecipient: new Map(),
    protocolsById: new Map(),
    topicProposalsById: new Map(),
    archiveRepairsById: new Map(),
  };

  appendEvent(state, events, {
    eventType: "room.created",
    actor: actor("system", "scenario_fixture"),
    payload: {
      roomId: fixture.initial_room.room_id,
      constraints: fixture.initial_room.constraints ?? {},
    },
  });

  for (const topic of fixture.topics ?? []) {
    appendEvent(state, events, {
      eventType: "topic.created",
      actor: actor("system", "scenario_fixture"),
      payload: {
        topicId: topic.topic_id,
        title: topic.title ?? topic.topic_id,
        status: topic.status ?? "active",
        summary: topic.summary,
        openQuestions: asStringArray(topic.open_questions),
      },
    });
  }

  for (const memory of fixture.initial_memory ?? []) {
    appendInitialMemory(state, events, memory);
  }

  for (const archive of fixture.initial_archives ?? []) {
    appendArchive(state, events, archive);
  }

  const archivesAfterMessage = new Map<string, ScenarioArchive[]>();
  const finalArchives: ScenarioArchive[] = [];
  for (const archive of fixture.archives ?? []) {
    if (archive.after_message_id !== undefined) {
      const bucket = archivesAfterMessage.get(archive.after_message_id) ?? [];
      bucket.push(archive);
      archivesAfterMessage.set(archive.after_message_id, bucket);
    } else {
      finalArchives.push(archive);
    }
  }

  const degradationsAfterMessage = new Map<string, ScenarioProviderDegradation[]>();
  const finalDegradations: ScenarioProviderDegradation[] = [];
  for (const degradation of fixture.provider_degradations ?? []) {
    if (degradation.after_message_id !== undefined) {
      const bucket = degradationsAfterMessage.get(degradation.after_message_id) ?? [];
      bucket.push(degradation);
      degradationsAfterMessage.set(degradation.after_message_id, bucket);
    } else {
      finalDegradations.push(degradation);
    }
  }

  const sideEffectDecisionsAfterMessage = new Map<string, ScenarioSideEffectDecision[]>();
  const finalSideEffectDecisions: ScenarioSideEffectDecision[] = [];
  for (const decision of fixture.side_effect_decisions ?? []) {
    if (decision.after_message_id !== undefined) {
      const bucket = sideEffectDecisionsAfterMessage.get(decision.after_message_id) ?? [];
      bucket.push(decision);
      sideEffectDecisionsAfterMessage.set(decision.after_message_id, bucket);
    } else {
      finalSideEffectDecisions.push(decision);
    }
  }

  const sideEffectExpirationsAfterMessage = new Map<string, ScenarioSideEffectExpiration[]>();
  const finalSideEffectExpirations: ScenarioSideEffectExpiration[] = [];
  for (const expiration of fixture.side_effect_expirations ?? []) {
    if (expiration.after_message_id !== undefined) {
      const bucket = sideEffectExpirationsAfterMessage.get(expiration.after_message_id) ?? [];
      bucket.push(expiration);
      sideEffectExpirationsAfterMessage.set(expiration.after_message_id, bucket);
    } else {
      finalSideEffectExpirations.push(expiration);
    }
  }

  const sideEffectResultsAfterMessage = new Map<string, ScenarioSideEffectResult[]>();
  const finalSideEffectResults: ScenarioSideEffectResult[] = [];
  for (const result of fixture.side_effect_results ?? []) {
    if (result.after_message_id !== undefined) {
      const bucket = sideEffectResultsAfterMessage.get(result.after_message_id) ?? [];
      bucket.push(result);
      sideEffectResultsAfterMessage.set(result.after_message_id, bucket);
    } else {
      finalSideEffectResults.push(result);
    }
  }

  const queues = new Map<AgentId, ScenarioIntention[]>();
  for (const [agentId, intentions] of Object.entries(fixture.scripted_intentions ?? {})) {
    queues.set(agentId, [...intentions]);
  }

  for (const message of fixture.messages) {
    const messageEvent = appendMessageEvent(state, events, message, fixture);

    const agentOrder = fixture.agents?.map((agent) => agent.agent_id) ?? [...queues.keys()];
    for (const agentId of agentOrder) {
      const queue = queues.get(agentId);
      if (queue === undefined || queue.length === 0) {
        continue;
      }

      const next = queue[0];
      if (next.after_message_id !== undefined && next.after_message_id !== message.message_id) {
        continue;
      }

      queue.shift();
      appendIntention(state, events, fixture, agentId, next, message);
    }

    for (const degradation of degradationsAfterMessage.get(message.message_id) ?? []) {
      appendProviderDegradation(state, events, degradation, messageEvent);
    }

    for (const decision of sideEffectDecisionsAfterMessage.get(message.message_id) ?? []) {
      appendSideEffectDecision(state, events, decision);
    }

    for (const expiration of sideEffectExpirationsAfterMessage.get(message.message_id) ?? []) {
      appendSideEffectExpiration(state, events, expiration);
    }

    for (const result of sideEffectResultsAfterMessage.get(message.message_id) ?? []) {
      appendSideEffectResult(state, events, result);
    }

    for (const archive of archivesAfterMessage.get(message.message_id) ?? []) {
      appendArchive(state, events, archive);
    }
  }

  for (const [agentId, queue] of queues.entries()) {
    while (queue.length > 0) {
      appendIntention(state, events, fixture, agentId, queue.shift()!, undefined);
    }
  }

  for (const expiration of fixture.protocol_expirations ?? []) {
    appendProtocolExpiration(state, events, expiration);
  }

  for (const application of fixture.archive_repair_applications ?? []) {
    appendArchiveRepairApplication(state, events, application);
  }

  for (const degradation of finalDegradations) {
    appendProviderDegradation(state, events, degradation);
  }

  for (const decision of finalSideEffectDecisions) {
    appendSideEffectDecision(state, events, decision);
  }

  for (const expiration of finalSideEffectExpirations) {
    appendSideEffectExpiration(state, events, expiration);
  }

  for (const result of finalSideEffectResults) {
    appendSideEffectResult(state, events, result);
  }

  for (const archive of finalArchives) {
    appendArchive(state, events, archive);
  }

  return { fixture, events };
}

export function buildScenarioRunReport(run: ScenarioRunResult): ScenarioRunReport {
  const stateTransitions = buildStateTransitionReport(run.events);
  const archives = buildArchiveCarryoverReport(run.events);
  return {
    scenarioId: run.fixture.scenario_id,
    purpose: run.fixture.purpose,
    eventCount: run.events.length,
    eventTypeCounts: countBy(run.events, (event) => event.event_type),
    agentExpression: buildAgentExpressionReport(run.events),
    stateTransitions,
    archives,
    multiArchiveCarryoverRefs: buildMultiArchiveCarryoverReport(run.events, stateTransitions),
    providerBoundaryRecoveries: buildProviderBoundaryRecoveryReport(run.events),
    socialReviewPressures: buildSocialReviewPressureReport(run.events),
    autonomySignals: {
      forcedSpeechMarkerCount: run.events.filter(hasForcedSpeechMarker).length,
      consensusClaimCount: run.events.filter(claimsConsensus).length,
      sideEffectRequestCount: run.events.filter((event) => event.event_type === "side_effect.requested").length,
      sideEffectApprovalCount: run.events.filter((event) => event.event_type === "side_effect.approved").length,
      sideEffectDeniedCount: run.events.filter((event) => event.event_type === "side_effect.denied").length,
      sideEffectExpiredCount: run.events.filter((event) => event.event_type === "side_effect.expired").length,
      providerBoundaryCount: run.events.filter((event) => event.event_type === "agent.provider_degraded").length,
      archiveReviewRequestCount: run.events.filter((event) => event.event_type === "archive.review_requested").length,
    },
  };
}

function buildAgentExpressionReport(events: readonly RoomEvent[]): ScenarioAgentExpressionReport[] {
  const byAgent = new Map<AgentId, ScenarioAgentExpressionReport>();

  for (const event of events) {
    const payload = objectPayload(event.payload);
    const agentId = stringValue(payload.agentId) ?? (event.actor.kind === "agent" ? event.actor.id : undefined);
    if (agentId === undefined) {
      continue;
    }

    const report =
      byAgent.get(agentId) ??
      ({
        agentId,
        intentionCount: 0,
        speechCount: 0,
        silenceCount: 0,
      } satisfies ScenarioAgentExpressionReport);

    if (event.event_type === "agent.intention.recorded" || event.event_type === "agent.intention_recorded") {
      report.intentionCount += 1;
      const intention = objectPayload(payload.intention);
      const intentionKind = stringValue(payload.kind) ?? stringValue(intention.kind);
      if (intentionKind === "stay_silent") {
        report.silenceCount += 1;
      }
    }

    if (event.event_type === "message.created" && payload.authorKind === "agent") {
      report.speechCount += 1;
    }

    byAgent.set(agentId, report);
  }

  return [...byAgent.values()].sort((a, b) => a.agentId.localeCompare(b.agentId));
}

function buildStateTransitionReport(events: readonly RoomEvent[]): ScenarioStateTransitionReport[] {
  const transitions = new Map<string, ScenarioStateTransitionReport>();

  for (const event of events) {
    const payload = objectPayload(event.payload);
    const transition = transitionFromEvent(event, payload);
    if (transition === undefined) {
      continue;
    }

    const key = `${transition.subjectType}:${transition.subjectRef}`;
    const report =
      transitions.get(key) ??
      ({
        subjectType: transition.subjectType,
        subjectRef: transition.subjectRef,
        states: [],
        eventIds: [],
      } satisfies ScenarioStateTransitionReport);
    report.states.push(transition.state);
    report.eventIds.push(event.event_id);
    transitions.set(key, report);
  }

  return [...transitions.values()].sort(
    (a, b) => a.subjectType.localeCompare(b.subjectType) || a.subjectRef.localeCompare(b.subjectRef),
  );
}

function transitionFromEvent(
  event: RoomEvent,
  payload: Record<string, unknown>,
): {
  subjectType: "memory" | "protocol" | "archive_repair" | "handoff" | "topic_proposal" | "provider_boundary" | "side_effect";
  subjectRef: RefId;
  state: string;
} | undefined {
  if (event.event_type.startsWith("memory.")) {
    const memoryId = stringValue(payload.memoryId) ?? stringValue(payload.memory_id);
    const state = stringValue(payload.state) ?? event.event_type.slice("memory.".length);
    return memoryId ? { subjectType: "memory", subjectRef: memoryId, state } : undefined;
  }

  if (event.event_type.startsWith("protocol.")) {
    const protocolId = stringValue(payload.protocolId) ?? stringValue(payload.protocol_id);
    const state = stringValue(payload.status) ?? event.event_type.slice("protocol.".length);
    return protocolId ? { subjectType: "protocol", subjectRef: protocolId, state } : undefined;
  }

  if (event.event_type.startsWith("archive.repair_")) {
    const repairRef = stringValue(payload.repairId) ?? stringValue(payload.repairRef) ?? stringValue(payload.repair_ref);
    const state = stringValue(payload.status) ?? archiveRepairStateFromEventType(event.event_type);
    return repairRef ? { subjectType: "archive_repair", subjectRef: repairRef, state } : undefined;
  }

  if (event.event_type.startsWith("handoff.")) {
    const handoffRef = stringValue(payload.handoffId) ?? stringValue(payload.handoffRef) ?? stringValue(payload.handoff_ref);
    const state = stringValue(payload.status) ?? stringValue(payload.response) ?? event.event_type.slice("handoff.".length);
    return handoffRef ? { subjectType: "handoff", subjectRef: handoffRef, state } : undefined;
  }

  if (event.event_type.startsWith("topic.")) {
    const proposalRef =
      stringValue(payload.proposalId) ??
      stringValue(payload.proposal_id) ??
      stringValue(payload.topicProposalRef) ??
      stringValue(payload.topic_proposal_ref);
    if (proposalRef === undefined) {
      return undefined;
    }
    const state =
      event.event_type === "topic.applied"
        ? "applied"
        : stringValue(payload.status) ?? stringValue(payload.response) ?? event.event_type.slice("topic.".length);
    return { subjectType: "topic_proposal", subjectRef: proposalRef, state };
  }

  if (event.event_type === "agent.provider_degraded") {
    const boundaryRef = stringValue(payload.degradationId) ?? stringValue(payload.degradation_id) ?? event.event_id;
    return { subjectType: "provider_boundary", subjectRef: boundaryRef, state: "degraded" };
  }

  if (event.event_type.startsWith("provider_boundary.")) {
    const boundaryRef =
      stringValue(payload.providerBoundaryRef) ??
      stringValue(payload.provider_boundary_ref) ??
      stringValue(payload.boundaryRef) ??
      stringValue(payload.boundary_ref);
    const state = stringValue(payload.status) ?? event.event_type.slice("provider_boundary.".length);
    return boundaryRef ? { subjectType: "provider_boundary", subjectRef: boundaryRef, state } : undefined;
  }

  if (event.event_type.startsWith("side_effect.")) {
    const sideEffectRef =
      stringValue(payload.requestId) ??
      stringValue(payload.request_id) ??
      stringValue(payload.approvalId) ??
      stringValue(payload.approval_id) ??
      stringValue(payload.resultId) ??
      stringValue(payload.result_id);
    const state = stringValue(payload.status) ?? event.event_type.slice("side_effect.".length);
    return sideEffectRef ? { subjectType: "side_effect", subjectRef: sideEffectRef, state } : undefined;
  }

  return undefined;
}

function archiveRepairStateFromEventType(eventType: string): string {
  if (eventType === "archive.repair_proposed") return "proposed";
  if (eventType === "archive.repair_responded") return "responded";
  if (eventType === "archive.repair_applied") return "applied";
  return eventType.slice("archive.".length);
}

function buildArchiveCarryoverReport(events: readonly RoomEvent[]): ScenarioArchiveCarryoverReport[] {
  return events
    .filter((event) => event.event_type === "daily_archive.created")
    .map((event) => {
      const payload = objectPayload(event.payload);
      const sourceRefs = archiveSourceRefs(payload);
      return {
        archiveId: stringValue(payload.archiveId) ?? stringValue(payload.archive_id) ?? event.event_id,
        sourceRefCount: sourceRefs.length,
        carriedRefs: sourceRefs.slice(0, 12),
        disagreementCount: objectArray(payload.disagreements).length,
        contestedCount: objectArray(payload.contestedItems).length,
        rejectedHandoffCount: objectArray(payload.rejectedHandoffs).length,
        openQuestionCount: objectArray(payload.openQuestions).length,
        silenceCount: objectArray(payload.silences).length,
        providerBoundaryCount: objectArray(payload.providerBoundaries).length,
        archiveReviewCount: objectArray(payload.archiveReviews).length,
        revisionOf: stringValue(payload.revisionOf) ?? stringValue(payload.revision_of),
        appliedRepairRef: stringValue(payload.appliedRepairRef) ?? stringValue(payload.applied_repair_ref),
        summaryClaimsConsensus: claimsConsensus(event),
      };
    });
}

function buildMultiArchiveCarryoverReport(
  events: readonly RoomEvent[],
  stateTransitions: readonly ScenarioStateTransitionReport[],
): ScenarioMultiArchiveCarryoverReport[] {
  const transitionsByRef = new Map(stateTransitions.map((transition) => [transition.subjectRef, transition]));
  const archivesByRef = new Map<RefId, RefId[]>();

  for (const event of events) {
    if (event.event_type !== "daily_archive.created") {
      continue;
    }
    const payload = objectPayload(event.payload);
    const archiveId = stringValue(payload.archiveId) ?? stringValue(payload.archive_id) ?? event.event_id;
    for (const ref of archiveSourceRefs(payload)) {
      const archiveIds = archivesByRef.get(ref) ?? [];
      if (!archiveIds.includes(archiveId)) {
        archiveIds.push(archiveId);
      }
      archivesByRef.set(ref, archiveIds);
    }
  }

  return [...archivesByRef.entries()]
    .filter(([, archiveIds]) => archiveIds.length > 1)
    .map(([ref, archiveIds]) => {
      const transition = transitionsByRef.get(ref);
      const states = transition?.states ?? [];
      return {
        ref,
        archiveIds,
        occurrenceCount: archiveIds.length,
        subjectType: transition?.subjectType,
        states,
        unresolved: isUnresolvedCarryover(states),
      } satisfies ScenarioMultiArchiveCarryoverReport;
    })
    .sort((a, b) => a.ref.localeCompare(b.ref));
}

function buildSocialReviewPressureReport(events: readonly RoomEvent[]): ScenarioSocialReviewPressureReport[] {
  const messageIndexByMessageId = new Map<RefId, number>();
  const messageEventIdByMessageId = new Map<RefId, RefId>();
  const eventIndexByEventId = new Map<RefId, number>();
  const archiveRefsById = new Map<RefId, RefId[]>();
  events.forEach((event, index) => {
    eventIndexByEventId.set(event.event_id, index);
    if (event.event_type === "message.created") {
      const messageId = stringValue(objectPayload(event.payload).messageId);
      if (messageId !== undefined) {
        messageIndexByMessageId.set(messageId, index);
        messageEventIdByMessageId.set(messageId, event.event_id);
      }
    }
    if (event.event_type === "daily_archive.created") {
      const payload = objectPayload(event.payload);
      const archiveId = stringValue(payload.archiveId) ?? stringValue(payload.archive_id) ?? event.event_id;
      archiveRefsById.set(archiveId, archiveSourceRefs(payload));
    }
  });

  const grouped = new Map<
    RefId,
    {
      sourceMessageId: RefId;
      agentId: AgentId;
      topicId?: TopicId;
      reviewEventIds: RefId[];
      reviewedRefs: ScenarioSocialReviewTraceReport[];
    }
  >();

  for (const event of events) {
    const payload = objectPayload(event.payload);
    const trace = socialReviewTraceFromEvent(event, payload);
    if (trace === undefined) {
      continue;
    }
    const sourceMessageId = stringValue(payload.sourceMessageId) ?? stringValue(payload.source_message_id);
    if (sourceMessageId === undefined) {
      continue;
    }
    const existing =
      grouped.get(sourceMessageId) ??
      ({
        sourceMessageId,
        agentId: trace.agentId,
        topicId: trace.topicId,
        reviewEventIds: [],
        reviewedRefs: [],
      } satisfies {
        sourceMessageId: RefId;
        agentId: AgentId;
        topicId?: TopicId;
        reviewEventIds: RefId[];
        reviewedRefs: ScenarioSocialReviewTraceReport[];
      });
    existing.reviewEventIds.push(event.event_id);
    existing.reviewedRefs.push({
      subjectType: trace.subjectType,
      subjectRef: trace.subjectRef,
      response: trace.response,
      eventId: event.event_id,
    });
    grouped.set(sourceMessageId, existing);
  }

  return [...grouped.values()]
    .map((pressure) => {
      const subjectTypes = uniqueSocialReviewSubjectTypes(pressure.reviewedRefs.map((trace) => trace.subjectType));
      const startIndex =
        messageIndexByMessageId.get(pressure.sourceMessageId) ?? eventIndexByEventId.get(pressure.sourceMessageId) ?? -1;
      const directCausationIds = uniqueRefs([
        messageEventIdByMessageId.get(pressure.sourceMessageId) ?? pressure.sourceMessageId,
        ...pressure.reviewEventIds,
      ]);
      const allClosureEventIds =
        startIndex < 0 ? [] : formalClosureEventIdsForReview(events, startIndex, pressure.reviewedRefs);
      const formalClosureEventIds =
        startIndex < 0
          ? []
          : formalClosureEventIdsForReview(events, startIndex, pressure.reviewedRefs, new Set(directCausationIds));
      const laterFormalClosureEventIds = allClosureEventIds.filter((eventId) => !formalClosureEventIds.includes(eventId));
      const archiveCarryover = socialReviewArchiveCarryover(archiveRefsById, {
        sourceMessageId: pressure.sourceMessageId,
        reviewEventIds: pressure.reviewEventIds,
        reviewedRefs: pressure.reviewedRefs,
      });
      return {
        sourceMessageId: pressure.sourceMessageId,
        agentId: pressure.agentId,
        topicId: pressure.topicId,
        reviewEventIds: uniqueRefs(pressure.reviewEventIds),
        subjectTypes,
        reviewedRefs: pressure.reviewedRefs,
        formalClosureEventIds,
        laterFormalClosureEventIds,
        archiveCarryoverIds: archiveCarryover.archiveCarryoverIds,
        archiveCarriedReviewEventIds: archiveCarryover.archiveCarriedReviewEventIds,
        archiveCarriedReviewedRefs: archiveCarryover.archiveCarriedReviewedRefs,
        hasMixedSubjectTypes: subjectTypes.length > 1,
        hasFormalClosure: formalClosureEventIds.length > 0,
        hasLaterFormalClosure: laterFormalClosureEventIds.length > 0,
        isCarriedByArchive: archiveCarryover.archiveCarryoverIds.length > 0,
      } satisfies ScenarioSocialReviewPressureReport;
    })
    .sort((a, b) => a.sourceMessageId.localeCompare(b.sourceMessageId));
}

function socialReviewArchiveCarryover(
  archiveRefsById: ReadonlyMap<RefId, RefId[]>,
  pressure: {
    sourceMessageId: RefId;
    reviewEventIds: RefId[];
    reviewedRefs: readonly ScenarioSocialReviewTraceReport[];
  },
): {
  archiveCarryoverIds: RefId[];
  archiveCarriedReviewEventIds: RefId[];
  archiveCarriedReviewedRefs: RefId[];
} {
  const archiveCarryoverIds: RefId[] = [];
  const archiveCarriedReviewEventIds: RefId[] = [];
  const archiveCarriedReviewedRefs: RefId[] = [];
  const reviewedSubjectRefs = uniqueRefs(pressure.reviewedRefs.map((trace) => trace.subjectRef));

  for (const [archiveId, refs] of archiveRefsById.entries()) {
    const carriedReviewEvents = pressure.reviewEventIds.filter((eventId) => refs.includes(eventId));
    const carriedSubjectRefs = reviewedSubjectRefs.filter((ref) => refs.includes(ref));
    const carriesSourceMessage = refs.includes(pressure.sourceMessageId);
    if (carriesSourceMessage || carriedReviewEvents.length > 0) {
      archiveCarryoverIds.push(archiveId);
      archiveCarriedReviewEventIds.push(...carriedReviewEvents);
      archiveCarriedReviewedRefs.push(...carriedSubjectRefs);
    }
  }

  return {
    archiveCarryoverIds: uniqueRefs(archiveCarryoverIds),
    archiveCarriedReviewEventIds: uniqueRefs(archiveCarriedReviewEventIds),
    archiveCarriedReviewedRefs: uniqueRefs(archiveCarriedReviewedRefs),
  };
}

function socialReviewTraceFromEvent(
  event: RoomEvent,
  payload: Record<string, unknown>,
):
  | (ScenarioSocialReviewTraceReport & {
      agentId: AgentId;
      topicId?: TopicId;
    })
  | undefined {
  const agentId = stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? (event.actor.kind === "agent" ? event.actor.id : undefined);
  if (agentId === undefined) {
    return undefined;
  }
  const topicId = stringValue(payload.topicId) ?? stringValue(payload.topic_id);
  const response = stringValue(payload.response) ?? "reviewed";

  if (event.event_type === "memory.reviewed") {
    const subjectRef = stringValue(payload.memoryRef) ?? stringValue(payload.memory_ref);
    return subjectRef ? { subjectType: "memory", subjectRef, response, eventId: event.event_id, agentId, topicId } : undefined;
  }

  if (event.event_type === "protocol.reviewed") {
    const subjectRef = stringValue(payload.protocolRef) ?? stringValue(payload.protocol_ref);
    return subjectRef ? { subjectType: "protocol", subjectRef, response, eventId: event.event_id, agentId, topicId } : undefined;
  }

  if (event.event_type === "handoff.reviewed") {
    const subjectRef = stringValue(payload.handoffRef) ?? stringValue(payload.handoff_ref);
    return subjectRef ? { subjectType: "handoff", subjectRef, response, eventId: event.event_id, agentId, topicId } : undefined;
  }

  if (event.event_type === "persona_delta.reviewed") {
    const subjectRef = stringValue(payload.deltaRef) ?? stringValue(payload.delta_ref);
    return subjectRef ? { subjectType: "persona_delta", subjectRef, response, eventId: event.event_id, agentId, topicId } : undefined;
  }

  if (event.event_type === "topic.reviewed") {
    const subjectRef = stringValue(payload.topicProposalRef) ?? stringValue(payload.topic_proposal_ref);
    return subjectRef ? { subjectType: "topic_proposal", subjectRef, response, eventId: event.event_id, agentId, topicId } : undefined;
  }

  if (event.event_type === "open_question.responded") {
    const subjectRef = stringValue(payload.questionRef) ?? stringValue(payload.question_ref);
    return subjectRef ? { subjectType: "open_question", subjectRef, response, eventId: event.event_id, agentId, topicId } : undefined;
  }

  return undefined;
}

function formalClosureEventIdsForReview(
  events: readonly RoomEvent[],
  sourceMessageIndex: number,
  traces: readonly ScenarioSocialReviewTraceReport[],
  directCausationIds?: ReadonlySet<RefId>,
): RefId[] {
  const closureEventIds: RefId[] = [];
  for (const event of events.slice(sourceMessageIndex + 1)) {
    const payload = objectPayload(event.payload);
    if (directCausationIds !== undefined && !directCausationIds.has(event.causation_id ?? "")) {
      continue;
    }
    if (traces.some((trace) => isFormalClosureForReviewTrace(event, payload, trace))) {
      closureEventIds.push(event.event_id);
    }
  }
  return uniqueRefs(closureEventIds);
}

function isFormalClosureForReviewTrace(
  event: RoomEvent,
  payload: Record<string, unknown>,
  trace: ScenarioSocialReviewTraceReport,
): boolean {
  if (trace.subjectType === "memory") {
    return (
      ["memory.accepted", "memory.contested", "memory.stale", "memory.retired"].includes(event.event_type) &&
      refValueEquals(trace.subjectRef, payload.memoryId, payload.memory_id, payload.memoryRef, payload.memory_ref)
    );
  }

  if (trace.subjectType === "protocol") {
    return (
      ["protocol.responded", "protocol.retired", "protocol.expired"].includes(event.event_type) &&
      refValueEquals(trace.subjectRef, payload.protocolId, payload.protocol_id, payload.protocolRef, payload.protocol_ref)
    );
  }

  if (trace.subjectType === "handoff") {
    return (
      event.event_type === "handoff.responded" &&
      refValueEquals(trace.subjectRef, payload.handoffId, payload.handoff_id, payload.handoffRef, payload.handoff_ref)
    );
  }

  if (trace.subjectType === "persona_delta") {
    return (
      event.event_type === "persona_delta.responded" &&
      refValueEquals(trace.subjectRef, payload.deltaId, payload.delta_id, payload.deltaRef, payload.delta_ref)
    );
  }

  if (trace.subjectType === "topic_proposal") {
    return (
      ["topic.responded", "topic.applied"].includes(event.event_type) &&
      refValueEquals(
        trace.subjectRef,
        payload.proposalId,
        payload.proposal_id,
        payload.topicProposalRef,
        payload.topic_proposal_ref,
      )
    );
  }

  return false;
}

function refValueEquals(ref: RefId, ...values: unknown[]): boolean {
  return values.some((value) => stringValue(value) === ref);
}

function uniqueSocialReviewSubjectTypes(types: readonly ScenarioSocialReviewSubjectType[]): ScenarioSocialReviewSubjectType[] {
  return [...new Set(types)];
}

function buildProviderBoundaryRecoveryReport(events: readonly RoomEvent[]): ScenarioProviderBoundaryRecoveryReport[] {
  const byAgent = new Map<
    AgentId,
    {
      agentId: AgentId;
      boundaryRefs: RefId[];
      degradationEvents: { boundaryRef: RefId; index: number }[];
      degradationCount: number;
      firstBoundaryEventId: RefId;
      firstBoundaryIndex: number;
    }
  >();

  events.forEach((event, index) => {
    if (event.event_type !== "agent.provider_degraded") {
      return;
    }
    const payload = objectPayload(event.payload);
    const agentId = stringValue(payload.agentId) ?? stringValue(payload.agent_id);
    if (agentId === undefined) {
      return;
    }
    const boundaryRef = stringValue(payload.degradationId) ?? stringValue(payload.degradation_id) ?? event.event_id;
    const current =
      byAgent.get(agentId) ??
      ({
        agentId,
        boundaryRefs: [],
        degradationEvents: [],
        degradationCount: 0,
        firstBoundaryEventId: event.event_id,
        firstBoundaryIndex: index,
      } satisfies {
        agentId: AgentId;
        boundaryRefs: RefId[];
        degradationEvents: { boundaryRef: RefId; index: number }[];
        degradationCount: number;
        firstBoundaryEventId: RefId;
        firstBoundaryIndex: number;
      });
    current.boundaryRefs.push(boundaryRef);
    current.degradationEvents.push({ boundaryRef, index });
    current.degradationCount += 1;
    byAgent.set(agentId, current);
  });

  return [...byAgent.values()]
    .map((boundary) => {
      const laterEvents = events.slice(boundary.firstBoundaryIndex + 1);
      const laterIntentionKinds: string[] = [];
      let laterSilenceCount = 0;
      const laterSpeechEventIds: RefId[] = [];
      const retiredBoundaryRefs: RefId[] = [];
      const retirementIndexByRef = new Map<RefId, number>();
      let firstRetirementIndex = -1;

      for (const [offset, event] of laterEvents.entries()) {
        const eventIndex = boundary.firstBoundaryIndex + 1 + offset;
        const payload = objectPayload(event.payload);
        if (event.event_type === "agent.intention.recorded" || event.event_type === "agent.intention_recorded") {
          const agentId = stringValue(payload.agentId) ?? stringValue(payload.agent_id) ?? event.actor.id;
          if (agentId !== boundary.agentId) {
            continue;
          }
          const intention = objectPayload(payload.intention);
          const kind = stringValue(payload.kind) ?? stringValue(intention.kind) ?? "unknown";
          laterIntentionKinds.push(kind);
          if (kind === "stay_silent") {
            laterSilenceCount += 1;
          }
          continue;
        }

        if (event.event_type === "message.created" && payload.authorKind === "agent" && payload.author === boundary.agentId) {
          laterSpeechEventIds.push(event.event_id);
          continue;
        }

        if (event.event_type === "provider_boundary.retired") {
          const boundaryRef = stringValue(payload.providerBoundaryRef) ?? stringValue(payload.provider_boundary_ref);
          if (boundaryRef !== undefined && boundary.boundaryRefs.includes(boundaryRef)) {
            retiredBoundaryRefs.push(boundaryRef);
            if (!retirementIndexByRef.has(boundaryRef)) {
              retirementIndexByRef.set(boundaryRef, eventIndex);
            }
            if (firstRetirementIndex < 0) {
              firstRetirementIndex = eventIndex;
            }
          }
        }
      }

      const uniqueRetiredBoundaryRefs = uniqueRefs(retiredBoundaryRefs);
      const activeBoundaryRefs = boundary.boundaryRefs.filter((ref) => !uniqueRetiredBoundaryRefs.includes(ref));
      const degradationRefsAfterRetirement =
        firstRetirementIndex < 0
          ? []
          : boundary.degradationEvents
              .filter((event) => event.index > firstRetirementIndex)
              .map((event) => ({ boundaryRef: event.boundaryRef, index: event.index }));
      const wasRetiredBeforeDegradation = (event: { boundaryRef: RefId; index: number }): boolean => {
        const retirementIndex = retirementIndexByRef.get(event.boundaryRef);
        return retirementIndex !== undefined && retirementIndex < event.index;
      };
      const freshBoundaryRefsAfterRetirement = uniqueRefs(
        degradationRefsAfterRetirement
          .filter((event) => !wasRetiredBeforeDegradation(event))
          .map((event) => event.boundaryRef),
      );
      const reusedRetiredBoundaryRefsAfterRetirement = uniqueRefs(
        degradationRefsAfterRetirement
          .filter((event) => wasRetiredBeforeDegradation(event))
          .map((event) => event.boundaryRef),
      );
      const degradationIndexByRef = new Map(
        boundary.degradationEvents.map((event) => [event.boundaryRef, event.index] as const),
      );
      const pressureChoices = boundary.degradationEvents.map((event) =>
        buildProviderBoundaryPressureChoiceReport(events, event.boundaryRef, event.index),
      );
      const freshBoundaryPressureChoices = freshBoundaryRefsAfterRetirement.map((ref) =>
        buildProviderBoundaryPressureChoiceReport(events, ref, degradationIndexByRef.get(ref) ?? firstRetirementIndex),
      );

      return {
        agentId: boundary.agentId,
        boundaryRefs: boundary.boundaryRefs,
        retiredBoundaryRefs: uniqueRetiredBoundaryRefs,
        activeBoundaryRefs,
        freshBoundaryRefsAfterRetirement,
        reusedRetiredBoundaryRefsAfterRetirement,
        pressureChoices,
        freshBoundaryPressureChoices,
        degradationCount: boundary.degradationCount,
        firstBoundaryEventId: boundary.firstBoundaryEventId,
        laterIntentionKinds,
        laterSpeechEventIds,
        laterSilenceCount,
        recoveredBySpeech: laterSpeechEventIds.length > 0,
        retiredAfterRecovery: laterSpeechEventIds.length > 0 && uniqueRetiredBoundaryRefs.length > 0,
        futureOutageCreatedFreshBoundary:
          freshBoundaryRefsAfterRetirement.length > 0 && reusedRetiredBoundaryRefsAfterRetirement.length === 0,
      } satisfies ScenarioProviderBoundaryRecoveryReport;
    })
    .sort((a, b) => a.agentId.localeCompare(b.agentId));
}

function buildProviderBoundaryPressureChoiceReport(
  events: readonly RoomEvent[],
  boundaryRef: RefId,
  boundaryIndex: number,
): ScenarioProviderBoundaryPressureChoiceReport {
  const repairRequestEventIds: RefId[] = [];
  const replacementRepairRequestEventIds: RefId[] = [];
  const retryProposalEventIds: RefId[] = [];
  const silenceIntentionEventIds: RefId[] = [];
  const disagreementEventIds: RefId[] = [];
  const sideEffectApprovalEventIds: RefId[] = [];
  const sideEffectDeniedEventIds: RefId[] = [];
  const sideEffectExpiredEventIds: RefId[] = [];
  const sideEffectResultEventIds: RefId[] = [];
  const retryProtocolProposalEventIds: RefId[] = [];
  const retryRetirementEventIds: RefId[] = [];
  const providerBoundaryRetirementEventIds: RefId[] = [];
  const choiceAgentIds: AgentId[] = [];
  const repairRequestRefs: RefId[] = [];
  const decidedRepairRequestRefs = new Set<RefId>();
  const deniedRepairRequestRefs = new Set<RefId>();

  for (const event of events.slice(Math.max(boundaryIndex + 1, 0))) {
    if (!eventMentionsRef(event, boundaryRef)) {
      continue;
    }

    const payload = objectPayload(event.payload);
    const text = eventSearchText(event);
    const choiceAgentId = agentChoiceId(event, payload);
    if (choiceAgentId !== undefined) {
      choiceAgentIds.push(choiceAgentId);
    }

    const mentionsProviderRepair = /\b(repair|fix|diagnostic|provider|runtime)\b|修复|诊断|运行时/.test(text);
    if (event.event_type === "side_effect.requested" && mentionsProviderRepair) {
      repairRequestEventIds.push(event.event_id);
      const requestRef = stringValue(payload.requestId) ?? stringValue(payload.request_id) ?? event.event_id;
      repairRequestRefs.push(requestRef);
      const requestContextRefs = stringArray(payload.contextRefs).concat(stringArray(payload.context_refs));
      const referencesDeniedRequest = requestContextRefs.some((ref) => deniedRepairRequestRefs.has(ref));
      const looksLikeReplacement =
        /\b(narrower|narrow|smaller|scoped|replacement|revised|revision|new request)\b|更窄|更小|缩小|替代|修订|新请求/.test(
          text,
        );
      if (deniedRepairRequestRefs.size > 0 && (referencesDeniedRequest || looksLikeReplacement)) {
        replacementRepairRequestEventIds.push(event.event_id);
      }
    }

    if (event.event_type === "side_effect.approved") {
      sideEffectApprovalEventIds.push(event.event_id);
      const requestRef = stringValue(payload.approvalId) ?? stringValue(payload.approval_id);
      if (requestRef !== undefined) {
        decidedRepairRequestRefs.add(requestRef);
      }
    }

    if (event.event_type === "side_effect.denied") {
      sideEffectDeniedEventIds.push(event.event_id);
      const requestRef = stringValue(payload.approvalId) ?? stringValue(payload.approval_id);
      if (requestRef !== undefined) {
        decidedRepairRequestRefs.add(requestRef);
        deniedRepairRequestRefs.add(requestRef);
      }
    }

    if (event.event_type === "side_effect.expired") {
      sideEffectExpiredEventIds.push(event.event_id);
      const requestRef = stringValue(payload.approvalId) ?? stringValue(payload.approval_id);
      if (requestRef !== undefined) {
        decidedRepairRequestRefs.add(requestRef);
      }
    }

    if (event.event_type === "side_effect.result_reported") {
      sideEffectResultEventIds.push(event.event_id);
    }

    if (event.event_type === "provider_boundary.retired") {
      const payloadBoundaryRef =
        stringValue(payload.providerBoundaryRef) ?? stringValue(payload.provider_boundary_ref) ?? stringValue(payload.boundaryRef);
      if (payloadBoundaryRef === boundaryRef) {
        providerBoundaryRetirementEventIds.push(event.event_id);
      }
    }

    if (event.event_type === "agent.intention.recorded" || event.event_type === "agent.intention_recorded") {
      const intention = objectPayload(payload.intention);
      const kind = stringValue(payload.kind) ?? stringValue(intention.kind);
      if (kind === "stay_silent") {
        silenceIntentionEventIds.push(event.event_id);
      }
    }

    if (
      event.event_type === "message.created" &&
      payload.authorKind === "agent" &&
      /\b(retry|later retry|try again|ask later|wait and retry)\b|重试|再试|稍后再问|稍后再试/.test(text)
    ) {
      retryProposalEventIds.push(event.event_id);
    }

    if (event.event_type === "protocol.proposed" && /\b(retry|later retry|try again|ask later|wait and retry)\b|重试|再试|稍后再问|稍后再试/.test(text)) {
      retryProtocolProposalEventIds.push(event.event_id);
    }

    if (
      (event.event_type === "protocol.retired" ||
        (event.event_type === "protocol.responded" &&
          (stringValue(payload.status) === "retired" || stringValue(payload.response) === "retire"))) &&
      /\b(retry|later retry|try again|ask later|wait and retry)\b|重试|再试|稍后再问|稍后再试/.test(text)
    ) {
      retryRetirementEventIds.push(event.event_id);
    }

    if (
      /\b(disagree|different path|not automatic|no consensus|without consensus|should not auto|do not automatically)\b|分歧|不同意|不自动|不要自动|不能自动/.test(
        text,
      )
    ) {
      disagreementEventIds.push(event.event_id);
    }
  }

  const choiceKindCount = [
    repairRequestEventIds.length > 0,
    retryProposalEventIds.length > 0,
    silenceIntentionEventIds.length > 0,
  ].filter(Boolean).length;
  const archiveCarryoverIds = events
    .filter((event) => event.event_type === "daily_archive.created")
    .filter((event) => archiveSourceRefs(objectPayload(event.payload)).includes(boundaryRef))
    .map((event) => {
      const payload = objectPayload(event.payload);
      return stringValue(payload.archiveId) ?? stringValue(payload.archive_id) ?? event.event_id;
    });
  const uniqueChoiceAgentIds = uniqueRefs(choiceAgentIds);
  const eventIndexById = new Map(events.map((event, index) => [event.event_id, index] as const));
  const boundaryRetirementIndexes = providerBoundaryRetirementEventIds
    .map((eventId) => eventIndexById.get(eventId))
    .filter((index): index is number => index !== undefined);
  const resultIndexes = sideEffectResultEventIds
    .map((eventId) => eventIndexById.get(eventId))
    .filter((index): index is number => index !== undefined);
  const retryRetirementIndexes = retryRetirementEventIds
    .map((eventId) => eventIndexById.get(eventId))
    .filter((index): index is number => index !== undefined);
  const anyBeforeBoundaryRetirement = (indexes: readonly number[]): boolean =>
    indexes.some((index) => boundaryRetirementIndexes.length === 0 || boundaryRetirementIndexes.every((retireIndex) => retireIndex > index));

  return {
    boundaryRef,
    choiceAgentIds: uniqueChoiceAgentIds,
    archiveCarryoverIds: uniqueRefs(archiveCarryoverIds),
    repairRequestEventIds: uniqueRefs(repairRequestEventIds),
    replacementRepairRequestEventIds: uniqueRefs(replacementRepairRequestEventIds),
    retryProposalEventIds: uniqueRefs(retryProposalEventIds),
    silenceIntentionEventIds: uniqueRefs(silenceIntentionEventIds),
    disagreementEventIds: uniqueRefs(disagreementEventIds),
    sideEffectApprovalEventIds: uniqueRefs(sideEffectApprovalEventIds),
    sideEffectDeniedEventIds: uniqueRefs(sideEffectDeniedEventIds),
    sideEffectExpiredEventIds: uniqueRefs(sideEffectExpiredEventIds),
    sideEffectResultEventIds: uniqueRefs(sideEffectResultEventIds),
    retryProtocolProposalEventIds: uniqueRefs(retryProtocolProposalEventIds),
    retryRetirementEventIds: uniqueRefs(retryRetirementEventIds),
    providerBoundaryRetirementEventIds: uniqueRefs(providerBoundaryRetirementEventIds),
    hasMixedChoices: choiceKindCount >= 2,
    repairStillRequiresApproval: uniqueRefs(repairRequestRefs).some((requestRef) => !decidedRepairRequestRefs.has(requestRef)),
    repairDeniedAfterContest: repairRequestEventIds.length > 0 && sideEffectDeniedEventIds.length > 0,
    repairReplacementAfterDenial: replacementRepairRequestEventIds.length > 0,
    repairApprovedWithoutExecution: sideEffectApprovalEventIds.length > 0 && sideEffectResultEventIds.length === 0,
    repairResultReported: sideEffectResultEventIds.length > 0,
    repairResultWithoutBoundaryRetirement: anyBeforeBoundaryRetirement(resultIndexes),
    providerBoundaryRetiredAfterResult: resultIndexes.some((resultIndex) =>
      boundaryRetirementIndexes.some((retireIndex) => retireIndex > resultIndex),
    ),
    retryRetiredWithoutBoundaryRetirement: anyBeforeBoundaryRetirement(retryRetirementIndexes),
    carriedAcrossArchives: archiveCarryoverIds.length > 1,
    hasMultiAgentPressure: uniqueChoiceAgentIds.length >= 3 && choiceKindCount >= 2,
  };
}

function agentChoiceId(event: RoomEvent, payload: Record<string, unknown>): AgentId | undefined {
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
    stringValue(payload.retired_by)
  );
}

function eventMentionsRef(event: RoomEvent, ref: RefId): boolean {
  return event.refs.includes(ref) || JSON.stringify(event.payload ?? {}).includes(ref);
}

function eventSearchText(event: RoomEvent): string {
  return `${event.event_type} ${JSON.stringify(event.payload ?? {})}`.toLowerCase();
}

function archiveSourceRefs(payload: Record<string, unknown>): RefId[] {
  const nestedArchive = objectPayload(payload.archive);
  return uniqueRefs(
    stringArray(payload.sourceRefs)
      .concat(stringArray(payload.source_refs))
      .concat(stringArray(payload.provenanceRefs))
      .concat(stringArray(payload.provenance_refs))
      .concat(stringArray(payload.memoryDeltaRefs))
      .concat(sourceRefsFromArchiveEntries(payload.silences))
      .concat(sourceRefsFromArchiveEntries(payload.providerBoundaries))
      .concat(sourceRefsFromArchiveEntries(payload.archiveReviews))
      .concat(sourceRefsFromArchiveEntries(payload.sideEffectOutcomes))
      .concat(sourceRefsFromArchiveEntries(payload.side_effect_outcomes))
      .concat(archiveObjectSourceRefs(nestedArchive)),
  );
}

function sourceRefsFromArchiveEntries(value: unknown): RefId[] {
  return objectArray(value).flatMap(sourceRefsFromArchiveEntry);
}

function sourceRefsFromArchiveEntry(entry: Record<string, unknown>): RefId[] {
  return stringArray(entry.sourceRefs)
    .concat(stringArray(entry.source_refs))
    .concat(stringArray(entry.eventIds))
    .concat(stringArray(entry.event_ids))
    .concat(refFromStringValue(entry.eventId))
    .concat(refFromStringValue(entry.event_id));
}

function archiveObjectSourceRefs(archive: Record<string, unknown>): RefId[] {
  if (Object.keys(archive).length === 0) {
    return [];
  }
  return [
    "decisions",
    "disagreements",
    "openQuestions",
    "open_questions",
    "openQuestionTraces",
    "open_question_traces",
    "memoryChanges",
    "memory_changes",
    "topicProposals",
    "topic_proposals",
    "handoffs",
    "protocols",
    "invitations",
    "silences",
    "personaDeltas",
    "persona_deltas",
    "sideEffectBoundaries",
    "side_effect_boundaries",
    "workspaceBoundaries",
    "workspace_boundaries",
    "workspaceArtifacts",
    "workspace_artifacts",
    "skillCapsules",
    "skill_capsules",
    "pressureBoundaries",
    "pressure_boundaries",
    "providerBoundaries",
    "provider_boundaries",
    "memoryPressureBoundaries",
    "memory_pressure_boundaries",
    "archiveReviews",
    "archive_reviews",
    "sideEffectOutcomes",
    "side_effect_outcomes",
  ].flatMap((field) => sourceRefsFromArchiveEntriesDeep(archive[field]));
}

function sourceRefsFromArchiveEntriesDeep(value: unknown): RefId[] {
  return objectArray(value).flatMap((entry) =>
    sourceRefsFromArchiveEntry(entry)
      .concat(sourceRefsFromArchiveEntriesDeep(entry.responses))
      .concat(sourceRefsFromArchiveEntriesDeep(entry.reviews)),
  );
}

function refFromStringValue(value: unknown): RefId[] {
  const ref = stringValue(value);
  return ref === undefined ? [] : [ref];
}

function isUnresolvedCarryover(states: readonly string[]): boolean {
  if (states.length === 0) {
    return false;
  }
  const terminalStates = new Set(["applied", "retired", "rejected", "expired", "completed", "denied"]);
  if (states.some((state) => terminalStates.has(state))) {
    return false;
  }
  const unresolvedStates = new Set([
    "proposed",
    "reviewed",
    "questioned",
    "cautioned",
    "deferred",
    "challenge",
    "challenged",
    "contested",
    "stale",
    "active",
    "revised",
    "partially_accepted",
    "responded",
    "requested",
    "approved",
    "degraded",
  ]);
  return states.some((state) => unresolvedStates.has(state));
}

function openQuestionRefsForResponse(refs: RefId[]): RefId[] {
  return uniqueRefs(refs).filter(isOpenQuestionRef);
}

function isOpenQuestionRef(ref: RefId): boolean {
  return ref.startsWith("question_");
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

function openQuestionResponseKind(content: string): string {
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "responded";
}

function memoryReviewResponseKind(content: string): string {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/stale|caution|uncertain|过期|谨慎|不确定|存疑/.test(content)) return "cautioned";
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function protocolReviewResponseKind(content: string): string {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|too broad|scope|过宽|范围|谨慎|不确定|存疑/.test(content)) return "cautioned";
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function handoffReviewResponseKind(content: string): string {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问|确认/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|too broad|scope|packet|context|过宽|范围|上下文|谨慎|不确定|存疑/.test(content)) return "cautioned";
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function personaDeltaReviewResponseKind(content: string): string {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问|证据/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|thin|weak|temporary|role|identity|谨慎|不确定|存疑|太薄|临时|身份|角色/.test(content)) return "cautioned";
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function topicProposalReviewResponseKind(content: string): string {
  if (/[?？]/.test(content) || /question|ask|疑问|问题|追问|证据/.test(content)) return "questioned";
  if (/contest|contested|challenge|disagree|反对|质疑|不同意/.test(content)) return "contested";
  if (/caution|uncertain|too broad|scope|split|pause|merge|active topic|过宽|范围|拆分|暂停|合并|当前话题|谨慎|不确定|存疑/.test(content)) {
    return "cautioned";
  }
  if (/defer|later|pause|hold|稍后|搁置|暂停|先不|暂不/.test(content)) return "deferred";
  return "reviewed";
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function objectPayload(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function hasForcedSpeechMarker(event: RoomEvent): boolean {
  const payload = objectPayload(event.payload);
  return (
    payload.forced === true ||
    payload.required === true ||
    payload.mandatory === true ||
    payload.systemAssigned === true ||
    payload.system_assigned === true ||
    payload.policy === "mandatory_speech" ||
    typeof payload.forcedBy === "string" ||
    typeof payload.forced_by === "string"
  );
}

function claimsConsensus(event: RoomEvent): boolean {
  const text = JSON.stringify(event.payload ?? {}).toLowerCase();
  if (/\b(no|not|without|lack(?:s|ing)?|absence of)[\w\s-]{0,80}\bconsensus\b/.test(text)) {
    return false;
  }
  return /\b(consensus|unanimous|all agreed|settled|resolved as consensus|no disagreement)\b/.test(text);
}
