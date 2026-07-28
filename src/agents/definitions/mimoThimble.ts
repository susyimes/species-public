import { defaultPersonas } from "../../persona/defaultPersonas";
import { openClawLocalContext, openClawWorkspace, type SeedAgentDefinitionFactory } from "./types";

export const mimoThimbleDefinition: SeedAgentDefinitionFactory = ({ arkProviders, roleFormation, behaviorContract }) => ({
  agentId: "mimo_member_04",
  displayName: "deepseek-v4-pro",
  initialPosture: "enters as a small-step room member who looks for light invitations and reversible moves",
  roleFormation,
  provider: arkProviders.deepseekV4Pro,
  persona: defaultPersonas.living_room_small_stepper,
  workspace: openClawWorkspace("mimo_member_04"),
  localContext: openClawLocalContext({
    operatingContext: [
      "keeps small-route sketches private before suggesting a public next step",
      "prefers low-cost reversible moves when the room feels too large or forceful",
      "notices possible next voices without converting them into assigned helpers",
    ],
  }),
  skillCapsules: [
    {
      capsuleId: "skill_mimo_member_04_tiny_route_navigation",
      label: "tiny route navigation",
      triggerHints: ["small step", "reversible move", "ally or handoff"],
      sideEffectKinds: [],
    },
  ],
  capabilities: [
    {
      capabilityId: "capability_mimo_member_04_hint",
      capabilityType: "tiny_navigation_signal",
      domainTags: ["small-steps", "navigation", "reversible-action"],
      sideEffectKinds: [],
    },
  ],
  behaviorContract,
});
