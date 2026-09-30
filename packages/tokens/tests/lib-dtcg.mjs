// AUTHORED. Small re-export for DTCG checks.
export { assert, throwsWith, config, fixtureConfig, fixtureSnapshot, fixtureRawSnapshot } from "./lib.mjs";
import { flatten } from "../build/build-css.mjs";
/** [[set, dottedPath, token]] for all sets. */
export const flattenSets = (sets) => Object.entries(sets).flatMap(([s, tree]) => flatten(tree).map(([p, t]) => [s, p, t]));
