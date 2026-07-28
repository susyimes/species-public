import type { AgentId, EventActor, EventId, RefId, RoomEvent, RoomId, SideEffectKind, TopicId } from "../types";

export type SideEffectAppendCommand<TPayload> = {
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

export type SideEffectEventAppender = {
  append<TPayload>(command: SideEffectAppendCommand<TPayload>): Promise<RoomEvent<TPayload>>;
};

export type ApprovalStatus = "requested" | "approved" | "denied" | "expired" | "executed" | "failed" | "revoked";

export type ApprovalScope = {
  kinds?: SideEffectKind[];
  targets?: string[];
  targetPrefixes?: string[];
  allowedAgents?: AgentId[];
  expiresAt: string;
};

export type ApprovalRecord = {
  approvalId: string;
  roomId: RoomId;
  requestedBy: AgentId;
  topicId?: TopicId;
  kind: SideEffectKind;
  target: string;
  reason: string;
  expectedImpact: string;
  contextRefs: RefId[];
  proposedCommand?: string;
  status: ApprovalStatus;
  approvedBy?: string;
  deniedBy?: string;
  expiredBy?: string;
  decisionReason?: string;
  scope: ApprovalScope;
  createdAt: string;
  decidedAt?: string;
};

export type ApprovalRequestInput = {
  roomId: RoomId;
  requestedBy: AgentId;
  topicId?: TopicId;
  kind: SideEffectKind;
  target: string;
  reason: string;
  expectedImpact: string;
  contextRefs: RefId[];
  proposedCommand?: string;
  scope: ApprovalScope;
  actor?: EventActor;
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
};

export type ApprovalDecisionInput = {
  approvalId: string;
  decidedBy: string;
  reason: string;
  scope?: ApprovalScope;
  actor?: EventActor;
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
};

export type ActionAttemptInput = {
  approvalId?: string;
  agentId: AgentId;
  kind: SideEffectKind;
  target: string;
  at?: string;
};

export type ActionResultStatus = "completed" | "failed";

export type ActionResult = {
  resultId: string;
  approvalId: string;
  agentId: AgentId;
  actionKind: SideEffectKind;
  target: string;
  status: ActionResultStatus;
  summary: string;
  artifactRefs: RefId[];
  claimRefs: RefId[];
  followUpProposalRefs: RefId[];
  contextRefs: RefId[];
  completedAt: string;
};

export type ActionResultInput = {
  approvalId: string;
  agentId: AgentId;
  actionKind: SideEffectKind;
  target: string;
  status: ActionResultStatus;
  summary: string;
  artifactRefs?: RefId[];
  claimRefs?: RefId[];
  followUpProposalRefs?: RefId[];
  contextRefs?: RefId[];
  actor?: EventActor;
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
  completedAt?: string;
};

type Clock = () => string;

class IdSequence {
  private counters = new Map<string, number>();

  next(prefix: string): string {
    const nextValue = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, nextValue);
    return `${prefix}_${String(nextValue).padStart(4, "0")}`;
  }
}

export class SideEffectApprovalError extends Error {
  readonly code:
    | "missing_approval"
    | "not_approved"
    | "expired_approval"
    | "kind_out_of_scope"
    | "target_out_of_scope"
    | "agent_out_of_scope";

  constructor(code: SideEffectApprovalError["code"], message: string) {
    super(message);
    this.name = "SideEffectApprovalError";
    this.code = code;
  }
}

export class InMemorySideEffectEventAppender implements SideEffectEventAppender {
  private readonly events: RoomEvent[] = [];
  private sequence = 0;

