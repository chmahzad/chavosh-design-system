// AUTHORED. Token pipeline v0.3 — converter: public Figma snapshot (chavosh.figma-public-snapshot 1.0.0, derived from a
// private raw capture of schema 1.2.0 by build/sanitize-snapshot.mjs; ADR 0011) → DTCG token source (generated).
//
// Evolved from the frozen proof archive (not a dependency on it):
// - Proof #1 (tag proof-1-closed): Brand mode sets, brandDependent semantic tokens, internal Brand layer.
// - Proof #2 (tag proof-2-closed): provenance/hash gate, verbatim descriptions + known-artefact guard, dimension
//   objects {value, unit:"px"}, every Figma mode kept, Effect Style → shadow composite, $extensions.chavosh.
// New in v0.3:
// - Export closure is DERIVED from component bindings (G4), after removing bindings on layers excluded by the
//   component's export scope (G6). Nothing is listed by hand.
// - Typed FLOAT/STRING: font/weight/* → fontWeight, font/family/* → fontFamily (G3; minimal DTCG types).
// - Text styles are validated and recorded for traceability; no typography composite is emitted (G3).
// - Manifest records, per component, which tokens it binds and which were left out by the scope.
// No web conversion and no CSS here.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertNoDescriptionArtefacts } from "./lib/description-guard.mjs";
import { oneRule } from "./lib/units.mjs";
import { PUBLIC_SCHEMA, RAW_SCHEMA, SANITIZER_VERSION, assertPublicSafe } from "./sanitize-snapshot.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CONVERTER_VERSION = "0.3.0";
export const SNAPSHOT_SCHEMA_VERSION = RAW_SCHEMA.schemaVersion; // extraction content schema carried by the public snapshot
export const DEFAULT_OUT_DIR = "generated/dtcg";
export const CONFIG_PATH = "source/export-config.json";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const toHex = (c) => "#" + [c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
const isAlias = (v) => !!v && typeof v === "object" && v.type === "VARIABLE_ALIAS" && typeof v.id === "string";
const pathOf = (name) => name.split("/");
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function setDeep(obj, path, value) {
  let o = obj;
  for (const seg of path.slice(0, -1)) {
    if (o[seg] && o[seg].$value !== undefined) throw new Error(`Leaf/group conflict at ${path.join(".")}`);
    o = o[seg] ??= {};
  }
  const leaf = path[path.length - 1];
  if (o[leaf] !== undefined) throw new Error(`Duplicate token path ${path.join(".")}`);
  o[leaf] = value;
}

/** Validate the public build snapshot against its generated provenance record (ADR 0011). */
export function loadPublicSnapshot(snapshotPath, provenancePath) {
  if (!existsSync(snapshotPath)) throw new Error(`Public snapshot missing: ${snapshotPath}. It is derived from a manual read-only Figma exporter run by build/sanitize-snapshot.mjs (see packages/tokens/snapshots/figma/README.md).`);
  if (!existsSync(provenancePath)) throw new Error(`Provenance record missing: ${provenancePath}.`);
  const bytes = readFileSync(snapshotPath);
  const prov = JSON.parse(readFileSync(provenancePath, "utf8"));
  const hash = sha256(bytes);
  if (hash !== prov.sha256) throw new Error(`Public snapshot hash mismatch: ${hash} ≠ provenance ${prov.sha256}. The public snapshot must not be edited — regenerate it with the sanitizer.`);
  if (bytes.length !== prov.bytes) throw new Error(`Public snapshot size ${bytes.length} ≠ provenance ${prov.bytes}.`);
  const snapshot = JSON.parse(bytes.toString("utf8"));
  if (snapshot.schema !== PUBLIC_SCHEMA.schema || snapshot.schemaVersion !== PUBLIC_SCHEMA.schemaVersion || prov.schemaVersion !== snapshot.schemaVersion) throw new Error(`Unexpected snapshot schema ${snapshot.schema} ${snapshot.schemaVersion}`);
  if (snapshot.extractor?.version !== prov.capture?.extractor?.version) throw new Error("Extractor version differs from provenance");
  if (snapshot.sanitizer?.version !== prov.sanitizer?.version || prov.sanitizer?.version !== SANITIZER_VERSION) throw new Error(`Sanitizer version differs (snapshot ${snapshot.sanitizer?.version}, provenance ${prov.sanitizer?.version}, code ${SANITIZER_VERSION})`);
  if (!/^[0-9a-f]{64}$/.test(prov.derivedFrom?.sha256 || "")) throw new Error("Provenance must attest the raw capture SHA-256");
  assertPublicSafe(snapshot);
  return { snapshot, bytes, hash, provenance: prov };
}

/** Bindings/style refs that enter the export closure after applying each component's export scope. */
export function scopeComponents(snapshot, config) {
  const out = [];
  for (const c of snapshot.components || []) {
    const policy = config.components[c.name];
    if (!policy) throw new Error(`No export policy for component "${c.name}"`);
    if (policy.figmaNodeId !== c.nodeId || policy.type !== c.type) throw new Error(`Component "${c.name}" is ${c.type} ${c.nodeId}; policy expects ${policy.type} ${policy.figmaNodeId}`);
    const excluded = new Set(policy.excludedLayers || []);
    const inScope = (r) => !r.layer.split("/").some((seg) => excluded.has(seg));
    const layersSeen = new Set(c.bindings.concat(c.styleRefs).flatMap((r) => r.layer.split("/")));
    for (const l of excluded) if (!layersSeen.has(l)) throw new Error(`Component "${c.name}": excluded layer "${l}" does not exist in the snapshot — check export-config.json`);
    out.push({ component: c, policy, bindings: c.bindings.filter(inScope), excludedBindings: c.bindings.filter((r) => !inScope(r)), styleRefs: c.styleRefs.filter(inScope) });
  }
  const configured = Object.keys(config.components).sort();
  const found = (snapshot.components || []).map((c) => c.name).sort();
  if (JSON.stringify(configured) !== JSON.stringify(found)) throw new Error(`Snapshot components [${found}] ≠ configured components [${configured}]`);
  return out;
}

/** Pure conversion: snapshot + policy → { sets, counts, report }. No I/O. */
export function convertSnapshot(snapshot, config) {
  if (snapshot.schema !== PUBLIC_SCHEMA.schema || snapshot.schemaVersion !== PUBLIC_SCHEMA.schemaVersion || snapshot.derivedFrom?.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) throw new Error(`Converter ${CONVERTER_VERSION} needs a public snapshot (${PUBLIC_SCHEMA.schema} ${PUBLIC_SCHEMA.schemaVersion}) derived from snapshot schema ${SNAPSHOT_SCHEMA_VERSION}`);
  assertNoDescriptionArtefacts(snapshot, "snapshot");

  const collections = new Map(snapshot.collections.map((c) => [c.id, c]));
  const vars = new Map(snapshot.variables.map((v) => [v.id, v]));
  const styles = new Map([...(snapshot.styles?.text || []), ...(snapshot.styles?.effect || [])].map((s) => [s.id, s]));
  const policyOf = (v) => {
    const col = collections.get(v.variableCollectionId);
    if (!col) throw new Error(`Variable ${v.name} references unknown collection ${v.variableCollectionId}`);
    const p = config.collections[col.name];
    if (!p) throw new Error(`No export policy for collection ${col.name}`);
    return { col, p };
  };

  // 1. Export closure: in-scope bindings + in-scope style dependencies, then aliases across every mode.
  const scoped = scopeComponents(snapshot, config);
  const rootIds = new Set();
  const usedStyles = new Set();
  for (const s of scoped) {
    for (const b of s.bindings) rootIds.add(b.variableId);
    for (const r of s.styleRefs) usedStyles.add(r.styleId);
  }
  for (const id of usedStyles) {
    const st = styles.get(id);
    if (!st) throw new Error(`Referenced style ${id} missing from snapshot`);
    for (const a of Object.values(st.boundVariables || {}).flat()) if (isAlias(a)) rootIds.add(a.id);
    for (const e of st.effects || []) for (const a of Object.values(e.boundVariables || {})) if (isAlias(a)) rootIds.add(a.id);
  }
  const closure = new Set();
  const queue = [...rootIds];
  while (queue.length) {
    const id = queue.shift();
    if (closure.has(id)) continue;
    const v = vars.get(id);
    if (!v) throw new Error(`Variable ${id} (bound or aliased) missing from snapshot`);
    closure.add(id);
    for (const val of Object.values(v.valuesByMode)) if (isAlias(val)) queue.push(val.id);
  }

  const ref = (id) => {
    const t = vars.get(id);
    if (!t) throw new Error(`Alias target ${id} missing from snapshot`);
    if (!closure.has(id)) throw new Error(`Alias target ${t.name} is outside the export closure`);
    return `{${pathOf(t.name).join(".")}}`;
  };
  const typeOf = (v) => {
    const rules = config.variableTypes[v.resolvedType];
    if (!rules) throw new Error(`Unsupported resolvedType ${v.resolvedType} (${v.name})`);
    return oneRule(rules, v.name, `${v.resolvedType} type policy`);
  };
  const rawValue = (v, t, raw) => {
    if (t.type === "dimension") {
      if (typeof raw !== "number") throw new Error(`${v.name}: expected a number, got ${JSON.stringify(raw)}`);
      return { value: raw, unit: t.unit };
    }
    if (t.type === "fontWeight") {
      if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 1000) throw new Error(`${v.name}: DTCG fontWeight must be an integer 1–1000, got ${JSON.stringify(raw)}`);
      return raw;
    }
    if (t.type === "fontFamily") {
      if (typeof raw !== "string" || !raw.trim()) throw new Error(`${v.name}: DTCG fontFamily must be a non-empty string, got ${JSON.stringify(raw)}`);
      return raw; // exactly as Figma stores it; web fallbacks are platform policy
    }
    if (t.type === "color") {
      if (!raw || typeof raw !== "object" || !("r" in raw)) throw new Error(`${v.name}: expected a colour`);
      return { colorSpace: "srgb", components: [raw.r, raw.g, raw.b], alpha: raw.a, hex: toHex(raw) };
    }
    throw new Error(`${v.name}: unsupported type ${t.type}`);
  };
  const dependsOnBrand = (v, seen = new Set()) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return Object.values(v.valuesByMode).some((val) => {
      if (!isAlias(val)) return false;
      const t = vars.get(val.id);
      return policyOf(t).p.layer === "brand" || dependsOnBrand(t, seen);
    });
  };

  const sets = {};
  const pushVariable = (setName, v, mode, raw) => {
    const { col, p } = policyOf(v);
    const t = typeOf(v);
    const token = { $type: t.type, $value: isAlias(raw) ? ref(raw.id) : rawValue(v, t, raw) };
    if (v.description !== "") token.$description = v.description; // verbatim
    const ext = { layer: p.layer, visibility: p.visibility };
    if (mode) ext.mode = mode.slug;
    if (p.visibility !== "source-only") ext.css = `--${config.cssPrefix}-${pathOf(v.name).join("-")}`;
    if (p.layer === "semantic") ext.brandDependent = dependsOnBrand(v);
    ext.figma = {
      variableId: v.id, collection: col.name, collectionId: col.id,
      ...(mode ? { mode: mode.name, modeId: mode.modeId } : {}),
      path: v.name, resolvedType: v.resolvedType, scopes: v.scopes, codeSyntax: v.codeSyntax,
    };
    token.$extensions = { chavosh: ext };
    setDeep((sets[setName] ??= {}), pathOf(v.name), token);
  };

  const byNameThenId = (a, b) => cmp(a.name, b.name) || cmp(a.id, b.id);
  for (const v of snapshot.variables.filter((x) => closure.has(x.id)).sort(byNameThenId)) {
    const { col, p } = policyOf(v);
    const modeIds = Object.keys(v.valuesByMode).sort();
    const colModeIds = col.modes.map((m) => m.modeId).sort();
    if (JSON.stringify(modeIds) !== JSON.stringify(colModeIds)) throw new Error(`${v.name}: modes do not match collection ${col.name}`);
    if (p.modeSets) {
      for (const m of col.modes) {
        const setName = p.modeSets[m.name];
        if (!setName) throw new Error(`No set for ${col.name} mode ${m.name}`);
        pushVariable(setName, v, { name: m.name, modeId: m.modeId, slug: p.modeSlugs[m.name] }, v.valuesByMode[m.modeId]);
      }
    } else {
      if (col.modes.length !== 1) throw new Error(`${col.name} has ${col.modes.length} modes but no modeSets policy`);
      pushVariable(p.set, v, null, v.valuesByMode[col.defaultModeId]);
    }
  }

  // 2. Effect styles used in scope → shadow composites (Proof #2 rules).
  const ep = config.effectStyles;
  const resolveColor = (id, seen = new Set()) => {
    if (seen.has(id)) throw new Error(`Alias cycle at ${id}`);
    seen.add(id);
    const v = vars.get(id);
    if (!v) throw new Error(`Alias target ${id} missing from snapshot`);
    const val = Object.values(v.valuesByMode)[0];
    return isAlias(val) ? resolveColor(val.id, seen) : val;
  };
  const effectStyles = (snapshot.styles?.effect || []).filter((s) => usedStyles.has(s.id)).sort((a, b) => cmp(a.name, b.name) || cmp(a.id, b.id));
  for (const s of effectStyles) {
    const layers = s.effects.map((e, i) => {
      const where = `effect style ${s.name} layer ${i}`;
      if (!ep.supported.type.includes(e.type)) throw new Error(`${where}: unsupported effect type ${e.type}`);
      if (!ep.supported.blendMode.includes(e.blendMode)) throw new Error(`${where}: unsupported blend mode ${e.blendMode}`);
      if (!ep.supported.visible.includes(e.visible)) throw new Error(`${where}: unsupported visibility ${e.visible}`);
      const binding = e.boundVariables?.color;
      if (!isAlias(binding)) throw new Error(`${where}: colour must be bound to a semantic variable`);
      const bound = vars.get(binding.id);
      if (!bound) throw new Error(`${where}: bound colour ${binding.id} missing from snapshot`);
      if (policyOf(bound).p.layer !== "semantic") throw new Error(`${where}: bound colour ${bound.name} is not a semantic colour`);
      const resolved = resolveColor(binding.id);
      if (["r", "g", "b", "a"].some((k) => resolved[k] !== e.color[k])) throw new Error(`${where}: stored colour differs from the bound variable ${bound.name}`);
      const px = (n) => {
        if (typeof n !== "number") throw new Error(`${where}: non-numeric geometry`);
        return { value: n, unit: "px" };
      };
      return { color: ref(binding.id), offsetX: px(e.offset.x), offsetY: px(e.offset.y), blur: px(e.radius), spread: px(e.spread) };
    });
    const token = { $type: "shadow", $value: layers };
    if (s.description !== "") token.$description = s.description;
    token.$extensions = {
      chavosh: {
        layer: ep.layer, visibility: ep.visibility, css: `--${config.cssPrefix}-${pathOf(s.name).join("-")}`,
        figma: {
          styleId: s.id, styleType: s.type, path: s.name,
          layers: s.effects.map((e) => ({ type: e.type, visible: e.visible, blendMode: e.blendMode, showShadowBehindNode: e.showShadowBehindNode, colorVariableId: e.boundVariables.color.id })),
        },
      },
    };
    setDeep((sets[ep.set] ??= {}), pathOf(s.name), token);
  }

  // 3. Every reference resolves inside the generated sets.
  const index = new Map();
  const walk = (o, p, set) => {
    for (const [k, v] of Object.entries(o)) {
      if (k.startsWith("$")) continue;
      const path = [...p, k].join(".");
      if (v && v.$value !== undefined) index.set(path, [...(index.get(path) || []), set]);
      else if (v && typeof v === "object") walk(v, [...p, k], set);
    }
  };
  for (const [name, tree] of Object.entries(sets)) walk(tree, [], name);
  for (const r of JSON.stringify(sets).match(/"\{[^}]+\}"/g) || []) if (!index.has(r.slice(2, -2))) throw new Error(`Unresolvable reference ${r}`);

  // 4. Traceability report (no values).
  const nameOf = (id) => vars.get(id).name;
  const textStyles = (snapshot.styles?.text || []).filter((s) => usedStyles.has(s.id)).sort((a, b) => cmp(a.name, b.name)).map((s) => ({
    name: s.name, id: s.id,
    properties: Object.fromEntries(Object.entries(s.boundVariables || {}).sort(([a], [b]) => cmp(a, b)).map(([k, a]) => [k, isAlias(a) ? nameOf(a.id) : null])),
    unboundProperties: { letterSpacing: s.letterSpacing, textCase: s.textCase, textDecoration: s.textDecoration },
  }));
  const components = scoped.map((s) => {
    const inIds = new Set(s.bindings.map((b) => b.variableId));
    const exIds = new Set(s.excludedBindings.map((b) => b.variableId));
    return {
      name: s.component.name, figmaNodeId: s.component.nodeId, exportScope: s.policy.exportScope, variants: s.component.variants.length,
      bindings: s.component.bindings.length, bindingsInScope: s.bindings.length, excludedLayers: s.policy.excludedLayers,
      boundTokens: [...inIds].map(nameOf).sort(),
      styles: [...new Set(s.styleRefs.map((r) => styles.get(r.styleId).name))].sort(),
      excludedOnly: [...exIds].filter((id) => !closure.has(id)).map(nameOf).sort(),
    };
  });
  const outOfClosure = snapshot.variables.filter((v) => !closure.has(v.id)).map((v) => v.name).sort();
  const counts = Object.fromEntries(Object.keys(sets).sort().map((n) => [n, [...index.values()].filter((s) => s.includes(n)).length]));
  return { sets, counts, report: { components, textStyles, outOfClosure } };
}

