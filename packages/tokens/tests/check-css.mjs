// AUTHORED. CSS build v0.3 on the fixture pipeline: structure (brand blocks → brand-scoped public → :root → media),
// brand switching, public/private boundaries, opaque + alpha colours, typography properties, responsive output and
// dedup, unit policy (incl. failures and Style Dictionary as second line of defence), primitive exclusion, naming,
// and the ADR 0008 composite re-declaration rule.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, throwsWith, config, policy, fixturePipeline, parseCss } from "./lib.mjs";
import { loadDtcg, runStyleDictionary, buildPlan, validateDeclarations, TRANSFORMS, SD_VERSION } from "../build/build-css.mjs";

export const FIXTURE_EXPECTED = {
  brand: { financial: { "--ch-brand-primary-800": "#1e3d7a" }, invest: { "--ch-brand-primary-800": "#590da2" } },
  brandScoped: { "--ch-color-control-checked": "var(--ch-brand-primary-800)" },
  base: {
    "--ch-border-width-default": "1px", "--ch-font-family-sans": "Inter, system-ui, sans-serif", "--ch-font-weight-medium": "500",
    "--ch-radius-full": "9999px", "--ch-radius-md": "0.5rem", "--ch-size-control-height-md": "3rem", "--ch-space-gap-md": "0.75rem",
    "--ch-font-line-height-body-md": "1.5rem", "--ch-font-size-body-md": "1rem", "--ch-layout-margin": "1rem",
    "--ch-color-elevation-shadow-overlay": "rgb(27 34 44 / 12%)", "--ch-color-text-default": "#1b222c",
    "--ch-elevation-overlay": "0px 4px 12px -2px var(--ch-color-elevation-shadow-overlay), 0px 2px 4px 0px var(--ch-color-elevation-shadow-overlay)",
  },
  tablet: { "--ch-layout-margin": "2rem" },
  desktop: { "--ch-layout-margin": "2.5rem" },
};
const same = (map, obj) => map.size === Object.keys(obj).length && Object.entries(obj).every(([k, v]) => map.get(k) === v);

