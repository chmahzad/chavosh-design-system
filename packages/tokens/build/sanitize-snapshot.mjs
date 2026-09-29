// AUTHORED. Deterministic sanitizer: private raw Figma capture (chavosh.figma-raw-snapshot 1.2.0) → public build
// snapshot (chavosh.figma-public-snapshot 1.0.0). Decision: docs/decisions/0011-public-snapshot-and-identifier-minimisation.md.
//
// The raw capture stays private (it contains the Figma file key and library keys). This transform applies an explicit
// rule set and nothing else; every other byte of meaning — token names, values, descriptions, aliases, modes, node IDs,
// variable IDs, component structure — is carried over unchanged and PROVEN unchanged by assertOnlyApprovedChanges().
//
// Rules (the complete list):
//   R1 source.fileKey                         removed   (Figma file key)
//   R2 components[].key                       removed   (published component key)
//   R3 styles.{text,effect}[].key             removed   (published library style key)
//   R4 styles.{text,effect}[].id              rewritten  "S:<key>,…" → "style:<type>/<style name>"
//   R5 components[].styleRefs[].styleId       rewritten  with the same R4 mapping
//   R6 schema / schemaVersion                 "chavosh.figma-raw-snapshot" 1.2.0 → "chavosh.figma-public-snapshot" 1.0.0,
//                                             plus derivedFrom {schema, schemaVersion} and sanitizer {name, version}
// Fails on: an unexpected input schema, a style ID that does not embed its key, a style reference to an unknown style,
// colliding public style IDs, any residual private identifier, or any difference outside R1–R6.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SANITIZER_NAME = "chavosh-snapshot-sanitizer";
export const SANITIZER_VERSION = "1.0.0";
export const RAW_SCHEMA = { schema: "chavosh.figma-raw-snapshot", schemaVersion: "1.2.0" };
export const PUBLIC_SCHEMA = { schema: "chavosh.figma-public-snapshot", schemaVersion: "1.0.0" };
const STYLE_KINDS = ["text", "effect"];
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
export const toPublicText = (snapshot) => JSON.stringify(snapshot, null, 2) + "\n";

/** Public style identifier derived from the style's type and name: "style:text/label/md". */
export const publicStyleId = (style) => `style:${String(style.type).toLowerCase()}/${style.name}`;

/** Apply R1–R6. Returns { snapshot, counts, removedValues }. Throws on any unexpected input. */
export function sanitizeSnapshot(raw) {
  if (raw.schema !== RAW_SCHEMA.schema || raw.schemaVersion !== RAW_SCHEMA.schemaVersion) throw new Error(`Sanitizer ${SANITIZER_VERSION} needs ${RAW_SCHEMA.schema} ${RAW_SCHEMA.schemaVersion}, got ${raw.schema} ${raw.schemaVersion}`);
  const out = structuredClone(raw);
  const counts = { fileKeyRemoved: 0, componentKeysRemoved: 0, styleKeysRemoved: 0, styleIdsRewritten: 0, styleRefsRewritten: 0 };
  const removedValues = new Set();

  if (out.source && "fileKey" in out.source) { if (out.source.fileKey) removedValues.add(out.source.fileKey); delete out.source.fileKey; counts.fileKeyRemoved++; }
  for (const c of out.components || []) if ("key" in c) { if (c.key) removedValues.add(c.key); delete c.key; counts.componentKeysRemoved++; }

  const idMap = new Map();
  const seen = new Map();
  for (const kind of STYLE_KINDS) for (const s of out.styles?.[kind] || []) {
    if (typeof s.key !== "string" || !s.key || typeof s.id !== "string" || !s.id.startsWith(`S:${s.key},`)) throw new Error(`Style "${s.name}": unexpected identifier pattern (id ${JSON.stringify(s.id)} does not embed its key) — sanitizer rules need review`);
    const pub = publicStyleId(s);
    if (seen.has(pub)) throw new Error(`Public style ID collision: "${pub}" (styles "${seen.get(pub)}" and "${s.name}")`);
    seen.set(pub, s.name);
    idMap.set(s.id, pub);
    removedValues.add(s.key);
    removedValues.add(s.id);
    s.id = pub;
    delete s.key;
    counts.styleKeysRemoved++;
    counts.styleIdsRewritten++;
  }
  for (const c of out.components || []) for (const r of c.styleRefs || []) {
    if (!idMap.has(r.styleId)) throw new Error(`Component "${c.name}" references unknown style ${JSON.stringify(r.styleId)}`);
    r.styleId = idMap.get(r.styleId);
    counts.styleRefsRewritten++;
  }

  // R6 — rebuild the top level so the new fields sit next to the schema identity (deterministic key order).
  const { schema, schemaVersion, ...rest } = out;
  const snapshot = { ...PUBLIC_SCHEMA, derivedFrom: { schema, schemaVersion }, sanitizer: { name: SANITIZER_NAME, version: SANITIZER_VERSION }, ...rest };

  assertPublicSafe(snapshot, removedValues);
  assertOnlyApprovedChanges(raw, snapshot, idMap);
  return { snapshot, counts, removedValues };
}

