import type { AppendCommand, InvariantResult, RoomEvent } from "../types";

export type ConstitutionCheckInput<TPayload = unknown> = {
  command: AppendCommand<TPayload>;
  existingEvents: readonly RoomEvent[];
};

export type ConstitutionInvariant = <TPayload>(
  input: ConstitutionCheckInput<TPayload>,
) => InvariantResult | InvariantResult[];

export const defaultConstitutionInvariants: ConstitutionInvariant[] = [
  noForcedSpeech,
  silenceIsValid,
  noActiveAgentOwner,
  memoryCommitGate,
  sideEffectsRequireApproval,
  appendOnlyRuntime,
];

export function checkConstitution<TPayload>(
  input: ConstitutionCheckInput<TPayload>,
  invariants: readonly ConstitutionInvariant[] = defaultConstitutionInvariants,
): InvariantResult[] {
  return invariants.flatMap((invariant) => invariant(input));
}

export function hasBlockingInvariant(results: readonly InvariantResult[]): boolean {
  return results.some((result) => !result.ok && result.severity === "error");
}

function pass(invariantId: string, message: string): InvariantResult {
  return { ok: true, invariantId, severity: "error", message };
}

function fail(invariantId: string, message: string, suggestedEventType?: string): InvariantResult {
  return { ok: false, invariantId, severity: "error", message, suggestedEventType };
}

function noForcedSpeech<TPayload>({ command }: ConstitutionCheckInput<TPayload>): InvariantResult {
  const payload = asRecord(command.payload);
  const intention = asRecord(payload.intention);
  const forcedEventTypes = new Set([
    "agent.speech_forced",
    "agent.commanded_to_speak",
    "scheduler.assigned_speaker",
    "speaker.forced",
    "handoff.assigned",
  ]);

  if (forcedEventTypes.has(command.eventType)) {
    return fail(
      "constitution.no_forced_speech",
      "The system may invite agents, but it may not append events that force a specific agent to speak.",
    );
  }

  if (hasForcedMarker(payload) || hasForcedMarker(intention)) {
    return fail(
      "constitution.no_forced_speech",
      "Forced or mandatory speech markers are not allowed in room events.",
    );
  }

  if (
    command.eventType === "message.created" &&
    command.actor.kind === "system" &&
    (payload.authorKind === "agent" || payload.author_kind === "agent")
  ) {
    return fail(
      "constitution.no_forced_speech",
      "A system event cannot create visible speech on behalf of an agent.",
    );
  }

  return pass("constitution.no_forced_speech", "No forced speech marker found.");
}

function silenceIsValid<TPayload>({ command }: ConstitutionCheckInput<TPayload>): InvariantResult {
  const payload = asRecord(command.payload);
  const intention = asRecord(payload.intention);
  const kind = payload.kind ?? payload.intention ?? intention.kind;

  if (kind === "stay_silent") {
    return pass("constitution.silence_is_valid", "stay_silent is a valid social intention.");
  }

  return pass("constitution.silence_is_valid", "Event does not invalidate silence.");
}

function noActiveAgentOwner<TPayload>({ command }: ConstitutionCheckInput<TPayload>): InvariantResult {
  const payload = asRecord(command.payload);
  const lowerEventType = command.eventType.toLowerCase();

  if (
    lowerEventType === "room.active_agent_set" ||
    lowerEventType === "scheduler.active_agent_set" ||
    lowerEventType === "active_agent.assigned"
  ) {
    return fail(
      "constitution.no_active_agent_owner",
      "The room cannot create a durable central active_agent owner.",
    );
  }

  if (
    hasOwn(payload, "active_agent") ||
    hasOwn(payload, "activeAgent") ||
    hasOwn(payload, "current_step") ||
    hasOwn(payload, "currentStep")
  ) {
    return fail(
      "constitution.no_active_agent_owner",
      "Room state may not encode active_agent/current_step control ownership.",
    );
  }

  return pass("constitution.no_active_agent_owner", "No central active agent owner found.");
}

