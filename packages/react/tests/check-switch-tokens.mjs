// AUTHORED. Switch v1 static checks (ADR 0016). switch.css may consume only public --ch-* tokens (never primitives, never
// --ch-brand-*), plus private --_sw-* variables set only from public tokens; the tokens it consumes must be EXACTLY
// Switch's approved contract (packages/tokens/tests/switch-v1-spec.json). No raw colours; the only raw lengths are the
// approved intrinsic Switch geometry in rem (track 2.75 × 1.5rem, 0.5rem thumb border = 1rem thumb, 0.25rem inset,
// 1.25rem travel), the overlay 100% and 0px; motion is exactly 150ms cubic-bezier(0.2, 0, 0, 1) and 0ms under
// prefers-reduced-motion. System colours only in forced colours. Switch.tsx renders a native <input type="checkbox"
// role="switch"> in a wrapping <label>, text before control, no keyboard handling, never sets the form-field name, no
// brand logic, no inline styles; types self-test rejects a Switch without label or with a role override.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintComponentCss, LINT_PROBES } from "./lib/lint-component-css.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const read = (p) => readFileSync(join(HERE, p), "utf8");
function assert(c, m) { if (!c) throw new Error(m); }

export const SWITCH_LINT = {
  prefix: "sw",
  allowedLengths: [
    { literal: "100%", line: /^\s*(width|height):\s*100%;/ },
    { literal: "2.75rem", line: /^\s*width:\s*2\.75rem;/ },
    { literal: "1.5rem", line: /^\s*height:\s*1\.5rem;/ },
    { literal: "0.25rem", line: /^\s*(top|inset-inline-start):\s*calc\(0\.25rem - var\(--ch-border-width-strong\)\);/ },
    { literal: "0.5rem", line: /^\s*border:\s*0\.5rem solid var\(--_sw-thumb\);/ },
    { literal: "1.25rem", line: /^\s*transform:\s*translateX\(1\.25rem\);/ },
    { literal: "-1.25rem", line: /^\s*transform:\s*translateX\(-1\.25rem\);/ },
  ],
};

export async function run() {
  const css = read("../src/Switch/switch.css");
  const tokensCss = read("../../tokens/dist/ch-tokens.css");
  const { problems, used, publicTokens } = lintComponentCss(css, tokensCss, SWITCH_LINT);
  assert(problems.length === 0, `switch.css token discipline: ${problems.join("; ")}`);
  const contract = JSON.parse(read("../../tokens/tests/switch-v1-spec.json")).boundTokens.map((t) => `--ch-${t.split("/").join("-")}`).sort();
  assert(JSON.stringify(used) === JSON.stringify(contract), `switch.css must consume exactly Switch's ${contract.length}-token approved closure: extra [${used.filter((t) => !contract.includes(t))}] missing [${contract.filter((t) => !used.includes(t))}]`);
  assert(used.every((t) => publicTokens.has(t)), "every Switch token must be public in ch-tokens.css");
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const durations = [...src.matchAll(/(\d+)ms/g)].map((m) => m[1]);
  const easings = [...src.matchAll(/cubic-bezier\(([^)]*)\)/g)].map((m) => m[1]);
  assert(durations.length === 5 && durations.slice(0, 4).every((d) => d === "150") && durations[4] === "0" && easings.every((e) => e === "0.2, 0, 0, 1"), `motion must be 150ms cubic-bezier(0.2, 0, 0, 1) only, 0ms under reduced motion (${durations} / ${easings})`);
  assert(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.ch-switch__track,\s*\.ch-switch__thumb\s*\{\s*transition-duration:\s*0ms;/.test(src), "prefers-reduced-motion: reduce → 0ms for track and thumb");
  const probes = [...LINT_PROBES("sw"), [".x{width:44px}", /raw length 44px/], [".x{margin:0.25rem}", /raw length 0\.25rem/], [".x{transform:translateX(20px)}", /raw length 20px/]];
  for (const [snippet, re] of probes) assert(lintComponentCss(snippet, tokensCss, SWITCH_LINT).problems.some((p) => re.test(p)), `linter self-test missed ${snippet}`);

  const tsx = read("../src/Switch/Switch.tsx").replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  assert(/<input\b[^>]*type="checkbox" role="switch"/.test(tsx) && /<label\b/.test(tsx) && !/<div|<button\b|<a\b|tabIndex|aria-checked/.test(tsx), "Switch must render a native <input type=checkbox role=switch> inside a <label> (native checked state, no aria-checked emulation, no tabIndex)");
  assert(tsx.indexOf("ch-switch__text") < tsx.indexOf("ch-switch__control"), "text first, control trailing");
  assert(!/onKey(Down|Up|Press)|addEventListener/.test(tsx), "Switch adds no keyboard handling: Space is native");
  assert(!/\bname=/.test(tsx), "Switch never sets the form-field name attribute itself: only the consumer's native name prop reaches the <input>");
  assert(/aria-labelledby=\{labelId\}/.test(tsx) && /aria-describedby=\{describedByIds\}/.test(tsx), "name from the label text, description from supporting text");
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert(!/ch-tokens\.css|@import/.test(tsx + cssCode) && /import "\.\/switch\.css"/.test(tsx) && (tsx.match(/^import /gm) || []).length === 2, "Switch imports only switch.css (+ React); the token stylesheet is loaded once at the entry");
  assert(!/data-brand|financial|invest|style=\{/i.test(tsx), "no brand logic or inline styles in Switch");
  assert(/export \{ Switch \} from "\.\/Switch\/Switch";/.test(read("../src/index.ts")), "Switch is exported from @chavosh/react");

  const TSC = join(PKG, "../../node_modules/.bin/tsc");
  const tmp = mkdtempSync(join(PKG, ".tmp-switch-types-"));
  try {
    for (const [i, snippet] of ['<Switch name="n" />', '<Switch label="x" role="checkbox" />', '<Switch label="x" indeterminate />'].entries()) {
      writeFileSync(join(tmp, `bad${i}.tsx`), `import { Switch } from "../src";\nexport const x = ${snippet};\n`);
      writeFileSync(join(tmp, "tsconfig.json"), JSON.stringify({ extends: "../tsconfig.json", include: [`bad${i}.tsx`, "../src"] }));
      let ok = true;
      try { execFileSync(TSC, ["-p", join(tmp, "tsconfig.json")], { cwd: PKG, stdio: "pipe" }); } catch { ok = false; }
      assert(!ok, `types self-test: tsc accepted ${snippet}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return [
    `switch.css consumes exactly Switch's ${used.length}-token approved closure; no primitives, no --ch-brand-*; private --_sw-* set only from public tokens`,
    "no raw colours; only raw lengths are the approved intrinsic geometry in rem (track 2.75×1.5rem, 1rem border-drawn thumb, 0.25rem inset, ±1.25rem travel), overlay 100% and 0px; motion 150ms cubic-bezier(0.2, 0, 0, 1), 0ms under prefers-reduced-motion; system colours only in forced colours; linter self-test catches 11 violation kinds",
    "Switch.tsx: native <input type=checkbox role=switch> in a wrapping <label>, text first / control trailing, no aria-checked emulation, no keyboard handling, never sets the form-field name itself, name via aria-labelledby, description via aria-describedby, imports only switch.css, no brand logic, no inline styles; exported; API contract (tests/types/switch-api.tsx) rejects 12 excluded props/values; self-test: tsc rejects a Switch without label, a role override and indeterminate",
  ];
}
