# 0014 — Checkbox v1 implementation mapping; Link regression baseline

**Status:** Accepted (30 Sep 2026) — approved by the designer with the M2 commit (Checkbox v1, the 29-token contract, the 62-token surface, `className` on the row, native `name` only when supplied, name via `aria-labelledby`, description from supporting text, the Link regression baseline and the shared linter). Extends ADR 0012 and 0013. Source of design
decisions: `chavosh-checkbox-architecture.md` (approved 29 Sep 2026) and the Selection & Control Foundations Review; this
ADR records only how they are implemented.

## 1. Evidence
- Canonical Checkbox capture: exporter plugin v0.4.0, 30 Sep 2026, node `52:1034`, 12 variants, 374 bindings, 59
  variables (raw SHA-256 `a18ff7ab…`, private). Moved from `stagedSnapshots` to `publicSnapshots` in M2.
- Export scope `checkbox-v1`: no excluded layers (the glyph is internal vector geometry; supporting text is in the API).
- Closure = contract `packages/tokens/tests/checkbox-v1-spec.json` (29 tokens, text styles `body/md`, `body/sm`),
  identical to the validated capture and to the architecture's token table. **No new Figma tokens**; the three
  Checkbox tokens approved in the architecture (`color/control/checked`, `color/control/checked-hover`,
  `size/control/indicator`) already exist in Figma and are now published. 20 tokens become public (42 → 62); one
  internal brand role is added (`--ch-brand-primary-900`, via `control/checked-hover`). Button's 53 and Link's 19
  declarations are unchanged.

## 2. API
`<Checkbox label supportingText? hideLabel? indeterminate? ref? …nativeInputAttributes>`
- `label: ReactNode` — required (the accessible name, also when hidden). No `children`.
- `supportingText?: ReactNode` — description (aria-describedby).
- `hideLabel?: boolean` — visually hides the text column; the label remains the name.
- `indeterminate?: boolean` — applied to the DOM property after every render (a user click clears it natively; the owner
  re-derives it). Not a submitted value.
- Native input attributes (`checked`, `defaultChecked`, `onChange`, `disabled`, `name`, `value`, `required`, `form`,
  `id`, `aria-*`, `data-*`) and `ref` reach the `<input>`; `type` is fixed. **`className` is applied to the row** (the
  layout element) — the only attribute not placed on the input. A consumer `aria-describedby` is kept and precedes the
  supporting text.
- **Accessible name vs form-field `name`:** the accessible name is the label text via `aria-labelledby`; the description is
  the supporting text. The form-field `name` attribute is only the consumer's native `name` prop, passed to the `<input>`
  unchanged when supplied and absent otherwise — it is never derived from the visible label (asserted by
  `check-checkbox-tokens` and `check-checkbox-browser`).
- Excluded (compile-time contract `tests/types/checkbox-api.tsx`): `type`, `children`, error/invalid/validation props,
  size, state props, icon swap.

## 3. Structure and semantics
```
<label class="ch-checkbox">                       whole row = target (min-height size/touch-target/min)
  <span class="ch-checkbox__control">             height font/line-height/body/md → box on the first line
    <input type="checkbox" aria-labelledby aria-describedby>   transparent, exactly over the box
    <span class="ch-checkbox__box" aria-hidden>   20×20, 2px border, radius/sm; SVG check/dash from Figma geometry
  <span class="ch-checkbox__text">
    <span id=label>  body/md       <span id=support>  body/sm
```
- Wrapping `<label>` makes the whole row (padding, box, label, supporting text) toggle the input; `aria-labelledby`
  keeps the name to the label text so supporting text is only the description.
- Glyph: the Figma paths (check `M5.5 10.5 L8.5 13.5 L14.5 6.5`, dash `M6 10 L14 10`) in a 20-unit viewBox, 2-unit
  round stroke, covering the border box; it scales with the box. Shown by `:checked` / `:indeterminate`, so structure
  never depends on colour.
- Disabled uses `:disabled` (so `<fieldset disabled>` works); label/supporting colours use `:has()`.

## 4. State mapping (architecture §4)
| Selection · State | Box fill | Border (2px) | Glyph | Label |
|---|---|---|---|---|
| Unchecked | `surface/default` | `border/input` | — | `text/default` |
| Unchecked · Hover | `surface/default` | `border/strong` | — | `text/default` |
| Checked / Indeterminate | `control/checked` | `control/checked` | `icon/inverse` | `text/default` |
| … · Hover | `control/checked-hover` | `control/checked-hover` | `icon/inverse` | `text/default` |
| Disabled (any) | `surface/disabled` | `border/disabled` | `icon/disabled` | `text/disabled` |
Supporting text `text/subtle` (disabled `text/disabled`). Hover applies to the whole row, hover-capable pointers only,
never when disabled. Focus-visible on the input draws the Button focus technique on the box (3px `focus/indicator`
outline + 2px `focus/outer` ring; radii follow `radius/sm`). Forced colours: 2px `CanvasText` boundary, glyph
`CanvasText`, disabled `GrayText`, focus outline `Highlight`.

## 5. Documented CSS exceptions
`100%` (input overlay; glyph over the border box), the standard visually-hidden utility (`1px`, `clip-path: inset(50%)`)
for `hideLabel`, `0px`, and system colours inside forced colours. Enforced by the shared linter
`packages/react/tests/lib/lint-component-css.mjs` (new components use it; Button and Link keep their frozen linters).

## 6. Link regression baseline
Link is now a regression baseline like Button: `packages/react/tests/baseline/link-v1.baseline.json`, recorded from
`7da1127`, freezes Link's 11 reference files (source, CSS, stories, docs, checks, harness, types, contract, ADR 0013)
and its 19 resolved CSS declarations (15 public + 4 referenced brand). `check-link-baseline` enforces it with the
Button guard's comparison and self-tests.

## 7. Verification added
`check-checkbox-tokens` (static discipline, closure = contract, types self-test), `check-checkbox-browser` (Chromium:
63 state checks across selection × state × four brand contexts plus page-level brand; name/description/mixed;
keyboard; row target; form submission and `required`; `<fieldset disabled>`; select-all; wrapping; 200 % text; 320px
reflow; hover-incapable devices; forced colours), `check-link-baseline`, and 10 Checkbox stories + docs in
`check-storybook`. Automated results are evidence, not a WCAG conformance claim.

## 8. Debt
- Group validation, legend styling and error messaging wait for the future Checkbox Group / field wrapper.
- Consent labels with inline links remain a pattern concern (links independently focusable; must not toggle).
- `:has()` is required for disabled label colours (supported in current evergreen browsers).
