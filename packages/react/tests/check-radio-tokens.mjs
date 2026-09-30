// AUTHORED. Radio v1 static checks (ADR 0015). radio.css may consume only public --ch-* tokens (never primitives, never
// --ch-brand-*), plus private --_rd-* variables set only from public tokens; the tokens it consumes must be EXACTLY
// Radio's approved contract (packages/tokens/tests/radio-v1-spec.json). No raw colours; the only raw lengths are the
// documented overlay 100% and 0px; the dot is derived from size/control/indicator (0.2 × border → 0.4 × diameter).
// System colours only in forced colours. Radio.tsx renders a native <input type="radio"> in a wrapping <label>, no role
// emulation, no JavaScript keyboard handling (the browser owns grouping and arrow keys), never sets the form-field name,
// no brand logic, no inline styles; types self-test rejects a Radio without label.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintComponentCss, LINT_PROBES } from "./lib/lint-component-css.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const read = (p) => readFileSync(join(HERE, p), "utf8");
function assert(c, m) { if (!c) throw new Error(m); }

export const RADIO_LINT = {
  prefix: "rd",
  allowedLengths: [{ literal: "100%", line: /^\s*(width|height|max-width):\s*100%;/ }],
};

export async function run() {
  const css = read("../src/Radio/radio.css");
  const tokensCss = read("../../tokens/dist/ch-tokens.css");
  const { problems, used, publicTokens } = lintComponentCss(css, tokensCss, RADIO_LINT);
  assert(problems.length === 0, `radio.css token discipline: ${problems.join("; ")}`);
  const contract = JSON.parse(read("../../tokens/tests/radio-v1-spec.json")).boundTokens.map((t) => `--ch-${t.split("/").join("-")}`).sort();
  assert(JSON.stringify(used) === JSON.stringify(contract), `radio.css must consume exactly Radio's ${contract.length}-token approved closure: extra [${used.filter((t) => !contract.includes(t))}] missing [${contract.filter((t) => !used.includes(t))}]`);
  assert(used.every((t) => publicTokens.has(t)), "every Radio token must be public in ch-tokens.css");
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert(/border:\s*calc\(var\(--ch-size-control-indicator\) \* 0\.2\) solid var\(--_rd-dot\);/.test(src), "the dot is 0.4 × size/control/indicator (a 0.2 border on each side), drawn as a border so it survives forced colours");
  const probes = [...LINT_PROBES("rd"), [".x{width:8px}", /raw length 8px/], [".x{margin:1px}", /raw length 1px/]];
  for (const [snippet, re] of probes) assert(lintComponentCss(snippet, tokensCss, RADIO_LINT).problems.some((p) => re.test(p)), `linter self-test missed ${snippet}`);

  const tsx = read("../src/Radio/Radio.tsx").replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  assert(/<input\b[^>]*type="radio"/.test(tsx) && /<label\b/.test(tsx) && !/role=|<div|<button\b|<a\b|tabIndex/.test(tsx), "Radio must render a native <input type=radio> inside a <label>, no role emulation or tabIndex");
  assert(!/onKey(Down|Up|Press)|addEventListener/.test(tsx), "Radio adds no keyboard handling: grouping and arrow keys are native");
  assert(!/\bname=/.test(tsx), "Radio never sets the form-field name attribute itself: only the consumer's native name prop reaches the <input>");
  assert(/aria-labelledby=\{labelId\}/.test(tsx) && /aria-describedby=\{describedByIds\}/.test(tsx), "name from the label text, description from supporting text");
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert(!/ch-tokens\.css|@import/.test(tsx + cssCode) && /import "\.\/radio\.css"/.test(tsx) && (tsx.match(/^import /gm) || []).length === 2, "Radio imports only radio.css (+ React); the token stylesheet is loaded once at the entry");
  assert(!/data-brand|financial|invest|style=\{/i.test(tsx), "no brand logic or inline styles in Radio");
  assert(/export \{ Radio \} from "\.\/Radio\/Radio";/.test(read("../src/index.ts")), "Radio is exported from @chavosh/react");

  const TSC = join(PKG, "../../node_modules/.bin/tsc");
  const tmp = mkdtempSync(join(PKG, ".tmp-radio-types-"));
  try {
    for (const [i, snippet] of ['<Radio name="n" value="v" />', '<Radio label="x" type="checkbox" />', '<Radio label="x" indeterminate />'].entries()) {
      writeFileSync(join(tmp, `bad${i}.tsx`), `import { Radio } from "../src";\nexport const x = ${snippet};\n`);
      writeFileSync(join(tmp, "tsconfig.json"), JSON.stringify({ extends: "../tsconfig.json", include: [`bad${i}.tsx`, "../src"] }));
      let ok = true;
      try { execFileSync(TSC, ["-p", join(tmp, "tsconfig.json")], { cwd: PKG, stdio: "pipe" }); } catch { ok = false; }
      assert(!ok, `types self-test: tsc accepted ${snippet}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return [
    `radio.css consumes exactly Radio's ${used.length}-token approved closure; no primitives, no --ch-brand-*; private --_rd-* set only from public tokens; the dot is 0.4 × size/control/indicator (border-drawn)`,
    "no raw colours; only raw lengths are the documented overlay 100% and 0px; system colours only in forced colours; linter self-test catches 10 violation kinds",
    "Radio.tsx: native <input type=radio> in a wrapping <label>, no keyboard handling (native grouping), never sets the form-field name itself, name via aria-labelledby, description via aria-describedby, imports only radio.css, no brand logic, no inline styles; exported; API contract (tests/types/radio-api.tsx) rejects 12 excluded props/values; self-test: tsc rejects a Radio without label, a type override and indeterminate",
  ];
}
