// AUTHORED. Token discipline for Button v1 (static). button.css may consume only public --ch-* tokens that exist in
// the production stylesheet (never primitives, never --ch-brand-*), plus its own private --_btn-* variables, which
// may be set only from public tokens or documented keywords. No raw colours; no raw lengths except the documented
// exceptions (ADR 0010 decision 3 underline 1px / 0.15em, zero). System colours only inside forced-colours. The
// component does not load the token stylesheet itself and contains no brand logic or inline styles.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(HERE, p), "utf8");
function assert(c, m) { if (!c) throw new Error(m); }

export function lintButtonCss(css, tokensCss) {
  const problems = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const brandBlock = /\[data-brand="[^"]+"\]\s*\{[^}]*\}/g;
  const publicTokens = new Set([...tokensCss.replace(/\/\*[\s\S]*?\*\//g, "").replace(brandBlock, "").matchAll(/(--ch-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const internal = new Set([...tokensCss.matchAll(/(--ch-brand-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const primitives = JSON.parse(read("../../tokens/generated/dtcg/primitives.tokens.json"));
  const flat = (t, p = []) => Object.entries(t).flatMap(([k, v]) => (k.startsWith("$") ? [] : v && "$value" in v ? [[...p, k].join("-")] : v && typeof v === "object" ? flat(v, [...p, k]) : []));
  const primitiveNames = new Set(flat(primitives).map((p) => `--ch-${p}`));

  const used = [...src.matchAll(/var\((--[a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
  for (const v of used) {
    if (v.startsWith("--_btn-")) continue;
    if (v.startsWith("--ch-brand-") || internal.has(v)) problems.push(`internal Brand variable ${v}`);
    else if (primitiveNames.has(v)) problems.push(`primitive token ${v}`);
    else if (!publicTokens.has(v)) problems.push(`unknown/non-public token ${v}`);
  }
  // private variables: declared only in this file, values only public tokens / private vars / keywords
  for (const m of src.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;}]+)[;}]/g)) {
    const [, name, value] = m;
    if (!name.startsWith("--_btn-")) { problems.push(`declares non-private custom property ${name}`); continue; }
    const rest = value.replace(/var\(--(ch|_btn)-[a-z0-9-]+\)/g, "").trim();
    if (!["", "transparent", "currentColor", "0px"].includes(rest)) problems.push(`${name} set to a raw value "${value.trim()}"`);
  }
  // raw colours
  if (/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/.test(src)) problems.push("raw colour literal");
  // raw lengths: only 1px (underline thickness), 0.15em (underline offset), 0 / 0px
  const outside = src.replace(/@media \(forced-colors: active\)\s*\{[\s\S]*\}\s*$/m, "");
  for (const m of src.matchAll(/(?<![\w-])(-?\d*\.?\d+)(px|rem|em|%|vw|vh|pt|ch)\b/g)) {
    const lit = m[0];
    if (lit === "0px") continue;
    const line = src.slice(src.lastIndexOf("\n", m.index) + 1, src.indexOf("\n", m.index));
    const ok = (lit === "1px" && /text-decoration-thickness:\s*1px/.test(line)) || (lit === "0.15em" && /text-underline-offset:\s*0\.15em/.test(line));
    if (!ok) problems.push(`raw length ${lit} in "${line.trim()}"`);
  }
  // system colours only in forced colours
  if (/\b(GrayText|ButtonText|ButtonFace|Canvas|CanvasText|Highlight|HighlightText|LinkText)\b/.test(outside)) problems.push("system colour outside @media (forced-colors: active)");
  return { problems, used: [...new Set(used.filter((v) => v.startsWith("--ch-")))].sort(), publicTokens };
}

export async function run() {
  const css = read("../src/Button/button.css");
  const tokensCss = read("../../tokens/dist/ch-tokens.css");
  const { problems, used, publicTokens } = lintButtonCss(css, tokensCss);
  assert(problems.length === 0, `button.css token discipline: ${problems.join("; ")}`);
  assert(used.length === publicTokens.size && used.every((t) => publicTokens.has(t)), `Button should consume the whole 37-token closure (uses ${used.length} of ${publicTokens.size})`);

  // Self-test: the linter really catches violations.
  const bad = [
    [".x{color:var(--ch-brand-primary-800)}", /internal Brand/],
    [".x{color:var(--ch-color-navy-800)}", /primitive|non-public/],
    [".x{color:#1e3d7a}", /raw colour/],
    [".x{padding:12px}", /raw length 12px/],
    [".x{padding:0.75rem}", /raw length/],
    [".x{--_btn-bg:#fff}", /raw value/],
    [".x{--ch-button-bg:red}", /non-private custom property/],
    [".x{color:GrayText}", /system colour outside/],
  ];
  for (const [snippet, re] of bad) assert(lintButtonCss(snippet, tokensCss).problems.some((p) => re.test(p)), `linter self-test missed ${snippet}`);

  const tsx = read("../src/Button/Button.tsx").replace(/\/\/.*$/gm, "");
  assert(/<button\b/.test(tsx) && !/role=|<div|<span|<a\b/.test(tsx), "Button must render a native <button> only");
  const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert(!/ch-tokens\.css|@import/.test(tsx + cssCode) && /import "\.\/button\.css"/.test(tsx) && (tsx.match(/^import /gm) || []).length === 2, "Button imports only button.css (+ React types); the token stylesheet is loaded once at the entry");
  assert(!/data-brand|financial|invest|style=\{/i.test(tsx), "no brand logic or inline styles in Button");
  return [
    `button.css consumes exactly the ${used.length} public Button tokens (no primitives, no --ch-brand-*); private --_btn-* set only from public tokens/keywords`,
    "no raw colours; only raw lengths are the documented underline 1px / 0.15em and 0px; system colours only in forced-colours; linter self-test catches 8 violation kinds",
    "Button.tsx: native <button>, imports only button.css, no brand logic, no inline styles",
  ];
}
