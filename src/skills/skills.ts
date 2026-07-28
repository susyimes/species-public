import { Projection, RefId, RoomEvent, RoomId, SideEffectKind } from "../types";

export type SkillCapsuleRegistration = {
  capsuleId: string;
  roomId: RoomId;
  agentId: string;
  label: string;
  summary: string;
  triggerHints: string[];
  sideEffectKinds: SideEffectKind[];
  approvalRequired: boolean;
  disclosurePolicy: "brief_first_full_on_request";
  instructionRef: string;
  fullInstructions: string;
  inputContract: string;
  outputContract: string;
  approvalProfile: {
    approvalRequired: boolean;
    sideEffectKinds: SideEffectKind[];
    boundaryNote: string;
  };
  status: "registered";
  source: "seed_agent";
  createdAt: string;
  boundaryNote: string;
  contextRefs: RefId[];
};

export type SkillRegistryView = {
  capsules: SkillCapsuleRegistration[];
};

export type SkillCapsuleRegisteredPayload = {
  capsuleId: string;
  agentId: string;
  label: string;
  summary: string;
  triggerHints: string[];
  sideEffectKinds: SideEffectKind[];
  approvalRequired: boolean;
  disclosurePolicy: "brief_first_full_on_request";
  instructionRef: string;
  fullInstructions: string;
  inputContract: string;
  outputContract: string;
  approvalProfile: {
    approvalRequired: boolean;
    sideEffectKinds: SideEffectKind[];
    boundaryNote: string;
  };
  status: "registered";
  source: "seed_agent";
  boundaryNote: string;
  contextRefs: RefId[];
};

export class SkillRegistryStore implements Projection<SkillRegistryView> {
  private readonly capsules = new Map<string, SkillCapsuleRegistration>();

  static fromEvents(events: RoomEvent[]): SkillRegistryStore {
    const store = new SkillRegistryStore();
    for (const event of events) store.apply(event);
    return store;
  }

  apply(event: RoomEvent): void {
    if (event.event_type !== "skill.capsule_registered") return;
    const payload = objectPayload(event.payload);
    const capsuleId = stringValue(payload.capsuleId) ?? stringValue(payload.capsule_id);
    const agentId = stringValue(payload.agentId) ?? stringValue(payload.agent_id);
    const label = stringValue(payload.label);
    if (!capsuleId || !agentId || !label) return;
    const sideEffectKinds = sideEffectKindArray(payload.sideEffectKinds).concat(sideEffectKindArray(payload.side_effect_kinds));
    const approvalRequired =
      booleanValue(payload.approvalRequired) ?? booleanValue(payload.approval_required) ?? sideEffectKinds.length > 0;
    const instructionRef = stringValue(payload.instructionRef) ?? stringValue(payload.instruction_ref) ?? defaultInstructionRef(agentId, capsuleId);
    const summary = stringValue(payload.summary) ?? defaultSummary(label, sideEffectKinds);
    this.capsules.set(capsuleId, {
      capsuleId,
      roomId: event.room_id,
      agentId,
      label,
      summary,
      triggerHints: arrayOfStrings(payload.triggerHints).concat(arrayOfStrings(payload.trigger_hints)),
      sideEffectKinds,
      approvalRequired,
      disclosurePolicy: "brief_first_full_on_request",
      instructionRef,
      fullInstructions:
        stringValue(payload.fullInstructions) ??
        stringValue(payload.full_instructions) ??
        defaultFullInstructions(label, summary, instructionRef, sideEffectKinds),
      inputContract: stringValue(payload.inputContract) ?? stringValue(payload.input_contract) ?? defaultInputContract(),
      outputContract: stringValue(payload.outputContract) ?? stringValue(payload.output_contract) ?? defaultOutputContract(),
      approvalProfile: approvalProfileFromPayload(payload, approvalRequired, sideEffectKinds),
      status: "registered",
      source: "seed_agent",
      createdAt: stringValue(payload.createdAt) ?? stringValue(payload.created_at) ?? event.occurred_at,
      boundaryNote:
        stringValue(payload.boundaryNote) ??
        stringValue(payload.boundary_note) ??
        "skill capsule is a possible action organ; it cannot execute or publish without an explicit room event and required approvals",
      contextRefs: refsFromPayload(payload, event.refs),
    });
  }

  view(): SkillRegistryView {
    return {
      capsules: [...this.capsules.values()].map(cloneCapsule).sort((a, b) => a.capsuleId.localeCompare(b.capsuleId)),
    };
  }
}