  async append<TPayload>(command: SideEffectAppendCommand<TPayload>): Promise<RoomEvent<TPayload>> {
    const previous = this.events.at(-1) ?? null;
    const event: RoomEvent<TPayload> = {
      event_id: `evt_action_${String(++this.sequence).padStart(4, "0")}`,
      room_id: command.roomId,
      event_type: command.eventType,
      schema_version: "1",
      payload_schema: command.payloadSchema ?? `${command.eventType}.v1`,
      occurred_at: command.occurredAt ?? new Date().toISOString(),
      appended_at: new Date().toISOString(),
      actor: command.actor,
      causation_id: command.causationId ?? null,
      correlation_id: command.correlationId ?? `corr_action_${this.sequence}`,
      idempotency_key: command.idempotencyKey ?? `idem_action_${this.sequence}`,
      refs: command.refs ?? [],
      payload: command.payload,
      prev_event_id: previous?.event_id ?? null,
      prev_event_hash: previous?.event_hash ?? null,
      event_hash: `hash_action_${this.sequence}`,
    };
    this.events.push(event);
    return event;
  }

  allEvents(): RoomEvent[] {
    return this.events.map((event) => clone(event));
  }
}

export class SideEffectGate {
  private readonly appender: SideEffectEventAppender;
  private readonly now: Clock;
  private readonly ids = new IdSequence();
  private readonly approvals = new Map<string, ApprovalRecord>();
  private readonly results = new Map<string, ActionResult>();

  constructor(options: { appender?: SideEffectEventAppender; now?: Clock; events?: RoomEvent[] } = {}) {
    this.appender = options.appender ?? new InMemorySideEffectEventAppender();
    this.now = options.now ?? (() => new Date().toISOString());
    for (const event of options.events ?? []) {
      this.apply(event);
    }
  }

  async request(input: ApprovalRequestInput): Promise<ApprovalRecord> {
    requireText(input.roomId, "roomId");
    requireText(input.requestedBy, "requestedBy");
    requireText(input.kind, "kind");
    requireText(input.target, "target");
    requireText(input.reason, "reason");
    requireText(input.expectedImpact, "expectedImpact");
    requireRefs(input.contextRefs, "contextRefs");
    validateScope(input.scope);

    const record: ApprovalRecord = {
      approvalId: this.ids.next("approval"),
      roomId: input.roomId,
      requestedBy: input.requestedBy,
      topicId: input.topicId,
      kind: input.kind,
      target: input.target,
      reason: input.reason,
      expectedImpact: input.expectedImpact,
      contextRefs: uniqueRefs(input.contextRefs),
      proposedCommand: input.proposedCommand,
      status: "requested",
      scope: normalizeScope(input.scope, input.kind, input.target, input.requestedBy),
      createdAt: this.now(),
    };

    const event = await this.appender.append({
      roomId: record.roomId,
      eventType: "side_effect.requested",
      actor: input.actor ?? { kind: "agent", id: input.requestedBy },
      payload: record,
      refs: record.contextRefs,
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? record.approvalId,
    });
    this.apply(event);
    return clone(record);
  }

  async approve(input: ApprovalDecisionInput): Promise<ApprovalRecord> {
    const record = this.requireApproval(input.approvalId);
    requireText(input.decidedBy, "decidedBy");
    requireText(input.reason, "reason");
    const scope = input.scope ? normalizeScope(input.scope, record.kind, record.target, record.requestedBy) : clone(record.scope);
    validateScope(scope);

    const payload = {
      approvalId: input.approvalId,
      approvedBy: input.decidedBy,
      reason: input.reason,
      scope,
      decidedAt: this.now(),
    };
    const event = await this.appender.append({
      roomId: record.roomId,
      eventType: "side_effect.approved",
      actor: input.actor ?? { kind: "user", id: input.decidedBy },
      payload,
      refs: [record.approvalId],
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? `${record.approvalId}:approved`,
    });
    this.apply(event);
    return clone(this.requireApproval(input.approvalId));
  }

  async deny(input: ApprovalDecisionInput): Promise<ApprovalRecord> {
    const record = this.requireApproval(input.approvalId);
    requireText(input.decidedBy, "decidedBy");
    requireText(input.reason, "reason");

    const payload = {
      approvalId: input.approvalId,
      deniedBy: input.decidedBy,
      reason: input.reason,
      decidedAt: this.now(),
    };
    const event = await this.appender.append({
      roomId: record.roomId,
      eventType: "side_effect.denied",
      actor: input.actor ?? { kind: "user", id: input.decidedBy },
      payload,
      refs: [record.approvalId],
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? `${record.approvalId}:denied`,
    });
    this.apply(event);
    return clone(this.requireApproval(input.approvalId));
  }

