// AUTHORED. Production state of packages/tokens (multi-component, ADR 0011 + ADR 0012).
// Without public snapshots: status PENDING (manual read-only Figma exporter run + sanitizer required) and NO
// production outputs may exist (generated/dtcg, dist/ch-tokens.css) — nothing is fabricated.
// With public snapshots: each capture passes the provenance gate on its PUBLIC SHA-256 and contains exactly its
// configured component (roots = export-config); the private raw captures are attestations, re-derived byte-for-byte
// only when CHAVOSH_RAW_SNAPSHOT points to a raw file or a directory of raw files (optional, never required);
// captures are mutually consistent (mergeSnapshots); exporter capture targets agree with export-config and never
// include the frozen Button; generated/dtcg and dist/ch-tokens.css equal a fresh build; each component's closure
// equals its approved contract (components.<name>.contract) — differences are Design/code mismatches for review;
// the public CSS surface equals the union of the released contracts.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, config, readJson, diffDirs, parseCss, ROOT } from "./lib.mjs";
import { convert, loadPublicSnapshot, loadPublicSnapshots, mergeSnapshots } from "../build/convert-snapshot.mjs";
import { rederive } from "../build/sanitize-snapshot.mjs";
import { buildCss, flatten } from "../build/build-css.mjs";
import { captureTargets } from "../../../tools/figma-exporter/tests/mock.mjs";

function rawCandidates(p) {
  if (!p) return [];
  if (!existsSync(p)) throw new Error(`CHAVOSH_RAW_SNAPSHOT ${p} does not exist`);
  const files = statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith(".json")).map((f) => join(p, f)) : [p];
  return files.map((f) => ({ file: f, sha256: createHash("sha256").update(readFileSync(f)).digest("hex") }));
}

