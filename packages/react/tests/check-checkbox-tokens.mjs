// AUTHORED. Checkbox v1 static checks (ADR 0014). checkbox.css may consume only public --ch-* tokens (never
// primitives, never --ch-brand-*), plus private --_cb-* variables set only from public tokens; the tokens it consumes
// must be EXACTLY Checkbox's approved contract (packages/tokens/tests/checkbox-v1-spec.json). No raw colours; the only
// raw lengths are the documented layout exceptions (100% for the hidden input / glyph overlay, the 1px visually-hidden
// utility) and 0px. System colours only in forced colours. Checkbox.tsx renders a native <input type="checkbox"> in a
// wrapping <label>, no role emulation, no brand logic, no inline styles; types self-test rejects a Checkbox without label.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintComponentCss, LINT_PROBES } from "./lib/lint-component-css.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const read = (p) => readFileSync(join(HERE, p), "utf8");
function assert(c, m) { if (!c) throw new Error(m); }

export const CHECKBOX_LINT = {
  prefix: "cb",
  allowedLengths: [
    { literal: "100%", line: /^\s*(width|height|max-width):\s*(100%|calc\(100% \+ var\(--ch-border-width-strong\) \* 2\));/ },
    { literal: "1px", line: /^\s*(width|height):\s*1px;/ },
    { literal: "50%", line: /^\s*clip-path:\s*inset\(50%\);/ },
  ],
};

export async function run() {
  const css = read("../src/Checkbox/checkbox.css");
  const tokensCss = read("../../tokens/dist/ch-tokens.css");
  const { problems, used, publicTokens } = lintComponentCss(css, tokensCss, CHECKBOX_LINT);
  assert(problems.length === 0, `checkbox.css token discipline: ${problems.join("; ")}`);
  const contract = JSON.parse(read("../../tokens/tests/checkbox-v1-spec.json")).boundTokens.map((t) => `--ch-${t.split("/").join("-")}`).sort();
  assert(JSON.stringify(used) === JSON.stringify(contract), `checkbox.css must consume exactly Checkbox's ${contract.length}-token approved closure: extra [${used.filter((t) => !contract.includes(t))}] missing [${contract.filter((t) => !used.includes(t))}]`);
  assert(used.every((t) => publicTokens.has(t)), "every Checkbox token must be public in ch-tokens.css");
  const probes = [...LINT_PROBES("cb"), [".x{width:2px}", /raw length 2px/], [".x{margin:1px}", /raw length 1px/]];
  for (const [snippet, re] of probes) assert(lintComponentCss(snippet, tokensCss, CHECKBOX_LINT).problems.some((p) => re.test(p)), `linter self-test missed ${snippet}`);

  const tsx = read("../src/Checkbox/Checkbox.tsx").replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  assert(/<input\b[^>]*type="checkbox"/.test(tsx) && /<label\b/.test(tsx) && !/role=|<div|<button\b|<a\b|tabIndex/.test(tsx), "Checkbox must render a native <input type=checkbox> inside a <label>, no role emulation or tabIndex");
  assert(!/\bname=/.test(tsx) && !/\bname\b\s*[:=]/.test(tsx.replace(/\/\*[\s\S]*?\*\//g, "")), "Checkbox never sets the form-field name attribute itself: only the consumer's native name prop reaches the <input>");
  assert(/aria-labelledby=\{labelId\}/.test(tsx) && /aria-describedby=\{describedByIds\}/.test(tsx), "name from the label text, description from supporting text");
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert(!/ch-tokens\.css|@import/.test(tsx + cssCode) && /import "\.\/checkbox\.css"/.test(tsx) && (tsx.match(/^import /gm) || []).length === 2, "Checkbox imports only checkbox.css (+ React); the token stylesheet is loaded once at the entry");
  assert(!/data-brand|financial|invest|style=\{/i.test(tsx), "no brand logic or inline styles in Checkbox");
  assert(/export \{ Checkbox \} from "\.\/Checkbox\/Checkbox";/.test(read("../src/index.ts")), "Checkbox is exported from @chavosh/react");

  const TSC = join(PKG, "../../node_modules/.bin/tsc");
  const tmp = mkdtempSync(join(PKG, ".tmp-checkbox-types-"));
  try {
    for (const [i, snippet] of ["<Checkbox />", '<Checkbox label="x" type="radio" />', '<Checkbox label="x" error="Required" />'].entries()) {
      writeFileSync(join(tmp, `bad${i}.tsx`), `import { Checkbox } from "../src";\nexport const x = ${snippet};\n`);
      writeFileSync(join(tmp, "tsconfig.json"), JSON.stringify({ extends: "../tsconfig.json", include: [`bad${i}.tsx`, "../src"] }));
      let ok = true;
      try { execFileSync(TSC, ["-p", join(tmp, "tsconfig.json")], { cwd: PKG, stdio: "pipe" }); } catch { ok = false; }
      assert(!ok, `types self-test: tsc accepted ${snippet}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return [
    `checkbox.css consumes exactly Checkbox's ${used.length}-token approved closure; no primitives, no --ch-brand-*; private --_cb-* set only from public tokens`,
    "no raw colours; only raw lengths are the documented overlay 100%, the visually-hidden 1px / inset(50%) and 0px; system colours only in forced colours; linter self-test catches 10 violation kinds",
    "Checkbox.tsx: native <input type=checkbox> in a wrapping <label>, name via aria-labelledby (label text), description via aria-describedby (supporting text), never sets the form-field name attribute itself, imports only checkbox.css, no brand logic, no inline styles; exported; API contract (tests/types/checkbox-api.tsx) rejects 11 excluded props/values; self-test: tsc rejects a Checkbox without label, a type override and an error prop",
  ];
}
