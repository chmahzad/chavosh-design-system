// AUTHORED. Production state of packages/tokens.
// Without a public snapshot: status PENDING (manual read-only Figma exporter run + sanitizer required) and NO
// production outputs may exist (generated/dtcg, dist/ch-tokens.css) — nothing is fabricated.
// With the public snapshot (ADR 0011): provenance gate on the PUBLIC SHA-256; the private raw capture is an attestation,
// re-derived byte-for-byte only when CHAVOSH_RAW_SNAPSHOT points to it (optional, never required); snapshot roots =
// exporter roots = export-config; generated/dtcg and
// dist/ch-tokens.css equal a fresh build (freshness, no hand edits, no stale files); Button v1 closure equals the
// approved Button architecture (button-v1-spec.json) — differences are Design/code mismatches for review.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, config, readJson, diffDirs, parseCss, ROOT } from "./lib.mjs";
import { convert, loadPublicSnapshot } from "../build/convert-snapshot.mjs";
import { rederive } from "../build/sanitize-snapshot.mjs";
import { buildCss, flatten } from "../build/build-css.mjs";
import { pluginRoots } from "../../../tools/figma-exporter/tests/mock.mjs";

export async function run() {
  const cfg = config();
  const snapPath = join(ROOT, cfg.publicSnapshot.path);
  const provPath = join(ROOT, cfg.publicSnapshot.provenance);
  const dtcgDir = join(ROOT, "generated/dtcg");
  const distDir = join(ROOT, "dist");
  const roots = pluginRoots();
  assert(JSON.stringify(roots.components.map((r) => [r.name, r.nodeId, r.type])) === JSON.stringify(Object.entries(cfg.components).map(([n, c]) => [n, c.figmaNodeId, c.type])), "exporter roots (code.js) must equal export-config components");

  if (!existsSync(snapPath)) {
    assert(!existsSync(provPath), "provenance record exists without a public snapshot");
    assert(!existsSync(dtcgDir) && !existsSync(distDir), "production outputs exist without a public snapshot — they cannot be genuine");
    return {
      status: "PENDING",
      lines: [
        `public snapshot ${cfg.publicSnapshot.path} not present yet — manual read-only Figma exporter run + sanitizer required`,
        "no production outputs present (generated/dtcg, dist/ch-tokens.css): nothing fabricated; exporter roots match export-config (Button 20:2)",
      ],
    };
  }

  const lines = [];
  const { snapshot, hash, bytes, provenance } = loadPublicSnapshot(snapPath, provPath);
  assert(JSON.stringify(snapshot.source.roots) === JSON.stringify(roots), "snapshot was taken with different exporter roots");
  lines.push(`public snapshot: sha256 ${hash.slice(0, 16)}… matches provenance; no private identifiers; roots = Button 20:2; extractor ${snapshot.extractor.version}; sanitizer ${snapshot.sanitizer.version} (${Object.entries(provenance.transformations).map(([k, v]) => `${k} ${v}`).join(", ")})`);
  const rawPath = process.env.CHAVOSH_RAW_SNAPSHOT;
  if (rawPath) {
    const r = rederive(rawPath, bytes.toString("utf8"));
    assert(r.rawSha256 === provenance.derivedFrom.sha256, `CHAVOSH_RAW_SNAPSHOT sha256 ${r.rawSha256} ≠ attested raw capture ${provenance.derivedFrom.sha256}`);
    assert(r.identical, "re-deriving the public snapshot from the raw capture does not reproduce the committed public snapshot");
    lines.push(`raw capture: attested sha256 ${provenance.derivedFrom.sha256.slice(0, 16)}… verified; sanitizer re-derivation byte-identical to the committed public snapshot`);
  } else {
    lines.push(`raw capture: attested sha256 ${provenance.derivedFrom.sha256.slice(0, 16)}… (${provenance.derivedFrom.bytes} bytes; private, not in this repository — re-derivation runs only when CHAVOSH_RAW_SNAPSHOT is set)`);
  }

  const tmp = mkdtempSync(join(tmpdir(), "ch-prod-"));
  try {
    const m = convert({ outDir: join(tmp, "dtcg") });
    assert(existsSync(dtcgDir), "generated/dtcg missing — run `npm run convert`");
    const dd = diffDirs(dtcgDir, join(tmp, "dtcg"));
    assert(dd.length === 0, `generated/dtcg is stale or hand-edited (${dd.join(", ")}) — run \`npm run convert\``);
    const b = await buildCss({ dtcgDir, outDir: join(tmp, "dist") });
    assert(existsSync(distDir), "dist missing — run `npm run build:css`");
    const cd = diffDirs(distDir, join(tmp, "dist"));
    assert(cd.length === 0, `dist is stale or hand-edited (${cd.join(", ")}) — run \`npm run build:css\``);
    lines.push(`freshness: generated/dtcg (${Object.keys(m.files).length} sets) and dist/ch-tokens.css equal a fresh build`);

    const spec = readJson("tests/button-v1-spec.json");
    const btn = m.traceability.components.find((c) => c.name === "Button");
    const missing = spec.boundTokens.filter((t) => !btn.boundTokens.includes(t));
    const extra = btn.boundTokens.filter((t) => !spec.boundTokens.includes(t));
    const styleDiff = JSON.stringify([...btn.styles].filter((s) => !s.startsWith("elevation/")).sort()) !== JSON.stringify([...spec.textStyles].sort());
    assert(!missing.length && !extra.length && !styleDiff, `Design/code mismatch vs ${spec.source}: missing [${missing}] extra [${extra}] styles [${btn.styles}] — review before changing anything`);
    lines.push(`Button v1 closure = approved architecture: ${btn.boundTokens.length} bound tokens, text styles ${spec.textStyles.join(", ")}; excluded by labels-only scope: ${btn.excludedOnly.join(", ")}`);

    // Public / internal surface of the production stylesheet
    const css = readFileSync(join(distDir, "ch-tokens.css"), "utf8");
    const blocks = parseCss(css);
    const sel = blocks.map((x) => (x.media ? `@${x.media} ${x.selector}` : x.selector));
    const brandBlocks = blocks.filter((x) => x.selector.includes('[data-brand="'));
    assert(sel[0] === ':root, [data-brand="financial"]' && sel[1] === '[data-brand="invest"]' && sel[2] === ":root, [data-brand]" && sel[3] === ":root", `block order ${JSON.stringify(sel)} (Financial must be the default brand on :root)`);
    const publicNames = [...new Set(blocks.filter((x) => !x.selector.includes('[data-brand="')).flatMap((x) => [...x.decls.keys()]))].sort();
    const expectedPublic = spec.boundTokens.map((t) => `--ch-${t.split("/").join("-")}`).sort();
    assert(JSON.stringify(publicNames) === JSON.stringify(expectedPublic), `public CSS properties ≠ Button closure: extra [${publicNames.filter((n) => !expectedPublic.includes(n))}] missing [${expectedPublic.filter((n) => !publicNames.includes(n))}]`);
    const internal = brandBlocks.flatMap((x) => [...x.decls.keys()]);
    assert(internal.every((n) => n.startsWith("--ch-brand-")) && !publicNames.some((n) => n.startsWith("--ch-brand-")), "--ch-brand-* only in brand scopes");
    assert(JSON.stringify([...brandBlocks[0].decls.keys()].sort()) === JSON.stringify([...brandBlocks[1].decls.keys()].sort()), "both brands declare the same roles");
    const prims = JSON.parse(readFileSync(join(dtcgDir, "primitives.tokens.json"), "utf8"));
    const primNames = flatten(prims).map(([p]) => `--ch-${p.split(".").join("-")}`);
    assert(primNames.every((n) => !css.includes(`${n}:`) && !css.includes(`var(${n})`)), "a primitive is exposed in CSS");
    const refs = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/var\((--[a-z0-9-]+)\)/g)].map((x) => x[1]);
    assert(refs.every((r) => internal.includes(r) || publicNames.includes(r)), "var() to an undeclared property");
    lines.push(`surface: ${publicNames.length} public properties = the ${spec.boundTokens.length}-token closure (${blocks[2].decls.size} brand-dependent on :root, [data-brand]); ${internal.length} internal --ch-brand-* declarations (${brandBlocks[0].decls.size} roles × 2 brands); ${primNames.length} primitives absent; Financial default on :root`);

    // Responsive: every Responsive token keeps all three modes in DTCG; CSS emits overrides only where values differ
    const modes = ["mobile", "tablet", "desktop"].map((m) => flatten(JSON.parse(readFileSync(join(dtcgDir, `responsive-${m}.tokens.json`), "utf8"))));
    assert(modes.every((m) => m.length === modes[0].length && m.length > 0), "responsive sets incomplete");
    const differs = modes[0].filter(([p], i) => modes.some((m) => JSON.stringify(m.find(([q]) => q === p)[1].$value) !== JSON.stringify(modes[0][i][1].$value))).map(([p]) => p);
    const mediaCount = blocks.filter((x) => x.media).reduce((n, x) => n + x.decls.size, 0);
    assert(differs.length === 0 ? mediaCount === 0 : mediaCount > 0, "responsive overrides do not match DTCG mode differences");
    lines.push(`responsive: ${modes[0].length} Responsive tokens × 3 modes kept in DTCG; ${differs.length} differ by breakpoint → ${mediaCount} media overrides (label sizes are equal in all modes, so base only)`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { status: "PASS", lines };
}
