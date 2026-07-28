import { AgentId, MemoryClaim, MemoryState, Projection, RefId, RoomEvent, RoomId } from "../types";

export type MemoryTransition = {
  transitionId: string;
  memoryId: string;
  fromState?: MemoryState;
  toState: MemoryState;
  eventType: string;
  actor: string;
  reason?: string;
  evidenceRefs: RefId[];
  createdAt: string;
};

export type MemoryClaimRecord = MemoryClaim & {
  kind?: string;
  acceptedRefs: RefId[];
  staleRefs: RefId[];
  retiredRefs: RefId[];
  reviewRefs: RefId[];
  transitions: MemoryTransition[];
  confidenceNote?: string;
};

export type MemoryClaimView = {
  claims: MemoryClaimRecord[];
  transitions: MemoryTransition[];
};

export type MemoryContextOptions = {
  topicId?: string;
  relevantRefs?: RefId[];
  includeProposed?: boolean;
  includeObserved?: boolean;
};

const MEMORY_STATES: MemoryState[] = [
  "observed",
  "proposed",
  "contested",
  "accepted",
  "stale",
  "retired",
];

const ALLOWED_TRANSITIONS: Record<MemoryState, MemoryState[]> = {
  observed: ["proposed", "retired"],
  proposed: ["accepted", "contested", "retired"],
  contested: ["accepted", "proposed", "stale", "retired"],
  accepted: ["contested", "stale", "retired"],
  stale: ["contested", "accepted", "retired"],
  retired: ["proposed"],
};

export class MemoryClaimStore implements Projection<MemoryClaimView> {
  private readonly claims = new Map<string, MemoryClaimRecord>();

  static fromEvents(events: RoomEvent[]): MemoryClaimStore {
    const store = new MemoryClaimStore();
    for (const event of events) store.apply(event);
    return store;
  }

  apply(event: RoomEvent): void {
    const nextState = memoryStateFromEvent(event.event_type);
    if (!nextState) return;

    const payload = objectPayload(event.payload);
    const memoryId =
      stringValue(payload.memoryId) ??
      stringValue(payload.memory_id) ??
      stringValue(payload.memoryRef) ??
      stringValue(payload.memory_ref);
    if (!memoryId) return;

    const existing = this.claims.get(memoryId);
    if (existing && existing.state !== nextState && !transitionAllowed(existing.state, nextState)) {
      throw new Error(`Invalid memory transition for ${memoryId}: ${existing.state} -> ${nextState}`);
    }

    const evidenceRefs = refsFromPayload(payload, event.refs);
    const claim = existing ?? createClaim(event, memoryId, nextState, evidenceRefs);
    const previousState = existing?.state;
    const transition: MemoryTransition = {
      transitionId: `${event.event_id}:${memoryId}:${nextState}`,
      memoryId,
      fromState: previousState,
      toState: nextState,
      eventType: event.event_type,
      actor: actorIdFromEvent(event),
      reason: stringValue(payload.reason),
      evidenceRefs,
      createdAt: event.occurred_at,
    };

    claim.state = nextState;
    claim.summary = stringValue(payload.summary) ?? claim.summary;
    claim.kind = stringValue(payload.kind) ?? claim.kind;
    claim.confidenceNote = stringValue(payload.confidenceNote) ?? stringValue(payload.confidence_note) ?? claim.confidenceNote;
    claim.revisedFromMemoryRef =
      stringValue(payload.revisedFromMemoryRef) ?? stringValue(payload.revised_from_memory_ref) ?? claim.revisedFromMemoryRef;
    claim.revisedBy = stringValue(payload.revisedBy) ?? stringValue(payload.revised_by) ?? claim.revisedBy;
    claim.lastReviewedAt = event.occurred_at;
    claim.sourceRefs = unique(claim.sourceRefs.concat(sourceRefsFromPayload(payload, evidenceRefs)));
    claim.sourcePressureRefs = unique(claim.sourcePressureRefs.concat(pressureRefsFromPayload(payload, event.refs)));
    claim.reviewRefs = unique(claim.reviewRefs.concat(reviewRefsFromPayload(payload, event.event_id)));
    claim.transitions.push(transition);

    if (nextState === "proposed") {
      claim.proposedBy = stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by) ?? event.actor.id;
    }

    if (nextState === "contested") {
      const contestedBy = stringValue(payload.contestedBy) ?? stringValue(payload.contested_by) ?? event.actor.id;
      claim.contestedBy = unique(claim.contestedBy.concat(contestedBy));
      claim.contestRefs = unique(claim.contestRefs.concat(contestRefsFromPayload(payload, evidenceRefs)));
    }

    if (nextState === "accepted") {
      claim.acceptedRefs = unique(claim.acceptedRefs.concat(evidenceRefs.length > 0 ? evidenceRefs : [event.event_id]));
    }

    if (nextState === "stale") {
      claim.staleRefs = unique(claim.staleRefs.concat(evidenceRefs.length > 0 ? evidenceRefs : [event.event_id]));
    }

    if (nextState === "retired") {
      claim.retiredRefs = unique(claim.retiredRefs.concat(evidenceRefs.length > 0 ? evidenceRefs : [event.event_id]));
    }

