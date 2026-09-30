// AUTHORED. Button v1 regression guard (ADR 0012; amendments recorded in the baseline with their ADR, e.g. ADR 0013). Button is the frozen reference implementation: its source, CSS,
// stories, docs, its own verification files and ADR 0010 must stay byte-identical to the published baseline, and
// the resolved CSS contract of its 37 public tokens — every declaration of those names (selector, media query,
// value) plus the internal --ch-brand-* declarations they reference — must be exactly the baseline set. A new
// component may add tokens, but may not redefine, override or add breakpoint overrides for Button's tokens.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCss } from "../../tokens/tests/lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../../..");
function assert(c, m) { if (!c) throw new Error(m); }

export function compareButtonContract(cssText, baseline) {
  const names = new Set(baseline.publicTokens);
  const blocks = parseCss(cssText);
  const refs = new Set(baseline.declarations.filter((d) => d.name.startsWith("--ch-brand-")).map((d) => d.name));
  const key = (d) => `${d.media ?? ""} | ${d.selector} | ${d.name}`;
  const actual = new Map();
  for (const b of blocks) for (const [n, v] of b.decls) if (names.has(n) || refs.has(n)) actual.set(key({ media: b.media || null, selector: b.selector, name: n }), v);
  const expected = new Map(baseline.declarations.map((d) => [key(d), d.value]));
  const problems = [];
  for (const [k, v] of expected) if (!actual.has(k)) problems.push(`missing ${k}`); else if (actual.get(k) !== v) problems.push(`changed ${k}: ${v} → ${actual.get(k)}`);
  for (const k of actual.keys()) if (!expected.has(k)) problems.push(`added ${k}`);
  return problems;
}

export async function run() {
  const baseline = JSON.parse(readFileSync(join(HERE, "baseline/button-v1.baseline.json"), "utf8"));
  const changed = Object.entries(baseline.files).filter(([f, sha]) => createHash("sha256").update(readFileSync(join(REPO, f))).digest("hex") !== sha).map(([f]) => f);
  assert(changed.length === 0, `Button reference files changed since ${baseline.sourceCommit.slice(0, 7)}: ${changed.join(", ")} — Button is frozen (ADR 0012)`);
  // Approved amendments (each with its ADR): the recorded hash must be the amendment's result, and the ADR must exist.
  for (const a of baseline.amendments || []) {
    assert(baseline.files[a.file] === a.to && a.from !== a.to && /^[0-9a-f]{64}$/.test(a.from), `baseline amendment for ${a.file} is inconsistent`);
    readFileSync(join(REPO, a.adr));
  }
  const css = readFileSync(join(REPO, "packages/tokens/dist/ch-tokens.css"), "utf8");
  const problems = compareButtonContract(css, baseline);
  assert(problems.length === 0, `Button public token contract changed: ${problems.slice(0, 5).join("; ")}`);
  // Self-test: the comparison must catch a changed value, a missing declaration and an added override.
  const first = baseline.declarations.find((d) => d.selector === ":root" && !d.media);
  const probes = [
    css.replace(`${first.name}: ${first.value};`, `${first.name}: 0;`),
    css.replace(`${first.name}: ${first.value};`, ""),
    `${css}\n@media (min-width: 48rem) {\n  :root {\n    ${first.name}: 1px;\n  }\n}\n`,
  ];
  for (const [i, p] of probes.entries()) assert(p !== css && compareButtonContract(p, baseline).length > 0, `baseline self-test ${i} was not detected`);
  return [
    `files: ${Object.keys(baseline.files).length} Button reference files byte-identical to ${baseline.sourceCommit.slice(0, 7)} (source, CSS, stories, docs, Button checks, harness, spec, ADR 0010)${(baseline.amendments || []).length ? `; approved amendments: ${baseline.amendments.map((a) => `${a.file.split("/").pop()} (${a.adr.split("/").pop().slice(0, 4)})`).join(", ")}` : ""}`,
    `contract: ${baseline.publicTokens.length} public Button tokens + ${baseline.declarations.length - baseline.publicTokens.length} referenced brand declarations — ${baseline.declarations.length} declarations exactly as published; nothing added, removed or overridden`,
    "self-test: changed value, removed declaration and added breakpoint override are all detected",
  ];
}
