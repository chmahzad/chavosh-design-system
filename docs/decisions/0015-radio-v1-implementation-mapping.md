# 0015 — Radio v1 implementation mapping; Checkbox regression baseline

**Status:** Accepted (30 Sep 2026) — approved by the designer with the M3 commit (Radio v1, the 28-token contract, the 63-token surface via `radius/full`, native radio and same-name grouping without keyboard JavaScript, no RadioGroup, native `name` passthrough only, `className` on the row, the proportional border-drawn dot, the Checkbox baseline and the frozen shared linter). Extends ADR 0012–0014. Source of design
decisions: `chavosh-radio-architecture.md` (approved 29 Sep 2026) and the Selection & Control Foundations Review; this ADR
records only how they are implemented.

## 1. Evidence
- Canonical Radio capture: exporter plugin v0.4.0, 30 Sep 2026, node `56:1281`, 8 variants, 264 bindings, 58 variables
  (raw SHA-256 `081685a5…`, private). Moved from `stagedSnapshots` to `publicSnapshots` in M3.
- Export scope `radio-v1`: no excluded layers (the dot is intrinsic geometry; supporting text is in the API).
- Closure = contract `packages/tokens/tests/radio-v1-spec.json` (28 tokens, text styles `body/md`, `body/sm`),
  identical to the validated capture and to the architecture's "Token reuse (zero new tokens)" list. **No new Figma
  tokens.** One token becomes public: `radius/full` (Dimension → Primitive `radius/max`, emitted through the existing
  `radius-full-sentinel` web rule as `9999px`). Public surface 62 → 63; internal brand declarations unchanged (18).
  Button's 53, Link's 19 and Checkbox's 33 declarations are unchanged.

## 2. API
`<Radio label supportingText? ref? …nativeInputAttributes>`
- `label: ReactNode` — required (accessible name). No `children`.
- `supportingText?: ReactNode` — description (aria-describedby).
- Native input attributes (`name`, `value`, `checked`, `defaultChecked`, `onChange`, `disabled`, `required`, `form`,
  `id`, `aria-*`, `data-*`) and `ref` reach the `<input>`; `type` is fixed. `className` is applied to the row
  (ADR 0014 precedent). A consumer `aria-describedby` is kept and precedes the supporting text.
- **Form-field `name`:** only the consumer's native `name` prop, passed unchanged when supplied and absent otherwise —
  never derived from the label. Accessible name = label text via `aria-labelledby`.
- Excluded (compile-time contract `tests/types/radio-api.tsx`): `type`, `children`, `indeterminate`, `hideLabel`,
  error/invalid, size, state props, read-only.

## 3. Structure, grouping and keyboard
Same anatomy as Checkbox: wrapping `<label class="ch-radio">` (whole 44px row = target), control aligned to the first
line (`font/line-height/body/md`), transparent native input exactly over the 20px circle, `aria-hidden` circle with a dot,
text column (`body/md` label, `body/sm` supporting text).
- **No RadioGroup, no JavaScript keyboard handling.** Radios with the same native `name` form one group: the browser
  keeps a single selection, makes the group one tab stop (entering at the selected radio, or at an enabled radio when
  none is selected), moves focus and selection together with the arrow keys (wrapping, skipping disabled options) and
  selects with Space. A radio cannot be deselected. Storybook composes groups with `<fieldset>`/`<legend>`.
- Group validation (required rule and error message) belongs to the future Radio Group; native `required` still works.

## 4. State mapping (architecture §4)
| Selection · State | Circle surface | Ring (2px) | Dot | Label |
|---|---|---|---|---|
| Unselected | `surface/default` | `border/input` | — | `text/default` |
| Unselected · Hover | `surface/default` | `border/strong` | — | `text/default` |
| Selected | `surface/default` | `control/checked` | `control/checked` | `text/default` |
| Selected · Hover | `surface/default` | `control/checked-hover` | `control/checked-hover` | `text/default` |
| Disabled (any) | `surface/disabled` | `border/disabled` | `icon/disabled` (selected only) | `text/disabled` |
Supporting text `text/subtle` (disabled `text/disabled`). Hover on the whole row, hover-capable pointers only, never when
disabled. Focus-visible draws the Button focus technique around the circle (circular via `radius/full`). Forced colours:
`CanvasText` ring and dot, disabled `GrayText`, focus outline `Highlight`.

## 5. Dot geometry (approved intrinsic geometry)
Figma: 8px dot in the 20px circle. Implemented as `0.4 × size/control/indicator`, drawn as a border-only circle
(`border: calc(size/control/indicator × 0.2)`) centred in the circle — so it scales with the control (architecture §6:
"production sizes the dot proportionally") and remains visible in forced colours, where backgrounds are replaced.
No token. Other CSS exceptions: `100%` (input overlay), `0px`, system colours inside forced colours — enforced by the
shared linter.

## 6. Checkbox regression baseline
Checkbox is now a regression baseline: `packages/react/tests/baseline/checkbox-v1.baseline.json`, recorded from
`24caaf7`, freezes its 12 reference files (source, CSS, stories, docs, checks, harness, types, the shared component CSS
linter, contract, ADR 0014) and its 33 resolved CSS declarations (29 public + 4 referenced brand). Enforced by
`check-checkbox-baseline`. Freezing the shared linter means a later component that needs a different allowance passes
it through its own configuration; changing the linter itself requires a new ADR.

## 7. Verification added
`check-radio-tokens` (static discipline, closure = contract, dot geometry, no keyboard handling, types self-test),
`check-radio-browser` (Chromium: 42 state checks; name/description; consumer-only form `name`; native grouping, Tab /
Shift+Tab, Space, arrow keys with wrap and disabled skipping, no deselection; required and submission; `<fieldset
disabled>`; wrapping; 200 % text; 320px reflow; hover-incapable devices; forced colours), `check-checkbox-baseline`, and
9 Radio stories + docs in `check-storybook`. Automated results are evidence, not a WCAG conformance claim.

## 8. Debt
- Radio Group (legend styling, group helper/error, required messaging) is future scope.
- Visually hidden label ("choose one account" table rows) is a possible non-breaking extension.
- Shift+Tab entry point into a group with no selection is browser-defined (Chromium: first enabled radio).
- `:has()` is required for disabled label colours (supported in current evergreen browsers).
