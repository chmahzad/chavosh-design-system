// AUTHORED. Converter v0.3 on the fixture snapshot: scope-derived closure, DTCG typing (incl. fontFamily/fontWeight),
// references, brand mode sets, public/private metadata, verbatim descriptions, traceability report, sanitizer,
// provenance gate, and failure modes.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { assert, throwsWith, config, fixtureSnapshot, fixtureRawSnapshot, flattenSets } from "./lib-dtcg.mjs";
import { convertSnapshot, loadPublicSnapshot, mergeSnapshots } from "../build/convert-snapshot.mjs";
import { sanitizeSnapshot, assertOnlyApprovedChanges, publicProvenance, publicStyleId, toPublicText } from "../build/sanitize-snapshot.mjs";
import { toText } from "../../../tools/figma-exporter/tests/mock.mjs";

export async function run() {
  const lines = [];
  const cfg = config();
  const snap = await fixtureSnapshot();
  const { sets, report } = convertSnapshot(snap, cfg);
  const all = flattenSets(sets);
  const get = (set, p) => all.find(([s, q]) => s === set && q === p)?.[2];

  // Closure derived from bindings with the v1 scope applied
  const btn = report.components[0];
  assert(btn.name === "Button" && btn.exportScope === "button-v1-labels-only", "component report");
  assert(btn.excludedOnly.join() === "size/icon/md" && !all.some(([, p]) => p.startsWith("size.icon") || p === "size.500"), "tokens bound only on icon/spinner layers stay out (G6)");
  assert(report.outOfClosure.includes("size/icon/md") && btn.bindingsInScope < btn.bindings, "scope removes icon/spinner bindings");
  assert(!all.some(([, p]) => p === "space.gap.sm"), "decoy excluded");
  lines.push(`closure: ${btn.boundTokens.length} tokens bound by Button in scope (${btn.bindingsInScope}/${btn.bindings} bindings); excluded-only ${btn.excludedOnly.join(", ")}; decoys absent`);

  // Typing
  const fam = get("dimension", "font.family.sans"), famP = get("primitives", "font.family.inter");
  const w = get("dimension", "font.weight.medium"), wP = get("primitives", "font.weight.500");
  assert(fam.$type === "fontFamily" && fam.$value === "{font.family.inter}" && famP.$type === "fontFamily" && famP.$value === "Inter", "fontFamily typing, Figma value verbatim (no web fallback in DTCG)");
  assert(w.$type === "fontWeight" && w.$value === "{font.weight.500}" && wP.$type === "fontWeight" && wP.$value === 500, "fontWeight typing (number)");
  assert(get("dimension", "space.gap.md").$type === "dimension" && get("primitives", "space.300").$value.unit === "px", "dimension objects");
  const col = get("primitives", "color.navy.800").$value;
  assert(col.colorSpace === "srgb" && col.alpha === 1 && col.hex === "#1e3d7a", "colour object");
  lines.push("types: fontFamily (string, Figma value verbatim), fontWeight (number), dimension {value, unit:px}, colour sRGB object");

  // Brand sets and public/private metadata
  assert(get("brand-financial", "brand.primary.800").$value === "{color.navy.800}" && get("brand-invest", "brand.primary.800").$value === "{color.violet.800}", "brand mode sets");
  for (const [set, p, t] of all) {
    const c = t.$extensions.chavosh;
    if (set === "primitives") assert(c.visibility === "source-only" && !("css" in c), `${p}: primitive must be source-only`);
    else if (set.startsWith("brand-")) assert(c.visibility === "internal" && c.css.startsWith("--ch-brand-"), `${p}: brand is internal --ch-brand-*`);
    else assert(c.visibility === "public" && c.css === `--ch-${p.split(".").join("-")}` && !c.css.startsWith("--ch-brand-"), `${p}: public name`);
  }
  assert(get("color", "color.control.checked").$extensions.chavosh.brandDependent === true && get("color", "color.text.default").$extensions.chavosh.brandDependent === false, "brandDependent flag");
  lines.push("boundaries: primitives source-only (no CSS name), Brand internal --ch-brand-*, everything else public --ch-* = Figma path; brandDependent flagged");

  // References and descriptions
  const paths = new Set(all.map(([, p]) => p));
  const refs = JSON.stringify(sets).match(/"\{[^}]+\}"/g) || [];
  assert(refs.length > 10 && refs.every((r) => paths.has(r.slice(2, -2))), "every reference resolves");
  const src = new Map(snap.variables.map((v) => [v.name, v.description]));
  let desc = 0;
  for (const [, p, t] of all) if (t.$type !== "shadow") { const d = src.get(p.split(".").join("/")); assert((d === "" && !("$description" in t)) || t.$description === d, `${p}: description verbatim`); desc++; }
  assert(report.textStyles[0].properties.fontWeight === "font/weight/medium" && report.textStyles[0].properties.fontFamily === "font/family/sans", "text style traceability");
  assert(!Object.keys(sets).some((s) => /typography|text/.test(s)) && !all.some(([, , t]) => t.$type === "typography"), "no typography composite (G3)");
  lines.push(`references: ${refs.length} all resolve; ${desc} descriptions verbatim; text style label/md traced to per-property tokens; no typography composite`);

  // Sanitizer (ADR 0011): raw fixture capture → public snapshot; only the approved identifier rules may differ
  const raw = await fixtureRawSnapshot();
  const { snapshot: pubAgain, counts } = sanitizeSnapshot(raw);
  assert(toPublicText(pubAgain) === toPublicText(snap), "sanitizer is deterministic");
  assert(!("fileKey" in snap.source) && snap.components.every((c) => !("key" in c)) && snap.styles.text.every((s) => !("key" in s) && s.id === `style:text/${s.name}`), "file, component and style keys removed; style IDs public");
  assert(snap.components[0].styleRefs.every((r) => r.styleId.startsWith("style:")) && JSON.stringify(snap.variables) === JSON.stringify(raw.variables) && JSON.stringify(snap.collections) === JSON.stringify(raw.collections), "variables and collections untouched; style references rewritten");
  assert(snap.components[0].nodeId === raw.components[0].nodeId && JSON.stringify(snap.components[0].bindings) === JSON.stringify(raw.components[0].bindings), "node IDs and bindings untouched");
  const sanitizeWith = async (f) => { const r = structuredClone(raw); f(r); return () => sanitizeSnapshot(r); };
  await throwsWith(await sanitizeWith((r) => { r.styles.text.push({ ...structuredClone(r.styles.text[0]), id: "S:dupkey,", key: "dupkey" }); }), /Public style ID collision/, "style ID collision");
  await throwsWith(await sanitizeWith((r) => { r.styles.text[0].id = "S:otherkey,"; }), /unexpected identifier pattern/, "style ID without its key");
  await throwsWith(await sanitizeWith((r) => { r.components[0].styleRefs[0].styleId = "S:unknown,"; }), /unknown style/, "unknown style reference");
  await throwsWith(await sanitizeWith((r) => { r.variables[0].description = `see ${r.source.fileKey}`; }), /Private identifier\(s\) remain/, "residual file key");
  await throwsWith(await sanitizeWith((r) => { r.schemaVersion = "1.1.0"; }), /needs chavosh.figma-raw-snapshot 1.2.0/, "unexpected raw schema");
  const pubMut = structuredClone(pubAgain);
  pubMut.variables[0].name = "renamed";
  const idMap = new Map(raw.styles.text.concat(raw.styles.effect || []).map((s) => [s.id, publicStyleId(s)]));
  await throwsWith(() => assertOnlyApprovedChanges(raw, pubMut, idMap), /Sanitizer changed \$\.variables\[0\]\.name/, "structural invariant");
  lines.push(`sanitizer: deterministic; removes file/component/style keys and rewrites style IDs (${JSON.stringify(counts)}); refuses collisions, unexpected ID patterns, unknown references, residual identifiers, other schemas and any other change`);

  // Provenance gate (public snapshot)
  const tmp = mkdtempSync(join(tmpdir(), "ch-prov-"));
  try {
    const text = toPublicText(snap);
    const f = join(tmp, "s.json"), pv = join(tmp, "p.json");
    writeFileSync(f, text);
    const rawText = toText(raw);
    const prov = publicProvenance({ rawBytes: Buffer.from(rawText), rawProvenance: { schemaVersion: "1.2.0", extractor: { version: "0.3.0" } }, publicText: text, counts, publicFile: "s.json" });
    writeFileSync(pv, JSON.stringify(prov));
    assert(loadPublicSnapshot(f, pv).hash === prov.sha256 && prov.derivedFrom.sha256 === createHash("sha256").update(rawText).digest("hex"), "valid provenance accepted; raw attestation recorded");
    writeFileSync(f, text.replace("Checked state", "Checked  state"));
    await throwsWith(() => loadPublicSnapshot(f, pv), /hash mismatch/, "tampered snapshot");
    const leaky = structuredClone(snap);
    leaky.source.fileKey = "leak";
    const leakyText = toPublicText(leaky);
    writeFileSync(f, leakyText);
    writeFileSync(pv, JSON.stringify({ ...prov, sha256: createHash("sha256").update(leakyText).digest("hex"), bytes: Buffer.byteLength(leakyText) }));
    await throwsWith(() => loadPublicSnapshot(f, pv), /Private identifier\(s\) remain/, "public snapshot carrying a private identifier");
    writeFileSync(f, rawText);
    writeFileSync(pv, JSON.stringify({ ...prov, sha256: createHash("sha256").update(rawText).digest("hex"), bytes: Buffer.byteLength(rawText) }));
    await throwsWith(() => loadPublicSnapshot(f, pv), /Unexpected snapshot schema/, "raw capture as build input");
    await throwsWith(() => loadPublicSnapshot(join(tmp, "none.json"), pv), /manual read-only Figma exporter run/, "missing snapshot");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  lines.push("provenance gate: public SHA-256/size/schema/extractor/sanitizer version + raw attestation; tampered, identifier-carrying, raw or missing snapshot refused");

  // Multi-snapshot merge (ADR 0012): identical shared records merge; any divergence or naming conflict is refused
  {
    const a = structuredClone(snap), b = structuredClone(snap);
    b.components[0] = { ...b.components[0], name: "Other", nodeId: "99:1" };
    b.source.roots = { components: [{ nodeId: "99:1", name: "Other", type: "COMPONENT_SET" }] };
    const merged = mergeSnapshots([{ id: "a", snapshot: a }, { id: "b", snapshot: b }]);
    assert(merged.components.map((c) => c.name).join() === "Button,Other" && merged.variables.length === snap.variables.length && merged.source.roots.components.length === 2, "consistent captures merge without duplicates");
    assert(mergeSnapshots([{ id: "a", snapshot: a }]) === a, "a single capture is used unchanged");
    const diverge = async (f, re, label) => { const c = structuredClone(b); f(c); await throwsWith(() => mergeSnapshots([{ id: "a", snapshot: a }, { id: "b", snapshot: c }]), re, label); };
    await diverge((c) => { c.variables[0].description += "!"; }, /Cross-snapshot inconsistency: variable .* in \[description\]/, "diverging description");
    await diverge((c) => { const v = c.variables.find((x) => Object.values(x.valuesByMode).some((m) => m && m.type === "VARIABLE_ALIAS")); const k = Object.keys(v.valuesByMode).find((m) => v.valuesByMode[m].type === "VARIABLE_ALIAS"); v.valuesByMode[k] = { type: "VARIABLE_ALIAS", id: "VariableID:0:0" }; }, /in \[valuesByMode\]/, "diverging alias");
    await diverge((c) => { c.variables.push({ ...structuredClone(c.variables[0]), id: "VariableID:0:1" }); }, /naming conflict/, "same name, different ID");
    await diverge((c) => { c.collections[0].modes = []; }, /collection .* differs/, "diverging collection");
    await diverge((c) => { c.components[0].name = "Button"; }, /appears in captures a and b/, "component in two captures");
    await diverge((c) => { c.source.fileName = "Another file"; }, /comes from "Another file"/, "different Figma file");
  }
  lines.push("multi-snapshot merge: identical shared variables/collections/styles merge once; diverging values, aliases, descriptions or collections, a name with two IDs, a component in two captures and a different source file are refused");

  // Failure modes
  const mut = async (f) => { const s = structuredClone(snap); f(s); return () => convertSnapshot(s, cfg); };
  await throwsWith(await mut((s) => { s.variables.find((v) => v.name === "font/weight/500").valuesByMode["1:0"] = 450.5; }), /fontWeight must be an integer/, "invalid weight");
  await throwsWith(await mut((s) => { s.variables.find((v) => v.name === "font/family/inter").name = "misc/label"; }), /STRING type policy: misc\/label is unclassified/, "unclassified STRING");
  await throwsWith(await mut((s) => { s.variables.find((v) => v.name === "radius/md").name = "layout/columns"; }), /unclassified/, "unclassified FLOAT");
  await throwsWith(await mut((s) => { s.variables = s.variables.filter((v) => v.name !== "color/navy/800"); }), /missing from snapshot/, "missing alias target");
  await throwsWith(await mut((s) => { s.variables.find((v) => v.name === "radius/md").description = "grid&#39;s"; }), /known extraction artefact/, "description artefact");
  await throwsWith(await mut((s) => { s.components[0].nodeId = "99:1"; }), /policy expects COMPONENT_SET 20:2/, "wrong component id");
  await throwsWith(await mut((s) => { s.components[0].bindings = s.components[0].bindings.filter((b) => !b.layer.startsWith("spinner")); s.components[0].styleRefs = s.components[0].styleRefs.filter((b) => !b.layer.startsWith("spinner")); }), /excluded layer "spinner" does not exist/, "stale scope layer");
  await throwsWith(await mut((s) => { s.derivedFrom.schemaVersion = "1.1.0"; }), /derived from snapshot schema 1.2.0/, "old schema");
  lines.push("failure modes: invalid weight, unclassified STRING/FLOAT, missing alias target, description artefact, wrong component, stale scope layer, old schema → refused");
  return lines;
}
