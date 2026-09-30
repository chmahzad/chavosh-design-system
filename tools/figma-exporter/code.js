// Chavosh Financial — private read-only exporter plugin v0.4.0 (entry point). AUTHORED.
// Build: tools/figma-exporter/bundle.mjs concatenates src/extract.js + this file into dist-plugin/code.js (generated).
// One run captures each target component SEPARATELY (ADR 0012: per-component canonical captures): for every
// target it extracts that component's dependency closure (variables bound anywhere in the component, incl. hidden
// layers, + text/effect styles + alias closure over all modes) with the unchanged v0.3.0 extractor and offers one
// raw snapshot per component for download. It never modifies the Figma file.
// Button is NOT a target: its capture (29 Sep 2026) is frozen. Targets must match
// packages/tokens/source/export-config.json once a component is configured.

const CHAVOSH_CAPTURE_TARGETS = [
  { nodeId: "34:944", name: "Link", type: "COMPONENT_SET", file: "chavosh-link" },
  { nodeId: "42:745", name: "Text Field", type: "COMPONENT_SET", file: "chavosh-text-field" },
  { nodeId: "52:1034", name: "Checkbox", type: "COMPONENT_SET", file: "chavosh-checkbox" },
  { nodeId: "56:1281", name: "Radio", type: "COMPONENT_SET", file: "chavosh-radio" },
  { nodeId: "63:1411", name: "Switch", type: "COMPONENT_SET", file: "chavosh-switch" },
];

async function chavoshCaptureAll(figmaApi, targets) {
  const results = [];
  for (const t of targets) {
    try {
      const snapshot = await chavoshExtractV3(figmaApi, { components: [{ nodeId: t.nodeId, name: t.name, type: t.type }] });
      const c = snapshot.components[0];
      results.push({
        name: t.name,
        file: `${t.file}-figma-snapshot.json`,
        json: JSON.stringify(snapshot, null, 2) + "\n",
        summary: `${c.name} (${c.variants.length} variants, ${c.bindings.length} bindings) · ${snapshot.variables.length} variables · ${snapshot.collections.length} collections · ${snapshot.styles.text.length} text style(s) · ${snapshot.styles.effect.length} effect style(s)`,
      });
    } catch (err) {
      results.push({ name: t.name, error: String(err && err.message ? err.message : err) });
    }
  }
  return results;
}

figma.showUI(__html__, { width: 560, height: 520 });

chavoshCaptureAll(figma, CHAVOSH_CAPTURE_TARGETS)
  .then((results) => figma.ui.postMessage({ type: "snapshots", results }))
  .catch((err) => figma.ui.postMessage({ type: "error", message: String(err && err.message ? err.message : err) }));

figma.ui.onmessage = (msg) => {
  if (msg && msg.type === "close") figma.closePlugin();
};
