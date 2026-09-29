// AUTHORED. Pure helper checks: G2 colour rule (opaque → hex, alpha → rgb / %), fonts (G3 + decision 9), px → rem
// exactness, sentinel/zero radius rules, rule matching (unclassified / ambiguous fail).
import { assert, throwsWith, policy } from "./lib.mjs";
import { colorToCss, cssFamilyName, fontFamilyToCss, fontWeightToCss, formatDimension, pxToRem, oneRule, ruleFor } from "../build/lib/units.mjs";

export async function run() {
  const P = policy();
  const c = (r, g, b, a, hex) => ({ colorSpace: "srgb", components: [r, g, b], alpha: a, ...(hex ? { hex } : {}) });
  // Opaque → hex (lowercase, from Figma float components; Proof #1 navy/violet values)
  assert(colorToCss(c(0.11764705926179886, 0.239215686917305, 0.47843137383461, 1, "#1e3d7a"), "x") === "#1e3d7a", "opaque navy → hex");
  assert(colorToCss(c(0.3490196168422699, 0.05098039284348488, 0.6352941393852234, 1), "x") === "#590da2", "opaque violet → hex");
  assert(colorToCss(c(1, 1, 1, 1), "x") === "#ffffff" && colorToCss(c(0, 0, 0, 1), "x") === "#000000", "white/black");
  // Translucent → modern rgb (Proof #2 value), decimals preserved, 0% allowed
  assert(colorToCss(c(0.10588235408067703, 0.13333334028720856, 0.1725490242242813, 0.11999999731779099, "#1b222c"), "x") === "rgb(27 34 44 / 12%)", "alpha 12%");
  assert(colorToCss(c(1, 0.5, 0, 0.125), "x") === "rgb(255 128 0 / 12.5%)" && colorToCss(c(0, 0, 0, 0), "x") === "rgb(0 0 0 / 0%)", "alpha decimals / zero");
  await throwsWith(() => colorToCss(c(0, 0, 0, 1, "#ffffff"), "x"), /disagree with hex/, "hex mismatch");
  await throwsWith(() => colorToCss(c(0, 0, 1.2, 1), "x"), /out of range/, "channel range");
  await throwsWith(() => colorToCss(c(0, 0, 0, 1.5), "x"), /alpha out of range/, "alpha range");
  await throwsWith(() => colorToCss("#000000", "x"), /sRGB colour object/, "non-object colour");

  // Fonts
  assert(fontFamilyToCss("Inter", P, "f") === "Inter, system-ui, sans-serif", "Inter stack (decision 9)");
  assert(fontFamilyToCss(["Inter"], P, "f") === "Inter, system-ui, sans-serif", "array form");
  assert(cssFamilyName("IBM Plex Sans") === '"IBM Plex Sans"' && cssFamilyName("sans-serif") === "sans-serif" && cssFamilyName("system-ui") === "system-ui", "quoting");
  await throwsWith(() => fontFamilyToCss("Roboto", P, "f"), /no web font stack/, "unknown family");
  assert(fontWeightToCss(500, P, "w") === "500" && fontWeightToCss(400, P, "w") === "400", "weight");
  for (const bad of [0, 1001, 500.5, "500", null]) await throwsWith(() => fontWeightToCss(bad, P, "w"), /integer font weight/, `weight ${bad}`);

  // Dimensions
  assert(pxToRem(12, 16) === "0.75rem" && pxToRem(48, 16) === "3rem" && pxToRem(9999, 16) === "624.9375rem", "pxToRem");
  await throwsWith(() => pxToRem(0.3, 16), /not exact/, "inexact rem");
  const d = (n) => ({ value: n, unit: "px" });
  assert(formatDimension(ruleFor(P, "radius/full"), d(9999), 16, "radius/full") === "9999px", "sentinel");
  assert(formatDimension(ruleFor(P, "radius/none"), d(0), 16, "radius/none") === "0", "radius/none → 0");
  assert(formatDimension(ruleFor(P, "focus/width/indicator"), d(3), 16, "f") === "3px" && formatDimension(ruleFor(P, "space/component/xl"), d(24), 16, "s") === "1.5rem", "px/rem rules");
  await throwsWith(() => formatDimension(ruleFor(P, "radius/full"), d(999), 16, "radius/full"), /sentinel rule/, "sentinel mismatch");
  await throwsWith(() => formatDimension(ruleFor(P, "radius/md"), { value: 1, unit: "rem" }, 16, "radius/md"), /unit: "px"/, "non-px source");
  await throwsWith(() => ruleFor(P, "layout/columns"), /unclassified/, "unclassified");
  await throwsWith(() => oneRule([{ id: "a", match: ["x/*"] }, { id: "b", match: ["x/y"] }], "x/y", "t"), /ambiguous/, "ambiguous");
  for (const r of P.dimensionRules) assert(r.basis && r.id, `rule ${r.id} must cite its architecture basis`);
  return [
    "colour (G2): opaque → lowercase hex (#1e3d7a, #590da2), alpha → rgb(27 34 44 / 12%); hex/range/shape errors fail",
    "fonts (G3): Inter → Inter, system-ui, sans-serif; generic/quoted names; unknown family and invalid weights fail",
    `dimensions: exact px → rem, 9999px sentinel, radius/none → 0, px widths; unclassified/ambiguous fail; ${P.dimensionRules.length} rules each cite a basis`,
  ];
}