/** No private identifier may remain: no key/fileKey properties, no "S:<key>," style IDs, no 40-hex keys, no removed value. */
export function assertPublicSafe(snapshot, removedValues = new Set()) {
  const problems = [];
  const walk = (o, path) => {
    if (Array.isArray(o)) return o.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o)) {
        if (k === "key" || k === "fileKey") problems.push(`${path}.${k}`);
        walk(v, `${path}.${k}`);
      }
      return;
    }
    if (typeof o !== "string") return;
    if (/^S:[^,]*,/.test(o)) problems.push(`${path}: Figma style ID pattern`);
    if (/\b[0-9a-f]{40}\b/i.test(o)) problems.push(`${path}: 40-hex library key pattern`);
    for (const v of removedValues) if (v && o.includes(v)) problems.push(`${path}: contains a removed identifier`);
  };
  walk(snapshot, "$");
  if (problems.length) throw new Error(`Private identifier(s) remain in the public snapshot: ${problems.slice(0, 5).join("; ")}${problems.length > 5 ? ` (+${problems.length - 5})` : ""}`);
}

/** Structural invariant: the public snapshot equals the raw capture except at the R1–R6 locations. */
export function assertOnlyApprovedChanges(raw, pub, idMap) {
  const fail = (path, why) => { throw new Error(`Sanitizer changed ${path} (${why}) — only the approved identifier rules may differ`); };
  const top = new Set([...Object.keys(raw).filter((k) => k !== "schema" && k !== "schemaVersion"), "schema", "schemaVersion", "derivedFrom", "sanitizer"]);
  for (const k of Object.keys(pub)) if (!top.has(k)) fail(`$.${k}`, "unexpected top-level field");
  if (pub.schema !== PUBLIC_SCHEMA.schema || pub.schemaVersion !== PUBLIC_SCHEMA.schemaVersion) fail("$.schema", "public schema");
  if (pub.derivedFrom?.schema !== raw.schema || pub.derivedFrom?.schemaVersion !== raw.schemaVersion) fail("$.derivedFrom", "must record the raw schema");
  const allowedRemoval = (path) => path === "$.source.fileKey" || /^\$\.components\[\d+\]\.key$/.test(path) || /^\$\.styles\.(text|effect)\[\d+\]\.key$/.test(path);
  const rewritten = (path) => /^\$\.styles\.(text|effect)\[\d+\]\.id$/.test(path) || /^\$\.components\[\d+\]\.styleRefs\[\d+\]\.styleId$/.test(path);
  const cmp = (a, b, path) => {
    if (rewritten(path)) { if (idMap.get(a) !== b) fail(path, "style ID mapping"); return; }
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) fail(path, "array shape");
      return a.forEach((v, i) => cmp(v, b[i], `${path}[${i}]`));
    }
    if (a && typeof a === "object") {
      if (!b || typeof b !== "object" || Array.isArray(b)) fail(path, "object shape");
      const ka = Object.keys(a).filter((k) => !allowedRemoval(`${path}.${k}`));
      const kb = Object.keys(b);
      if (JSON.stringify(ka) !== JSON.stringify(kb)) fail(path, `keys ${ka} ≠ ${kb}`);
      return ka.forEach((k) => cmp(a[k], b[k], `${path}.${k}`));
    }
    if (!Object.is(a, b)) fail(path, "value");
  };
  for (const k of Object.keys(raw)) if (k !== "schema" && k !== "schemaVersion") cmp(raw[k], pub[k], `$.${k}`);
}

