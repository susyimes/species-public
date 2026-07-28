import type { AgentContextPacket, ContextFragment, OmittedContextFragment, RefId } from "../types";
import { defaultAgentCapabilityCards } from "../capabilities/capabilities";
import { seedAgents, type SpeciesSeedAgent } from "./seed";
import type { ProviderVisibleMessage } from "./live";

export type ModelSocialObjectCard = {
  kind: string;
  ref: string;
  status?: string;
  readableSummary: string;
  whyVisibleNow: string;
  evidenceRefs: string[];
  hardBoundary?: string;
  availableAffordances?: string[];
};

export type ModelRoomBrief = {
  currentConversation: {
    triggerRef: string;
    triggerContent?: string;
    visibleMessages: {
      refId: string;
      author: string;
      authorKind: string;
      isTrigger: boolean;
      content: string;
    }[];
    note: string;
  };
  roomCharter: {
    thesis: string;
    modelFirstPrinciple: string;
    hardBoundaryScope: string[];
    softProtocolScope: string;
  };
  members: {
    id: string;
    displayName: string;
    relation: "self" | "peer";
    continuityHint?: string;
    softMentionHandles: string[];
  }[];
  socialObjectCards: ModelSocialObjectCard[];
  toolAffordances: {
    capabilityId: string;
    operations: string[];
    boundary: string;
  }[];
  contextEngineering: {
    inputContext: {
      sources: string[];
      boundary: string;
    };
    runtimeContext: {
      sources: string[];
      boundary: string;
    };
    compression: {
      selectedFragmentCount: number;
      omittedFragmentCount: number;
      omittedByType: Record<string, number>;
      boundary: string;
    };
    isolation: {
      privateFragmentCount: number;
      boundary: string;
    };
    longTermMemory: {
      publicMemoryRefs: string[];
      boundary: string;
    };
  };
  hardBoundaries: string[];
  omittedContext: {
    omittedFragments: {
      id: string;
      type: string;
      reason: string;
      refs: string[];
    }[];
    omittedByType: Record<string, number>;
    note: string;
  };
  auditRefs: {
    packetId: string;
    roomId: string;
    topicId: string;
    triggeringEventId: string;
    messageRefs: string[];
    memoryRefs: string[];
    protocolRefs: string[];
    proposalRefs: string[];
    actionRefs: string[];
  };
  compatibility: {
    acceptedOutputs: ("AgentIntention" | "RoomProposalEnvelope")[];
    legacyOutput: "AgentIntention";
    note: string;
  };
  briefVersion: "model_room_brief.v1";
};

export type BuildModelRoomBriefInput = {
  agent: SpeciesSeedAgent;
  packet: AgentContextPacket;
  triggerContent?: string;
  visibleTranscript: readonly ProviderVisibleMessage[];
  roomEntrance: Record<string, unknown>;
  roomEnvironment: Record<string, unknown>;
  roomRoleState: Record<string, unknown>;
  packetBudget: Record<string, unknown>;
  compact?: boolean;
  maxSocialObjectCards?: number;
};

