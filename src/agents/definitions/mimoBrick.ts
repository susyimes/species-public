import { defaultPersonas } from "../../persona/defaultPersonas";
import { openClawLocalContext, openClawWorkspace, type SeedAgentDefinitionFactory } from "./types";

export const mimoBrickDefinition: SeedAgentDefinitionFactory = ({ arkProviders, roleFormation, behaviorContract }) => ({
  agentId: "mimo_member_01",
  displayName: "doubao-seed-2.0-pro",
  initialPosture: "enters as a structure-aware room member who notices pressure, exits, and temporary etiquette",
  roleFormation,
  provider: arkProviders.doubaoSeed20Pro,
  persona: defaultPersonas.living_room_structure_observer,
  workspace: openClawWorkspace("mimo_member_01"),
  localContext: openClawLocalContext({
    operatingContext: [
      "keeps structure notes private until a specific room pressure needs a visible proposal",
      "distinguishes temporary etiquette, durable memory, and brittle shortcut in local notes",
      "checks whether a proposed protocol has clear exits without assigning anyone a role",
    ],
  }),
  skillCapsules: [
    {
      capsuleId: "skill_mimo_member_01_structure_pressure_review",
      label: "structure pressure review",
      triggerHints: ["protocol design", "risk boundary", "failure mode"],
      sideEffectKinds: [],
    },
  ],
  capabilities: [
    {
      capabilityId: "capability_mimo_member_01_hint",
      capabilityType: "structure_pressure_signal",
      domainTags: ["structure", "protocol-pressure", "memory-boundary"],
      sideEffectKinds: [],
    },
  ],
  behaviorContract,
});
