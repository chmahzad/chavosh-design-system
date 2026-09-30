// AUTHORED. Shared helpers for the token pipeline v0.3 checks.
// The FIXTURE pipeline runs the real exporter (read-only mock), the real converter and the real CSS build on
// tools/figma-exporter/tests/fixtures/plugin-api.fixture.json (test data: real variable records from the proof
// archive's canonical snapshots + labelled synthetic records), then the real sanitizer (raw → public schema, ADR 0011).
// It is never production evidence.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadExtractor, loadFixture, createReadOnlyFigma, FIXTURE_ROOTS, toText } from "../../../tools/figma-exporter/tests/mock.mjs";
import { writeDtcg } from "../build/convert-snapshot.mjs";
import { sanitizeSnapshot } from "../build/sanitize-snapshot.mjs";
import { buildCss } from "../build/build-css.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const read = (p) => readFileSync(join(ROOT, p), "utf8");
export const readJson = (p) => JSON.parse(read(p));
export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
export async function throwsWith(fn, re, label) {
  let err;
  try { await fn(); } catch (e) { err = e; }
  assert(err && re.test(err.message), `${label}: expected ${re}, got ${err ? err.message.split("\n")[0] : "no error"}`);
}
export const config = () => readJson("source/export-config.json");
export const policy = () => readJson("source/web-policy.json");
/**
 * Fixture checks run the real export policy restricted to the component(s) the fixture captures (Button): the real
 * config also lists released components (e.g. Link) whose captures are production data, never fixture data.
 */
export const fixtureConfig = () => {
  const c = config();
  const names = FIXTURE_ROOTS.components.map((r) => r.name);
  return {
    ...c,
    publicSnapshots: c.publicSnapshots.filter((e) => e.components.every((n) => names.includes(n))),
    components: Object.fromEntries(Object.entries(c.components).filter(([n]) => names.includes(n))),
  };
};

/** Raw fixture capture (exporter output, raw schema). */
export async function fixtureRawSnapshot(mutateFixture) {
  const fx = loadFixture();
  if (mutateFixture) mutateFixture(fx);
  return loadExtractor()(createReadOnlyFigma(fx).figma, FIXTURE_ROOTS);
}

/** Public fixture snapshot: raw fixture capture → sanitizer, exactly as production (ADR 0011). */
export async function fixtureSnapshot(mutateFixture) {
  return sanitizeSnapshot(await fixtureRawSnapshot(mutateFixture)).snapshot;
}

/** Snapshot → DTCG → CSS in a temp dir. Returns { dir, dtcgDir, cssText, build, manifest, cleanup }. */
export async function fixturePipeline({ snapshot, mutateSnapshot, cfg = fixtureConfig(), policyPath } = {}) {
  const snap = snapshot || (await fixtureSnapshot());
  if (mutateSnapshot) mutateSnapshot(snap);
  const dir = mkdtempSync(join(tmpdir(), "ch-tokens-"));
  const dtcgDir = join(dir, "dtcg");
  const text = toText(snap);
  const manifest = writeDtcg({ snapshot: snap, sources: [{ id: "fixture", path: "tools/figma-exporter/tests/fixtures (fixture)", snapshot: snap, bytes: Buffer.from(text), hash: "fixture-not-canonical" }], config: cfg, outDir: dtcgDir });
  const build = await buildCss({ dtcgDir, outDir: join(dir, "dist"), ...(policyPath ? { policyPath } : {}) });
  return { dir, dtcgDir, cssText: build.css, build, manifest, snapshot: snap, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

export function diffDirs(a, b) {
  const la = readdirSync(a).sort();
  const lb = readdirSync(b).sort();
  const out = [];
  for (const f of new Set([...la, ...lb])) {
    if (!la.includes(f)) out.push(`missing ${f}`);
    else if (!lb.includes(f)) out.push(`extra ${f}`);
    else if (!readFileSync(join(a, f)).equals(readFileSync(join(b, f)))) out.push(`differs ${f}`);
  }
  return out;
}

/** Parse generated CSS into ordered blocks: [{ selector, media, decls: Map }]. */
export function parseCss(css) {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = [];
  const re = /(@media \(min-width: ([0-9.]+rem)\)\s*\{\s*)?([^{}@]+)\{([^{}]*)\}\s*(\})?/g;
  let m;
  while ((m = re.exec(body))) {
    const decls = new Map();
    for (const raw of m[4].split(";").map((s) => s.trim()).filter(Boolean)) {
      const d = /^(--[a-z0-9-]+):\s*(.+)$/s.exec(raw);
      if (!d) throw new Error(`unparseable declaration: ${raw}`);
      if (decls.has(d[1])) throw new Error(`collision: ${d[1]} declared twice in one block`);
      decls.set(d[1], d[2].trim());
    }
    blocks.push({ selector: m[3].trim(), media: m[2] || null, decls });
  }
  return blocks;
}
