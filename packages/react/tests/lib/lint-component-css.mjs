// AUTHORED. Shared token-discipline linter for components released after Link (ADR 0014). A component stylesheet may
// consume only public --ch-* tokens that exist in the production stylesheet (never primitives, never --ch-brand-*),
// plus its own private variables (prefix per component), which may be set only from public tokens / private variables.
// No raw colours. Raw lengths only where the component's ADR lists them (literal + line pattern). System colours only
// inside @media (forced-colors: active). (Button and Link keep their own frozen linters.)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const flat = (t, p = []) => Object.entries(t).flatMap(([k, v]) => (k.startsWith("$") ? [] : v && "$value" in v ? [[...p, k].join("-")] : v && typeof v === "object" ? flat(v, [...p, k]) : []));
const SYSTEM = /\b(GrayText|ButtonText|ButtonFace|ButtonBorder|Canvas|CanvasText|Field|FieldText|Highlight|HighlightText|LinkText|VisitedText|Mark|MarkText|AccentColor|AccentColorText)\b/;

export function lintComponentCss(css, tokensCss, { prefix, allowedLengths = [] }) {
  const problems = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const brandBlock = /\[data-brand="[^"]+"\]\s*\{[^}]*\}/g;
  const publicTokens = new Set([...tokensCss.replace(/\/\*[\s\S]*?\*\//g, "").replace(brandBlock, "").matchAll(/(--ch-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const internal = new Set([...tokensCss.matchAll(/(--ch-brand-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const primitiveNames = new Set(flat(JSON.parse(readFileSync(join(HERE, "../../../tokens/generated/dtcg/primitives.tokens.json"), "utf8"))).map((p) => `--ch-${p}`));
  const priv = `--_${prefix}-`;

  const used = [...src.matchAll(/var\((--[a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
  for (const v of used) {
    if (v.startsWith(priv)) continue;
    if (v.startsWith("--ch-brand-") || internal.has(v)) problems.push(`internal Brand variable ${v}`);
    else if (primitiveNames.has(v)) problems.push(`primitive token ${v}`);
    else if (!publicTokens.has(v)) problems.push(`unknown/non-public token ${v}`);
  }
  for (const m of src.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;}]+)[;}]/g)) {
    const [, name, value] = m;
    if (!name.startsWith(priv)) { problems.push(`declares non-private custom property ${name}`); continue; }
    if (value.replace(new RegExp(`var\\(--(ch|_${prefix})-[a-z0-9-]+\\)`, "g"), "").trim() !== "") problems.push(`${name} set to a raw value "${value.trim()}"`);
  }
  if (/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/.test(src)) problems.push("raw colour literal");
  for (const m of src.matchAll(/(?<![\w-])(-?\d*\.?\d+)(px|rem|em|%|vw|vh|pt|ch)\b/g)) {
    const lit = m[0];
    if (lit === "0px") continue;
    const line = src.slice(src.lastIndexOf("\n", m.index) + 1, src.indexOf("\n", m.index));
    if (!allowedLengths.some((a) => a.literal === lit && a.line.test(line))) problems.push(`raw length ${lit} in "${line.trim()}"`);
  }
  const outside = src.replace(/@media \(forced-colors: active\)\s*\{[\s\S]*\}\s*$/m, "");
  if (SYSTEM.test(outside)) problems.push("system colour outside @media (forced-colors: active)");
  return { problems, used: [...new Set(used.filter((v) => v.startsWith("--ch-")))].sort(), publicTokens };
}

/** Self-test snippets every component linter must reject. */
export const LINT_PROBES = (prefix) => [
  [".x{color:var(--ch-brand-primary-800)}", /internal Brand/],
  [".x{color:var(--ch-color-navy-800)}", /primitive|non-public/],
  [".x{color:#1e3d7a}", /raw colour/],
  [".x{padding:12px}", /raw length 12px/],
  [".x{padding:0.75rem}", /raw length/],
  [`.x{--_${prefix}-bg:#fff}`, /raw value/],
  [".x{--ch-component-bg:red}", /non-private custom property/],
  [".x{color:CanvasText}", /system colour outside/],
];
