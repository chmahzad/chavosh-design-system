// AUTHORED. Token pipeline v0.3 — generated DTCG → Style Dictionary 5.5.5 → packages/tokens/dist/ch-tokens.css.
//
// Evolved from the frozen proof archive (not a dependency on it):
// - Proof #1 (tag proof-1-closed): internal --ch-brand-* layer per brand scope (default brand also on :root);
//   brand-dependent public tokens keep a live var(--ch-brand-*) reference and are re-declared on
//   `:root, [data-brand]` so page-level and nested brand contexts re-resolve (verified in Chromium).
// - Proof #2 (tag proof-2-closed): handwritten web policy (no built-in transform groups), policy check BEFORE
//   Style Dictionary (SD swallows transform errors by default), SD with warnings as errors, post-build
//   validation against an SD-independent expectation, primitives never emitted, mobile-first responsive
//   output with deduplicated overrides at 48rem / 64rem, live shadow colour reference, deterministic output.
// New in v0.3:
// - G2 colour: opaque → hex, translucent → rgb(R G B / A%).
// - G3 fonts: fontFamily → web stack from policy (Inter, system-ui, sans-serif); fontWeight → number.
// - ADR 0008: a public token whose value references a brand-scoped token (e.g. a shadow using a
//   brand-dependent colour) is re-declared in the brand scope as well (Proof #2 nested-composite finding).
import StyleDictionary from "style-dictionary";
import { createPropertyFormatter } from "style-dictionary/utils";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPxDimension, colorToCss, fontFamilyToCss, fontWeightToCss, formatDimension, ruleFor } from "./lib/units.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BUILD_CSS_VERSION = "0.3.0";
export const SD_VERSION = "5.5.5";
export const DTCG_DIR = "generated/dtcg";
export const POLICY_PATH = "source/web-policy.json";
export const CONFIG_PATH = "source/export-config.json";
export const DEFAULT_OUT_DIR = "dist";
export const CSS_FILE = "ch-tokens.css";
export const TRANSFORMS = ["ch/name/figma-path", "ch/dimension/web", "ch/color/css", "ch/fontFamily/web", "ch/fontWeight/web", "ch/shadow/web"];

const chavosh = (t) => (t && t.$extensions && t.$extensions.chavosh) || {};
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const isRef = (v) => typeof v === "string" && /^\{[^{}]+\}$/.test(v);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function assertStyleDictionaryVersion() {
  const entry = fileURLToPath(import.meta.resolve("style-dictionary"));
  const v = JSON.parse(readFileSync(join(dirname(entry), "..", "package.json"), "utf8")).version;
  if (v !== SD_VERSION) throw new Error(`Style Dictionary ${v} installed; the token pipeline is pinned to ${SD_VERSION}`);
  return v;
}

export function flatten(tree, p = []) {
  return Object.entries(tree).flatMap(([k, v]) =>
    k.startsWith("$") ? [] : v && typeof v === "object" && "$value" in v ? [[[...p, k].join("."), v]] : v && typeof v === "object" ? flatten(v, [...p, k]) : [],
  );
}

/** Load the generated DTCG sets exactly as the converter wrote them (manifest hashes, no unlisted files). */
export function loadDtcg(dtcgDir = join(ROOT, DTCG_DIR)) {
  const manifestText = readFileSync(join(dtcgDir, "_manifest.json"), "utf8");
  const manifest = JSON.parse(manifestText);
  const listed = Object.keys(manifest.files).sort();
  const present = readdirSync(dtcgDir).filter((f) => f.endsWith(".tokens.json")).sort();
  if (JSON.stringify(listed) !== JSON.stringify(present)) throw new Error(`DTCG set files ${present} do not match _manifest.json ${listed} — run \`npm run convert\``);
  const sets = {};
  const files = {};
  for (const f of listed) {
    const buf = readFileSync(join(dtcgDir, f));
    if (sha256(buf) !== manifest.files[f]) throw new Error(`${f}: SHA-256 differs from _manifest.json — generated DTCG was modified; run \`npm run convert\``);
    const name = f.replace(/\.tokens\.json$/, "");
    sets[name] = JSON.parse(buf.toString("utf8"));
    files[name] = join(dtcgDir, f);
  }
  return { manifest, manifestSha256: sha256(manifestText), sets, files };
}

