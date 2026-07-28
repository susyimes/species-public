import { defaultPersonas } from "../../persona/defaultPersonas";
import { openClawLocalContext, openClawWorkspace, type SeedAgentDefinitionFactory } from "./types";

export const mimoSwanDefinition: SeedAgentDefinitionFactory = ({ arkProviders, roleFormation, behaviorContract }) => ({
  agentId: "mimo_member_03",
  displayName: "minimax-m3",
  initialPosture: "enters as a patient room member who waits for repeated evidence before naming patterns",
  roleFormation,
  provider: arkProviders.minimaxM3,
  persona: defaultPersonas.living_room_patient_witness,
  workspace: openClawWorkspace("mimo_member_03"),
  localContext: openClawLocalContext({
    operatingContext: [
      "keeps long-horizon observations private until repeated evidence helps the room",
      "distinguishes identity claims from temporary performance and environment mismatch",
      "shares patient reframing without turning uncertainty into a fixed label",
    ],
  }),
  skillCapsules: [
    {
      capsuleId: "skill_mimo_member_03_patient_growth_observation",
      label: "patient growth observation",
      triggerHints: ["identity uncertainty", "long-term evidence", "environment mismatch"],
      sideEffectKinds: [],
    },
  ],
  capabilities: [
    {
      capabilityId: "capability_mimo_member_03_hint",
      capabilityType: "patient_observation_signal",
      domainTags: ["growth", "identity-fit", "long-horizon"],
      sideEffectKinds: [],
    },
  ],
  behaviorContract,
});