export async function run() {
  const cfg = config();
  const dtcgDir = join(ROOT, "generated/dtcg");
  const distDir = join(ROOT, "dist");
  const targets = captureTargets();
  assert(!targets.some((t) => t.name === "Button"), "exporter capture targets must not include the frozen Button");
  for (const t of targets) {
    const c = cfg.components[t.name];
    if (c) assert(c.figmaNodeId === t.nodeId && c.type === t.type, `capture target ${t.name} ${t.nodeId} ≠ export-config ${c.figmaNodeId}`);
  }
  for (const [name, c] of Object.entries(cfg.components)) assert(name === "Button" || targets.some((t) => t.name === name), `configured component ${name} is not a capture target`);
  const configured = cfg.publicSnapshots.flatMap((e) => e.components).sort();
  assert(JSON.stringify(configured) === JSON.stringify(Object.keys(cfg.components).sort()), `publicSnapshots components [${configured}] ≠ configured components [${Object.keys(cfg.components)}]`);

  const present = cfg.publicSnapshots.filter((e) => existsSync(join(ROOT, e.path)));
  if (!present.length) {
    assert(cfg.publicSnapshots.every((e) => !existsSync(join(ROOT, e.provenance))), "provenance record exists without a public snapshot");
    assert(!existsSync(dtcgDir) && !existsSync(distDir), "production outputs exist without a public snapshot — they cannot be genuine");
    return {
      status: "PENDING",
      lines: [
        "no public snapshot present yet — manual read-only Figma exporter run + sanitizer required",
        "no production outputs present (generated/dtcg, dist/ch-tokens.css): nothing fabricated",
      ],
    };
  }
  assert(present.length === cfg.publicSnapshots.length, `configured public snapshots missing: ${cfg.publicSnapshots.filter((e) => !present.includes(e)).map((e) => e.path)}`);

  const lines = [];
  const loaded = loadPublicSnapshots(cfg);
  for (const l of loaded) {
    const expected = { components: l.components.map((n) => ({ nodeId: cfg.components[n].figmaNodeId, name: n, type: cfg.components[n].type })) };
    assert(JSON.stringify(l.snapshot.source.roots) === JSON.stringify(expected), `snapshot ${l.id} was taken with roots ${JSON.stringify(l.snapshot.source.roots)}, expected ${JSON.stringify(expected)}`);
  }
  // Staged captures (recorded, not released): same provenance gate, roots = exporter capture target, consistent with
  // every released capture; their components are not configured, so nothing of them reaches DTCG or CSS.
  const staged = (cfg.stagedSnapshots || []).map((e) => {
    assert(e.components.length === 1 && !cfg.components[e.components[0]], `staged capture ${e.id} must hold one unreleased component`);
    const t = targets.find((x) => x.name === e.components[0]);
    assert(t, `staged capture ${e.id} (${e.components[0]}) is not an exporter capture target`);
    const l = { id: e.id, ...loadPublicSnapshot(join(ROOT, e.path), join(ROOT, e.provenance)) };
    const expected = { components: [{ nodeId: t.nodeId, name: t.name, type: t.type }] };
    assert(JSON.stringify(l.snapshot.source.roots) === JSON.stringify(expected) && l.snapshot.components.length === 1, `staged capture ${e.id} roots ${JSON.stringify(l.snapshot.source.roots)} ≠ ${JSON.stringify(expected)}`);
    return l;
  });
  const recorded = [...loaded.flatMap((l) => l.components), ...staged.map((l) => l.snapshot.components[0].name)];
  for (const t of targets) assert(recorded.includes(t.name), `capture target ${t.name} has no recorded public snapshot`);
  mergeSnapshots([...loaded, ...staged].map((l) => ({ id: l.id, snapshot: l.snapshot })));
  const stagedLine = staged.length ? `staged captures (recorded, not released): ${staged.map((l) => `${l.id} ${l.hash.slice(0, 12)}…`).join(", ")} match provenance; roots = exporter capture targets; consistent with the released captures; excluded from DTCG and CSS` : null;
  lines.push(`public snapshots: ${loaded.map((l) => `${l.id} ${l.hash.slice(0, 12)}…`).join(", ")} match provenance; no private identifiers; roots = export-config; extractor ${[...new Set(loaded.map((l) => l.snapshot.extractor.version))]}; sanitizer ${[...new Set(loaded.map((l) => l.snapshot.sanitizer.version))]}${loaded.length > 1 ? `; ${loaded.length} captures mutually consistent` : ""}`);
  if (stagedLine) lines.push(stagedLine);
  const raws = rawCandidates(process.env.CHAVOSH_RAW_SNAPSHOT);
  const verified = [];
  for (const l of [...loaded, ...staged]) {
    const raw = raws.find((r) => r.sha256 === l.provenance.derivedFrom.sha256);
    if (!raw) continue;
    const r = rederive(raw.file, l.bytes.toString("utf8"));
    assert(r.identical, `re-deriving public snapshot ${l.id} from its raw capture does not reproduce the committed file`);
    verified.push(l.id);
  }
  if (raws.length) assert(verified.length > 0, "CHAVOSH_RAW_SNAPSHOT is set but contains no file matching an attested raw capture");
  lines.push(`raw captures: ${[...loaded, ...staged].map((l) => `${l.id} ${l.provenance.derivedFrom.sha256.slice(0, 12)}… ${verified.includes(l.id) ? "re-derived byte-identical" : "attested (private, not in this repository)"}`).join("; ")}`);

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

    const contractTokens = new Set();
    for (const [name, policy] of Object.entries(cfg.components)) {
      const spec = readJson(policy.contract);
      const comp = m.traceability.components.find((c) => c.name === name);
      const missing = spec.boundTokens.filter((t) => !comp.boundTokens.includes(t));
      const extra = comp.boundTokens.filter((t) => !spec.boundTokens.includes(t));
      const styleDiff = JSON.stringify([...comp.styles].filter((s) => !s.startsWith("elevation/")).sort()) !== JSON.stringify([...spec.textStyles].sort());
      assert(!missing.length && !extra.length && !styleDiff, `Design/code mismatch (${name}) vs ${spec.source}: missing [${missing}] extra [${extra}] styles [${comp.styles}] — review before changing anything`);
      spec.boundTokens.forEach((t) => contractTokens.add(t));
      lines.push(`${name} closure = approved contract: ${comp.boundTokens.length} bound tokens, text styles ${spec.textStyles.join(", ")}; excluded by scope: ${comp.excludedOnly.join(", ") || "none"}`);
    }
    const spec = { boundTokens: [...contractTokens].sort() };

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
    lines.push(`surface: ${publicNames.length} public properties = union of the released contracts (${spec.boundTokens.length} tokens; ${blocks[2].decls.size} brand-dependent on :root, [data-brand]); ${internal.length} internal --ch-brand-* declarations (${brandBlocks[0].decls.size} roles × 2 brands); ${primNames.length} primitives absent; Financial default on :root`);

    // Responsive: every Responsive token keeps all three modes in DTCG; CSS emits overrides only where values differ
    const modes = ["mobile", "tablet", "desktop"].map((m) => flatten(JSON.parse(readFileSync(join(dtcgDir, `responsive-${m}.tokens.json`), "utf8"))));
    assert(modes.every((m) => m.length === modes[0].length && m.length > 0), "responsive sets incomplete");
    const differs = modes[0].filter(([p], i) => modes.some((m) => JSON.stringify(m.find(([q]) => q === p)[1].$value) !== JSON.stringify(modes[0][i][1].$value))).map(([p]) => p);
    const mediaCount = blocks.filter((x) => x.media).reduce((n, x) => n + x.decls.size, 0);
    assert(differs.length === 0 ? mediaCount === 0 : mediaCount > 0, "responsive overrides do not match DTCG mode differences");
    lines.push(`responsive: ${modes[0].length} Responsive tokens × 3 modes kept in DTCG; ${differs.length} differ by breakpoint → ${mediaCount} media overrides ${differs.length ? `(${differs.join(", ")})` : "(all equal across breakpoints, so base only)"}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { status: "PASS", lines };
}