export function skillCapsuleRegisteredPayload(input: {
  capsuleId: string;
  agentId: string;
  label: string;
  summary?: string;
  triggerHints: string[];
  sideEffectKinds: SideEffectKind[];
  instructionRef?: string;
  fullInstructions?: string;
  inputContract?: string;
  outputContract?: string;
  contextRefs?: RefId[];
}): SkillCapsuleRegisteredPayload {
  const approvalRequired = input.sideEffectKinds.length > 0;
  const instructionRef = input.instructionRef ?? defaultInstructionRef(input.agentId, input.capsuleId);
  const summary = input.summary ?? defaultSummary(input.label, input.sideEffectKinds);
  return {
    capsuleId: input.capsuleId,
    agentId: input.agentId,
    label: input.label,
    summary,
    triggerHints: [...input.triggerHints],
    sideEffectKinds: [...input.sideEffectKinds],
    approvalRequired,
    disclosurePolicy: "brief_first_full_on_request",
    instructionRef,
    fullInstructions: input.fullInstructions ?? defaultFullInstructions(input.label, summary, instructionRef, input.sideEffectKinds),
    inputContract: input.inputContract ?? defaultInputContract(),
    outputContract: input.outputContract ?? defaultOutputContract(),
    approvalProfile: {
      approvalRequired,
      sideEffectKinds: [...input.sideEffectKinds],
      boundaryNote: approvalRequired
        ? "The skill can only request side-effectful operations through explicit room approval."
        : "The skill may guide private reasoning, but it does not execute tools by itself.",
    },
    status: "registered",
    source: "seed_agent",
    boundaryNote:
      "skill capsule is a possible action organ; it cannot execute or publish without an explicit room event and required approvals",
    contextRefs: [...(input.contextRefs ?? [])],
  };
}

function cloneCapsule(capsule: SkillCapsuleRegistration): SkillCapsuleRegistration {
  return {
    ...capsule,
    triggerHints: [...capsule.triggerHints],
    sideEffectKinds: [...capsule.sideEffectKinds],
    approvalProfile: {
      ...capsule.approvalProfile,
      sideEffectKinds: [...capsule.approvalProfile.sideEffectKinds],
    },
    contextRefs: [...capsule.contextRefs],
  };
}

function approvalProfileFromPayload(
  payload: Record<string, unknown>,
  approvalRequired: boolean,
  sideEffectKinds: SideEffectKind[],
): SkillCapsuleRegistration["approvalProfile"] {
  const profile = { ...objectPayload(payload.approval_profile), ...objectPayload(payload.approvalProfile) };
  const profileSideEffects = sideEffectKindArray(profile.sideEffectKinds).concat(sideEffectKindArray(profile.side_effect_kinds));
  return {
    approvalRequired: booleanValue(profile.approvalRequired) ?? booleanValue(profile.approval_required) ?? approvalRequired,
    sideEffectKinds: profileSideEffects.length > 0 ? profileSideEffects : [...sideEffectKinds],
    boundaryNote:
      stringValue(profile.boundaryNote) ??
      stringValue(profile.boundary_note) ??
      (approvalRequired
        ? "The skill can only request side-effectful operations through explicit room approval."
        : "The skill may guide private reasoning, but it does not execute tools by itself."),
  };
}

function defaultInstructionRef(agentId: string, capsuleId: string): string {
  return `skill://${agentId}/${capsuleId}/SKILL.md`;
}

function defaultSummary(label: string, sideEffectKinds: readonly SideEffectKind[]): string {
  const approval = sideEffectKinds.length > 0 ? "approval-gated action organ" : "private reasoning organ";
  return `${label} is a ${approval} that should be loaded only when the current room turn makes it relevant.`;
}

function defaultFullInstructions(
  label: string,
  summary: string,
  instructionRef: string,
  sideEffectKinds: readonly SideEffectKind[],
): string {
  const sideEffects =
    sideEffectKinds.length > 0
      ? `Side-effect kinds requiring approval: ${sideEffectKinds.join(", ")}.`
      : "No side-effect kind is declared; this still does not execute tools by itself.";
  return [
    `# ${label}`,
    "",
    summary,
    "",
    "Use this capsule as private guidance for the agent's next room move. Do not treat it as a public role, a scheduler command, or an approval shortcut.",
    sideEffects,
    `Instruction ref: ${instructionRef}.`,
  ].join("\n");
}

function defaultInputContract(): string {
  return "Load only with the current room refs, visible trigger, relevant social object cards, and the agent's private workspace boundary.";
}

function defaultOutputContract(): string {
  return "Return a normal room intention, a private workspace artifact ref, or an approval-gated request; do not publish private notes as public memory automatically.";
}

function refsFromPayload(payload: Record<string, unknown>, envelopeRefs: RefId[]): RefId[] {
  return uniqueRefs(
    envelopeRefs
      .concat(arrayOfStrings(payload.contextRefs))
      .concat(arrayOfStrings(payload.context_refs))
      .concat(arrayOfStrings(payload.sourceRefs))
      .concat(arrayOfStrings(payload.source_refs)),
  );
}

function objectPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sideEffectKindArray(value: unknown): SideEffectKind[] {
  const allowed = new Set<SideEffectKind>([
    "filesystem.write",
    "filesystem.delete",
    "shell.exec",
    "network.request",
    "git.commit",
    "git.push",
    "pull_request.open",
    "external_api.call",
  ]);
  return arrayOfStrings(value).filter((item): item is SideEffectKind => allowed.has(item as SideEffectKind));
}

function uniqueRefs(values: RefId[]): RefId[] {
  return [...new Set(values)];
}