/** Which sets each (brand, breakpoint) Style Dictionary run loads — derived from policy and present sets. */
export function buildPlan(config, policy, setNames) {
  const has = (s) => setNames.includes(s);
  const brandP = config.collections.Brand;
  const brandSets = Object.entries(brandP.modeSets).filter(([, s]) => has(s));
  const brands = brandSets.length
    ? brandSets.map(([mode, set]) => ({ mode, slug: brandP.modeSlugs[mode], set, isDefault: mode === brandP.defaultMode })).sort((a, b) => (b.isDefault - a.isDefault) || cmp(a.slug, b.slug))
    : [{ mode: null, slug: null, set: null, isDefault: true }];
  if (brandSets.length && !brands[0].isDefault) throw new Error(`Default brand ${brandP.defaultMode} has no DTCG set`);
  const resp = config.collections.Responsive;
  const setForSlug = Object.fromEntries(Object.entries(resp.modeSlugs).map(([mode, slug]) => [slug, resp.modeSets[mode]]));
  const order = [{ mode: policy.responsive.base, minWidth: null }, ...policy.responsive.overrides];
  const anyResp = order.some((b) => has(setForSlug[b.mode]));
  if (anyResp && !order.every((b) => has(setForSlug[b.mode]))) throw new Error("Responsive DTCG sets are incomplete");
  const breakpoints = order.map((b) => ({ ...b, set: anyResp ? setForSlug[b.mode] : null }));
  const modal = new Set([...Object.values(brandP.modeSets), ...Object.values(resp.modeSets)]);
  const shared = setNames.filter((s) => !modal.has(s)).sort();
  for (const s of shared) {
    const known = Object.values(config.collections).some((c) => c.set === s) || s === config.effectStyles.set;
    if (!known) throw new Error(`DTCG set "${s}" has no export policy`);
  }
  return { brands, breakpoints, shared };
}

const setsFor = (plan, brand, bp) => [...plan.shared, ...(brand.set ? [brand.set] : []), ...(bp.set ? [bp.set] : [])];

/** Format a fully resolved value by DTCG type under the web policy. */
export function formatValue(type, value, policy, path) {
  if (type === "dimension") return formatDimension(ruleFor(policy, path), value, policy.remBasePx, path);
  if (type === "color") return colorToCss(value, path);
  if (type === "fontFamily") return fontFamilyToCss(value, policy, path);
  if (type === "fontWeight") return fontWeightToCss(value, policy, path);
  throw new Error(`${path}: $type "${type}" has no web policy`);
}

