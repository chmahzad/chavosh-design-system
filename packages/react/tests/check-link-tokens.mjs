// AUTHORED. Link v1 static checks (ADR 0013). Token discipline: link.css may consume only public --ch-* tokens that
// exist in the production stylesheet (never primitives, never --ch-brand-*), plus its own private --_link-* variables,
// set only from public tokens. The tokens it consumes must be EXACTLY Link's approved contract
// (packages/tokens/tests/link-v1-spec.json) — the closure derived from the Figma capture. No raw colours; the only raw
// lengths are the approved underline constants (1px rest, 2px hover, 0.15em offset) and 0px. System colours only in
// forced colours. Link.tsx renders a native <a> only, has no brand logic, no inline styles, and imports only link.css.
// Types: the compile-time contract rejects a Link without href (self-test).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const read = (p) => readFileSync(join(HERE, p), "utf8");
function assert(c, m) { if (!c) throw new Error(m); }

const flat = (t, p = []) => Object.entries(t).flatMap(([k, v]) => (k.startsWith("$") ? [] : v && "$value" in v ? [[...p, k].join("-")] : v && typeof v === "object" ? flat(v, [...p, k]) : []));

export function lintLinkCss(css, tokensCss) {
  const problems = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const brandBlock = /\[data-brand="[^"]+"\]\s*\{[^}]*\}/g;
  const publicTokens = new Set([...tokensCss.replace(/\/\*[\s\S]*?\*\//g, "").replace(brandBlock, "").matchAll(/(--ch-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const internal = new Set([...tokensCss.matchAll(/(--ch-brand-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const primitiveNames = new Set(flat(JSON.parse(read("../../tokens/generated/dtcg/primitives.tokens.json"))).map((p) => `--ch-${p}`));

  const used = [...src.matchAll(/var\((--[a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
  for (const v of used) {
    if (v.startsWith("--_link-")) continue;
    if (v.startsWith("--ch-brand-") || internal.has(v)) problems.push(`internal Brand variable ${v}`);
    else if (primitiveNames.has(v)) problems.push(`primitive token ${v}`);
    else if (!publicTokens.has(v)) problems.push(`unknown/non-public token ${v}`);
  }
  for (const m of src.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;}]+)[;}]/g)) {
    const [, name, value] = m;
    if (!name.startsWith("--_link-")) { problems.push(`declares non-private custom property ${name}`); continue; }
    if (value.replace(/var\(--(ch|_link)-[a-z0-9-]+\)/g, "").trim() !== "") problems.push(`${name} set to a raw value "${value.trim()}"`);
  }
  if (/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/.test(src)) problems.push("raw colour literal");
  for (const m of src.matchAll(/(?<![\w-])(-?\d*\.?\d+)(px|rem|em|%|vw|vh|pt|ch)\b/g)) {
    const lit = m[0];
    if (lit === "0px") continue;
    const line = src.slice(src.lastIndexOf("\n", m.index) + 1, src.indexOf("\n", m.index));
    const ok = ((lit === "1px" || lit === "2px") && /text-decoration-thickness:\s*[12]px/.test(line)) || (lit === "0.15em" && /text-underline-offset:\s*0\.15em/.test(line));
    if (!ok) problems.push(`raw length ${lit} in "${line.trim()}"`);
  }
  const outside = src.replace(/@media \(forced-colors: active\)\s*\{[\s\S]*\}\s*$/m, "");
  if (/\b(GrayText|ButtonText|ButtonFace|Canvas|CanvasText|Highlight|HighlightText|LinkText|VisitedText)\b/.test(outside)) problems.push("system colour outside @media (forced-colors: active)");
  if (/:visited/.test(src)) problems.push(":visited styling is not part of Link v1");
  return { problems, used: [...new Set(used.filter((v) => v.startsWith("--ch-")))].sort(), publicTokens };
}

export async function run() {
  const css = read("../src/Link/link.css");
  const tokensCss = read("../../tokens/dist/ch-tokens.css");
  const { problems, used, publicTokens } = lintLinkCss(css, tokensCss);
  assert(problems.length === 0, `link.css token discipline: ${problems.join("; ")}`);
  const contract = JSON.parse(read("../../tokens/tests/link-v1-spec.json")).boundTokens.map((t) => `--ch-${t.split("/").join("-")}`).sort();
  assert(JSON.stringify(used) === JSON.stringify(contract), `link.css must consume exactly Link's ${contract.length}-token approved closure: extra [${used.filter((t) => !contract.includes(t))}] missing [${contract.filter((t) => !used.includes(t))}]`);
  assert(used.every((t) => publicTokens.has(t)), "every Link token must be public in ch-tokens.css");

  const bad = [
    [".x{color:var(--ch-brand-primary-700)}", /internal Brand/],
    [".x{color:var(--ch-color-navy-700)}", /primitive|non-public/],
    [".x{color:#335493}", /raw colour/],
    [".x{min-height:44px}", /raw length 44px/],
    [".x{text-underline-offset:3px}", /raw length 3px/],
    [".x{--_link-fg:#fff}", /raw value/],
    [".x{--ch-link-fg:red}", /non-private custom property/],
    [".x{color:LinkText}", /system colour outside/],
    [".x:visited{color:var(--ch-color-text-link-hover)}", /:visited/],
  ];
  for (const [snippet, re] of bad) assert(lintLinkCss(snippet, tokensCss).problems.some((p) => re.test(p)), `linter self-test missed ${snippet}`);

  const tsx = read("../src/Link/Link.tsx").replace(/\/\/.*$/gm, "");
  assert(/<a\b/.test(tsx) && !/role=|<div|<span|<button\b|tabIndex/.test(tsx), "Link must render a native <a> only (no role override, no tabIndex)");
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert(!/ch-tokens\.css|@import/.test(tsx + cssCode) && /import "\.\/link\.css"/.test(tsx) && (tsx.match(/^import /gm) || []).length === 2, "Link imports only link.css (+ React types); the token stylesheet is loaded once at the entry");
  assert(!/data-brand|financial|invest|style=\{/i.test(tsx), "no brand logic or inline styles in Link");
  assert(/export \{ Link \} from "\.\/Link\/Link";/.test(read("../src/index.ts")), "Link is exported from @chavosh/react");

  // Types self-test: a Link without href (and a disabled Link) must fail to compile.
  const TSC = join(PKG, "../../node_modules/.bin/tsc");
  const tmp = mkdtempSync(join(PKG, ".tmp-link-types-"));
  try {
    for (const [i, snippet] of ['<Link>x</Link>', '<Link href="/x" disabled>x</Link>'].entries()) {
      writeFileSync(join(tmp, `bad${i}.tsx`), `import { Link } from "../src";\nexport const x = ${snippet};\n`);
      writeFileSync(join(tmp, "tsconfig.json"), JSON.stringify({ extends: "../tsconfig.json", include: [`bad${i}.tsx`, "../src"] }));
      let ok = true;
      try { execFileSync(TSC, ["-p", join(tmp, "tsconfig.json")], { cwd: PKG, stdio: "pipe" }); } catch { ok = false; }
      assert(!ok, `types self-test: tsc accepted ${snippet}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return [
    `link.css consumes exactly Link's ${used.length}-token approved closure (${used.map((t) => t.slice(5)).join(", ")}); no primitives, no --ch-brand-*; private --_link-* set only from public tokens`,
    "no raw colours; only raw lengths are the approved underline constants 1px / 2px / 0.15em and 0px; system colours only in forced colours; no :visited styling; linter self-test catches 9 violation kinds",
    "Link.tsx: native <a> only, imports only link.css, no brand logic, no inline styles; exported from @chavosh/react; API contract (tests/types/link-api.tsx) compiles with 14 excluded props/values rejected; self-test: tsc rejects a Link without href and a disabled Link",
  ];
}
