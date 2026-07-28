import type {
  AgentId,
  EventActor,
  EventId,
  HandoffStatus,
  ProtocolStatus,
  RefId,
  RoomEvent,
  RoomId,
  TopicId,
} from "../types";

export type SocialAppendCommand<TPayload> = {
  roomId: RoomId;
  eventType: string;
  actor: EventActor;
  payload: TPayload;
  refs?: RefId[];
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
  occurredAt?: string;
  payloadSchema?: string;
};

export type SocialEventAppender = {
  append<TPayload>(command: SocialAppendCommand<TPayload>): Promise<RoomEvent<TPayload>>;
};

export type HandoffResponseKind =
  | "accept"
  | "reject"
  | "partially_accept"
  | "delegate_to_other"
  | "challenge_handoff";

export type HandoffAcceptedScope = {
  contextRefs?: RefId[];
  requestedResponse?: string;
};

export type HandoffProposal = {
  handoffId: string;
  roomId: RoomId;
  topicId: TopicId;
  fromAgent: AgentId;
  toAgent: AgentId;
  reason: string;
  requestedResponse: string;
  contextRefs: RefId[];
  returnTo?: AgentId;
  status: HandoffStatus;
  createdAt: string;
  expiresAt?: string;
};

export type HandoffResponse = {
  responseId: string;
  handoffId: string;
  agentId: AgentId;
  response: HandoffResponseKind;
  reason: string;
  acceptedScope?: HandoffAcceptedScope;
  redirectTo?: AgentId;
  challengeRefs: RefId[];
  createdAt: string;
  createsForcedMessage: false;
};

export type HandoffProjection = {
  proposal: HandoffProposal;
  responses: HandoffResponse[];
  status: HandoffStatus;
  activeContextRef: RefId | null;
};

export type HandoffProposalInput = {
  roomId: RoomId;
  topicId: TopicId;
  fromAgent: AgentId;
  toAgent: AgentId;
  reason: string;
  requestedResponse?: string;
  contextRefs: RefId[];
  returnTo?: AgentId;
  expiresAt?: string;
  actor?: EventActor;
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
};

export type HandoffResponseInput = {
  handoffId: string;
  agentId: AgentId;
  response: HandoffResponseKind;
  reason: string;
  acceptedScope?: HandoffAcceptedScope;
  redirectTo?: AgentId;
  challengeRefs?: RefId[];
  actor?: EventActor;
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
};

export type ProtocolScopeType =
  | "room"
  | "topic"
  | "topic_group"
  | "agent_pair"
  | "time_window"
  | "single_round";

export type ProtocolScope = {
  type: ProtocolScopeType;
  topicIds?: TopicId[];
  agentIds?: AgentId[];
  roomId?: RoomId;
};

export type ProtocolResponseKind = "accept" | "reject" | "challenge" | "revise";

export type ProtocolProposal = {
  protocolId: string;
  roomId: RoomId;
  proposedBy: AgentId;
  topicId?: TopicId;
  kind: string;
  summary: string;
  body: Record<string, unknown>;
  scope: ProtocolScope;
  status: ProtocolStatus;
  createdAt: string;
  expiresAt?: string;
};

export type ProtocolResponse = {
  responseId: string;
  protocolId: string;
  agentId: AgentId;
  response: ProtocolResponseKind;
  reason: string;
  proposedRevision?: Record<string, unknown>;
  createdAt: string;
};

export type ProtocolProjection = {
  proposal: ProtocolProposal;
  responses: ProtocolResponse[];
  status: ProtocolStatus;
  contextRef: RefId;
  hiddenSchedulerRule: false;
};

export type ProtocolProposalInput = {
  roomId: RoomId;
  proposedBy: AgentId;
  topicId?: TopicId;
  kind: string;
  summary: string;
  body?: Record<string, unknown>;
  scope: ProtocolScope;
  expiresAt?: string;
  actor?: EventActor;
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
};