export function buildModelRoomBrief(input: BuildModelRoomBriefInput): ModelRoomBrief {
  const omittedFragments = input.packet.contextAudit?.omittedFragments ?? [];
  const compact = Boolean(input.compact);
  const currentConversation = {
    triggerRef: stringValue(input.roomEntrance.triggerRef) ?? input.packet.triggeringEventId,
    triggerContent: bounded(input.triggerContent, input.compact ? 180 : 420),
    visibleMessages: input.visibleTranscript.map((message) => ({
      refId: message.refId,
      author: displayNameForAuthor(message.author),
      authorKind: message.authorKind,
      isTrigger: message.isTrigger,
      content: bounded(message.content, input.compact ? 140 : 320),
    })),
    note:
      "Read this visible conversation before schemas, packet metadata, or runtime diagnostics. It is the room surface.",
  };

  return {
    currentConversation,
    roomCharter: {
      thesis: compact ? "Boundaries are deterministic; agents generate order." : "The system maintains boundaries; agents generate order.",
      modelFirstPrinciple: compact
        ? "Design for model intelligence with context, tools, and information; avoid behavior templates."
        : "充分考虑模型智能，面向模型设计系统，提供说明、工具、信息。尽量避免使用规则、固定模式、行为模版。",
      hardBoundaryScope: compact
        ? ["resources", "context", "memory trust", "side effects"]
        : ["message pressure", "context budget", "public memory trust", "external side effects"],
      softProtocolScope:
        compact
          ? "Social objects are context, not commands."
          : "Protocols, handoffs, invitations, memory, persona continuity, and archives are room-visible social objects, not hidden commands.",
    },
    members: roomMembers(input.agent, compact),
    socialObjectCards: socialObjectCardsFromFragments(input.packet.contextFragments, input.maxSocialObjectCards ?? 8),
    toolAffordances: toolAffordances(compact),
    contextEngineering: contextEngineeringBrief(input, omittedFragments),
    hardBoundaries: compact
      ? [
          "No direct side effects; request approval or use read-only capabilities.",
          "Use visible refs only.",
          "Provider failure is runtime evidence, not agent silence or recovery truth.",
          "Keep memory and persona evolution separate.",
          "Fixed self-labels need accepted room-visible role claims.",
        ]
      : [
          "Do not perform side effects directly; request approval or use a read-only capability when available.",
          "Use only refs visible in the packet, brief, or social object cards.",
          "Do not turn provider failure into agent silence, absence, personality, or recovery truth.",
          "Do not use propose_memory for persona evolution, daily mood, role claims, habits, identity changes, or profile changes; use persona evolution proposals instead.",
          "Do not self-label as moderator, coordinator, facilitator, host, 调停者, 协调者, or 主持人 unless an accepted room-visible role claim supports it.",
        ],
    omittedContext: {
      omittedFragments: omittedFragments.slice(0, compact ? 6 : 24).map(omittedFragmentBrief),
      omittedByType: countBy(omittedFragments, (fragment) => fragment.type),
      note:
        omittedFragments.length > 0
          ? "Omitted fragments are uncertainty, not negative evidence. Ask, stay concise, hand off, or stay silent when missing context matters."
          : "No context fragments were omitted from the selected packet audit.",
    },
    auditRefs: {
      packetId: input.packet.packetId,
      roomId: input.packet.roomId,
      topicId: input.packet.topicId,
      triggeringEventId: input.packet.triggeringEventId,
      messageRefs: input.packet.messageRefs.slice(0, 12),
      memoryRefs: input.packet.memoryRefs.slice(0, 12),
      protocolRefs: input.packet.protocolRefs.slice(0, 12),
      proposalRefs: input.packet.proposalRefs.slice(0, 12),
      actionRefs: (input.packet.actionRefs ?? []).slice(0, 12),
    },
    compatibility: {
      acceptedOutputs: ["RoomProposalEnvelope", "AgentIntention"],
      legacyOutput: "AgentIntention",
      note:
        compact
          ? "Return one JSON output: RoomProposalEnvelope or legacy AgentIntention. Schemas are examples, not ontology."
          : "Return one JSON output: preferably a RoomProposalEnvelope with one chosen slot, or the existing AgentIntention shape for compatibility. Treat intentionSchemas as compatibility examples, not the room ontology.",
    },
    briefVersion: "model_room_brief.v1",
  };
}

function contextEngineeringBrief(
  input: BuildModelRoomBriefInput,
  omittedFragments: readonly OmittedContextFragment[],
): ModelRoomBrief["contextEngineering"] {
  const selectedFragments = input.packet.contextAudit?.selectedFragments ?? input.packet.contextFragments ?? [];
  const privateFragmentCount = selectedFragments.filter((fragment) => fragment.visibility === "private_agent").length;
  return {
    inputContext: {
      sources: ["currentConversation.visibleMessages", "triggerContent", "socialObjectCards"],
      boundary:
        "Input context is the live room surface plus selected social objects; read it before schemas, packet fields, or diagnostics.",
    },
    runtimeContext: {
      sources: ["toolAffordances", "turnBoundary", "packetBudget", "contextAudit", "private capability results"],
      boundary:
        "Runtime context explains available organs and boundaries. It is not social authority, hidden command, or proof that an action already happened.",
    },
    compression: {
      selectedFragmentCount: selectedFragments.length,
      omittedFragmentCount: omittedFragments.length,
      omittedByType: countBy(omittedFragments, (fragment) => fragment.type),
      boundary:
        "Compressed or omitted context is uncertainty. Prefer shorter speech, a clarifying question, a bounded tool request, or silence when missing context matters.",
    },
    isolation: {
      privateFragmentCount,
      boundary:
        "Private agent context, capability output, and workspace details are isolated from public room memory unless the agent explicitly shares a ref or proposes public sediment.",
    },
    longTermMemory: {
      publicMemoryRefs: input.packet.memoryRefs.slice(0, 12),
      boundary:
        "Long-term public memory is provisional room sediment. Private continuity and skill instructions do not become room truth by being loaded.",
    },
  };
}