function sideEffectsRequireApproval<TPayload>({
  command,
  existingEvents,
}: ConstitutionCheckInput<TPayload>): InvariantResult {
  if (!isSideEffectExecutionEvent(command.eventType)) {
    return pass("constitution.side_effects_require_approval", "Event does not execute an external side effect.");
  }

  const payload = asRecord(command.payload);
  const approvalRef = firstString(
    payload.approvalId,
    payload.approval_id,
    payload.grantId,
    payload.grant_id,
    payload.requestId,
    payload.request_id,
    ...((command.refs ?? []) as unknown[]),
  );

  if (!approvalRef) {
    return fail(
      "constitution.side_effects_require_approval",
      "Side-effect execution requires a prior approval reference.",
      "side_effect.approved",
    );
  }

  const approved = existingEvents.some((event) => {
    if (event.room_id !== command.roomId || event.event_type !== "side_effect.approved") {
      return false;
    }
    const approvedPayload = asRecord(event.payload);
    return (
      approvedPayload.approvalId === approvalRef ||
      approvedPayload.approval_id === approvalRef ||
      approvedPayload.grantId === approvalRef ||
      approvedPayload.grant_id === approvalRef ||
      approvedPayload.requestId === approvalRef ||
      approvedPayload.request_id === approvalRef ||
      event.refs.includes(approvalRef)
    );
  });

  if (!approved) {
    return fail(
      "constitution.side_effects_require_approval",
      `Side-effect execution for ${approvalRef} has no prior approval event.`,
      "side_effect.approved",
    );
  }

  return pass("constitution.side_effects_require_approval", "Side effect has a prior approval event.");
}

function memoryCommitGate<TPayload>({
  command,
  existingEvents,
}: ConstitutionCheckInput<TPayload>): InvariantResult {
  if (command.eventType !== "memory.accepted") {
    return pass("constitution.memory_commit_gate", "Event does not commit accepted memory.");
  }

  const payload = asRecord(command.payload);
  const memoryId = firstString(payload.memoryId, payload.memory_id, payload.memoryRef, payload.memory_ref);
  if (!memoryId) {
    return fail(
      "constitution.memory_commit_gate",
      "Accepted memory requires a memoryId or memoryRef.",
      "memory.proposed",
    );
  }

  const proposed = existingEvents.some((event) => {
    if (event.room_id !== command.roomId || event.event_type !== "memory.proposed") {
      return false;
    }
    const proposedPayload = asRecord(event.payload);
    return (
      proposedPayload.memoryId === memoryId ||
      proposedPayload.memory_id === memoryId ||
      proposedPayload.memoryRef === memoryId ||
      proposedPayload.memory_ref === memoryId
    );
  });

  if (!proposed) {
    return fail(
      "constitution.memory_commit_gate",
      `Accepted memory ${memoryId} requires a prior memory.proposed event.`,
      "memory.proposed",
    );
  }

  const reviewRefs = memoryReviewRefs(payload).filter((ref) => ref !== memoryId);
  if (reviewRefs.length === 0) {
    return fail(
      "constitution.memory_commit_gate",
      `Accepted memory ${memoryId} requires evidence, review, source, or context refs beyond the memory id.`,
      "memory.accepted",
    );
  }

  return pass("constitution.memory_commit_gate", "Accepted memory passed proposal and review-ref gate.");
}

function appendOnlyRuntime<TPayload>({ command }: ConstitutionCheckInput<TPayload>): InvariantResult {
  const forbiddenEventTypes = new Set([
    "ledger.event_updated",
    "ledger.event_deleted",
    "ledger.rewrite_requested",
    "event.updated",
    "event.deleted",
  ]);

  if (forbiddenEventTypes.has(command.eventType)) {
    return fail(
      "constitution.append_only",
      "Canonical room history is append-only; corrections must be appended as new events.",
    );
  }

  return pass("constitution.append_only", "Append-only runtime path preserved.");
}

function isSideEffectExecutionEvent(eventType: string): boolean {
  return (
    eventType === "side_effect.executed" ||
    eventType === "side_effect.result_reported" ||
    eventType === "action.started" ||
    eventType === "action.completed" ||
    eventType === "action.failed"
  );
}

function hasForcedMarker(payload: Record<string, unknown>): boolean {
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function memoryReviewRefs(payload: Record<string, unknown>): string[] {
  return uniqueStrings(
    arrayOfStrings(payload.contextRefs)
      .concat(arrayOfStrings(payload.context_refs))
      .concat(arrayOfStrings(payload.evidenceRefs))
      .concat(arrayOfStrings(payload.evidence_refs))
      .concat(arrayOfStrings(payload.reviewRefs))
      .concat(arrayOfStrings(payload.review_refs))
      .concat(arrayOfStrings(payload.sourceRefs))
      .concat(arrayOfStrings(payload.source_refs)),
  );
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
