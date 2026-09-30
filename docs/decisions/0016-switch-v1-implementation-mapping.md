# 0016 — Switch v1 implementation mapping; Radio regression baseline

**Status:** Accepted (30 Sep 2026) — under the designer's delegated M4 approval (commit if strict verification and the
Storybook build pass with no material deviation). Extends ADR 0012–0015. Sources: `chavosh-switch-architecture.md`
(approved 29 Sep 2026), the Selection & Control Foundations Review, and the motion rule in
`chavosh-select-architecture.md` §12 / foundations. This ADR records only how they are implemented.

## 1. Evidence
- Canonical Switch capture: exporter plugin v0.4.0, 30 Sep 2026, node `63:1411`, 8 variants, 252 bindings, 59 variables
  (raw SHA-256 `25f2859b…`, private). Moved from `stagedSnapshots` to `publicSnapshots` in M4.
- Export scope `switch-v1`: no excluded layers.
- Closure = contract `packages/tokens/tests/switch-v1-spec.json` (30 tokens, text styles `body/md`, `body/sm`), identical
  to the validated capture and to the architecture's "zero new tokens" decision. **No new Figma tokens.** Two tokens
  become public: `color/icon/default` and `color/icon/subtle` (thumb colours). Public surface 63 → 65; internal brand
  declarations unchanged (18). Button 53, Link 19, Checkbox 33 and Radio 32 declarations unchanged.

## 2. API
`<Switch label supportingText? ref? …nativeCheckboxAttributes>` — `label: ReactNode` required (never changes with the
state); `supportingText?: ReactNode` (description). Native attributes (`checked`, `defaultChecked`, `onChange`,
`disabled`, `name`, `value`, `required`, `form`, `id`, `aria-*`, `data-*`) and `ref` reach the `<input>`; `type` and
`role` are fixed. Form `name` only when supplied, never derived from the label; accessible name = label text via
`aria-labelledby`; description = consumer `aria-describedby` + supporting text; `className` on the row. Excluded
(`tests/types/switch-api.tsx`): `type`, `role`, `children`, `indeterminate`, On/Off text, `loading`, error, size,
`hideLabel`, state props. No Switch Group component.

## 3. Structure and semantics
Wrapping `<label class="ch-switch">` (whole row = target, min-height `size/touch-target/min`), **text first, control
trailing** (text column fills the row), control aligned to the first line (`font/line-height/body/md`), native
`<input type="checkbox" role="switch">` transparent over the track (checked state is native — no `aria-checked`
emulation), `aria-hidden` track with the thumb. Keyboard is native: Tab (own tab stop), Space toggles, Enter and arrows
do nothing.

## 4. State mapping (architecture §4)
| Checked · State | Track fill | Track border (2px) | Thumb | Position |
|---|---|---|---|---|
| Off | `surface/default` | `border/input` | `icon/subtle` | start |
| Off · Hover | `surface/default` | `border/strong` | `icon/default` | start |
| On | `control/checked` | `control/checked` | `icon/inverse` | end |
| On · Hover | `control/checked-hover` | `control/checked-hover` | `icon/inverse` | end |
| Disabled | `surface/disabled` | `border/disabled` | `icon/disabled` | kept |
Hover on the whole row, hover-capable pointers only, never when disabled; focus-visible = Button focus technique around
the pill track; forced colours: `CanvasText` track border and thumb, `GrayText` disabled, `Highlight` focus outline.

## 5. Technical decisions (component-level, no tokens)
- **Intrinsic geometry in rem.** The approved 44×24 track, 16px thumb and 4px inset (20px travel) are written as
  2.75rem × 1.5rem, a 0.5rem-border thumb, 0.25rem inset and 1.25rem travel, so the control scales with text like every
  tokenised control dimension (web policy decision 4). At the default text size they are exactly 44 / 24 / 16 / 4 / 20px.
- **Border-drawn thumb** (like the Radio dot) so it survives forced colours, where backgrounds are replaced.
- **RTL:** the thumb uses `inset-inline-start` and travels the other way under `:dir(rtl)`.
- **Motion:** 150ms `cubic-bezier(0.2, 0, 0, 1)` on track colour/border and thumb transform/colour (Select architecture
  §12 table, foundations motion rules); state commits immediately; `prefers-reduced-motion: reduce` → 0ms. Motion
  tokens remain Foundations debt.
- **Forced-colours focus:** follows the implemented pattern of Button, Link, Checkbox and Radio (outline colour
  `Highlight`, offset 0). The foundations document's forced-colours rule suggests `outline-offset: 2px`; this
  difference already exists in all released components and is recorded as a design/code mismatch for review, not
  changed here.

## 6. Radio regression baseline
`packages/react/tests/baseline/radio-v1.baseline.json`, recorded from `6d72708`, freezes Radio's 11 reference files and
its 32 resolved CSS declarations; enforced by `check-radio-baseline`.

## 7. Verification added
`check-switch-tokens` (static discipline, closure = contract, geometry and motion allowances, no keyboard handling,
types self-test), `check-switch-browser` (Chromium: 42 state checks with geometry; RTL; role=switch and checked state;
name/description; keyboard; row target; controlled/uncontrolled; forms incl. required and default value "on";
`<fieldset disabled>`; motion and reduced motion; wrapping, 200 % text, 320px reflow; touch; forced colours),
`check-radio-baseline`, and 9 Switch stories + docs in `check-storybook`. Automated evidence, not WCAG conformance.

## 8. Debt
- Motion tokens (Foundations); forced-colours focus offset mismatch (§5); pending/failure feedback pattern; `:has()`
  for disabled label colours. Manual: VoiceOver/NVDA/TalkBack "switch, on/off" announcements, Windows High Contrast,
  real-device zoom.
