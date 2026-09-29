// AUTHORED. dist-plugin/code.js must equal a fresh bundle; the bundled plugin, run in a VM against the mock,
// posts the same snapshot as a direct extraction and only calls allow-listed getters (+ UI messaging).
import vm from "node:vm";
import { read, assert, loadExtractor, loadFixture, createReadOnlyFigma, pluginRoots, toText } from "./mock.mjs";
import { bundleSource } from "../bundle.mjs";

export async function run() {
  assert(read("dist-plugin/code.js") === bundleSource(), "dist-plugin/code.js is stale or hand-edited — run `npm run bundle:exporter`");
  const { figma, calls } = createReadOnlyFigma(loadFixture());
  const messages = [];
  const host = new Proxy({}, {
    get: (_, k) => {
      if (k === "showUI") return () => {};
      if (k === "ui") return { postMessage: (m) => messages.push(m), set onmessage(_f) {} };
      return figma[k];
    },
  });
  vm.runInNewContext(read("dist-plugin/code.js"), { figma: host, __html__: "" });
  for (let i = 0; i < 50 && !messages.length; i++) await new Promise((r) => setTimeout(r, 5));
  assert(messages.length === 1 && messages[0].type === "snapshot", `plugin did not post a snapshot: ${JSON.stringify(messages[0])}`);
  const direct = await loadExtractor()(createReadOnlyFigma(loadFixture()).figma, pluginRoots());
  assert(messages[0].json === toText(direct), "bundled plugin output differs from direct extraction");
  return [`bundle fresh; bundled plugin in a VM posts the direct-extraction snapshot (${messages[0].summary.variables} variables; ${[...new Set(calls)].length} getter types)`];
}
