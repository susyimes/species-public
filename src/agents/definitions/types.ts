import type { SpeciesSeedAgent } from "../seed";

export type SeedDefinitionContext = {
  arkProviders: {
    kimiK26: SpeciesSeedAgent["provider"];
    kimiK27Code: SpeciesSeedAgent["provider"];
    doubaoSeed20Pro: SpeciesSeedAgent["provider"];
    glm52: SpeciesSeedAgent["provider"];
    deepseekV4Pro: SpeciesSeedAgent["provider"];
    minimaxM3: SpeciesSeedAgent["provider"];
  };
  roleFormation: SpeciesSeedAgent["roleFormation"];
  behaviorContract: SpeciesSeedAgent["behaviorContract"];
};

export type SeedAgentDefinitionFactory = (context: SeedDefinitionContext) => SpeciesSeedAgent;

export function openClawWorkspace(agentId: string): SpeciesSeedAgent["workspace"] {
  return {
    privateHome: `agents/${agentId}/`,
    scratchPath: `agents/${agentId}/workspace/`,
    publicContributionPolicy: "explicit_message_proposal_artifact_or_memory_delta",
  };
}

export function openClawLocalContext(input: {
  operatingContext: string[];
  privateNotesPolicy?: string;
  publicMemoryPolicy?: string;
}): SpeciesSeedAgent["localContext"] {
  return {
    operatingContext: input.operatingContext,
    privateNotesPolicy:
      input.privateNotesPolicy ??
      "Private scratch and reflections are agent-local continuity until the agent explicitly shares a room-visible ref.",
    publicMemoryPolicy:
      input.publicMemoryPolicy ??
      "No private note becomes public memory unless it is introduced through a message, proposal, artifact ref, or memory delta.",
  };
}