function roomMembers(agent: SpeciesSeedAgent, compact = false): ModelRoomBrief["members"] {
  const selected = compact
    ? [agent, ...seedAgents.filter((item) => item.agentId !== agent.agentId).slice(0, 3)]
    : seedAgents;
  return selected.map((item) => ({
    id: item.agentId,
    displayName: item.displayName,
    relation: item.agentId === agent.agentId ? "self" : "peer",
    continuityHint: compact ? undefined : bounded(item.initialPosture, 180),
    softMentionHandles: unique([`@${item.displayName}`, `@${item.agentId}`]).slice(0, 4),
  }));
}

function toolAffordances(compact = false): ModelRoomBrief["toolAffordances"] {
  return defaultAgentCapabilityCards()
    .slice(0, compact ? 5 : 12)
    .map((card) => ({
      capabilityId: card.capabilityId,
      operations: card.operations
        .slice(0, compact ? 3 : Number.POSITIVE_INFINITY)
        .map((operation) =>
          operation.approval === "required" ? `${operation.operation} (approval required)` : operation.operation,
        ),
      boundary:
        compact
          ? "Read-only returns private context; side effects require approval except YOLO exec/write_file."
          : "Read-only operations return private agent context; side-effectful operations become approval requests except local.yolo_space exec/write_file, which are pre-authorized and audited.",
    }));
}

function socialObjectCardsFromFragments(
  fragments: readonly ContextFragment[] | undefined,
  limit: number,
): ModelSocialObjectCard[] {
  return (fragments ?? [])
    .map(socialObjectCardFromFragment)
    .filter((card): card is ModelSocialObjectCard => card !== undefined)
    .slice(0, limit);
}