export async function run() {
  const lines = [];
  const src = (await import("node:fs")).readFileSync(new URL("../build/build-css.mjs", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  for (const bad of [/transformGroup/, /["']web["']/, /["']size\//, /["']color\/(css|hex|rgb)["']/, /shadow\/css\/shorthand/, /["']name\/kebab["']/]) assert(!bad.test(src), `build-css.mjs must not use built-in ${bad}`);
  assert(SD_VERSION === "5.5.5" && TRANSFORMS.every((t) => t.startsWith("ch/")), "pinned SD, handwritten transforms only");

  const p = await fixturePipeline();
  try {
    const blocks = parseCss(p.cssText);
    const sel = blocks.map((b) => (b.media ? `@${b.media} ${b.selector}` : b.selector));
    assert(JSON.stringify(sel) === JSON.stringify([':root, [data-brand="financial"]', '[data-brand="invest"]', ":root, [data-brand]", ":root", "@48rem :root", "@64rem :root"]), `block structure ${JSON.stringify(sel)}`);
    const [fin, inv, scoped, root, tab, desk] = blocks;
    assert(same(fin.decls, FIXTURE_EXPECTED.brand.financial) && same(inv.decls, FIXTURE_EXPECTED.brand.invest), "brand blocks");
    assert(same(scoped.decls, FIXTURE_EXPECTED.brandScoped), "brand-scoped public block");
    assert(same(root.decls, FIXTURE_EXPECTED.base), `base values: ${JSON.stringify([...root.decls])}`);
    assert(same(tab.decls, FIXTURE_EXPECTED.tablet) && same(desk.decls, FIXTURE_EXPECTED.desktop), "responsive overrides (dedup: equal body/md values only in base)");
    lines.push("structure: :root+[data-brand=financial] → [data-brand=invest] → :root, [data-brand] (brand-dependent public) → :root → @media 48rem → @media 64rem; all values exact");

    // Boundaries
    for (const b of blocks) for (const n of b.decls.keys()) assert(/^--ch-[a-z0-9]+(-[a-z0-9]+)*$/.test(n), `${n}: naming`);
    const brandNames = [...fin.decls.keys(), ...inv.decls.keys()];
    assert(brandNames.every((n) => n.startsWith("--ch-brand-")) && [scoped, root, tab, desk].every((b) => [...b.decls.keys()].every((n) => !n.startsWith("--ch-brand-"))), "--ch-brand-* only in brand blocks");
    const publicValues = [scoped, root, tab, desk].flatMap((b) => [...b.decls.values()]);
    const refs = publicValues.flatMap((v) => [...v.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]));
    const declared = new Set(blocks.flatMap((b) => [...b.decls.keys()]));
    assert(refs.every((r) => declared.has(r)), "every var() targets an emitted token");
    for (const prim of ["--ch-color-navy-800", "--ch-color-violet-800", "--ch-space-300", "--ch-radius-max", "--ch-font-family-inter", "--ch-font-weight-500", "--ch-color-alpha-neutral-950-12", "--ch-size-icon-md"]) assert(!p.cssText.includes(prim), `${prim} must not be emitted`);
    lines.push("boundaries: --ch-brand-* only inside brand scopes; public tokens reference only emitted tokens; primitives and scope-excluded tokens absent");

    // Colour + typography
    assert(!/rgba\(|#[0-9A-F]{6}\b|#[0-9a-f]{3}\b|0\.1199/.test(p.cssText.replace(/\/\*[\s\S]*?\*\//g, "")), "no legacy/uppercase/short/float-noise colours");
    lines.push("colour: opaque → #1e3d7a / #590da2 / #1b222c; alpha → rgb(27 34 44 / 12%); typography: --ch-font-family-sans Inter, system-ui, sans-serif, --ch-font-weight-medium 500, size/line-height rem; no composite");

    // Composite re-declaration (ADR 0008): a shadow bound to a brand-dependent colour joins the brand scope.
    const q = await fixturePipeline({
      mutateSnapshot: (s) => {
        const navy = s.variables.find((v) => v.name === "color/navy/800").valuesByMode["1:0"];
        for (const e of s.styles.effect[0].effects) { e.boundVariables.color.id = "VariableID:51:2"; e.color = { ...navy }; }
      },
    });
    try {
      const qb = parseCss(q.cssText);
      const scopedQ = qb.find((b) => b.selector === ":root, [data-brand]");
      assert(scopedQ.decls.get("--ch-elevation-overlay") === "0px 4px 12px -2px var(--ch-color-control-checked), 0px 2px 4px 0px var(--ch-color-control-checked)" && !qb.find((b) => b.selector === ":root").decls.has("--ch-elevation-overlay"), "brand-dependent composite must be re-declared in the brand scope");
    } finally { q.cleanup(); }
    lines.push("ADR 0008: a shadow bound to a brand-dependent colour moves into :root, [data-brand] (nested brand contexts re-resolve it)");

    // Unit policy failures before SD, and SD itself as second line of defence
    const tmp = mkdtempSync(join(tmpdir(), "ch-pol-"));
    try {
      const withPolicy = async (mutate) => {
        const pol = policy(); mutate(pol);
        const f = join(tmp, `${Math.random().toString(36).slice(2)}.json`); writeFileSync(f, JSON.stringify(pol));
        return fixturePipeline({ policyPath: f }).then((r) => r.cleanup());
      };
      await throwsWith(() => withPolicy((pol) => (pol.dimensionRules = pol.dimensionRules.filter((r) => r.id !== "finite-radius"))), /radius\/md is unclassified/, "missing rule");
      await throwsWith(() => withPolicy((pol) => pol.dimensionRules.push({ id: "overlap", match: ["radius/*"], output: "rem" })), /ambiguous/, "ambiguous rule");
      await throwsWith(() => withPolicy((pol) => (pol.fontFamily.stacks = {})), /no web font stack/, "missing font stack");
      await throwsWith(() => withPolicy((pol) => (pol.emittedTypes = pol.emittedTypes.filter((t) => t !== "fontWeight"))), /\$type "fontWeight" has no web policy/, "unpoliced type");
      const dtcg = loadDtcg(p.dtcgDir);
      const lax = policy(); lax.dimensionRules = lax.dimensionRules.filter((r) => r.id !== "finite-radius");
      const plan = buildPlan(config(), lax, Object.keys(dtcg.sets));
      await throwsWith(() => runStyleDictionary({ files: dtcg.files, setNames: [...plan.shared, plan.brands[0].set, plan.breakpoints[0].set], config: config(), policy: lax }), /could not be applied correctly/, "SD must not swallow a transform failure");
    } finally { rmSync(tmp, { recursive: true, force: true }); }
    const V = (d) => validateDeclarations([{ name: "--ch-a", css: "--ch-a", path: "a", figmaPath: "a", layer: "dimension", visibility: "public", type: "dimension", description: null, value: "1px", ...d }], { primitivePaths: new Set(["space.300"]), prefix: "ch" });
    await throwsWith(() => V({ value: "12" }), /unitless/, "unitless dimension");
    await throwsWith(() => V({ value: "[object Object]" }), /object value/, "object value");
    await throwsWith(() => V({ path: "space.300" }), /primitive leaked/, "primitive");
    await throwsWith(() => V({ name: "--ch-brand-a", css: "--ch-brand-a", figmaPath: "brand/a" }), /brand namespace/, "public token in brand namespace");
    await throwsWith(() => V({ type: "fontWeight", value: "medium" }), /font weight must be a number/, "weight keyword");
    lines.push("failures: missing/ambiguous unit rule, missing font stack, unpoliced type (before SD); SD transform failure (warnings as errors); unitless, object, primitive, namespace and weight violations (after SD)");
  } finally {
    p.cleanup();
  }
  return lines;
}
