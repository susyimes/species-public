import type { AgentId, EventId, RefId, RoomEvent, TopicId } from "../types";

export type LedgerPredicate = (event: RoomEvent) => boolean;

export type LedgerAssertionResult = {
  ok: boolean;
  invariantId: string;
  message: string;
  eventIds: EventId[];
};

export type EventSelector =
  | string
  | {
      eventType: string;
      where?: LedgerPredicate;
      label?: string;
    };

export type ForcedSpeechOptions = {
  agentId?: AgentId;
  topicId?: TopicId;
  afterEventId?: EventId;
  handoffId?: RefId;
};

export type ForcedAgreementOptions = {
  topicId?: TopicId;
  archiveId?: string;
};

function pass(invariantId: string, message: string, eventIds: EventId[] = []): LedgerAssertionResult {
  return { ok: true, invariantId, message, eventIds };
}

function fail(invariantId: string, message: string, eventIds: EventId[] = []): LedgerAssertionResult {
  return { ok: false, invariantId, message, eventIds };
}

function payloadOf(event: RoomEvent): Record<string, unknown> {
  return typeof event.payload === "object" && event.payload !== null
    ? (event.payload as Record<string, unknown>)
    : {};
}

function selectorLabel(selector: EventSelector): string {
  return typeof selector === "string" ? selector : selector.label ?? selector.eventType;
}

function selectorMatches(event: RoomEvent, selector: EventSelector): boolean {
  if (typeof selector === "string") {
    return event.event_type === selector;
  }

  return event.event_type === selector.eventType && (selector.where?.(event) ?? true);
}

function eventTopicId(event: RoomEvent): string | undefined {
  const payload = payloadOf(event);
  const topicId = payload.topicId ?? payload.topic_id;
  return typeof topicId === "string" ? topicId : undefined;
}

function matchesTopic(event: RoomEvent, topicId?: TopicId): boolean {
  return topicId === undefined || eventTopicId(event) === topicId;
}

function textFrom(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(textFrom).join(" ");
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value as Record<string, unknown>).map(textFrom).join(" ");
  }

  return "";
}

function sourceRefsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function objectArrayFrom(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
  );
}

function isDisagreementEvent(event: RoomEvent): boolean {
  const payload = payloadOf(event);
  const status = payload.status;

  if (event.event_type === "memory.contested") {
    return true;
  }

  if (
    event.event_type === "handoff.responded" &&
    (status === "rejected" || status === "challenged" || status === "partially_accepted")
  ) {
    return true;
  }

  if (
    event.event_type === "topic.responded" &&
    (payload.response === "reject" || payload.response === "challenge" || status === "rejected" || status === "challenged")
  ) {
    return true;
  }

  const stance = payload.stance;
  if (stance === "disagree" || stance === "object" || stance === "contest") {
    return true;
  }

  const content = textFrom(payload.content).toLowerCase();
  return /\b(disagree|object|contest|reject|disputed|no consensus|not consensus)\b/.test(content);
}

function archiveShowsDisagreement(event: RoomEvent): boolean {
  const payload = payloadOf(event);
  const text = textFrom(payload).toLowerCase();
  const hasStructuredDisagreement =
    objectArrayFrom(payload.disagreements).length > 0 ||
    objectArrayFrom(payload.contestedItems).length > 0 ||
    objectArrayFrom(payload.rejectedHandoffs).length > 0 ||
    sourceRefsFrom(payload.openQuestions).length > 0 ||
    (Array.isArray(payload.openQuestions) && payload.openQuestions.length > 0);

  return (
    hasStructuredDisagreement ||
    /\b(disagreement|disputed|contested|objected|open question|no consensus|rejected)\b/.test(text)
  );
}

function archiveClaimsConsensus(event: RoomEvent): boolean {
  const payload = payloadOf(event);
  const text = textFrom(payload).toLowerCase();
  return /\b(consensus|unanimous|all agreed|settled|resolved as consensus|no disagreement)\b/.test(text);
}

function forcedSpeechTarget(event: RoomEvent): string | undefined {
  const payload = payloadOf(event);
  const candidates = [
    payload.agentId,
    payload.agent_id,
    payload.assignedAgentId,
    payload.assigned_agent_id,
    payload.toAgentId,
    payload.to_agent,
    payload.author,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      return candidate;
    }
  }

  return undefined;
}

function eventRefs(event: RoomEvent): string[] {
  const payload = payloadOf(event);
  const contextRefs = sourceRefsFrom(payload.contextRefs).concat(sourceRefsFrom(payload.context_refs));
  return [...event.refs, ...contextRefs];
}

function eventMatchesHandoff(event: RoomEvent, handoffId?: RefId): boolean {
  if (handoffId === undefined) {
    return true;
  }

  const payload = payloadOf(event);
  return (
    payload.handoffId === handoffId ||
    payload.handoff_id === handoffId ||
    payload.handoffRef === handoffId ||
    payload.handoff_ref === handoffId ||
    eventRefs(event).includes(handoffId)
  );
}