const isFormattedColor = (v) => typeof v === "string" && /^(#[0-9a-f]{6}|rgb\(\d{1,3} \d{1,3} \d{1,3} \/ \d+(\.\d+)?%\))$/.test(v);
const isFormattedStack = (v, policy) => typeof v === "string" && Object.keys(policy.fontFamily.stacks).some((f) => fontFamilyToCss(f, policy, "stack") === v);
const usesOutputReferences = (t) => chavosh(t).brandDependent === true || t.$type === "shadow";

/**
 * Pre-Style-Dictionary policy check and SD-independent expectation for every (brand, breakpoint) run.
 * Fails on unclassified/ambiguous dimensions, non-px sources, unknown font families, invalid weights,
 * unsupported types, or public tokens that reference non-emitted tokens.
 */
export function preflight({ sets }, config, policy) {
  const plan = buildPlan(config, policy, Object.keys(sets));
  const classification = {};
  const usedRules = new Set();
  const expected = {};
  for (const brand of plan.brands) {
    for (const bp of plan.breakpoints) {
      const inBuild = setsFor(plan, brand, bp);
      const all = new Map(inBuild.flatMap((s) => flatten(sets[s]).map(([p, t]) => [p, t])));
      if (all.size !== inBuild.reduce((n, s) => n + flatten(sets[s]).length, 0)) throw new Error(`Token path collision across sets (${brand.slug}/${bp.mode})`);
      const resolveRef = (v, seen = []) => {
        if (!isRef(v)) return v;
        const p = v.slice(1, -1);
        if (seen.includes(p)) throw new Error(`Reference cycle: ${[...seen, p].join(" → ")}`);
        const t = all.get(p);
        if (!t) throw new Error(`Unresolved reference ${v}`);
        return resolveRef(t.$value, [...seen, p]);
      };
      const emittedCss = (refStr, from) => {
        const t = all.get(refStr.slice(1, -1));
        const c = chavosh(t);
        if (!t || c.visibility === "source-only") throw new Error(`${from}: live reference ${refStr} targets a token that is not emitted`);
        return `var(${c.css})`;
      };
      const out = {};
      for (const [p, t] of all) {
        const c = chavosh(t);
        if (c.visibility === "source-only") continue;
        if (!["public", "internal"].includes(c.visibility)) throw new Error(`${p}: visibility "${c.visibility}" is not emitted`);
        if (c.visibility === "internal" && c.layer !== "brand") throw new Error(`${p}: only the Brand layer may be internal`);
        if (!policy.emittedTypes.includes(t.$type)) throw new Error(`${p}: $type "${t.$type}" has no web policy`);
        const figmaPath = c.figma && c.figma.path;
        if (!figmaPath) throw new Error(`${p}: missing $extensions.chavosh.figma.path`);
        let value;
        if (t.$type === "shadow") {
          classification[figmaPath] = "shadow";
          if (!Array.isArray(t.$value) || !t.$value.length) throw new Error(`${p}: shadow must be a non-empty layer array`);
          value = t.$value
            .map((layer, i) => {
              const keys = Object.keys(layer).sort();
              const want = [...policy.shadowGeometry.fields, "color"].sort();
              if (JSON.stringify(keys) !== JSON.stringify(want)) throw new Error(`${p}[${i}]: shadow layer keys ${keys} ≠ ${want}`);
              if (!isRef(layer.color)) throw new Error(`${p}[${i}]: shadow colour must reference a semantic colour token`);
              return `${policy.shadowGeometry.fields.map((f) => `${assertPxDimension(layer[f], `${p}[${i}].${f}`)}px`).join(" ")} ${emittedCss(layer.color, p)}`;
            })
            .join(", ");
        } else if (usesOutputReferences(t)) {
          if (!isRef(t.$value)) throw new Error(`${p}: brand-dependent token must be an alias`);
          classification[figmaPath] = `${t.$type} (live reference)`;
          formatValue(t.$type, resolveRef(t.$value), policy, figmaPath); // the resolved value must still satisfy policy
          value = emittedCss(t.$value, p);
        } else {
          if (t.$type === "dimension") usedRules.add(ruleFor(policy, figmaPath).id);
          classification[figmaPath] = t.$type === "dimension" ? ruleFor(policy, figmaPath).id : t.$type;
          value = formatValue(t.$type, resolveRef(t.$value), policy, figmaPath);
        }
        out[c.css] = value;
      }
      expected[`${brand.slug}/${bp.mode}`] = out;
    }
  }
  const unusedRules = policy.dimensionRules.filter((r) => !usedRules.has(r.id)).map((r) => r.id);
  return { plan, classification, expected, unusedRules };
}

export function sdHooks(config, policy) {
  const primitive = (t) => chavosh(t).layer === "primitive";
  const fp = (t) => chavosh(t).figma.path;
  return {
    transforms: {
      "ch/name/figma-path": { type: "name", transform: (t, platform) => [platform.prefix, ...t.path].join("-") },
      // Transitive transforms see a referenced token's value AFTER its own transform when that token is not a
      // primitive (e.g. semantic colour → Brand colour, already hex). Colour / font stack / weight formatting is
      // path-independent, so an already-formatted value passes through unchanged. Dimension output depends on
      // the token's own rule, so a non-primitive → non-primitive dimension alias is refused.
      "ch/dimension/web": {
        type: "value", transitive: true, filter: (t) => t.$type === "dimension" && !primitive(t),
        transform: (t) => {
          if (typeof t.$value === "string") throw new Error(`${fp(t)}: dimension aliases a non-primitive dimension (${t.original.$value}); not supported — alias the primitive`);
          return formatDimension(ruleFor(policy, fp(t)), t.$value, policy.remBasePx, fp(t));
        },
      },
      "ch/color/css": { type: "value", transitive: true, filter: (t) => t.$type === "color" && !primitive(t), transform: (t) => (isFormattedColor(t.$value) ? t.$value : colorToCss(t.$value, fp(t))) },
      "ch/fontFamily/web": { type: "value", transitive: true, filter: (t) => t.$type === "fontFamily" && !primitive(t), transform: (t) => (isFormattedStack(t.$value, policy) ? t.$value : fontFamilyToCss(t.$value, policy, fp(t))) },
      "ch/fontWeight/web": { type: "value", transitive: true, filter: (t) => t.$type === "fontWeight" && !primitive(t), transform: (t) => (typeof t.$value === "string" && /^\d+$/.test(t.$value) ? t.$value : fontWeightToCss(t.$value, policy, fp(t))) },
      "ch/shadow/web": {
        type: "value",
        transitive: true,
        filter: (t) => t.$type === "shadow",
        transform: (t) =>
          t.$value
            .map((layer, i) => {
              if (typeof layer.color !== "string" || layer.color.startsWith("{")) throw new Error(`${t.name}[${i}]: shadow colour not yet resolved`);
              return `${policy.shadowGeometry.fields.map((f) => `${assertPxDimension(layer[f], `${t.name}[${i}].${f}`)}px`).join(" ")} ${layer.color}`;
            })
            .join(", "),
      },
    },
    formats: {
      "ch/declarations": ({ dictionary, options }) => {
        const fmt = createPropertyFormatter({ outputReferences: options.outputReferences, dictionary, format: "css", usesDtcg: true, formatting: { commentStyle: "none" } });
        const rows = dictionary.allTokens.map((t) => {
          const line = fmt(t);
          const m = /^\s*(--[a-z0-9-]+): (.*);$/.exec(line);
          if (!m) throw new Error(`Unexpected declaration line: ${line}`);
          const c = chavosh(t);
          return { name: m[1], value: m[2], path: t.path.join("."), figmaPath: c.figma.path, layer: c.layer, visibility: c.visibility, type: t.$type, brandDependent: c.brandDependent === true, css: c.css, description: t.$description ?? null };
        });
        return JSON.stringify(rows.sort((a, b) => cmp(a.name, b.name)));
      },
    },
  };
}

/** One Style Dictionary run (no files written). */
export async function runStyleDictionary({ files, setNames, config, policy }) {
  const sd = new StyleDictionary({
    usesDtcg: true,
    source: setNames.map((s) => files[s]),
    hooks: sdHooks(config, policy),
    log: { verbosity: process.env.CH_SD_VERBOSE ? "verbose" : "silent", warnings: "error", errors: { brokenReferences: "throw" } },
    platforms: {
      css: {
        prefix: config.cssPrefix,
        transforms: TRANSFORMS,
        files: [{ destination: "declarations.json", format: "ch/declarations", filter: (t) => ["public", "internal"].includes(chavosh(t).visibility), options: { outputReferences: usesOutputReferences } }],
      },
    },
  });
  const outputs = await sd.formatPlatform("css");
  if (outputs.length !== 1) throw new Error(`Expected one Style Dictionary output, got ${outputs.length}`);
  const tokenCount = (await sd.getPlatformTokens("css")).allTokens.length;
  return { declarations: JSON.parse(outputs[0].output), tokenCount };
}

/** Post-build validation of emitted declarations. */
export function validateDeclarations(decls, { primitivePaths, prefix }) {
  const names = new Set();
  for (const d of decls) {
    if (!d.name.startsWith(`--${prefix}-`)) throw new Error(`${d.name}: missing --${prefix}- prefix`);
    if (names.has(d.name)) throw new Error(`Collision: ${d.name} emitted twice`);
    names.add(d.name);
    if (d.name !== d.css) throw new Error(`${d.name}: differs from $extensions.chavosh.css ${d.css}`);
    if (d.name !== `--${prefix}-${d.figmaPath.split("/").join("-")}`) throw new Error(`${d.name}: not traceable to Figma path ${d.figmaPath}`);
    if (primitivePaths.has(d.path)) throw new Error(`${d.name}: primitive leaked into CSS`);
    if ((d.layer === "brand") !== d.name.startsWith(`--${prefix}-brand-`)) throw new Error(`${d.name}: brand namespace must be exactly the internal Brand layer`);
    if (d.visibility === "internal" && d.layer !== "brand") throw new Error(`${d.name}: only Brand may be internal`);
    if (/\[object Object\]|[{}]|undefined|NaN/.test(d.value)) throw new Error(`${d.name}: unresolved/object value "${d.value}"`);
    if (d.type === "fontWeight") {
      if (!/^\d+$/.test(d.value) && !/^var\(--[a-z0-9-]+\)$/.test(d.value)) throw new Error(`${d.name}: font weight must be a number, got "${d.value}"`);
    } else if (/(^|[\s,(])-?\d*\.?\d+(?=$|[\s,)])/.test(d.value.replace(/rgb\([^)]*\)/g, "rgb()")) && d.value !== "0") {
      throw new Error(`${d.name}: unitless number in "${d.value}"`);
    }
    if (/\*\//.test(d.description || "")) throw new Error(`${d.name}: description contains "*/"`);
  }
  return decls;
}

/** Brand blocks, brand-scoped public tokens, mobile-first base and deduplicated overrides. */
export function assemble(runs, plan) {
  const base = plan.breakpoints[0];
  const def = plan.brands[0];
  const key = (b, bp) => `${b.slug}/${bp.mode}`;
  const names = runs[key(def, base)].map((d) => d.name).join(",");
  for (const k of Object.keys(runs)) if (runs[k].map((d) => d.name).join(",") !== names) throw new Error(`Run ${k} emits a different token set`);
  const byName = (k) => Object.fromEntries(runs[k].map((d) => [d.name, d]));

  const brandBlocks = plan.brands.filter((b) => b.set).map((b) => {
    const decls = runs[key(b, base)].filter((d) => d.layer === "brand");
    for (const bp of plan.breakpoints) for (const d of runs[key(b, bp)].filter((x) => x.layer === "brand")) if (byName(key(b, base))[d.name].value !== d.value) throw new Error(`${d.name}: brand token varies by breakpoint`);
    return { brand: b, decls };
  });

  const pub = (k) => runs[k].filter((d) => d.layer !== "brand");
  for (const bp of plan.breakpoints) {
    const ref = byName(key(def, bp));
    for (const b of plan.brands.slice(1)) for (const d of pub(key(b, bp))) if (ref[d.name].value !== d.value) throw new Error(`${d.name}: public value differs between brands without a brand-layer reference`);
  }
  const brandScoped = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of pub(key(def, base))) {
      if (brandScoped.has(d.name)) continue;
      const refs = [...d.value.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
      if (refs.some((r) => r.startsWith("--ch-brand-") || brandScoped.has(r))) {
        brandScoped.add(d.name);
        grew = true;
      }
    }
  }
  const baseDecls = pub(key(def, base));
  let prev = byName(key(def, base));
  const overrides = [];
  for (const bp of plan.breakpoints.slice(1)) {
    const decls = pub(key(def, bp));
    const changed = decls.filter((d) => d.value !== prev[d.name].value);
    for (const d of changed) {
      if (d.layer !== "responsive") throw new Error(`${d.name}: non-responsive token differs at ${bp.mode}`);
      if (brandScoped.has(d.name)) throw new Error(`${d.name}: brand-scoped token may not vary by breakpoint`);
    }
    overrides.push({ ...bp, decls: changed });
    prev = byName(key(def, bp));
  }
  return {
    brandBlocks,
    brandScoped: baseDecls.filter((d) => brandScoped.has(d.name)),
    base: baseDecls.filter((d) => !brandScoped.has(d.name)),
    overrides,
  };
}

