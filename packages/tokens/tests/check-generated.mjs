// AUTHORED. Deterministic builds and generated-file freshness mechanics (fixture pipeline): repeated runs are
// byte-identical; the converter and CSS build remove stale outputs; hand-edited or extra DTCG files are refused
// before Style Dictionary; the directory comparison used for production freshness detects edits, extras and gaps.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assert, throwsWith, fixturePipeline, fixtureSnapshot, diffDirs } from "./lib.mjs";
import { loadDtcg, buildCss } from "../build/build-css.mjs";

export async function run() {
  const lines = [];
  const snap = await fixtureSnapshot();
  const a = await fixturePipeline({ snapshot: structuredClone(snap) });
  const b = await fixturePipeline({ snapshot: structuredClone(snap) });
  try {
    assert(diffDirs(a.dtcgDir, b.dtcgDir).length === 0 && a.cssText === b.cssText, "two builds differ (non-deterministic)");
    assert(!/\d{4}-\d{2}-\d{2}T|GMT|UTC/.test(a.cssText + readFileSync(join(a.dtcgDir, "_manifest.json"), "utf8")), "no timestamps in outputs");
    lines.push(`determinism: two full fixture builds byte-identical (${readdirSync(a.dtcgDir).length} DTCG files + ch-tokens.css); no timestamps`);

    // Tampered / extra DTCG input refused before Style Dictionary
    const t = join(a.dir, "tampered");
    mkdirSync(t);
    for (const f of readdirSync(a.dtcgDir)) copyFileSync(join(a.dtcgDir, f), join(t, f));
    writeFileSync(join(t, "color.tokens.json"), readFileSync(join(t, "color.tokens.json"), "utf8").replace("{color.neutral.950}", "{color.navy.800}"));
    await throwsWith(() => loadDtcg(t), /SHA-256 differs from _manifest.json/, "hand-edited DTCG");
    copyFileSync(join(a.dtcgDir, "color.tokens.json"), join(t, "color.tokens.json"));
    writeFileSync(join(t, "old.tokens.json"), "{}\n");
    await throwsWith(() => loadDtcg(t), /do not match _manifest.json/, "stale extra DTCG");
    lines.push("inputs: hand-edited or extra DTCG files refused before Style Dictionary runs");

    // Stale outputs are removed by the builds; diffDirs detects edits, extras and gaps
    writeFileSync(join(a.dir, "dist", "old.css"), ":root{}\n");
    await buildCss({ dtcgDir: a.dtcgDir, outDir: join(a.dir, "dist") });
    assert(diffDirs(join(a.dir, "dist"), join(b.dir, "dist")).length === 0, "CSS build did not remove stale CSS");
    writeFileSync(join(a.dir, "dist", "ch-tokens.css"), a.cssText.replace("#1e3d7a", "#000000"));
    writeFileSync(join(a.dir, "dist", "extra.css"), "x");
    const d = diffDirs(join(a.dir, "dist"), join(b.dir, "dist"));
    rmSync(join(b.dir, "dist", "ch-tokens.css"));
    const d2 = diffDirs(join(a.dir, "dist"), join(b.dir, "dist"));
    assert(d.includes("differs ch-tokens.css") && d.includes("extra extra.css") && d2.includes("extra ch-tokens.css"), `freshness comparison self-test: ${d} / ${d2}`);
    lines.push("freshness mechanics: builds remove stale files; comparison detects hand edits, extra and missing files");
  } finally {
    a.cleanup();
    b.cleanup();
  }
  return lines;
}