/** Public provenance: raw capture attestation → sanitizer → public snapshot, plus the authored capture record. */
export function publicProvenance({ rawBytes, rawProvenance, publicText, counts, publicFile }) {
  const capture = { ...rawProvenance };
  for (const k of ["$comment", "file", "sha256", "bytes", "figmaFileKey", "schema", "schemaVersion"]) delete capture[k];
  return {
    $comment: "GENERATED by packages/tokens/build/sanitize-snapshot.mjs from the private raw Figma capture and its authored capture record — do not edit. The raw capture is not published; its SHA-256 is an attestation (ADR 0011).",
    file: publicFile,
    sha256: sha256(publicText),
    bytes: Buffer.byteLength(publicText),
    ...PUBLIC_SCHEMA,
    derivedFrom: {
      description: "Private raw capture from the read-only Figma exporter (not published).",
      schema: rawProvenance.schema || RAW_SCHEMA.schema,
      schemaVersion: rawProvenance.schemaVersion,
      sha256: sha256(rawBytes),
      bytes: rawBytes.length,
    },
    sanitizer: { name: SANITIZER_NAME, version: SANITIZER_VERSION, path: "packages/tokens/build/sanitize-snapshot.mjs" },
    transformations: counts,
    capture,
  };
}

/** Re-derive the public snapshot from a raw capture and compare byte-for-byte (used when the raw file is available). */
export function rederive(rawPath, publicText) {
  const rawBytes = readFileSync(rawPath);
  const { snapshot } = sanitizeSnapshot(JSON.parse(rawBytes.toString("utf8")));
  return { rawSha256: sha256(rawBytes), identical: toPublicText(snapshot) === publicText };
}

// CLI: node build/sanitize-snapshot.mjs <raw-snapshot.json> <raw-provenance.json> <public-snapshot-out.json>
// Writes the public snapshot and "<name>.provenance.json" next to it. Inputs are private and never committed.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [rawPath, rawProvPath, outPath] = process.argv.slice(2).map((p) => p && resolve(p));
  if (!rawPath || !rawProvPath || !outPath) throw new Error("usage: sanitize-snapshot.mjs <raw.json> <raw-provenance.json> <public-out.json>");
  const rawBytes = readFileSync(rawPath);
  const rawProvenance = JSON.parse(readFileSync(rawProvPath, "utf8"));
  if (sha256(rawBytes) !== rawProvenance.sha256 || rawBytes.length !== rawProvenance.bytes) throw new Error("Raw capture does not match its capture record (SHA-256/size)");
  const { snapshot, counts } = sanitizeSnapshot(JSON.parse(rawBytes.toString("utf8")));
  const publicText = toPublicText(snapshot);
  writeFileSync(outPath, publicText);
  const prov = publicProvenance({ rawBytes, rawProvenance, publicText, counts, publicFile: basename(outPath) });
  const provPath = join(dirname(outPath), basename(outPath).replace(/\.json$/, ".provenance.json"));
  writeFileSync(provPath, JSON.stringify(prov, null, 2) + "\n");
  console.log(`Public snapshot ${basename(outPath)} sha256 ${prov.sha256} (${prov.bytes} bytes) ← raw ${prov.derivedFrom.sha256}; ${JSON.stringify(counts)}`);
}