export type ProtocolResponseInput = {
  protocolId: string;
  agentId: AgentId;
  response: ProtocolResponseKind;
  reason: string;
  proposedRevision?: Record<string, unknown>;
  actor?: EventActor;
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
};

export type ProtocolRetireInput = {
  protocolId: string;
  retiredBy: AgentId;
  reason: string;
  actor?: EventActor;
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
};

export type ProtocolScopeQuery = {
  roomId: RoomId;
  topicId?: TopicId;
  agentId?: AgentId;
  at?: string;
};

type Clock = () => string;

const defaultSystemActor: EventActor = { kind: "system", id: "social_service" };

class IdSequence {
  private counters = new Map<string, number>();

  next(prefix: string): string {
    const nextValue = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, nextValue);
    return `${prefix}_${String(nextValue).padStart(4, "0")}`;
  }
}

export class InMemorySocialEventAppender implements SocialEventAppender {
  private readonly events: RoomEvent[] = [];
  private sequence = 0;

  async append<TPayload>(command: SocialAppendCommand<TPayload>): Promise<RoomEvent<TPayload>> {
    const previous = this.events.at(-1) ?? null;
    const event: RoomEvent<TPayload> = {
      event_id: `evt_social_${String(++this.sequence).padStart(4, "0")}`,
      room_id: command.roomId,
      event_type: command.eventType,
      schema_version: "1",
      payload_schema: command.payloadSchema ?? `${command.eventType}.v1`,
      occurred_at: command.occurredAt ?? new Date().toISOString(),
      appended_at: new Date().toISOString(),
      actor: command.actor,
      causation_id: command.causationId ?? null,
      correlation_id: command.correlationId ?? `corr_social_${this.sequence}`,
      idempotency_key: command.idempotencyKey ?? `idem_social_${this.sequence}`,
      refs: command.refs ?? [],
      payload: command.payload,
      prev_event_id: previous?.event_id ?? null,
      prev_event_hash: previous?.event_hash ?? null,
      event_hash: `hash_social_${this.sequence}`,
    };
    this.events.push(event);
    return event;
  }

  allEvents(): RoomEvent[] {
    return this.events.map((event) => clone(event));
  }
}

export class HandoffService {
  private readonly appender: SocialEventAppender;
  private readonly now: Clock;
  private readonly ids = new IdSequence();
  private readonly handoffs = new Map<string, HandoffProjection>();

  constructor(options: { appender?: SocialEventAppender; now?: Clock; events?: RoomEvent[] } = {}) {
    this.appender = options.appender ?? new InMemorySocialEventAppender();
    this.now = options.now ?? (() => new Date().toISOString());
    for (const event of options.events ?? []) {
      this.apply(event);
    }
  }

  async propose(input: HandoffProposalInput): Promise<HandoffProjection> {
    requireText(input.roomId, "roomId");
    requireText(input.topicId, "topicId");
    requireText(input.fromAgent, "fromAgent");
    requireText(input.toAgent, "toAgent");
    requireText(input.reason, "reason");
    requireRefs(input.contextRefs, "contextRefs");

    const proposal: HandoffProposal = {
      handoffId: this.ids.next("handoff"),
      roomId: input.roomId,
      topicId: input.topicId,
      fromAgent: input.fromAgent,
      toAgent: input.toAgent,
      reason: input.reason,
      requestedResponse: input.requestedResponse ?? "respond in the normal room turn",
      contextRefs: uniqueRefs(input.contextRefs),
      returnTo: input.returnTo,
      status: "proposed",
      createdAt: this.now(),
      expiresAt: input.expiresAt,
    };

    const event = await this.appender.append({
      roomId: proposal.roomId,
      eventType: "handoff.proposed",
      actor: input.actor ?? { kind: "agent", id: input.fromAgent },
      payload: proposal,
      refs: proposal.contextRefs,
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? proposal.handoffId,
    });
    this.apply(event);
    return requireProjection(this.handoffs, proposal.handoffId, "handoff");
  }

