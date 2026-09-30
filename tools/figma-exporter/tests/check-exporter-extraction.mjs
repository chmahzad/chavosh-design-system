// AUTHORED. Extractor v0.3.0 behaviour on the mock (roots = the fixture's Button set): component-rooted closure derived from bindings (incl. hidden
// layers, text-style and effect-style bindings, all Brand modes), decoys excluded, raw fidelity, determinism,
// and loud failures for every precondition.
import { assert, loadExtractor, loadFixture, createReadOnlyFigma, FIXTURE_ROOTS, captureTargets, toText } from "./mock.mjs";

async function throwsWith(fn, re, label) {
  let err;
  try { await fn(); } catch (e) { err = e; }
  assert(err && re.test(err.message), `${label}: expected ${re}, got ${err ? err.message : "no error"}`);
}

export async function run() {
  const lines = [];
  const extract = loadExtractor();
  const fx = loadFixture();
  const roots = FIXTURE_ROOTS;
  const targets = captureTargets();
  const approved = [["Link", "34:944"], ["Text Field", "42:745"], ["Checkbox", "52:1034"], ["Radio", "56:1281"], ["Switch", "63:1411"]];
  assert(JSON.stringify(targets.map((t) => [t.name, t.nodeId])) === JSON.stringify(approved) && targets.every((t) => t.type === "COMPONENT_SET" && /^chavosh-[a-z-]+$/.test(t.file)), "code.js capture targets must be exactly the approved Component Expansion roots (ADR 0012)");
  assert(!targets.some((t) => t.name === "Button" || t.nodeId === "20:2"), "Button is frozen and must not be re-captured");
  const snap = await extract(createReadOnlyFigma(fx).figma, roots);

  assert(snap.schema === "chavosh.figma-raw-snapshot" && snap.schemaVersion === "1.2.0" && snap.extractor.version === "0.3.0" && snap.extractor.readOnly === true, "envelope");
  const btn = snap.components[0];
  assert(btn.name === "Button" && btn.nodeId === "20:2" && btn.page.name === "Components" && btn.variants.length === 2, "component record");
  const names = snap.variables.map((v) => v.name);
  assert(!names.includes("space/gap/sm") && !names.includes("space/200"), "decoy (variable bound only outside the root) must be excluded");
  assert(names.includes("size/icon/md") && btn.bindings.some((b) => b.layer === "leading-icon" && b.visible === false), "hidden layers must be traversed and marked invisible");
  assert(btn.bindings.some((b) => b.layer === "leading-icon/glyph" && b.field === "strokes[0].color"), "paint bindings inside instances");
  assert(!btn.bindings.some((b) => /^fills(\[\d+\])?$/.test(b.field)), "node-level fills aliases are not duplicated");
  for (const f of ["fontFamily[0]", "fontSize[0]", "fontWeight[0]", "lineHeight[0]"]) assert(btn.bindings.some((b) => b.layer === "label-wrap/label" && b.field === f), `text binding ${f}`);
  assert(btn.styleRefs.some((r) => r.field === "textStyleId") && btn.styleRefs.some((r) => r.field === "effectStyleId"), "style references");
  assert(snap.styles.text[0].name === "label/md" && snap.styles.text[0].boundVariables.fontWeight.id === "VariableID:900:4", "text style captured with bound variables");
  assert(snap.styles.effect[0].name === "elevation/overlay", "effect style captured");
  assert(names.includes("color/navy/800") && names.includes("color/violet/800"), "alias closure follows every Brand mode");
  assert(names.includes("color/alpha/neutral-950/12"), "effect-style colour binding followed");
  const src = new Map(fx.variables.map((v) => [v.id, v]));
  const canon = (o) => JSON.stringify(o, (_, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));
  for (const v of snap.variables) {
    const s = src.get(v.id);
    assert(canon(v.valuesByMode) === canon(s.valuesByMode) && v.description === s.description, `${v.name}: raw fidelity`);
  }
  lines.push(`closure: ${snap.variables.length} variables in ${snap.collections.length} collections, ${btn.bindings.length} bindings over ${btn.variants.length} variants, 1 text + 1 effect style; decoys excluded`);
  lines.push("coverage: hidden instance layers (marked invisible), paint bindings, text-node font bindings, text/effect style bindings, all Brand modes; values raw and unresolved");

  const again = await extract(createReadOnlyFigma(fx, { shuffle: true }).figma, roots);
  assert(toText(again) === toText(snap), "output depends on traversal order");
  lines.push("determinism: identical bytes with reversed sibling order");

  const mut = (f) => { const c = structuredClone(fx); f(c); return createReadOnlyFigma(c).figma; };
  await throwsWith(() => extract(mut((c) => { c.skipInvisibleInstanceChildren = true; }), roots), /skipInvisibleInstanceChildren is true/, "skip invisible");
  await throwsWith(() => extract(mut((c) => { c.currentPageId = "10:2"; }), roots), /Open the "Components" page/, "wrong page");
  await throwsWith(() => extract(mut(() => {}), { components: [{ nodeId: "99:9", name: "Button", type: "COMPONENT_SET" }] }), /not found/, "missing root");
  await throwsWith(() => extract(mut(() => {}), { components: [{ nodeId: "20:2", name: "Card", type: "COMPONENT_SET" }] }), /expected COMPONENT_SET "Card"/, "wrong root name");
  await throwsWith(() => extract(mut((c) => { c.variables = c.variables.filter((v) => v.id !== "VariableID:1:23"); }), roots), /not found/, "broken alias");
  await throwsWith(() => extract(mut((c) => { c.variables.find((v) => v.id === "VariableID:5:83").remote = true; }), roots), /remote library variable/, "remote variable");
  await throwsWith(() => extract(mut((c) => { c.styles[0].type = "PAINT"; }), roots), /type PAINT is referenced but not supported/, "paint style");
  lines.push(`capture targets (plugin v0.4.0): ${targets.map((t) => `${t.name} ${t.nodeId}`).join(", ")}; Button (frozen) excluded`);
  lines.push("failure modes: hidden layers skipped, wrong page, missing/renamed root, broken alias, remote variable, unsupported style → all fail loudly");
  return lines;
}
