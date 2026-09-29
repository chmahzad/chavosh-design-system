// AUTHORED. Pure web-output helpers v0.3 (no Style Dictionary dependency), used by the pre-SD policy check, the SD
// transforms and the tests. Evolved from Proof #2's build/lib/units.mjs (tag proof-2-closed).

/** Policy path pattern: "*" = anything, "a/*" = any deeper path under a/, otherwise exact. */
export function matchesPath(pattern, path) {
  if (pattern === "*") return true;
  return pattern.endsWith("/*") ? path.startsWith(pattern.slice(0, -1)) : path === pattern;
}

/** Exactly one rule must match. */
export function oneRule(rules, path, what) {
  const hits = rules.filter((r) => r.match.some((m) => matchesPath(m, path)));
  if (hits.length !== 1) {
    throw new Error(`${what}: ${path} is ${hits.length ? `ambiguous (rules ${hits.map((r) => r.id || r.type).join(", ")})` : "unclassified (no rule)"}`);
  }
  return hits[0];
}

export const ruleFor = (policy, path) => oneRule(policy.dimensionRules, path, "Web unit policy");

export function assertPxDimension(v, label) {
  if (!v || typeof v !== "object" || typeof v.value !== "number" || !Number.isFinite(v.value) || v.unit !== "px" || Object.keys(v).length !== 2) {
    throw new Error(`${label}: expected a DTCG dimension object {value: number, unit: "px"}, got ${JSON.stringify(v)}`);
  }
  return v.value;
}

/** px → rem; refuses values not exactly representable in 4 decimals (no silent rounding). */
export function pxToRem(px, base) {
  const rem = px / base;
  const rounded = Number(rem.toFixed(4));
  if (Math.abs(rounded - rem) > 1e-12) throw new Error(`pxToRem: ${px}px / ${base} = ${rem} is not exact to 4 decimals`);
  return `${rounded}rem`;
}

export function formatDimension(rule, value, base, path) {
  const n = assertPxDimension(value, path);
  switch (rule.output) {
    case "rem":
      return pxToRem(n, base);
    case "px":
      return `${n}px`;
    case "zero":
      if (n !== 0) throw new Error(`${path}: rule ${rule.id} expects 0, resolved ${n}px`);
      return "0";
    case "sentinel-px":
      if (n !== rule.sentinelPx) throw new Error(`${path}: sentinel rule ${rule.id} expects ${rule.sentinelPx}px, resolved ${n}px`);
      return `${n}px`;
    default:
      throw new Error(`${path}: unknown policy output "${rule.output}" (rule ${rule.id})`);
  }
}

const hex2 = (n) => n.toString(16).padStart(2, "0");

/** DTCG sRGB colour → CSS. G2: alpha = 1 → #rrggbb (lowercase); alpha < 1 → rgb(R G B / A%). */
export function colorToCss(v, label) {
  if (!v || v.colorSpace !== "srgb" || !Array.isArray(v.components) || v.components.length !== 3 || typeof v.alpha !== "number") {
    throw new Error(`${label}: expected a DTCG sRGB colour object, got ${JSON.stringify(v)}`);
  }
  const ch = v.components.map((c) => {
    if (typeof c !== "number" || c < 0 || c > 1) throw new Error(`${label}: colour component out of range: ${c}`);
    return Math.round(c * 255);
  });
  const hex = `#${ch.map(hex2).join("")}`;
  if (v.hex && hex !== v.hex.toLowerCase()) throw new Error(`${label}: components ${ch} disagree with hex ${v.hex}`);
  if (!(v.alpha >= 0 && v.alpha <= 1)) throw new Error(`${label}: alpha out of range: ${v.alpha}`);
  if (v.alpha === 1) return hex;
  return `rgb(${ch.join(" ")} / ${Number((v.alpha * 100).toFixed(2))}%)`;
}

const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "math", "emoji", "fangsong"]);

/** One CSS family name: generic keywords and simple identifiers unquoted, anything else double-quoted. */
export function cssFamilyName(name) {
  if (typeof name !== "string" || !name.trim()) throw new Error(`Invalid font family name ${JSON.stringify(name)}`);
  if (GENERIC_FAMILIES.has(name) || /^[A-Za-z][A-Za-z0-9-]*$/.test(name)) return name;
  if (/["\\]/.test(name)) throw new Error(`Font family name needs escaping: ${name}`);
  return `"${name}"`;
}

/** DTCG fontFamily (string | string[]) → CSS font stack from the web policy (decision 9). */
export function fontFamilyToCss(value, policy, label) {
  const primary = Array.isArray(value) ? value[0] : value;
  if (typeof primary !== "string") throw new Error(`${label}: expected a DTCG fontFamily string, got ${JSON.stringify(value)}`);
  const stack = policy.fontFamily.stacks[primary];
  if (!stack) throw new Error(`${label}: font family "${primary}" has no web font stack in web-policy.json`);
  if (stack[0] !== primary) throw new Error(`${label}: web stack for "${primary}" must start with the Figma family`);
  return stack.map(cssFamilyName).join(", ");
}

/** DTCG fontWeight (number) → CSS number. */
export function fontWeightToCss(value, policy, label) {
  const { min, max } = policy.fontWeight;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}: expected an integer font weight ${min}–${max}, got ${JSON.stringify(value)}`);
  }
  return String(value);
}
