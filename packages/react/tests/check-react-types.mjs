// AUTHORED. TypeScript check of @chavosh/react (TypeScript 7.0.2, strict): source + the compile-time API contract
// (tests/types/button-api.tsx, where every excluded prop is a @ts-expect-error). Self-test: a deliberately wrong
// file must make tsc fail, so a pass is meaningful.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const TSC = join(PKG, "../../node_modules/.bin/tsc");
const tsc = (args) => { try { execFileSync(TSC, args, { cwd: PKG, encoding: "utf8", stdio: "pipe" }); return { ok: true, out: "" }; } catch (e) { return { ok: false, out: `${e.stdout}${e.stderr}` }; } };

export async function run() {
  const version = execFileSync(TSC, ["--version"], { encoding: "utf8" }).trim();
  const r = tsc(["-p", "tsconfig.json"]);
  if (!r.ok) throw new Error(`tsc failed: ${r.out.split("\n").slice(0, 3).join(" | ")}`);
  const tmp = mkdtempSync(join(PKG, ".tmp-types-"));
  try {
    writeFileSync(join(tmp, "bad.tsx"), 'import { Button } from "../src";\nexport const x = <Button loading>x</Button>;\n');
    writeFileSync(join(tmp, "tsconfig.json"), JSON.stringify({ extends: "../tsconfig.json", include: ["bad.tsx", "../src"] }));
    const bad = tsc(["-p", join(tmp, "tsconfig.json")]);
    if (bad.ok) throw new Error("self-test: tsc accepted a forbidden prop — the type check is not meaningful");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return [`${version} strict: source + API contract compile; 13 excluded props/values rejected (loading, icons, href, as, fullWidth, hover/pressed/focus, disabledBehavior, unknown hierarchy/size/type); self-test confirms tsc fails on a forbidden prop`];
}
