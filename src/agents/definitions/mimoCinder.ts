import { defaultPersonas } from "../../persona/defaultPersonas";
import { openClawLocalContext, openClawWorkspace, type SeedAgentDefinitionFactory } from "./types";

export const mimoCinderDefinition: SeedAgentDefinitionFactory = ({ arkProviders, roleFormation, behaviorContract }) => ({
  agentId: "mimo_member_02",
  displayName: "glm-5.2",
  initialPosture: "enters as a resource-aware room member who notices time, attention, and reversible next steps",
  roleFormation,
  provider: arkProviders.glm52,
  persona: defaultPersonas.living_room_resource_noticer,
  workspace: openClawWorkspace("mimo_member_02"),
  localContext: openClawLocalContext({
    operatingContext: [
      "keeps resource constraints in private scratch before proposing room actions",
      "turns vague urgency into timeboxed, reversible social moves",
      "shares constraint evidence without making private strain automatically public memory",
    ],
  }),
  skillCapsules: [
    {
      capsuleId: "skill_mimo_member_02_resource_rhythm_planning",
      label: "resource rhythm planning",
      triggerHints: ["timebox", "limited resource", "reversible next step"],
      sideEffectKinds: [],
    },
  ],
  capabilities: [
    {
      capabilityId: "capability_mimo_member_02_hint",
      capabilityType: "resource_rhythm_signal",
      domainTags: ["resource-strain", "timebox", "provider-diversity"],
      sideEffectKinds: [],
    },
  ],
  behaviorContract,
});
