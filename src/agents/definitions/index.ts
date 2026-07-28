import type { SpeciesSeedAgent } from "../seed";
import { kimiTideDefinition } from "./kimiTide";
import { kimiRedPathDefinition } from "./kimiRedPath";
import { mimoBrickDefinition } from "./mimoBrick";
import { mimoCinderDefinition } from "./mimoCinder";
import { mimoSwanDefinition } from "./mimoSwan";
import { mimoThimbleDefinition } from "./mimoThimble";
import type { SeedDefinitionContext } from "./types";

const factories = [
  kimiTideDefinition,
  kimiRedPathDefinition,
  mimoBrickDefinition,
  mimoCinderDefinition,
  mimoSwanDefinition,
  mimoThimbleDefinition,
];

export function seedAgentDefinitions(context: SeedDefinitionContext): SpeciesSeedAgent[] {
  return factories.map((factory) => factory(context));
}

export type { SeedDefinitionContext } from "./types";