/** File-level conversion: provenance/hash gate, convert, write sets + manifest (stale files removed). */
export function convert({ root = ROOT, outDir = join(root, DEFAULT_OUT_DIR), configPath = join(root, CONFIG_PATH), snapshotPath, provenancePath } = {}) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const snapPath = snapshotPath || join(root, config.publicSnapshot.path);
  const provPath = provenancePath || join(root, config.publicSnapshot.provenance);
  const { snapshot, bytes, hash, provenance } = loadPublicSnapshot(snapPath, provPath);
  return writeDtcg({ snapshot, bytes, hash, config, outDir, snapshotLabel: config.publicSnapshot.path, rawSha256: provenance.derivedFrom.sha256 });
}

/** Write sets + manifest for an already-validated snapshot (also used by tests on fixture snapshots). */
export function writeDtcg({ snapshot, bytes, hash, config, outDir, snapshotLabel, rawSha256 = null }) {
  const { sets, counts, report } = convertSnapshot(snapshot, config);
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) if (f.endsWith(".json")) rmSync(join(outDir, f));
  const files = {};
  for (const name of Object.keys(sets).sort()) {
    const file = `${name}.tokens.json`;
    const text = JSON.stringify(sets[name], null, 2) + "\n";
    writeFileSync(join(outDir, file), text);
    files[file] = sha256(text);
  }
  const manifest = {
    generated: true,
    notice: "GENERATED by packages/tokens/build/convert-snapshot.mjs — do not edit. Regenerate with `npm run convert`.",
    converterVersion: CONVERTER_VERSION,
    snapshot: {
      path: snapshotLabel, sha256: hash, bytes: bytes.length, schema: snapshot.schema, schemaVersion: snapshot.schemaVersion,
      sanitizerVersion: snapshot.sanitizer.version, rawCaptureSha256: rawSha256,
      extractorVersion: snapshot.extractor.version, sourceFileName: snapshot.source.fileName,
    },
    tokenCounts: counts,
    traceability: report,
    files,
  };
  writeFileSync(join(outDir, "_manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const m = convert();
  console.log(`Converted → ${Object.keys(m.files).join(", ")} (${Object.values(m.tokenCounts).reduce((a, b) => a + b, 0)} tokens)`);
}