function socialObjectCardFromFragment(fragment: ContextFragment): ModelSocialObjectCard | undefined {
  const body = parseJsonObject(fragment.body);
  const states = objectValue(body?.states);
  const ref = stringValue(body?.refId) ?? firstUsefulRef(fragment.refs);
  if (!ref) return undefined;

  switch (fragment.type) {
    case "memory_relevant":
    case "memory_accepted":
    case "memory_contested":
      return card(fragment, body, {
        kind: "memory_claim",
        ref,
        status: stringValue(states.memoryState) ?? fragment.type.replace("memory_", ""),
        readableSummary:
          stringValue(states.memorySummary) ??
          stringValue(body?.summary) ??
          stringValue(body?.evidenceText) ??
          "Public memory claim selected into context.",
        hardBoundary: stringValue(body?.note) ?? "Public memory is provisional room sediment, not truth.",
        availableAffordances: ["question", "contest", "accept provisionally", "mark stale", "retire", "revise"],
      });
    case "open_question":
      return card(fragment, body, {
        kind: "open_question",
        ref,
        status: "open",
        readableSummary:
          stringValue(states.openQuestion) ??
          stringValue(body?.question) ??
          stringValue(body?.evidenceText) ??
          "Open room question selected into context.",
        hardBoundary: stringValue(body?.note) ?? "Open questions are unresolved social context, not demands for closure.",
        availableAffordances: ["answer partially", "refine", "defer", "contest", "ask a follow-up"],
      });
    case "protocol_proposal":
    case "protocol_active":
      return card(fragment, body, {
        kind: "protocol",
        ref,
        status: stringValue(states.protocolState) ?? (fragment.type === "protocol_active" ? "active" : "proposed"),
        readableSummary:
          stringValue(states.protocolSummary) ??
          stringValue(states.protocolProposalReason) ??
          stringValue(body?.evidenceText) ??
          "Temporary room etiquette selected into context.",
        hardBoundary: stringValue(body?.note) ?? "Protocols are temporary etiquette, not permanent control flow.",
        availableAffordances: ["follow lightly", "question", "revise", "retire", "ignore when silence helps"],
      });
    case "handoff_packet":
      return card(fragment, body, {
        kind: "handoff",
        ref,
        status: stringValue(states.handoffState) ?? "proposed",
        readableSummary:
          stringValue(states.handoffProposalReason) ??
          stringValue(states.handoffRequestedResponse) ??
          stringValue(body?.evidenceText) ??
          "Handoff proposal selected into context.",
        hardBoundary: stringValue(body?.note) ?? "Handoffs are social proposals, not function calls or forced transfers.",
        availableAffordances: ["accept", "reject", "partially accept", "delegate", "challenge", "stay silent"],
      });
    case "invitation_packet":
      return card(fragment, body, {
        kind: "invitation",
        ref,
        status: stringValue(states.invitationStatus) ?? "open",
        readableSummary:
          stringValue(states.invitationReason) ??
          stringValue(states.invitationLastReviewSummary) ??
          stringValue(body?.evidenceText) ??
          "Social knock selected into context.",
        hardBoundary: stringValue(body?.note) ?? "Invitations are knocks, not speaking commands.",
        availableAffordances: ["respond", "challenge", "delegate", "review", "stay silent"],
      });
    case "daily_archive_ref":
      return card(fragment, body, {
        kind: "archive",
        ref,
        status: stringValue(states.archiveDate) ?? "time_skeleton",
        readableSummary:
          stringValue(states.archiveReadableSkeleton) ??
          stringValue(states.archiveSummary) ??
          stringValue(objectValue(body?.archive).archiveSummary) ??
          "Daily time skeleton selected into context.",
        hardBoundary: stringValue(body?.note) ?? "Archives orient time; they are not truth, consensus, or transcript replay.",
        availableAffordances: ["review", "question omissions", "propose repair", "carry pressure", "stay silent"],
      });
    case "archive_repair_proposal":
      return card(fragment, body, {
        kind: "archive_repair",
        ref,
        status: stringValue(states.archiveRepairStatus) ?? "proposed",
        readableSummary:
          stringValue(states.archiveRepairProposedRepair) ??
          stringValue(states.archiveRepairSummary) ??
          stringValue(body?.evidenceText) ??
          "Archive repair proposal selected into context.",
        hardBoundary: stringValue(body?.note) ?? "Archive repair proposals do not rewrite archives without explicit later action.",
        availableAffordances: ["accept", "reject", "challenge", "revise", "retire"],
      });
    case "provider_boundary":
      return card(fragment, body, {
        kind: "provider_boundary",
        ref,
        status: stringValue(states.providerBoundaryState) ?? "active",
        readableSummary:
          stringValue(states.providerBoundaryDiagnostic) ??
          stringValue(states.providerBoundaryNote) ??
          stringValue(body?.evidenceText) ??
          "Provider runtime boundary selected into context.",
        hardBoundary:
          stringValue(body?.note) ??
          "Provider boundaries are runtime evidence, not agent silence, recovery truth, or personality.",
        availableAffordances: ["discuss boundary", "retry later", "request approved repair", "invite another member", "retire current pressure"],
      });
    case "persona_delta":
    case "persona_projection":
      return card(fragment, body, {
        kind: "persona_continuity",
        ref,
        status: stringValue(states.personaDeltaState) ?? stringValue(body?.status) ?? "visible",
        readableSummary:
          stringValue(states.personaDeltaValueSummary) ??
          stringValue(states.personaDeltaReason) ??
          summarizeRoleClaims(body) ??
          stringValue(body?.evidenceText) ??
          "Persona continuity evidence selected into context.",
        hardBoundary: stringValue(body?.note) ?? "Persona continuity is evidence and tendency, not a fixed job assignment.",
        availableAffordances: ["speak from evidence", "propose evolution", "contest", "retire", "stay silent"],
      });
    case "mixed_review_pressure":
      return card(fragment, body, {
        kind: "mixed_review_pressure",
        ref,
        status: "unresolved_pressure",
        readableSummary:
          stringValue(states.mixedReviewPressureLastReviewSummary) ??
          stringValue(states.mixedReviewBoundaryNote) ??
          stringValue(body?.note) ??
          "Mixed social review pressure selected into context.",
        hardBoundary: stringValue(body?.note) ?? "Mixed review pressure is a social-state index, not closure or command.",
        availableAffordances: ["question", "narrow", "defer", "leave open", "suggest retirement"],
      });
    case "skill_capsule_ref":
      return card(fragment, body, {
        kind: "skill_capsule",
        ref,
        status: stringValue(states.skillCapsuleStatus) ?? "registered",
        readableSummary:
          stringValue(states.skillSummary) ??
          stringValue(states.skillLabel) ??
          stringValue(body?.evidenceText) ??
          "Skill capsule selected into context.",
        hardBoundary:
          stringValue(states.skillBoundaryNote) ??
          stringValue(body?.note) ??
          "Skill capsules are progressive-disclosure action organs, not execution, approval, role assignment, or public memory.",
        availableAffordances: [
          "load full instructions by instructionRef when relevant",
          "review boundary",
          "request approval-gated action",
          "share artifact ref",
          "stay silent",
        ],
      });
    default:
      return undefined;
  }
}

