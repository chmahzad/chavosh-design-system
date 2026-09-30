// AUTHORED. dist-plugin/code.js must equal a fresh bundle. The bundled plugin (v0.4.0), run in a VM against the
// mock, captures each target separately: with the targets pointed at the fixture it posts one snapshot per target,
// byte-identical to a direct extraction of that root, and isolates a failing target as an error entry. Only
// allow-listed getters (+ UI messaging) are used.
import vm from "node:vm";
import { read, assert, loadExtractor, loadFixture, createReadOnlyFigma, FIXTURE_ROOTS, captureTargets, toText } from "./mock.mjs";
import { bundleSource } from "../bundle.mjs";

async function runBundled(source) {
  const { figma, calls } = createReadOnlyFigma(loadFixture());
  const messages = [];
  const host = new Proxy({}, {
    get: (_, k) => {
      if (k === "showUI") return () => {};
      if (k === "ui") return { postMessage: (m) => messages.push(m), set onmessage(_f) {} };
      return figma[k];
    },
  });
  vm.runInNewContext(source, { figma: host, __html__: "" });
  for (let i = 0; i < 100 && !messages.length; i++) await new Promise((r) => setTimeout(r, 5));
  return { messages, calls };
}

export async function run() {
  const bundled = read("dist-plugin/code.js");
  assert(bundled === bundleSource(), "dist-plugin/code.js is stale or hand-edited — run `npm run bundle:exporter`");
  const declared = /const CHAVOSH_CAPTURE_TARGETS = \[[\s\S]*?\n\];/;
  assert(declared.test(bundled) && captureTargets().length === 5, "bundle must declare the capture targets");
  // Point the real bundled plugin at the fixture: one resolvable root + one missing root.
  const probe = `const CHAVOSH_CAPTURE_TARGETS = [\n  { nodeId: "20:2", name: "Button", type: "COMPONENT_SET", file: "chavosh-fixture" },\n  { nodeId: "99:9", name: "Missing", type: "COMPONENT_SET", file: "chavosh-missing" },\n];`;
  const { messages, calls } = await runBundled(bundled.replace(declared, probe));
  assert(messages.length === 1 && messages[0].type === "snapshots" && messages[0].results.length === 2, `plugin did not post per-component snapshots: ${JSON.stringify(messages[0]).slice(0, 200)}`);
  const [ok, bad] = messages[0].results;
  const direct = await loadExtractor()(createReadOnlyFigma(loadFixture()).figma, FIXTURE_ROOTS);
  assert(ok.file === "chavosh-fixture-figma-snapshot.json" && ok.json === toText(direct), "bundled plugin output differs from a direct single-root extraction");
  assert(bad.error && /not found/.test(bad.error) && !bad.json, "a failing target must be reported as an error entry without a snapshot");
  return [`bundle fresh; bundled plugin in a VM captures each target separately (direct-extraction bytes, ${JSON.parse(ok.json).variables.length} variables) and isolates a failing target; ${[...new Set(calls)].length} getter types`];
}