const LAYER_ORDER = [
  ["dimension", "Dimension (single mode) — spacing, sizing, radius, borders, font family and weight"],
  ["responsive", "Responsive — Mobile base"],
  ["semantic", "Semantic colour (brand-independent)"],
  ["composite", "Effects"],
];

export function renderCss(a, meta, { brandAttribute }) {
  const decl = (d, withDescription, indent = "  ") => `${indent}${d.name}: ${d.value};${withDescription && d.description ? ` /** ${d.description} */` : ""}`;
  const known = new Set(LAYER_ORDER.map(([l]) => l));
  for (const d of a.base) if (!known.has(d.layer)) throw new Error(`${d.name}: layer "${d.layer}" has no CSS section`);
  const parts = [];
  parts.push(
    `/**\n * Chavosh Financial Design System — design tokens (web)\n` +
      ` * GENERATED by packages/tokens/build/build-css.mjs ${meta.buildVersion} (Style Dictionary ${meta.sdVersion}) — do not edit.\n` +
      ` * Source: ${DTCG_DIR} (manifest sha256 ${meta.manifestSha256}) ← public Figma snapshot(s) ${meta.snapshotSha256}.\n` +
      ` * Web policy: ${POLICY_PATH} (sha256 ${meta.policySha256}).\n` +
      ` * Public API: --ch-* outside the --ch-brand-* namespace. --ch-brand-* is an internal runtime layer, not for components.\n` +
      ` * Brand: ${meta.defaultBrand ? `${meta.defaultBrand} by default; set ${brandAttribute}="<brand>" on any ancestor (page-level or nested).` : "single brand."}\n` +
      ` * Responsive: mobile-first; overrides only where a value differs from the previous breakpoint. Primitives are never emitted.\n */\n`,
  );
  if (a.brandBlocks.length) {
    parts.push(`/* Internal Brand layer (per brand context; ${a.brandBlocks[0].brand.slug} is the default) */`);
    for (const { brand, decls } of a.brandBlocks) {
      const sel = brand.isDefault ? `:root, [${brandAttribute}="${brand.slug}"]` : `[${brandAttribute}="${brand.slug}"]`;
      parts.push(`${sel} {\n${decls.map((d) => decl(d, true)).join("\n")}\n}\n`);
    }
  }
  if (a.brandScoped.length) {
    parts.push(`/* Public tokens that depend on brand — re-declared in every brand context so nested contexts re-resolve */\n:root, [${brandAttribute}] {\n${a.brandScoped.map((d) => decl(d, true)).join("\n")}\n}\n`);
  }
  const sections = LAYER_ORDER.map(([layer, title]) => [title, a.base.filter((d) => d.layer === layer)])
    .filter(([, ds]) => ds.length)
    .map(([title, ds]) => `  /* ${title} */\n${ds.map((d) => decl(d, true)).join("\n")}`);
  parts.push(`:root {\n${sections.join("\n\n")}\n}\n`);
  for (const o of a.overrides.filter((x) => x.decls.length)) {
    parts.push(`/* ${o.mode[0].toUpperCase()}${o.mode.slice(1)} — values that differ from the previous breakpoint */\n@media (min-width: ${o.minWidth}) {\n  :root {\n${o.decls.map((d) => decl(d, false, "    ")).join("\n")}\n  }\n}\n`);
  }
  return parts.join("\n");
}

