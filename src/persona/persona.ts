import type { AgentId, EventActor, EventId, RefId, RoomEvent, RoomId, SideEffectKind } from "../types";

export type PersonaAppendCommand<TPayload> = {
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

export type PersonaEventAppender = {
  append<TPayload>(command: PersonaAppendCommand<TPayload>): Promise<RoomEvent<TPayload>>;
};

export type PersonaDeltaStatus = "proposed" | "accepted" | "rejected" | "contested" | "retired" | "revised";
export type RoleClaimStatus = "proposed" | "accepted" | "rejected" | "contested" | "stale" | "retired" | "revised";

export type AgentDailyMood = {
  date: string;
  posture: string;
  sourceRef?: RefId;
};

export type AgentPersonaExperience = {
  summary: string;
  influence: string;
};

export type AgentConversationStyle = {
  voice: string;
  rhythm: string;
  interactionRules: string[];
  boundaries: string[];
};

export type AgentPersonaTemplate = {
  core: string;
  mood: string;
  experiences: AgentPersonaExperience[];
  personality: string[];
  habits: string[];
  conversationStyle: AgentConversationStyle;
};

export type AgentRoleClaim = {
  roleClaimId: string;
  label: string;
  status: RoleClaimStatus;
  proposedBy: AgentId;
  evidenceRefs: RefId[];
  responseRefs: RefId[];
  sourcePressureRefs?: RefId[];
  contestRefs: RefId[];
  sourceDeltaId: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentProfile = {
  agentId: AgentId;
  displayName: string;
  corePersonaRef?: string;
  initialPosture?: string;
  roleClaims: AgentRoleClaim[];
  habits: string[];
  experiences?: AgentPersonaExperience[];
  personality?: string[];
  conversationStyle?: AgentConversationStyle;
  dailyMood?: AgentDailyMood;
  privateHome?: string;
  capabilityRefs: RefId[];
  evolutionLogRefs: RefId[];
};

export type PersonaChangeField =
  | "displayName"
  | "corePersonaRef"
  | "initialPosture"
  | "roleClaims"
  | "habits"
  | "personality"
  | "dailyMood"
  | "privateHome"
  | "capabilityRefs";

export type PersonaChangeOperation = "set" | "add" | "remove";

export type PersonaProposedChange = {
  field: PersonaChangeField;
  operation: PersonaChangeOperation;
  value: string | AgentDailyMood;
};

export type PersonaDelta = {
  deltaId: string;
  agentId: AgentId;
  proposedBy: AgentId;
  revisedFromDeltaRef?: RefId;
  revisedBy?: AgentId;
  reason: string;
  proposedChange: PersonaProposedChange;
  evidenceRefs: RefId[];
  sourcePressureRefs?: RefId[];
  status: PersonaDeltaStatus;
  createdAt: string;
  responses: PersonaDeltaResponse[];
  boundaryNote?: string;
};

export type PersonaDeltaResponseKind = "accept" | "reject" | "contest" | "retire" | "revise";

export type PersonaDeltaResponse = {
  responseId: string;
  deltaId: string;
  agentId: AgentId;
  response: PersonaDeltaResponseKind;
  reason: string;
  proposedRevision?: string;
  evidenceRefs: RefId[];
  createdAt: string;
};

export type PersonaProjection = {
  profile: AgentProfile;
  evolutionLog: PersonaDelta[];
};

export type PersonaDeltaInput = {
  roomId: RoomId;
  agentId: AgentId;
  proposedBy: AgentId;
  reason: string;
  proposedChange: PersonaProposedChange;
  evidenceRefs: RefId[];
  sourcePressureRefs?: RefId[];
  actor?: EventActor;
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
};

export type PersonaDeltaResponseInput = {
  roomId: RoomId;
  deltaId: string;
  agentId: AgentId;
  response: PersonaDeltaResponseKind;
  reason: string;
  proposedRevision?: string;
  evidenceRefs?: RefId[];
  actor?: EventActor;
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
};

export type CapabilityCard = {
  capabilityId: string;
  agentId: AgentId;
  capabilityType: string;
  domainTags: string[];
  inputPreferences: string[];
  latency: "low" | "medium" | "high";
  sideEffectProfile: "none" | "read_only" | "approval_required";
  sideEffectKinds: SideEffectKind[];
  declaredConfidence: number;
  observedReputation: {
    successfulInvites: number;
    rejectedInvites: number;
    contestedOutputs: number;
  };
};

export type CapabilityCardInput = {
  roomId: RoomId;
  capabilityId?: string;
  agentId: AgentId;
  capabilityType: string;
  domainTags: string[];
  inputPreferences?: string[];
  latency?: "low" | "medium" | "high";
  sideEffectProfile?: "none" | "read_only" | "approval_required";
  sideEffectKinds?: SideEffectKind[];
  declaredConfidence: number;
  actor?: EventActor;
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
};

export type WakeSignal = {
  agentId: AgentId;
  capabilityId: string;
  source: "capability_card";
  score: number;
  reason: string;
  authority: "advisory";
  mustSpeak: false;
};

export type WakeSignalInput = {
  roomId: RoomId;
  topicTags: string[];
  mentionedAgents?: AgentId[];
  maxSignals?: number;
};

export type CapabilityOutcomeInput = {
  roomId: RoomId;
  capabilityId: string;
  agentId: AgentId;
  outcome: "successful_invite" | "rejected_invite" | "contested_output";
  reason: string;
  contextRefs?: RefId[];
  actor?: EventActor;
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
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

export class InMemoryPersonaEventAppender implements PersonaEventAppender {
  private readonly events: RoomEvent[] = [];
  private sequence = 0;

  async append<TPayload>(command: PersonaAppendCommand<TPayload>): Promise<RoomEvent<TPayload>> {
    const previous = this.events.at(-1) ?? null;
    const event: RoomEvent<TPayload> = {
      event_id: `evt_persona_${String(++this.sequence).padStart(4, "0")}`,
      room_id: command.roomId,
      event_type: command.eventType,
      schema_version: "1",
      payload_schema: command.payloadSchema ?? `${command.eventType}.v1`,
      occurred_at: command.occurredAt ?? new Date().toISOString(),
      appended_at: new Date().toISOString(),
      actor: command.actor,
      causation_id: command.causationId ?? null,
      correlation_id: command.correlationId ?? `corr_persona_${this.sequence}`,
      idempotency_key: command.idempotencyKey ?? `idem_persona_${this.sequence}`,
      refs: command.refs ?? [],
      payload: command.payload,
      prev_event_id: previous?.event_id ?? null,
      prev_event_hash: previous?.event_hash ?? null,
      event_hash: `hash_persona_${this.sequence}`,
    };
    this.events.push(event);
    return event;
  }

  allEvents(): RoomEvent[] {
    return this.events.map((event) => clone(event));
  }
}

export class PersonaService {
  private readonly appender: PersonaEventAppender;
  private readonly now: Clock;
  private readonly ids = new IdSequence();
  private readonly profiles = new Map<AgentId, AgentProfile>();
  private readonly deltas = new Map<string, PersonaDelta>();

  constructor(
    options: {
      appender?: PersonaEventAppender;
      now?: Clock;
      profiles?: AgentProfile[];
      events?: RoomEvent[];
    } = {},
  ) {
    this.appender = options.appender ?? new InMemoryPersonaEventAppender();
    this.now = options.now ?? (() => new Date().toISOString());
    for (const profile of options.profiles ?? []) {
      this.profiles.set(profile.agentId, clone(profile));
    }
    for (const event of options.events ?? []) {
      this.apply(event);
    }
  }

  getProfile(agentId: AgentId): Promise<AgentProfile> {
    return Promise.resolve(clone(this.ensureProfile(agentId)));
  }

  async proposeDelta(input: PersonaDeltaInput): Promise<PersonaDelta> {
    requireText(input.roomId, "roomId");
    requireText(input.agentId, "agentId");
    requireText(input.proposedBy, "proposedBy");
    requireText(input.reason, "reason");
    requireRefs(input.evidenceRefs, "evidenceRefs");
    validatePersonaChange(input.proposedChange);

    const sourcePressureRefs = uniqueRefs(input.sourcePressureRefs ?? input.evidenceRefs.filter(isMixedReviewPressureRef));
    const delta: PersonaDelta = {
      deltaId: this.ids.next("persona_delta"),
      agentId: input.agentId,
      proposedBy: input.proposedBy,
      reason: input.reason,
      proposedChange: clone(input.proposedChange),
      evidenceRefs: uniqueRefs(input.evidenceRefs),
      ...(sourcePressureRefs.length > 0 ? { sourcePressureRefs } : {}),
      status: "proposed",
      createdAt: this.now(),
      responses: [],
    };

    const event = await this.appender.append({
      roomId: input.roomId,
      eventType: "persona_delta.proposed",
      actor: input.actor ?? { kind: "agent", id: input.proposedBy },
      payload: delta,
      refs: uniqueRefs(delta.evidenceRefs.concat(delta.sourcePressureRefs ?? [])),
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? delta.deltaId,
    });
    this.apply(event);
    return clone(delta);
  }

  async respondToDelta(input: PersonaDeltaResponseInput): Promise<PersonaProjection> {
    requireText(input.roomId, "roomId");
    requireText(input.deltaId, "deltaId");
    requireText(input.agentId, "agentId");
    requireText(input.reason, "reason");

    const delta = this.deltas.get(input.deltaId);
    if (!delta) {
      throw new Error(`persona delta requires a proposed ledger event before response: ${input.deltaId}`);
    }

    const response: PersonaDeltaResponse = {
      responseId: this.ids.next("persona_delta_response"),
      deltaId: input.deltaId,
      agentId: input.agentId,
      response: input.response,
      reason: input.reason,
      proposedRevision: input.response === "revise" ? input.proposedRevision : undefined,
      evidenceRefs: uniqueRefs(input.evidenceRefs ?? []),
      createdAt: this.now(),
    };

    const event = await this.appender.append({
      roomId: input.roomId,
      eventType: "persona_delta.responded",
      actor: input.actor ?? { kind: "agent", id: input.agentId },
      payload: response,
      refs: uniqueRefs([input.deltaId, ...response.evidenceRefs]),
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? response.responseId,
    });
    this.apply(event);
    return this.getProjection(delta.agentId);
  }

  getEvolutionLog(agentId: AgentId): Promise<PersonaDelta[]> {
    return Promise.resolve(
      [...this.deltas.values()]
        .filter((delta) => delta.agentId === agentId)
        .map((delta) => clone(delta)),
    );
  }

  getProjection(agentId: AgentId): PersonaProjection {
    return {
      profile: clone(this.ensureProfile(agentId)),
      evolutionLog: [...this.deltas.values()]
        .filter((delta) => delta.agentId === agentId)
        .map((delta) => clone(delta)),
    };
  }

  apply(event: RoomEvent): void {
    if (event.event_type === "persona_delta.proposed") {
      const delta = clone(event.payload as PersonaDelta);
      const profile = this.ensureProfile(delta.agentId);
      profile.evolutionLogRefs.push(delta.deltaId);
      this.deltas.set(delta.deltaId, delta);
      if (delta.proposedChange.field === "roleClaims") {
        this.upsertRoleClaimFromDelta(profile, delta);
      }
      return;
    }

    if (event.event_type === "persona_delta.responded") {
      const response = event.payload as PersonaDeltaResponse;
      const delta = this.deltas.get(response.deltaId);
      if (!delta) {
        throw new Error(`persona delta response references unknown delta: ${response.deltaId}`);
      }
      delta.responses.push(clone(response));
      delta.status = personaStatusFromResponse(response.response);
      if (delta.proposedChange.field === "roleClaims") {
        this.updateRoleClaimFromDelta(this.ensureProfile(delta.agentId), delta);
      } else if (delta.status === "accepted") {
        this.applyAcceptedChange(this.ensureProfile(delta.agentId), delta.proposedChange);
      }
    }
  }

  private ensureProfile(agentId: AgentId): AgentProfile {
    let profile = this.profiles.get(agentId);
    if (!profile) {
      profile = {
        agentId,
        displayName: agentId,
        roleClaims: [],
        habits: [],
        capabilityRefs: [],
        evolutionLogRefs: [],
      };
      this.profiles.set(agentId, profile);
    }
    profile.roleClaims ??= [];
    return profile;
  }

  private upsertRoleClaimFromDelta(profile: AgentProfile, delta: PersonaDelta): void {
    if (typeof delta.proposedChange.value !== "string") {
      throw new Error("roleClaims change requires a string value");
    }
    const existing = profile.roleClaims.find((claim) => claim.sourceDeltaId === delta.deltaId);
    const sourcePressureRefs = uniqueRefs(delta.sourcePressureRefs ?? delta.evidenceRefs.filter(isMixedReviewPressureRef));
    const claim: AgentRoleClaim = {
      roleClaimId: existing?.roleClaimId ?? `role_claim_${delta.deltaId}`,
      label: delta.proposedChange.value,
      status: roleClaimStatusFromDelta(delta.status),
      proposedBy: delta.proposedBy,
      evidenceRefs: uniqueRefs(delta.evidenceRefs),
      responseRefs: existing?.responseRefs ?? [],
      ...(sourcePressureRefs.length > 0 ? { sourcePressureRefs } : {}),
      contestRefs: existing?.contestRefs ?? [],
      sourceDeltaId: delta.deltaId,
      createdAt: existing?.createdAt ?? delta.createdAt,
      updatedAt: delta.createdAt,
    };
    if (existing) {
      Object.assign(existing, claim);
    } else {
      profile.roleClaims.push(claim);
    }
  }

  private updateRoleClaimFromDelta(profile: AgentProfile, delta: PersonaDelta): void {
    this.upsertRoleClaimFromDelta(profile, delta);
    const claim = profile.roleClaims.find((item) => item.sourceDeltaId === delta.deltaId);
    if (!claim) return;
    claim.status = roleClaimStatusFromDelta(delta.status);
    claim.contestRefs = uniqueRefs(
      delta.responses
        .filter((response) => response.response === "contest" || response.response === "reject")
        .flatMap((response) => response.evidenceRefs),
    );
    claim.responseRefs = roleClaimResponseRefs(delta.responses);
    claim.updatedAt = delta.responses.at(-1)?.createdAt ?? claim.updatedAt;
  }

  private applyAcceptedChange(profile: AgentProfile, change: PersonaProposedChange): void {
    if (change.field === "dailyMood") {
      if (typeof change.value === "string") {
        throw new Error("dailyMood change requires an object value");
      }
      profile.dailyMood = clone(change.value);
      return;
    }

    if (typeof change.value !== "string") {
      throw new Error(`${change.field} change requires a string value`);
    }

    if (change.field === "habits" || change.field === "capabilityRefs" || change.field === "personality") {
      const list = profile[change.field] ?? [];
      applyListChange(list, change.operation, change.value);
      profile[change.field] = list;
      return;
    }

    if (change.field === "roleClaims") {
      throw new Error("roleClaims changes are projected from persona delta state");
    }

    if (change.operation === "remove") {
      delete profile[change.field];
      return;
    }

    if (change.operation !== "set") {
      throw new Error(`${change.field} only supports set/remove operations`);
    }
    profile[change.field] = change.value;
  }
}

export class CapabilityService {
  private readonly appender: PersonaEventAppender;
  private readonly ids = new IdSequence();
  private readonly cards = new Map<string, CapabilityCard>();

  constructor(options: { appender?: PersonaEventAppender; events?: RoomEvent[] } = {}) {
    this.appender = options.appender ?? new InMemoryPersonaEventAppender();
    for (const event of options.events ?? []) {
      this.apply(event);
    }
  }

  async upsertCard(input: CapabilityCardInput): Promise<CapabilityCard> {
    requireText(input.roomId, "roomId");
    requireText(input.agentId, "agentId");
    requireText(input.capabilityType, "capabilityType");
    if (input.domainTags.length === 0) {
      throw new Error("domainTags must include at least one tag");
    }
    if (input.declaredConfidence < 0 || input.declaredConfidence > 1) {
      throw new Error("declaredConfidence must be between 0 and 1");
    }

    const existing = input.capabilityId ? this.cards.get(input.capabilityId) : undefined;
    const card: CapabilityCard = {
      capabilityId: input.capabilityId ?? this.ids.next("capability"),
      agentId: input.agentId,
      capabilityType: input.capabilityType,
      domainTags: uniqueStrings(input.domainTags.map(normalizeTag)),
      inputPreferences: uniqueStrings(input.inputPreferences ?? []),
      latency: input.latency ?? "medium",
      sideEffectProfile: input.sideEffectProfile ?? "none",
      sideEffectKinds: input.sideEffectKinds ?? [],
      declaredConfidence: input.declaredConfidence,
      observedReputation: existing?.observedReputation ?? {
        successfulInvites: 0,
        rejectedInvites: 0,
        contestedOutputs: 0,
      },
    };

    const event = await this.appender.append({
      roomId: input.roomId,
      eventType: "capability_card.upserted",
      actor: input.actor ?? { kind: "agent", id: input.agentId },
      payload: card,
      refs: [card.agentId],
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? card.capabilityId,
    });
    this.apply(event);
    return clone(card);
  }

  getCards(agentId: AgentId): Promise<CapabilityCard[]> {
    return Promise.resolve(
      [...this.cards.values()]
        .filter((card) => card.agentId === agentId)
        .map((card) => clone(card)),
    );
  }

  buildWakeSignals(input: WakeSignalInput): Promise<WakeSignal[]> {
    const topicTags = new Set(input.topicTags.map(normalizeTag));
    const mentionedAgents = new Set(input.mentionedAgents ?? []);
    const signals = [...this.cards.values()]
      .map((card) => {
        const matchingTags = card.domainTags.filter((tag) => topicTags.has(tag));
        const observations =
          card.observedReputation.successfulInvites +
          card.observedReputation.rejectedInvites +
          card.observedReputation.contestedOutputs;
        const unverified = observations === 0;
        const mentionBonus = mentionedAgents.has(card.agentId) ? 0.2 : 0;
        const declaredPrior = unverified ? card.declaredConfidence * 0.05 : card.declaredConfidence * 0.2;
        const tagMatch = matchingTags.length * (unverified ? 0.05 : 0.18);
        const reputationAdjustment = unverified ? 0 : capabilityReputationScore(card) * 0.12;
        const score = clamp(declaredPrior + tagMatch + mentionBonus + reputationAdjustment, 0, 1);
        return {
          agentId: card.agentId,
          capabilityId: card.capabilityId,
          source: "capability_card" as const,
          score,
          reason:
            matchingTags.length > 0
              ? `Weak invitation hint: topic tags match ${matchingTags.join(", ")}; capability does not assign responsibility.`
              : "Weak invitation hint: capability card is available but does not assign responsibility.",
          authority: "advisory" as const,
          mustSpeak: false as const,
        };
      })
      .filter((signal) => signal.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, input.maxSignals ?? Number.POSITIVE_INFINITY);

    return Promise.resolve(signals);
  }

  async recordOutcome(input: CapabilityOutcomeInput): Promise<CapabilityCard> {
    requireText(input.roomId, "roomId");
    requireText(input.capabilityId, "capabilityId");
    requireText(input.agentId, "agentId");
    requireText(input.reason, "reason");
    const card = this.cards.get(input.capabilityId);
    if (!card) {
      throw new Error(`unknown capability card: ${input.capabilityId}`);
    }
    if (card.agentId !== input.agentId) {
      throw new Error("capability outcome agentId must match the card owner");
    }

    const payload = {
      capabilityId: input.capabilityId,
      agentId: input.agentId,
      outcome: input.outcome,
      reason: input.reason,
      contextRefs: uniqueRefs(input.contextRefs ?? []),
    };
    const event = await this.appender.append({
      roomId: input.roomId,
      eventType: "capability_card.outcome_recorded",
      actor: input.actor ?? { kind: "system", id: "capability_service" },
      payload,
      refs: uniqueRefs([input.capabilityId, ...(input.contextRefs ?? [])]),
      causationId: input.causationId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? `${input.capabilityId}:${input.outcome}`,
    });
    this.apply(event);
    const updated = this.cards.get(input.capabilityId);
    if (!updated) {
      throw new Error(`unknown capability card after outcome: ${input.capabilityId}`);
    }
    return clone(updated);
  }

  apply(event: RoomEvent): void {
    if (event.event_type === "capability_card.upserted") {
      const card = clone(event.payload as CapabilityCard);
      this.cards.set(card.capabilityId, card);
      return;
    }

    if (event.event_type === "capability_card.outcome_recorded") {
      const payload = event.payload as CapabilityOutcomeInput & { capabilityId: string };
      const card = this.cards.get(payload.capabilityId);
      if (!card) {
        throw new Error(`capability outcome references unknown card: ${payload.capabilityId}`);
      }
      if (payload.outcome === "successful_invite") {
        card.observedReputation.successfulInvites += 1;
      } else if (payload.outcome === "rejected_invite") {
        card.observedReputation.rejectedInvites += 1;
      } else {
        card.observedReputation.contestedOutputs += 1;
      }
    }
  }
}

function personaStatusFromResponse(response: PersonaDeltaResponseKind): PersonaDeltaStatus {
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

function roleClaimStatusFromDelta(status: PersonaDeltaStatus): RoleClaimStatus {
  switch (status) {
    case "proposed":
      return "proposed";
    case "accepted":
      return "accepted";
    case "rejected":
      return "rejected";
    case "contested":
      return "contested";
    case "retired":
      return "retired";
    case "revised":
      return "revised";
  }
}

function roleClaimResponseRefs(responses: readonly PersonaDeltaResponse[]): RefId[] {
  return uniqueRefs(responses.flatMap((response) => [response.responseId, ...response.evidenceRefs]));
}

function isMixedReviewPressureRef(ref: RefId): boolean {
  return ref.startsWith("mixed_review:");
}

function validatePersonaChange(change: PersonaProposedChange): void {
  if (!change) {
    throw new Error("proposedChange is required");
  }
  requireText(change.field, "proposedChange.field");
  requireText(change.operation, "proposedChange.operation");
  if (change.field === "dailyMood" && typeof change.value === "string") {
    throw new Error("dailyMood changes require an object value");
  }
  if (change.field !== "dailyMood" && typeof change.value !== "string") {
    throw new Error(`${change.field} changes require a string value`);
  }
}

function applyListChange(list: string[], operation: PersonaChangeOperation, value: string): void {
  if (operation === "add") {
    if (!list.includes(value)) {
      list.push(value);
    }
    return;
  }
  if (operation === "remove") {
    const index = list.indexOf(value);
    if (index >= 0) {
      list.splice(index, 1);
    }
    return;
  }
  list.splice(0, list.length, value);
}

function capabilityReputationScore(card: CapabilityCard): number {
  const total =
    card.observedReputation.successfulInvites +
    card.observedReputation.rejectedInvites +
    card.observedReputation.contestedOutputs;
  if (total === 0) {
    return 0;
  }
  return (
    (card.observedReputation.successfulInvites -
      card.observedReputation.rejectedInvites -
      card.observedReputation.contestedOutputs * 0.5) /
    total
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
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
  return uniqueStrings(refs.filter((ref) => ref.trim().length > 0));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
