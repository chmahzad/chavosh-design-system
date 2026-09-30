// AUTHORED. Text Field v1 static checks (ADR 0017). text-field.css may consume only public --ch-* tokens (never
// primitives, never --ch-brand-*), plus private --_tf-* variables set only from public tokens; the tokens it consumes
// must be EXACTLY Text Field's approved contract (packages/tokens/tests/text-field-v1-spec.json). No raw colours, no raw
// lengths other than 0px; no motion; system colours only in forced colours. TextField.tsx renders a native <input> with a
// persistent <label htmlFor>, error → aria-invalid + aria-describedby (error, helper, consumer), the temporary
// alert-circle artwork as a decorative inline SVG, no keyboard handling, never sets the form-field name, no brand logic,
// no inline styles; types self-test rejects a Text Field without label, type="number" and a consumer aria-invalid.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintComponentCss, LINT_PROBES } from "./lib/lint-component-css.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const read = (p) => readFileSync(join(HERE, p), "utf8");
function assert(c, m) { if (!c) throw new Error(m); }

export const TEXT_FIELD_LINT = { prefix: "tf", allowedLengths: [{ literal: "100%", line: /^\s*width:\s*100%;/ }] };
// Temporary Icon/alert-circle artwork, read-only from the Figma Foundations page (error-icon instance, 16px export).
export const ALERT_CIRCLE_PATH = "M8 4.66667V8.66667M8 11H8.00667M14 8C14 8.78793 13.8448 9.56815 13.5433 10.2961C13.2417 11.0241 12.7998 11.6855 12.2426 12.2426C11.6855 12.7998 11.0241 13.2417 10.2961 13.5433C9.56815 13.8448 8.78793 14 8 14C7.21207 14 6.43185 13.8448 5.7039 13.5433C4.97595 13.2417 4.31451 12.7998 3.75736 12.2426C3.20021 11.6855 2.75825 11.0241 2.45672 10.2961C2.15519 9.56815 2 8.78793 2 8C2 6.4087 2.63214 4.88258 3.75736 3.75736C4.88258 2.63214 6.4087 2 8 2C9.5913 2 11.1174 2.63214 12.2426 3.75736C13.3679 4.88258 14 6.4087 14 8Z";