function payloadHasForcedSpeechMarker(payload: Record<string, unknown>): boolean {
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

function sideEffectId(event: RoomEvent): string | undefined {
  const payload = payloadOf(event);
  const request = typeof payload.request === "object" && payload.request !== null
    ? (payload.request as Record<string, unknown>)
    : {};
  const candidates = [
    payload.requestId,
    payload.request_id,
    payload.approvalId,
    payload.approval_id,
    payload.resultId,
    payload.result_id,
    payload.actionRef,
    payload.action_ref,
    payload.actionId,
    payload.action_id,
    payload.sideEffectId,
    payload.side_effect_id,
    request.requestId,
    request.request_id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      return candidate;
    }
  }

  return undefined;
}

function archiveEntryHasSourceRefs(entry: Record<string, unknown>): boolean {
  return (
    sourceRefsFrom(entry.sourceRefs).length > 0 ||
    sourceRefsFrom(entry.source_refs).length > 0 ||
    sourceRefsFrom(entry.refs).length > 0
  );
}

export function assertEventExists(
  events: readonly RoomEvent[],
  eventType: string,
  where?: LedgerPredicate,
): LedgerAssertionResult {
  const matches = events.filter((event) => event.event_type === eventType && (where?.(event) ?? true));
  if (matches.length === 0) {
    return fail("event.exists", `Expected ${eventType} to exist.`, []);
  }

  return pass(
    "event.exists",
    `Found ${matches.length} ${eventType} event(s).`,
    matches.map((event) => event.event_id),
  );
}

export function assertNoEvent(
  events: readonly RoomEvent[],
  eventType: string,
  where?: LedgerPredicate,
): LedgerAssertionResult {
  const matches = events.filter((event) => event.event_type === eventType && (where?.(event) ?? true));
  if (matches.length > 0) {
    return fail(
      "event.absent",
      `Expected no ${eventType} event, but found ${matches.length}.`,
      matches.map((event) => event.event_id),
    );
  }

  return pass("event.absent", `No ${eventType} event matched the forbidden predicate.`);
}

export function assertEventOrder(
  events: readonly RoomEvent[],
  before: EventSelector,
  after: EventSelector,
): LedgerAssertionResult {
  const beforeIndex = events.findIndex((event) => selectorMatches(event, before));
  if (beforeIndex === -1) {
    return fail("event.order", `Missing before event ${selectorLabel(before)}.`);
  }

  const afterIndex = events.findIndex((event, index) => index > beforeIndex && selectorMatches(event, after));
  if (afterIndex === -1) {
    return fail(
      "event.order",
      `Missing ${selectorLabel(after)} after ${selectorLabel(before)}.`,
      [events[beforeIndex].event_id],
    );
  }

  return pass("event.order", `${selectorLabel(before)} occurs before ${selectorLabel(after)}.`, [
    events[beforeIndex].event_id,
    events[afterIndex].event_id,
  ]);
}

export function assertNoForcedSpeech(
  events: readonly RoomEvent[],
  options: ForcedSpeechOptions = {},
): LedgerAssertionResult {
  const startIndex =
    options.afterEventId === undefined
      ? 0
      : Math.max(
          0,
          events.findIndex((event) => event.event_id === options.afterEventId) + 1,
        );

  const forcedEventTypes = new Set([
    "agent.speech_forced",
    "agent.commanded_to_speak",
    "scheduler.assigned_speaker",
    "speaker.forced",
    "handoff.assigned",
  ]);

  const violations: RoomEvent[] = [];
  for (const event of events.slice(startIndex)) {
    const payload = payloadOf(event);
    const target = forcedSpeechTarget(event);
    const targetMatches = options.agentId === undefined || target === options.agentId;

    if (!targetMatches || !matchesTopic(event, options.topicId) || !eventMatchesHandoff(event, options.handoffId)) {
      continue;
    }

    if (forcedEventTypes.has(event.event_type)) {
      violations.push(event);
      continue;
    }

    if (event.event_type === "message.created") {
      const authorKind = payload.authorKind ?? payload.author_kind;
      const systemSpokeForAgent =
        event.actor.kind === "system" && authorKind === "agent" && typeof payload.author === "string";
      if (payloadHasForcedSpeechMarker(payload) || systemSpokeForAgent) {
        violations.push(event);
      }
      continue;
    }

    if (
      (event.event_type === "agent.intention.recorded" || event.event_type === "agent.intention_recorded") &&
      (payload.kind === "speak" || payload.intention === "speak") &&
      payloadHasForcedSpeechMarker(payload)
    ) {
      violations.push(event);
    }
  }

  if (violations.length > 0) {
    return fail(
      "autonomy.no_forced_speech",
      "Found event(s) that force an agent to speak.",
      violations.map((event) => event.event_id),
    );
  }

  return pass("autonomy.no_forced_speech", "No forced speech events were found.");
}

