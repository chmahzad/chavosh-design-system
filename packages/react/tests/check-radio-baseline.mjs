// AUTHORED. Radio v1 regression guard (ADR 0016). Radio is a released reference implementation: its source, CSS,
// stories, docs, its own verification files, contract and ADR 0015 must stay byte-identical to the recorded baseline
// (commit 6d72708), and the resolved CSS contract of its 28 public tokens — every declaration of those names plus the
// internal --ch-brand-* declarations they reference — must be exactly the baseline set. Later components may add tokens,
// but may not redefine, override or add breakpoint overrides for Radio's. Same comparison as the Button guard.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compareButtonContract as compareContract } from "./check-button-baseline.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../../..");
function assert(c, m) { if (!c) throw new Error(m); }

export async function run() {
  const baseline = JSON.parse(readFileSync(join(HERE, "baseline/radio-v1.baseline.json"), "utf8"));
  const changed = Object.entries(baseline.files).filter(([f, sha]) => createHash("sha256").update(readFileSync(join(REPO, f))).digest("hex") !== sha).map(([f]) => f);
  assert(changed.length === 0, `Radio reference files changed since ${baseline.sourceCommit.slice(0, 7)}: ${changed.join(", ")} — Radio is a regression baseline (ADR 0016)`);
  const css = readFileSync(join(REPO, "packages/tokens/dist/ch-tokens.css"), "utf8");
  const problems = compareContract(css, baseline);
  assert(problems.length === 0, `Radio public token contract changed: ${problems.slice(0, 5).join("; ")}`);
  const first = baseline.declarations.find((d) => d.selector === ":root" && !d.media);
  const probes = [
    css.replace(`${first.name}: ${first.value};`, `${first.name}: 0;`),
    css.replace(`${first.name}: ${first.value};`, ""),
    `${css}\n@media (min-width: 48rem) {\n  :root {\n    ${first.name}: 1px;\n  }\n}\n`,
  ];
  for (const [i, p] of probes.entries()) assert(p !== css && compareContract(p, baseline).length > 0, `baseline self-test ${i} was not detected`);
  return [
    `files: ${Object.keys(baseline.files).length} Radio reference files byte-identical to ${baseline.sourceCommit.slice(0, 7)} (source, CSS, stories, docs, Radio checks, harness, types, contract, ADR 0015)`,
    `contract: ${baseline.publicTokens.length} public Radio tokens + ${baseline.declarations.length - baseline.publicTokens.length} referenced brand declarations — ${baseline.declarations.length} declarations exactly as committed; nothing added, removed or overridden`,
    "self-test: changed value, removed declaration and added breakpoint override are all detected",
  ];
}
