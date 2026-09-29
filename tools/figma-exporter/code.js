// Chavosh Financial — private read-only exporter plugin v0.3.0 (entry point). AUTHORED.
// Build: tools/figma-exporter/bundle.mjs concatenates src/extract.js + this file into dist-plugin/code.js (generated).
// Extracts the dependency closure of the approved component roots (variables bound anywhere in the component,
// incl. hidden layers, + text/effect styles + alias closure over all modes) and offers the raw snapshot for
// download. It never modifies the Figma file. Roots must match packages/tokens/source/export-config.json.

const CHAVOSH_COMPONENT_ROOTS = {
  components: [{ nodeId: "20:2", name: "Button", type: "COMPONENT_SET" }],
};

figma.showUI(__html__, { width: 480, height: 380 });

chavoshExtractV3(figma, CHAVOSH_COMPONENT_ROOTS)
  .then((snapshot) =>
    figma.ui.postMessage({
      type: "snapshot",
      json: JSON.stringify(snapshot, null, 2) + "\n",
      summary: {
        components: snapshot.components.map((c) => `${c.name} (${c.variants.length} variants, ${c.bindings.length} bindings)`).join(", "),
        variables: snapshot.variables.length,
        collections: snapshot.collections.length,
        textStyles: snapshot.styles.text.length,
        effectStyles: snapshot.styles.effect.length,
      },
    }),
  )
  .catch((err) => figma.ui.postMessage({ type: "error", message: String(err && err.message ? err.message : err) }));

figma.ui.onmessage = (msg) => {
  if (msg && msg.type === "close") figma.closePlugin();
};