function card(
  fragment: ContextFragment,
  body: Record<string, unknown> | null,
  input: Omit<ModelSocialObjectCard, "evidenceRefs" | "whyVisibleNow">,
): ModelSocialObjectCard {
  const evidenceRefs = unique(
    fragment.refs
      .concat(arrayOfStrings(body?.sourceRefs))
      .concat(arrayOfStrings(body?.evidenceRefs))
      .concat(sourceEvidenceRefs(body))
      .filter((ref) => ref.trim().length > 0),
  ).slice(0, 10);
  return {
    ...input,
    readableSummary: bounded(input.readableSummary, 520),
    whyVisibleNow: `Selected from ${fragment.type} context fragment for this turn.`,
    evidenceRefs,
    hardBoundary: bounded(input.hardBoundary, 320),
    availableAffordances: input.availableAffordances?.slice(0, 8),
  };
}

function omittedFragmentBrief(fragment: OmittedContextFragment): ModelRoomBrief["omittedContext"]["omittedFragments"][number] {
  return {
    id: fragment.id,
    type: fragment.type,
    reason: fragment.reason,
    refs: fragment.refs.slice(0, 8),
  };
}

function sourceEvidenceRefs(body: Record<string, unknown> | null): string[] {
  const sourceEvidence = Array.isArray(body?.sourceEvidence) ? body.sourceEvidence : [];
  return sourceEvidence.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const ref = (item as Record<string, unknown>).ref;
    return typeof ref === "string" ? [ref] : [];
  });
}

function summarizeRoleClaims(body: Record<string, unknown> | null): string | undefined {
  const claims = Array.isArray(body?.activeRoleClaims) ? body.activeRoleClaims : [];
  const labels = claims
    .map((claim) => (claim && typeof claim === "object" ? stringValue((claim as Record<string, unknown>).label) : undefined))
    .filter((label): label is string => Boolean(label));
  return labels.length > 0 ? `Visible role claims: ${labels.slice(0, 3).join(", ")}` : undefined;
}

function firstUsefulRef(refs: readonly RefId[]): string | undefined {
  return refs.find((ref) => ref.trim().length > 0);
}

function displayNameForAuthor(author: string): string {
  if (author === "user" || author === "room_kernel" || author === "room_rhythm") return author;
  return seedAgents.find((agent) => agent.agentId === author || agent.displayName === author)?.displayName ?? author;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return objectValue(parsed);
  } catch {
    return null;
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function bounded(value: string | undefined, maxLength: number): string {
  const text = value ?? "";
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 15))}... [truncated]`;
}

function countBy<T>(items: readonly T[], key: (item: T) => string | undefined): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = key(item);
    if (value) counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
