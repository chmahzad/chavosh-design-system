# @chavosh/tokens — token pipeline v0.3

Public Figma snapshot (sanitized from a private raw capture, ADR 0011) → DTCG → Style Dictionary 5.5.5 → **`dist/ch-tokens.css`** (the one stylesheet React and Storybook will consume).

| Path | Kind | Purpose |
|---|---|---|
| `source/export-config.json` | handwritten | collections → layers/sets, FLOAT/STRING typing, effect support, component export scope, snapshot paths |
| `source/web-policy.json` | handwritten | web units (each rule cites its architecture basis), colour, font stacks, brand attribute, breakpoints |
| `snapshots/figma/` | derived | one public snapshot + provenance per component capture (raw captures attested, kept private; ADR 0011, 0012); released captures in `publicSnapshots`, recorded-but-unreleased in `stagedSnapshots` (ADR 0013) |
| `build/sanitize-snapshot.mjs` | handwritten | raw capture → public snapshot: removes Figma file/component/style keys, rule-checked |
| `build/convert-snapshot.mjs` | handwritten | provenance gate per capture → cross-capture consistency merge → guard → scoped closure → DTCG sets + manifest |
| `build/build-css.mjs` | handwritten | policy check → Style Dictionary per brand × breakpoint → validation → CSS |
| `build/lib/` | handwritten | description guard; unit/colour/font helpers |
| `generated/dtcg/` | generated | 8 DTCG sets + `_manifest.json` (incl. traceability) |
| `dist/ch-tokens.css` | generated | 63 public properties (union of the Button, Link, Checkbox and Radio closures) + 18 internal `--ch-brand-*` declarations |
| `tests/` | tests | units, DTCG, CSS, Chromium, determinism/freshness, production state |

Consumption: import `@chavosh/tokens/ch-tokens.css` once; components use only public `var(--ch-*)` tokens — never `--ch-brand-*`, never raw values. Brand via `data-brand` on any ancestor (Financial by default); breakpoints are in the stylesheet.