/** Full build. Writes <outDir>/ch-tokens.css unless outDir is null. */
export async function buildCss({ root = ROOT, outDir = join(root, DEFAULT_OUT_DIR), policyPath = join(root, POLICY_PATH), configPath = join(root, CONFIG_PATH), dtcgDir = join(root, DTCG_DIR) } = {}) {
  const sdVersion = assertStyleDictionaryVersion();
  const policyText = readFileSync(policyPath, "utf8");
  const policy = JSON.parse(policyText);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const dtcg = loadDtcg(dtcgDir);
  const { plan, expected, classification, unusedRules } = preflight(dtcg, config, policy);
  const primitivePaths = new Set(flatten(dtcg.sets[config.collections.Primitives.set] || {}).map(([p]) => p));
  const runs = {};
  const tokenCounts = {};
  for (const brand of plan.brands) {
    for (const bp of plan.breakpoints) {
      const k = `${brand.slug}/${bp.mode}`;
      const { declarations, tokenCount } = await runStyleDictionary({ files: dtcg.files, setNames: setsFor(plan, brand, bp), config, policy });
      validateDeclarations(declarations, { primitivePaths, prefix: config.cssPrefix });
      const got = Object.fromEntries(declarations.map((d) => [d.name, d.value]));
      const want = expected[k];
      const norm = (o) => JSON.stringify(o, Object.keys(o).sort());
      if (norm(got) !== norm(want)) throw new Error(`Style Dictionary output for ${k} differs from the policy expectation:\n${norm(got)}\n${norm(want)}`);
      runs[k] = declarations;
      tokenCounts[k] = tokenCount;
    }
  }
  const assembled = assemble(runs, plan);
  const css = renderCss(
    assembled,
    {
      buildVersion: BUILD_CSS_VERSION, sdVersion, manifestSha256: dtcg.manifestSha256, snapshotSha256: dtcg.manifest.snapshots.map((s) => `${s.id} sha256 ${s.sha256}`).join(", "),
      policySha256: sha256(policyText), defaultBrand: plan.brands[0].slug,
    },
    { brandAttribute: policy.brand.attribute },
  );
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    for (const f of readdirSync(outDir)) if (f.endsWith(".css") && f !== CSS_FILE) rmSync(join(outDir, f));
    writeFileSync(join(outDir, CSS_FILE), css);
  }
  return { css, plan, classification, expected, unusedRules, runs, assembled, tokenCounts };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { assembled, unusedRules } = await buildCss();
  console.log(`Built ${DEFAULT_OUT_DIR}/${CSS_FILE}: ${assembled.brandBlocks.length} brand block(s), ${assembled.brandScoped.length} brand-scoped, ${assembled.base.length} base; overrides ${assembled.overrides.map((o) => `${o.mode} ${o.decls.length}`).join(", ")}; unused policy rules: ${unusedRules.join(", ") || "none"}`);
}