export function assertNoForcedAgreement(
  events: readonly RoomEvent[],
  options: ForcedAgreementOptions = {},
): LedgerAssertionResult {
  const disagreements = events.filter(
    (event) => matchesTopic(event, options.topicId) && isDisagreementEvent(event),
  );

  if (disagreements.length === 0) {
    return pass("autonomy.no_forced_agreement", "No disagreement events were present.");
  }

  const archives = events.filter((event) => {
    const payload = payloadOf(event);
    return (
      event.event_type === "daily_archive.created" &&
      (options.archiveId === undefined || payload.archiveId === options.archiveId || payload.archive_id === options.archiveId)
    );
  });

  for (const archive of archives) {
    if (archiveClaimsConsensus(archive) && !archiveShowsDisagreement(archive)) {
      return fail(
        "autonomy.no_forced_agreement",
        "Archive uses consensus language while dropping visible disagreement.",
        [archive.event_id],
      );
    }

    if (!archiveShowsDisagreement(archive)) {
      return fail(
        "autonomy.no_forced_agreement",
        "Archive does not carry forward the visible disagreement.",
        [archive.event_id],
      );
    }
  }

  return pass(
    "autonomy.no_forced_agreement",
    "Visible disagreement was not rewritten as consensus.",
    disagreements.map((event) => event.event_id),
  );
}

export function assertSideEffectHasApproval(
  events: readonly RoomEvent[],
  actionRef: RefId,
): LedgerAssertionResult {
  const matchesAction = (event: RoomEvent): boolean => sideEffectId(event) === actionRef;

  const requestIndex = events.findIndex(
    (event) => event.event_type === "side_effect.requested" && matchesAction(event),
  );
  if (requestIndex === -1) {
    return fail("boundary.side_effect_approval", `No side-effect request found for ${actionRef}.`);
  }

  const approvalIndex = events.findIndex(
    (event, index) => index > requestIndex && event.event_type === "side_effect.approved" && matchesAction(event),
  );
  if (approvalIndex === -1) {
    return fail(
      "boundary.side_effect_approval",
      `Side effect ${actionRef} has no approval event.`,
      [events[requestIndex].event_id],
    );
  }

  const earlyCompletion = events.find(
    (event, index) =>
      index > requestIndex &&
      index < approvalIndex &&
      (event.event_type === "side_effect.completed" || event.event_type === "action.completed") &&
      matchesAction(event),
  );
  if (earlyCompletion !== undefined) {
    return fail(
      "boundary.side_effect_approval",
      `Side effect ${actionRef} completed before approval.`,
      [events[requestIndex].event_id, earlyCompletion.event_id, events[approvalIndex].event_id],
    );
  }

  return pass("boundary.side_effect_approval", `Side effect ${actionRef} has prior approval.`, [
    events[requestIndex].event_id,
    events[approvalIndex].event_id,
  ]);
}

export function assertArchiveHasSourceRefs(
  events: readonly RoomEvent[],
  archiveId?: string,
): LedgerAssertionResult {
  const archives = events.filter((event) => {
    const payload = payloadOf(event);
    return (
      event.event_type === "daily_archive.created" &&
      (archiveId === undefined || payload.archiveId === archiveId || payload.archive_id === archiveId)
    );
  });

  if (archives.length === 0) {
    return fail("archive.source_refs", "No daily archive event was found.");
  }

  const violations: RoomEvent[] = [];
  for (const archive of archives) {
    const payload = payloadOf(archive);
    const topLevelRefs = [
      ...archive.refs,
      ...sourceRefsFrom(payload.sourceRefs),
      ...sourceRefsFrom(payload.source_refs),
    ];

    const structuredEntries = [
      ...objectArrayFrom(payload.disagreements),
      ...objectArrayFrom(payload.decisions),
      ...objectArrayFrom(payload.openQuestions),
      ...objectArrayFrom(payload.open_questions),
      ...objectArrayFrom(payload.contestedItems),
      ...objectArrayFrom(payload.contested_items),
      ...objectArrayFrom(payload.rejectedHandoffs),
      ...objectArrayFrom(payload.rejected_handoffs),
      ...objectArrayFrom(payload.sideEffectOutcomes),
      ...objectArrayFrom(payload.side_effect_outcomes),
    ];

    const structuredRefsOk = structuredEntries.every(archiveEntryHasSourceRefs);
    if (topLevelRefs.length === 0 || !structuredRefsOk) {
      violations.push(archive);
    }
  }

  if (violations.length > 0) {
    return fail(
      "archive.source_refs",
      "Archive event(s) are missing source refs.",
      violations.map((event) => event.event_id),
    );
  }

  return pass(
    "archive.source_refs",
    "Archive event(s) include source refs.",
    archives.map((event) => event.event_id),
  );
}