  async respond(input: HandoffResponseInput): Promise<HandoffProjection> {
    const projection = requireProjection(this.handoffs, input.handoffId, "handoff");
    requireText(input.agentId, "agentId");
    requireText(input.reason, "reason");
    if (input.response === "delegate_to_other") {
      requireText(input.redirectTo, "redirectTo");
    }
    if (input.response === "partially_accept" && !input.acceptedScope) {
      throw new Error("acceptedScope is required for partially_accept");
    }

    const response: HandoffResponse = {
      responseId: this.ids.next("handoff_response"),
      handoffId: input.handoffId,
      agentId: input.agentId,
      response: input.response,
      reason: input.reason,
      acceptedScope: input.acceptedScope
        ? {
            contextRefs: input.acceptedScope.contextRefs ? uniqueRefs(input.acceptedScope.contextRefs) : undefined,
            requestedResponse: input.acceptedScope.requestedResponse,
          }
        : undefined,
      redirectTo: input.redirectTo,
      challengeRefs: uniqueRefs(input.challengeRefs ?? []),
      createdAt: this.now(),
      createsForcedMessage: false,
    };

    const event = await this.appender.append({
      roomId: projection.proposal.roomId,
      eventType: "handoff.responded",
      actor: input.actor ?? { kind: "agent", id: input.agentId },
      payload: response,
      refs: uniqueRefs([projection.proposal.handoffId, ...response.challengeRefs]),
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? response.responseId,
    });
    this.apply(event);
    return requireProjection(this.handoffs, input.handoffId, "handoff");
  }

  getActiveForTopic(topicId: TopicId, at: string = this.now()): HandoffProjection[] {
    return [...this.handoffs.values()]
      .filter((projection) => projection.proposal.topicId === topicId)
      .filter((projection) => isActiveHandoffStatus(projection.status))
      .filter((projection) => !isExpired(projection.proposal.expiresAt, at))
      .map((projection) => clone(projection));
  }

  get(handoffId: string): HandoffProjection | undefined {
    const projection = this.handoffs.get(handoffId);
    return projection ? clone(projection) : undefined;
  }

  view(): HandoffProjection[] {
    return [...this.handoffs.values()].map((projection) => clone(projection));
  }

  apply(event: RoomEvent): void {
    if (event.event_type === "handoff.proposed") {
      const proposal = event.payload as HandoffProposal;
      this.handoffs.set(proposal.handoffId, {
        proposal: clone(proposal),
        responses: [],
        status: proposal.status,
        activeContextRef: proposal.handoffId,
      });
      return;
    }

    if (event.event_type === "handoff.responded") {
      const response = event.payload as HandoffResponse;
      const projection = requireProjection(this.handoffs, response.handoffId, "handoff");
      const status = handoffStatusFromResponse(response.response);
      projection.responses.push(clone(response));
      projection.status = status;
      projection.proposal.status = status;
      projection.activeContextRef = isActiveHandoffStatus(status) ? projection.proposal.handoffId : null;
    }
  }
}

export class ProtocolService {
  private readonly appender: SocialEventAppender;
  private readonly now: Clock;
  private readonly ids = new IdSequence();
  private readonly protocols = new Map<string, ProtocolProjection>();

  constructor(options: { appender?: SocialEventAppender; now?: Clock; events?: RoomEvent[] } = {}) {
    this.appender = options.appender ?? new InMemorySocialEventAppender();
    this.now = options.now ?? (() => new Date().toISOString());
    for (const event of options.events ?? []) {
      this.apply(event);
    }
  }

  async propose(input: ProtocolProposalInput): Promise<ProtocolProjection> {
    requireText(input.roomId, "roomId");
    requireText(input.proposedBy, "proposedBy");
    requireText(input.kind, "kind");
    requireText(input.summary, "summary");
    validateProtocolScope(input.scope);

    const proposal: ProtocolProposal = {
      protocolId: this.ids.next("protocol"),
      roomId: input.roomId,
      proposedBy: input.proposedBy,
      topicId: input.topicId,
      kind: input.kind,
      summary: input.summary,
      body: input.body ?? {},
      scope: clone(input.scope),
      status: "proposed",
      createdAt: this.now(),
      expiresAt: input.expiresAt,
    };

    const refs = uniqueRefs([...(proposal.scope.topicIds ?? []), ...(proposal.scope.agentIds ?? [])]);
    const event = await this.appender.append({
      roomId: proposal.roomId,
      eventType: "protocol.proposed",
      actor: input.actor ?? { kind: "agent", id: input.proposedBy },
      payload: proposal,
      refs,
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? proposal.protocolId,
    });
    this.apply(event);
    return requireProjection(this.protocols, proposal.protocolId, "protocol");
  }

