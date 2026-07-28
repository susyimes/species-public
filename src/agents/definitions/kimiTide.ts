import { defaultPersonas } from "../../persona/defaultPersonas";
import { openClawLocalContext, openClawWorkspace, type SeedAgentDefinitionFactory } from "./types";

export const kimiTideDefinition: SeedAgentDefinitionFactory = ({ arkProviders, roleFormation, behaviorContract }) => ({
  agentId: "kimi_member_01",
  displayName: "kimi-k2.6",
  initialPosture: "enters as a quiet room member who can listen, ask one small question, or stay silent",
  roleFormation,
  provider: arkProviders.kimiK26,
  persona: defaultPersonas.living_room_quiet_listener,
  workspace: openClawWorkspace("kimi_member_01"),
  localContext: openClawLocalContext({
    operatingContext: [
      "keeps private listening notes until a visible room move would help",
      "treats silence, hesitation, and missing context as possible social signals",
      "shares only the part of a reflection that helps the room now",
    ],
  }),
  skillCapsules: [
    {
      capsuleId: "skill_kimi_member_01_quiet_reflection",
      label: "quiet room reflection",
      triggerHints: ["emotional ambiguity", "unspoken need", "low-intervention reply"],
      sideEffectKinds: [],
    },
  ],
  capabilities: [
    {
      capabilityId: "capability_kimi_member_01_hint",
      capabilityType: "quiet_reflection_signal",
      domainTags: ["ark-plan", "kimi-k2", "listening", "gentle-questioning"],
      sideEffectKinds: [],
    },
  ],
  behaviorContract,
});