    this.claims.set(memoryId, claim);
  }

  get(memoryId: string): MemoryClaimRecord | undefined {
    const claim = this.claims.get(memoryId);
    return claim ? cloneClaim(claim) : undefined;
  }

  getContextMemoryRefs(options: MemoryContextOptions = {}): RefId[] {
    const relevantRefs = new Set(options.relevantRefs ?? []);
    const refs: RefId[] = [];
    const claims = [...this.claims.values()].sort((a, b) => a.memoryId.localeCompare(b.memoryId));

    for (const claim of claims) {
      if (claim.state === "accepted" || claim.state === "contested") {
        refs.push(claim.memoryId);
        continue;
      }
      if (claim.state === "stale" && relevantRefs.has(claim.memoryId)) {
        refs.push(claim.memoryId);
        continue;
      }
      if (claim.state === "proposed" && options.includeProposed && relevantRefs.has(claim.memoryId)) {
        refs.push(claim.memoryId);
        continue;
      }
      if (claim.state === "observed" && options.includeObserved && relevantRefs.has(claim.memoryId)) {
        refs.push(claim.memoryId);
      }
    }

    return refs;
  }

  transitions(): MemoryTransition[] {
    return this.view().transitions;
  }

  view(): MemoryClaimView {
    const claims = [...this.claims.values()].map(cloneClaim).sort((a, b) => a.memoryId.localeCompare(b.memoryId));
    return {
      claims,
      transitions: claims.flatMap((claim) => claim.transitions),
    };
  }
}

export function isMemoryState(value: string): value is MemoryState {
  return MEMORY_STATES.includes(value as MemoryState);
}

export function transitionAllowed(fromState: MemoryState, toState: MemoryState): boolean {
  return fromState === toState || ALLOWED_TRANSITIONS[fromState].includes(toState);
}

function createClaim(
  event: RoomEvent,
  memoryId: string,
  state: MemoryState,
  evidenceRefs: RefId[],
): MemoryClaimRecord {
  const payload = objectPayload(event.payload);
  return {
    memoryId,
    roomId: event.room_id,
    state,
    kind: stringValue(payload.kind),
    summary: stringValue(payload.summary) ?? "",
    sourceRefs: sourceRefsFromPayload(payload, evidenceRefs),
    sourcePressureRefs: pressureRefsFromPayload(payload, event.refs),
    proposedBy: state === "proposed" ? stringValue(payload.proposedBy) ?? stringValue(payload.proposed_by) ?? event.actor.id : undefined,
    revisedFromMemoryRef: stringValue(payload.revisedFromMemoryRef) ?? stringValue(payload.revised_from_memory_ref),
    revisedBy: stringValue(payload.revisedBy) ?? stringValue(payload.revised_by),
    contestedBy: [],
    contestRefs: [],
    acceptedRefs: [],
    staleRefs: [],
    retiredRefs: [],
    reviewRefs: reviewRefsFromPayload(payload, event.event_id),
    transitions: [],
    confidenceNote: stringValue(payload.confidenceNote) ?? stringValue(payload.confidence_note),
    lastReviewedAt: event.occurred_at,
  };
}

function cloneClaim(claim: MemoryClaimRecord): MemoryClaimRecord {
  return {
    ...claim,
    sourceRefs: [...claim.sourceRefs],
    sourcePressureRefs: [...claim.sourcePressureRefs],
    contestedBy: [...claim.contestedBy],
    contestRefs: [...claim.contestRefs],
    acceptedRefs: [...claim.acceptedRefs],
    staleRefs: [...claim.staleRefs],
    retiredRefs: [...claim.retiredRefs],
    reviewRefs: [...claim.reviewRefs],
    transitions: claim.transitions.map((transition) => ({
      ...transition,
      evidenceRefs: [...transition.evidenceRefs],
    })),
  };
}

function memoryStateFromEvent(eventType: string): MemoryState | undefined {
  const maybeState = eventType.replace("memory.", "");
  return isMemoryState(maybeState) ? maybeState : undefined;
}

function actorIdFromEvent(event: RoomEvent): AgentId | string {
  return event.actor.id;
}

function sourceRefsFromPayload(payload: Record<string, unknown>, fallback: RefId[]): RefId[] {
  const sourceRefs = arrayOfStrings(payload.sourceRefs).concat(arrayOfStrings(payload.source_refs));
  return unique(sourceRefs.length > 0 ? sourceRefs : fallback);
}

function contestRefsFromPayload(payload: Record<string, unknown>, fallback: RefId[]): RefId[] {
  const contestRefs = arrayOfStrings(payload.contestRefs)
    .concat(arrayOfStrings(payload.contest_refs))
    .concat(arrayOfStrings(payload.evidenceRefs))
    .concat(arrayOfStrings(payload.evidence_refs))
    .concat(arrayOfStrings(payload.contextRefs))
    .concat(arrayOfStrings(payload.context_refs));
  return unique(contestRefs.length > 0 ? contestRefs : fallback);
}

function reviewRefsFromPayload(payload: Record<string, unknown>, eventId: string): RefId[] {
  const reviewRefs = arrayOfStrings(payload.reviewRefs).concat(arrayOfStrings(payload.review_refs));
  return unique(reviewRefs.length > 0 ? reviewRefs : [eventId]);
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
      .concat(arrayOfStrings(payload.evidence_refs)),
  ).filter((ref): ref is RefId => typeof ref === "string" && ref.length > 0);
}

function pressureRefsFromPayload(payload: Record<string, unknown>, envelopeRefs: RefId[]): RefId[] {
  return refsFromPayload(payload, envelopeRefs).filter((ref) => ref.startsWith("mixed_review:"));
}

function objectPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
