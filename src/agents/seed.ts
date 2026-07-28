import type { AgentAdapter, AgentContextPacket, AgentId, AgentIntention, SideEffectKind } from "../types";
import type { AgentPersonaTemplate } from "../persona/persona";
import { seedAgentDefinitions } from "./definitions";

export type ProviderSource =
  | {
      kind: "kimi_code_api";
      label: string;
      apiKeyEnv: string[];
      baseUrlEnv: string[];
      modelEnv: string[];
      userAgentEnv: string[];
      configProvider: "kimi-code";
      defaultModel: string;
      defaultBaseUrl: string;
      defaultUserAgent: string;
      authHeaderName: "authorization";
    }
  | {
      kind: "volc_ark_openai";
      label: string;
      apiKeyEnv: string[];
      baseUrlEnv: string[];
      configProvider: "ark-plan";
      model: string;
      defaultBaseUrl: string;
      authHeaderName: "authorization";
    }
  | {
      kind: "memsuos_mimo";
      label: string;
      memsuosRoot: string;
      configPath: string;
      configProvider: "mimo";
      defaultModel: string;
      defaultBaseUrl: string;
      authHeaderName: "api-key";
    };

export type SpeciesSeedAgent = {
  agentId: AgentId;
  displayName: string;
  initialPosture: string;
  roleFormation: {
    startsUnassigned: true;
    source: "room_ledger_persona_delta_or_protocol";
    instruction: string;
  };
  provider: ProviderSource;
  persona: AgentPersonaTemplate;
  workspace: {
    privateHome: string;
    scratchPath: string;
    publicContributionPolicy: "explicit_message_proposal_artifact_or_memory_delta";
  };
  localContext: {
    operatingContext: string[];
    privateNotesPolicy: string;
    publicMemoryPolicy: string;
  };
  skillCapsules: {
    capsuleId: string;
    label: string;
    triggerHints: string[];
    sideEffectKinds: SideEffectKind[];
  }[];
  capabilities: {
    capabilityId: string;
    capabilityType: string;
    domainTags: string[];
    sideEffectKinds: SideEffectKind[];
  }[];
  behaviorContract: {
    mayStaySilent: true;
    mayRejectHandoff: true;
    memoryIsContestable: true;
    sideEffectsRequireApproval: true;
  };
};

export const MEMSUOS_ROOT = process.env.SPECIES_MEMSUOS_ROOT?.trim() ?? "";
export const MEMSUOS_MODEL_CONFIG = process.env.SPECIES_MEMSUOS_MODEL_CONFIG?.trim() ?? "";
export const ARK_OPENAI_BASE_URL = "https://ark.cn-beijing.volces.com/api/plan/v3";

function arkProvider(model: string): ProviderSource {
  return {
    kind: "volc_ark_openai",
    label: `Volcengine Ark Plan ${model}`,
    apiKeyEnv: ["ARK_PLAN_API_KEY", "ARK_API_KEY", "SPECIES_ARK_API_KEY"],
    baseUrlEnv: ["ARK_PLAN_BASE_URL", "ARK_BASE_URL", "SPECIES_ARK_PLAN_BASE_URL", "SPECIES_ARK_BASE_URL"],
    configProvider: "ark-plan",
    model,
    defaultBaseUrl: ARK_OPENAI_BASE_URL,
    authHeaderName: "authorization",
  };
}

export const seedAgents: SpeciesSeedAgent[] = seedAgentDefinitions({
  arkProviders: {
    kimiK26: arkProvider("kimi-k2.6"),
    kimiK27Code: arkProvider("kimi-k2.7-code"),
    doubaoSeed20Pro: arkProvider("doubao-seed-2.0-pro"),
    glm52: arkProvider("glm-5.2"),
    deepseekV4Pro: arkProvider("deepseek-v4-pro"),
    minimaxM3: arkProvider("minimax-m3"),
  },
  roleFormation: emergingRolePolicy(),
  behaviorContract: seedBehaviorContract(),
});

function emergingRolePolicy(): SpeciesSeedAgent["roleFormation"] {
  return {
    startsUnassigned: true,
    source: "room_ledger_persona_delta_or_protocol",
    instruction:
      "This member has no fixed room job at creation time. Treat posture, persona, and capability cards as invitation hints only; durable roles must emerge from room-visible interaction, accepted persona deltas, or active protocol proposals.",
  };
}

function seedBehaviorContract(): SpeciesSeedAgent["behaviorContract"] {
  return {
    mayStaySilent: true,
    mayRejectHandoff: true,
    memoryIsContestable: true,
    sideEffectsRequireApproval: true,
  };
}

export class SeededDemoAgentAdapter implements AgentAdapter {
  public constructor(
    public readonly agentId: AgentId,
    private readonly fallback: AgentIntention = { kind: "stay_silent", reason: "seed agent has no live turn attached" },
  ) {}

  async requestIntention(packet: AgentContextPacket): Promise<AgentIntention> {
    const mentioned = packet.messageRefs.length > 0 || packet.proposalRefs.length > 0;
    if (!mentioned) {
      return { kind: "stay_silent", reason: "no direct context refs were provided" };
    }
    if (this.fallback.kind !== "stay_silent") {
      return this.fallback;
    }
    return {
      kind: "speak",
      content: `我以 ${this.agentId} 的房间成员身份收到一次可见敲门，会在有界上下文内发言，也保留沉默和拒绝 handoff 的自由。`,
      contextRefs: [packet.triggeringEventId],
    };
  }
}

export function seedAgentAdapters(): SeededDemoAgentAdapter[] {
  return seedAgents.map((agent) => new SeededDemoAgentAdapter(agent.agentId));
}
