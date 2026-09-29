// AUTHORED. `npm run verify`: runs every check group in order and prints PASS / PENDING / FAIL.
// PENDING = a documented external step is outstanding (the manual read-only Figma exporter run); it is reported,
// never hidden. `npm run verify -- --strict` treats PENDING as failure (use for releases/CI once captured).
const CHECKS = [
  "tools/figma-exporter/tests/check-exporter-readonly.mjs",
  "tools/figma-exporter/tests/check-exporter-extraction.mjs",
  "tools/figma-exporter/tests/check-exporter-bundle.mjs",
  "packages/tokens/tests/check-units.mjs",
  "packages/tokens/tests/check-dtcg.mjs",
  "packages/tokens/tests/check-css.mjs",
  "packages/tokens/tests/check-render.mjs",
  "packages/tokens/tests/check-generated.mjs",
  "packages/tokens/tests/check-production.mjs",
  "packages/tokens/tests/check-production-render.mjs",
  "packages/react/tests/check-react-types.mjs",
  "packages/react/tests/check-react-tokens.mjs",
  "packages/react/tests/check-react-browser.mjs",
];
const strict = process.argv.includes("--strict");
let failed = 0;
let pending = 0;
for (const path of CHECKS) {
  const name = path.split("/").pop().replace(/\.mjs$/, "");
  try {
    const { run } = await import(new URL(`../${path}`, import.meta.url));
    const res = await run();
    const status = Array.isArray(res) ? "PASS" : res.status;
    const lines = Array.isArray(res) ? res : res.lines;
    if (status === "PENDING") pending++;
    console.log(`${status.padEnd(8)}${name}`);
    for (const l of lines) console.log(`        · ${l}`);
  } catch (e) {
    failed++;
    console.log(`FAIL    ${name}\n        ${String(e && e.message ? e.message : e).split("\n")[0]}`);
  }
}
const total = CHECKS.length;
if (failed) console.log(`\n${failed} of ${total} check group(s) failed`);
else if (pending) console.log(`\nAll executable checks passed · ${pending} PENDING (manual Figma export)${strict ? " — strict mode: failing" : ""}`);
else console.log("\nAll checks passed");
process.exit(failed || (strict && pending) ? 1 : 0);