  async respond(input: ProtocolResponseInput): Promise<ProtocolProjection> {
    const projection = requireProjection(this.protocols, input.protocolId, "protocol");
    requireText(input.agentId, "agentId");
    requireText(input.reason, "reason");

    const response: ProtocolResponse = {
      responseId: this.ids.next("protocol_response"),
      protocolId: input.protocolId,
      agentId: input.agentId,
      response: input.response,
      reason: input.reason,
      proposedRevision: input.proposedRevision ? clone(input.proposedRevision) : undefined,
      createdAt: this.now(),
    };

    const event = await this.appender.append({
      roomId: projection.proposal.roomId,
      eventType: "protocol.responded",
      actor: input.actor ?? { kind: "agent", id: input.agentId },
      payload: response,
      refs: [projection.proposal.protocolId],
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? response.responseId,
    });
    this.apply(event);
    return requireProjection(this.protocols, input.protocolId, "protocol");
  }

  async retire(input: ProtocolRetireInput): Promise<ProtocolProjection> {
    const projection = requireProjection(this.protocols, input.protocolId, "protocol");
    requireText(input.retiredBy, "retiredBy");
    requireText(input.reason, "reason");

    const payload = {
      protocolId: input.protocolId,
      retiredBy: input.retiredBy,
      reason: input.reason,
      retiredAt: this.now(),
    };
    const event = await this.appender.append({
      roomId: projection.proposal.roomId,
      eventType: "protocol.retired",
      actor: input.actor ?? { kind: "agent", id: input.retiredBy },
      payload,
      refs: [projection.proposal.protocolId],
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? `${input.protocolId}:retired`,
    });
    this.apply(event);
    return requireProjection(this.protocols, input.protocolId, "protocol");
  }

  async expire(now: string = this.now()): Promise<ProtocolProjection[]> {
    const expired: ProtocolProjection[] = [];
    for (const projection of this.protocols.values()) {
      if (projection.status === "expired" || projection.status === "retired") {
        continue;
      }
      if (!isExpired(projection.proposal.expiresAt, now)) {
        continue;
      }

      const payload = {
        protocolId: projection.proposal.protocolId,
        expiredAt: now,
      };
      const event = await this.appender.append({
        roomId: projection.proposal.roomId,
        eventType: "protocol.expired",
        actor: defaultSystemActor,
        payload,
        refs: [projection.proposal.protocolId],
        idempotencyKey: `${projection.proposal.protocolId}:expired:${now}`,
        occurredAt: now,
      });
      this.apply(event);
      expired.push(requireProjection(this.protocols, projection.proposal.protocolId, "protocol"));
    }
    return expired;
  }

  getEffectiveProtocols(query: ProtocolScopeQuery): ProtocolProjection[] {
    const at = query.at ?? this.now();
    return [...this.protocols.values()]
      .filter((projection) => projection.proposal.roomId === query.roomId)
      .filter((projection) => projection.status === "active")
      .filter((projection) => !isExpired(projection.proposal.expiresAt, at))
      .filter((projection) => protocolMatchesQuery(projection.proposal, query))
      .map((projection) => clone(projection));
  }

  get(protocolId: string): ProtocolProjection | undefined {
    const projection = this.protocols.get(protocolId);
    return projection ? clone(projection) : undefined;
  }

  view(): ProtocolProjection[] {
    return [...this.protocols.values()].map((projection) => clone(projection));
  }

