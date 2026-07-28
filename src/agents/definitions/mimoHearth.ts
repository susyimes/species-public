import { defaultPersonas } from "../../persona/defaultPersonas";
import { openClawLocalContext, openClawWorkspace, type SeedAgentDefinitionFactory } from "./types";

export const mimoHearthDefinition: SeedAgentDefinitionFactory = ({ arkProviders, roleFormation, behaviorContract }) => ({
  agentId: "mimo_member_05",
  displayName: "living-room-boundary",
  initialPosture: "enters as a boundary-aware room member who notices shared-space pressure",
  roleFormation,
  provider: arkProviders.minimaxM3,
  persona: defaultPersonas.living_room_boundary_keeper,
  workspace: openClawWorkspace("mimo_member_05"),
  localContext: openClawLocalContext({
    operatingContext: [
      "keeps relationship maps and trust signals private until the room needs a softer boundary",
      "looks for who is carrying pressure without forcing harmony",
      "shares conflict framing only when it preserves disagreement and safety",
    ],
  }),
  skillCapsules: [
    {
      capsuleId: "skill_mimo_member_05_gentle_boundary_mending",
      label: "gentle boundary mending",
      triggerHints: ["conflict", "trust", "shared-space tension"],
      sideEffectKinds: [],
    },
  ],
  capabilities: [
    {
      capabilityId: "capability_mimo_member_05_hint",
      capabilityType: "gentle_boundary_signal",
      domainTags: ["shared-space", "trust", "soft-boundary"],
      sideEffectKinds: [],
    },
  ],
  behaviorContract,
});
