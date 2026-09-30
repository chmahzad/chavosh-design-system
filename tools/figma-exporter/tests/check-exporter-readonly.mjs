// AUTHORED. Exporter (extractor v0.3.0, plugin v0.4.0) is read-only: static scan for mutation APIs, write-throwing mock self-test,
// and a dynamic run that may only call allow-listed getters.
import { read, assert, loadExtractor, loadFixture, createReadOnlyFigma, FIXTURE_ROOTS, ALLOWED_CALLS } from "./mock.mjs";

const FORBIDDEN = [
  /\bcreate[A-Z]\w*\s*\(/, /\bset[A-Z]\w*\s*\(/, /\.remove\s*\(/, /\bdelete\s+\w/, /\bimport\w*Async\s*\(/,
  /\bload\w*Async\s*\(/, /\b(commitUndo|saveVersionHistoryAsync|triggerUndo)\b/,
  /\.(description|name|scopes|codeSyntax|effects|boundVariables|valuesByMode|key|characters|fills|strokes|visible|textStyleId|skipInvisibleInstanceChildren|currentPage)\s*=[^=]/,
];

export async function run() {
  for (const f of ["src/extract.js", "code.js"]) {
    const code = read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const re of FORBIDDEN) assert(!re.test(code), `${f} contains a forbidden mutation pattern ${re}`);
  }
  const { figma: probe } = createReadOnlyFigma(loadFixture());
  const mustThrow = [
    async () => { (await probe.variables.getVariableByIdAsync("VariableID:5:5")).description = "x"; },
    async () => { (await probe.getNodeByIdAsync("20:3")).name = "x"; },
    async () => { (await probe.getNodeByIdAsync("20:3")).fills[0].color.r = 1; },
    async () => { (await probe.getStyleByIdAsync("S:synthlabelmd,")).fontSize = 1; },
    async () => { (await probe.getNodeByIdAsync("20:3")).setBoundVariable(); },
    async () => { probe.setCurrentPageAsync(); },
    async () => { probe.skipInvisibleInstanceChildren = false; },
  ];
  for (const [i, f] of mustThrow.entries()) {
    let threw = false;
    try { await f(); } catch { threw = true; }
    assert(threw, `mock self-test ${i} did not throw — the read-only mock is not trustworthy`);
  }
  const { figma, calls } = createReadOnlyFigma(loadFixture(), { shuffle: true });
  await loadExtractor()(figma, FIXTURE_ROOTS);
  const used = [...new Set(calls)].sort();
  const bad = used.filter((c) => !ALLOWED_CALLS.includes(c));
  assert(bad.length === 0, `extractor called non-allow-listed APIs: ${bad.join(", ")}`);
  return [
    "static scan: no Figma mutation APIs or property writes in extract.js / code.js",
    `mock self-test: ${mustThrow.length}/${mustThrow.length} write/mutator attempts throw`,
    `dynamic run: ${calls.length} calls, only allow-listed getters (${used.map((c) => c.split(".").pop()).join(", ")})`,
  ];
}