  apply(event: RoomEvent): void {
    if (event.event_type === "protocol.proposed") {
      const proposal = event.payload as ProtocolProposal;
      this.protocols.set(proposal.protocolId, {
        proposal: clone(proposal),
        responses: [],
        status: proposal.status,
        contextRef: proposal.protocolId,
        hiddenSchedulerRule: false,
      });
      return;
    }

    if (event.event_type === "protocol.responded") {
      const response = event.payload as ProtocolResponse;
      const projection = requireProjection(this.protocols, response.protocolId, "protocol");
      const status = protocolStatusFromResponse(response.response);
      projection.responses.push(clone(response));
      projection.status = status;
      projection.proposal.status = status;
      return;
    }

    if (event.event_type === "protocol.retired") {
      const payload = event.payload as { protocolId: string };
      const projection = requireProjection(this.protocols, payload.protocolId, "protocol");
      projection.status = "retired";
      projection.proposal.status = "retired";
      return;
    }

    if (event.event_type === "protocol.expired") {
      const payload = event.payload as { protocolId: string };
      const projection = requireProjection(this.protocols, payload.protocolId, "protocol");
      projection.status = "expired";
      projection.proposal.status = "expired";
    }
  }
}

function handoffStatusFromResponse(response: HandoffResponseKind): HandoffStatus {
  switch (response) {
    case "accept":
      return "accepted";
    case "reject":
      return "rejected";
    case "partially_accept":
      return "partially_accepted";
    case "delegate_to_other":
      return "redirected";
    case "challenge_handoff":
      return "challenged";
  }
}

function protocolStatusFromResponse(response: ProtocolResponseKind): ProtocolStatus {
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

function isActiveHandoffStatus(status: HandoffStatus): boolean {
  return status === "proposed" || status === "accepted" || status === "partially_accepted" || status === "challenged";
}

function protocolMatchesQuery(proposal: ProtocolProposal, query: ProtocolScopeQuery): boolean {
  if (proposal.scope.type === "room") {
    return true;
  }
  if (proposal.scope.type === "topic" || proposal.scope.type === "single_round" || proposal.scope.type === "time_window") {
    return query.topicId !== undefined && (proposal.scope.topicIds ?? [proposal.topicId]).includes(query.topicId);
  }
  if (proposal.scope.type === "topic_group") {
    return query.topicId !== undefined && (proposal.scope.topicIds ?? []).includes(query.topicId);
  }
  if (proposal.scope.type === "agent_pair") {
    return query.agentId !== undefined && (proposal.scope.agentIds ?? []).includes(query.agentId);
  }
  return false;
}

function validateProtocolScope(scope: ProtocolScope): void {
  if (!scope || !scope.type) {
    throw new Error("protocol scope is required");
  }
  if (
    (scope.type === "topic" || scope.type === "topic_group" || scope.type === "single_round") &&
    (!scope.topicIds || scope.topicIds.length === 0)
  ) {
    throw new Error(`${scope.type} protocol scope requires topicIds`);
  }
  if (scope.type === "agent_pair" && (!scope.agentIds || scope.agentIds.length < 2)) {
    throw new Error("agent_pair protocol scope requires at least two agentIds");
  }
}

function isExpired(expiresAt: string | undefined, at: string): boolean {
  if (!expiresAt) {
    return false;
  }
  return Date.parse(expiresAt) <= Date.parse(at);
}

function requireText(value: string | undefined, fieldName: string): asserts value is string {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
}

function requireRefs(refs: RefId[] | undefined, fieldName: string): asserts refs is RefId[] {
  if (!refs || refs.length === 0) {
    throw new Error(`${fieldName} must include at least one ref`);
  }
}

function uniqueRefs(refs: RefId[]): RefId[] {
  return [...new Set(refs.filter((ref) => ref.trim().length > 0))];
}

function requireProjection<T>(map: Map<string, T>, id: string, label: string): T {
  const projection = map.get(id);
  if (!projection) {
    throw new Error(`unknown ${label}: ${id}`);
  }
  return projection;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