  async expire(input: ApprovalDecisionInput): Promise<ApprovalRecord> {
    const record = this.requireApproval(input.approvalId);
    requireText(input.decidedBy, "decidedBy");
    requireText(input.reason, "reason");

    const payload = {
      approvalId: input.approvalId,
      expiredBy: input.decidedBy,
      reason: input.reason,
      expiredAt: this.now(),
    };
    const event = await this.appender.append({
      roomId: record.roomId,
      eventType: "side_effect.expired",
      actor: input.actor ?? { kind: "user", id: input.decidedBy },
      payload,
      refs: [record.approvalId],
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? `${record.approvalId}:expired`,
    });
    this.apply(event);
    return clone(this.requireApproval(input.approvalId));
  }

  assertAllowed(input: ActionAttemptInput): Promise<ApprovalRecord> {
    if (!input.approvalId) {
      return Promise.reject(new SideEffectApprovalError("missing_approval", "side effect requires an approval id"));
    }
    const record = this.approvals.get(input.approvalId);
    if (!record) {
      return Promise.reject(new SideEffectApprovalError("missing_approval", `unknown approval: ${input.approvalId}`));
    }
    if (record.status !== "approved") {
      return Promise.reject(new SideEffectApprovalError("not_approved", `approval is ${record.status}, not approved`));
    }
    const at = input.at ?? this.now();
    if (isExpired(record.scope.expiresAt, at)) {
      return Promise.reject(new SideEffectApprovalError("expired_approval", `approval expired at ${record.scope.expiresAt}`));
    }
    if (!scopeAllowsKind(record.scope, input.kind)) {
      return Promise.reject(new SideEffectApprovalError("kind_out_of_scope", `${input.kind} is outside approval scope`));
    }
    if (!scopeAllowsTarget(record.scope, input.target)) {
      return Promise.reject(new SideEffectApprovalError("target_out_of_scope", `${input.target} is outside approval scope`));
    }
    if (!scopeAllowsAgent(record.scope, input.agentId, record.requestedBy)) {
      return Promise.reject(new SideEffectApprovalError("agent_out_of_scope", `${input.agentId} is outside approval scope`));
    }
    return Promise.resolve(clone(record));
  }

  async recordResult(input: ActionResultInput): Promise<ActionResult> {
    const approval = await this.assertAllowed({
      approvalId: input.approvalId,
      agentId: input.agentId,
      kind: input.actionKind,
      target: input.target,
      at: input.completedAt,
    });
    requireText(input.summary, "summary");

    const result: ActionResult = {
      resultId: this.ids.next("action_result"),
      approvalId: input.approvalId,
      agentId: input.agentId,
      actionKind: input.actionKind,
      target: input.target,
      status: input.status,
      summary: input.summary,
      artifactRefs: uniqueRefs(input.artifactRefs ?? []),
      claimRefs: uniqueRefs(input.claimRefs ?? []),
      followUpProposalRefs: uniqueRefs(input.followUpProposalRefs ?? []),
      contextRefs: uniqueRefs(input.contextRefs ?? []),
      completedAt: input.completedAt ?? this.now(),
    };

    const event = await this.appender.append({
      roomId: approval.roomId,
      eventType: "side_effect.result_reported",
      actor: input.actor ?? { kind: "agent", id: input.agentId },
      payload: result,
      refs: uniqueRefs([
        approval.approvalId,
        ...result.artifactRefs,
        ...result.claimRefs,
        ...result.followUpProposalRefs,
        ...result.contextRefs,
      ]),
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? result.resultId,
      occurredAt: result.completedAt,
    });
    this.apply(event);
    return clone(result);
  }

  getApproval(approvalId: string): ApprovalRecord | undefined {
    const record = this.approvals.get(approvalId);
    return record ? clone(record) : undefined;
  }