export async function run() {
  const css = read("../src/TextField/text-field.css");
  const tokensCss = read("../../tokens/dist/ch-tokens.css");
  const { problems, used, publicTokens } = lintComponentCss(css, tokensCss, TEXT_FIELD_LINT);
  assert(problems.length === 0, `text-field.css token discipline: ${problems.join("; ")}`);
  const contract = JSON.parse(read("../../tokens/tests/text-field-v1-spec.json")).boundTokens.map((t) => `--ch-${t.split("/").join("-")}`).sort();
  assert(JSON.stringify(used) === JSON.stringify(contract), `text-field.css must consume exactly Text Field's ${contract.length}-token approved closure: extra [${used.filter((t) => !contract.includes(t))}] missing [${contract.filter((t) => !used.includes(t))}]`);
  assert(used.every((t) => publicTokens.has(t)), "every Text Field token must be public in ch-tokens.css");
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert(/\.ch-text-field__input::placeholder\s*\{\s*color:\s*var\(--_tf-placeholder\);\s*opacity:\s*1;/.test(src), "the placeholder is painted from --_tf-placeholder at full opacity");
  assert(!/transition|animation|\d+m?s\b/.test(src), "Text Field has no motion in v1");
  assert(!/disabled[^{]*aria-invalid|aria-invalid[^{]*disabled|read-only[^{]*aria-invalid|aria-invalid[^{]*read-only/.test(src), "no rule targets the unsupported Disabled + Error / Read-only + Error combinations (ADR 0017)");
  const probes = [...LINT_PROBES("tf"), [".x{min-height:48px}", /raw length 48px/], [".x{padding-inline:12px}", /raw length 12px/], [".x{border-width:2px}", /raw length 2px/]];
  for (const [snippet, re] of probes) assert(lintComponentCss(snippet, tokensCss, TEXT_FIELD_LINT).problems.some((p) => re.test(p)), `linter self-test missed ${snippet}`);

  const raw = read("../src/TextField/TextField.tsx");
  const tsx = raw.replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  assert(/<input\b[^>]*type=\{type\}/.test(tsx) && /<label className="ch-text-field__label" htmlFor=\{inputId\}>/.test(tsx) && !/<button\b|<a\b|tabIndex|role=/.test(tsx), "Text Field must render a native <input> with a persistent <label htmlFor> (no role or tabIndex overrides)");
  assert(tsx.indexOf("ch-text-field__label") < tsx.indexOf("ch-text-field__helper") && tsx.indexOf("ch-text-field__helper") < tsx.indexOf("ch-text-field__input") && tsx.indexOf("ch-text-field__input") < tsx.indexOf("ch-text-field__error\""), "anatomy order: label row, helper, input, error (architecture §1)");
  assert(/aria-invalid=\{hasError \? true : undefined\}/.test(tsx) && /\[hasError \? errorId : undefined, hasHelper \? helperId : undefined, describedBy\]/.test(tsx), "errorMessage → aria-invalid; description order error, helper, consumer (architecture §4)");
  assert(/\(optional\)/.test(tsx) && /htmlFor=\{inputId\}>[\s\S]*ch-text-field__optional[\s\S]*<\/label>/.test(tsx), "the \"(optional)\" indicator is part of the visible label (accessible name)");
  assert(raw.includes(`d="${ALERT_CIRCLE_PATH}"`) && /aria-hidden="true" focusable="false"/.test(tsx) && /viewBox="0 0 16 16"/.test(tsx), "error icon = the temporary Icon/alert-circle artwork, decorative");
  assert(!/onKey(Down|Up|Press)|addEventListener|useEffect|useLayoutEffect/.test(tsx), "Text Field adds no keyboard handling or effects: behaviour is native");
  assert(!/\bname=/.test(tsx), "Text Field never sets the form-field name attribute itself: only the consumer's native name prop reaches the <input>");
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert(!/ch-tokens\.css|@import/.test(tsx + cssCode) && /import "\.\/text-field\.css"/.test(tsx) && (tsx.match(/^import /gm) || []).length === 2, "Text Field imports only text-field.css (+ React); the token stylesheet is loaded once at the entry");
  assert(!/data-brand|financial|invest|style=\{/i.test(tsx), "no brand logic or inline styles in Text Field");
  assert(/export \{ TextField \} from "\.\/TextField\/TextField";/.test(read("../src/index.ts")), "TextField is exported from @chavosh/react");

  const TSC = join(PKG, "../../node_modules/.bin/tsc");
  const tmp = mkdtempSync(join(PKG, ".tmp-text-field-types-"));
  try {
    for (const [i, snippet] of ['<TextField name="n" />', '<TextField label="x" type="number" />', '<TextField label="x" aria-invalid="true" />'].entries()) {
      writeFileSync(join(tmp, `bad${i}.tsx`), `import { TextField } from "../src";\nexport const x = ${snippet};\n`);
      writeFileSync(join(tmp, "tsconfig.json"), JSON.stringify({ extends: "../tsconfig.json", include: [`bad${i}.tsx`, "../src"] }));
      let ok = true;
      try { execFileSync(TSC, ["-p", join(tmp, "tsconfig.json")], { cwd: PKG, stdio: "pipe" }); } catch { ok = false; }
      assert(!ok, `types self-test: tsc accepted ${snippet}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return [
    `text-field.css consumes exactly Text Field's ${used.length}-token approved closure; no primitives, no --ch-brand-*; private --_tf-* set only from public tokens`,
    "no raw colours, no raw lengths (only 0px and the input's width: 100%), no motion; no rule targets the unsupported Disabled/Read-only + Error combinations; system colours only in forced colours; linter self-test catches 11 violation kinds",
    "TextField.tsx: native <input> with a persistent <label htmlFor> (incl. \"(optional)\"), anatomy label → helper → input → error, errorMessage → aria-invalid + description order error/helper/consumer, temporary Icon/alert-circle artwork as a decorative SVG, no keyboard handling, never sets the form-field name itself, imports only text-field.css, no brand logic, no inline styles; exported; API contract (tests/types/text-field-api.tsx) rejects 14 excluded props/values; self-test: tsc rejects a Text Field without label, type=\"number\" and a consumer aria-invalid",
  ];
}