  getResult(resultId: string): ActionResult | undefined {
    const result = this.results.get(resultId);
    return result ? clone(result) : undefined;
  }

  viewApprovals(): ApprovalRecord[] {
    return [...this.approvals.values()].map((record) => clone(record));
  }

  apply(event: RoomEvent): void {
    if (event.event_type === "side_effect.requested") {
      const record = clone(event.payload as ApprovalRecord);
      this.approvals.set(record.approvalId, record);
      return;
    }

    if (event.event_type === "side_effect.approved") {
      const payload = event.payload as {
        approvalId: string;
        approvedBy: string;
        reason: string;
        scope: ApprovalScope;
        decidedAt: string;
      };
      const record = this.requireApproval(payload.approvalId);
      record.status = "approved";
      record.approvedBy = payload.approvedBy;
      record.decisionReason = payload.reason;
      record.scope = clone(payload.scope);
      record.decidedAt = payload.decidedAt;
      return;
    }

    if (event.event_type === "side_effect.denied") {
      const payload = event.payload as {
        approvalId: string;
        deniedBy: string;
        reason: string;
        decidedAt: string;
      };
      const record = this.requireApproval(payload.approvalId);
      record.status = "denied";
      record.deniedBy = payload.deniedBy;
      record.decisionReason = payload.reason;
      record.decidedAt = payload.decidedAt;
      return;
    }

    if (event.event_type === "side_effect.expired") {
      const payload = event.payload as {
        approvalId: string;
        expiredBy: string;
        reason: string;
        expiredAt: string;
      };
      const record = this.requireApproval(payload.approvalId);
      record.status = "expired";
      record.expiredBy = payload.expiredBy;
      record.decisionReason = payload.reason;
      record.decidedAt = payload.expiredAt;
      return;
    }

    if (event.event_type === "side_effect.result_reported") {
      const result = clone(event.payload as ActionResult);
      this.results.set(result.resultId, result);
      const record = this.requireApproval(result.approvalId);
      record.status = result.status === "completed" ? "executed" : "failed";
    }
  }

  private requireApproval(approvalId: string): ApprovalRecord {
    const record = this.approvals.get(approvalId);
    if (!record) {
      throw new SideEffectApprovalError("missing_approval", `unknown approval: ${approvalId}`);
    }
    return record;
  }
}

function normalizeScope(scope: ApprovalScope, kind: SideEffectKind, target: string, requestedBy: AgentId): ApprovalScope {
  return {
    kinds: scope.kinds && scope.kinds.length > 0 ? [...scope.kinds] : [kind],
    targets: scope.targets && scope.targets.length > 0 ? [...scope.targets] : [target],
    targetPrefixes: scope.targetPrefixes ? [...scope.targetPrefixes] : undefined,
    allowedAgents: scope.allowedAgents && scope.allowedAgents.length > 0 ? [...scope.allowedAgents] : [requestedBy],
    expiresAt: scope.expiresAt,
  };
}

function validateScope(scope: ApprovalScope): void {
  if (!scope) {
    throw new Error("approval scope is required");
  }
  requireText(scope.expiresAt, "scope.expiresAt");
  if (Number.isNaN(Date.parse(scope.expiresAt))) {
    throw new Error("scope.expiresAt must be an ISO timestamp");
  }
}

function scopeAllowsKind(scope: ApprovalScope, kind: SideEffectKind): boolean {
  return !scope.kinds || scope.kinds.includes(kind);
}

function scopeAllowsTarget(scope: ApprovalScope, target: string): boolean {
  if (scope.targets?.includes(target)) {
    return true;
  }
  return (scope.targetPrefixes ?? []).some((prefix) => target.startsWith(prefix));
}

function scopeAllowsAgent(scope: ApprovalScope, agentId: AgentId, requestedBy: AgentId): boolean {
  return (scope.allowedAgents ?? [requestedBy]).includes(agentId);
}

function isExpired(expiresAt: string, at: string): boolean {
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
