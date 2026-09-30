# 0017 — Text Field v1 implementation mapping; Switch regression baseline

**Status:** Accepted (30 Sep 2026) — under the designer's delegated M5 approval (commit if strict verification and the
Storybook build pass with no material contradiction), including the two previously deferred decisions: the error icon
uses the temporary `Icon/alert-circle` artwork, and Disabled + Error / Read-only + Error are unsupported design
combinations in v1. Extends ADR 0012–0016. Source: `chavosh-text-field-architecture.md` (approved 29 Sep 2026) and the
Component Expansion Plan (Text Field API). This ADR records only how they are implemented.

## 1. Evidence
- Canonical Text Field capture: exporter plugin v0.4.0, 30 Sep 2026, node `42:745`, 8 variants (5 States × None +
  Default/Hover/Focus × Error). Moved from `stagedSnapshots` to `publicSnapshots` in M5; `stagedSnapshots` is now empty.
- Export scope `text-field-v1`, excluded layer `leading-icon`: the approved v1 API has no leading icon, so its bindings
  (`size/icon/md`, `color/icon/subtle`, `color/icon/disabled` on the glyph) stay in the snapshot but out of the closure
  (Button/Link precedent). The placeholder and the error icon stay in scope.
- Closure = contract `packages/tokens/tests/text-field-v1-spec.json`: **34 tokens**, text styles `label/md`, `body/md`,
  `body/sm`. No new Figma tokens. Seven tokens become public: `color/surface/sunken`, `color/text/placeholder`,
  `color/feedback/error/border`, `color/feedback/error/foreground`, `color/feedback/error/icon`, `size/icon/sm`,
  `space/component/md`. Public surface 65 → 72; internal brand declarations unchanged (18). Button 53, Link 19,
  Checkbox 33, Radio 32 and Switch 34 declarations unchanged. Text Field binds no brand-dependent token.

## 2. API
`<TextField label helperText? errorMessage? optional? type? ref? …nativeInputAttributes>`
- `label: ReactNode` — required, persistent and visible (accessible name). No `children`, no hidden label.
- `helperText?: ReactNode` — description. `errorMessage?: ReactNode` — the only source of the error treatment and of
  `aria-invalid`; an empty value is no error. `optional?: boolean` — the visible "(optional)" indicator.
- `type?: "text" | "email" | "tel" | "url" | "password"` (default `text`). `number` is excluded (architecture §7: use
  `inputMode`); `search` is a future Search component; non-text types are not Text Fields.
- Native attributes (`value`, `defaultValue`, `onChange`, `onBlur`, `placeholder`, `name`, `required`, `disabled`,
  `readOnly`, `autoComplete`, `inputMode`, `maxLength`, `pattern`, `form`, `id`, `aria-*`, `data-*`) and `ref` reach the
  `<input>`; `className` goes on the field wrapper (ADR 0014 precedent). Form `name` only when supplied, never derived
  from the label.
- Excluded (compile-time contract `tests/types/text-field-api.tsx`): consumer `aria-invalid` and `aria-errormessage`
  (typed `never`, so the invalid state always has a visible, described message), `error`, leading icon, size,
  `hideLabel`, success/warning validation, state props, non-boolean `optional`.

## 3. Structure and semantics
`<div class="ch-text-field">` column with `space/gap/sm` between label row, helper, input and error (architecture §1):
- `<label for>` (generated id, or the consumer `id`) containing the label text and, when `optional`, a `body/md`
  `text/subtle` "(optional)" span on a shared baseline with a `space/gap/xs` gap — so the name is "Label (optional)".
- Helper `<span id>` (`body/sm`, `text/subtle`).
- Native `<input>`. With no adornments in v1 it carries the container box itself (48px minimum, `space/component/md`
  padding, `radius/sm`, border); a wrapper arrives with icons/prefixes. `width: 100%` fills the field — and, because a
  percentage width makes the native input's intrinsic size compressible, the field reflows inside min-content
  containers such as `<fieldset>` at 320px / 400 % zoom.
- Error `<span id>`: the alert icon (`size/icon/sm`, `feedback/error/icon`, top-aligned as in Figma) + message
  (`body/sm`, `feedback/error/foreground`), `space/gap/xs`.
- `aria-describedby` = error id, helper id, then any consumer ids (architecture §4). No live region: errors appear after
  submit or blur; a form-level error summary is a future pattern.

## 4. State mapping (architecture §3)
| State | Background | Border (width) | Value | Placeholder |
|---|---|---|---|---|
| Default | `surface/default` | `border/input` (1px) | `text/default` | `text/placeholder` |
| Hover | `surface/default` | `border/strong` (1px) | `text/default` | `text/placeholder` |
| Focus-visible | `surface/default` | `border/input` (1px) + focus rings | `text/default` | `text/placeholder` |
| Disabled | `surface/disabled` | `border/disabled` (1px) | `text/disabled` | `text/disabled` |
| Read-only | `surface/sunken` | `border/input` (1px) | `text/default` | `text/placeholder` |
| Error (Default/Hover/Focus) | as state | `feedback/error/border` (2px, `border-width/strong`) | as state | as state |
Label `label/md` `text/default` and helper `text/subtle` in every state. Hover: hover-capable pointers, editable
(`:read-write`) and unfocused fields only — never disabled or read-only; a hovered Error keeps the error border. Focus
uses the Button technique (3px outline + 2px outer ring, offset 0). Forced colours: `CanvasText` boundary (errors keep
2px, icon and message), `GrayText` disabled, `Highlight` focus outline.

## 5. Error icon (deferred decision 1)
The real temporary `Icon/alert-circle` artwork was read **read-only** from Figma (the `error-icon` instance in the
Default + Error variant; main component on the Foundations page, described as "TEMPORARY — pending Icon system"): a
single 16×16 path, 2px round-capped stroke. It is inlined in `TextField.tsx` as a decorative SVG (`aria-hidden`,
`focusable="false"`, `stroke="currentColor"`, colour from `feedback/error/icon`), like the Checkbox glyph. It is not a
public icon and not an API; it is replaced when the Icon system exists. The raw export stays private.

## 6. Unsupported combinations (deferred decision 2)
Figma has no Disabled + Error or Read-only + Error variant. They are **unsupported design combinations in v1**: no new
visual state, no API and no runtime warning. No CSS rule targets them (enforced by `check-text-field-tokens`), stories
never show them (enforced by `check-storybook`), and the docs tell consumers to clear `errorMessage` before disabling a
field or making it read-only. The combined rendering is not a designed state.

## 7. Switch regression baseline
`packages/react/tests/baseline/switch-v1.baseline.json`, recorded from `520932f`, freezes Switch's 11 reference files and
its 34 resolved CSS declarations (30 public + 4 referenced brand); enforced by `check-switch-baseline`.

## 8. Verification added
`check-text-field-tokens` (static discipline, closure = contract, no motion, no rule for unsupported combinations,
anatomy order, error semantics, icon artwork, types self-test), `check-text-field-browser` (Chromium: 54 state checks ×
brand contexts incl. geometry and typography; name/description/invalid; generated ids; keyboard; native disabled and
readOnly; controlled/uncontrolled; forms; error on blur; wrapping and long values; 200 % text; 320px reflow; touch;
forced colours), `check-switch-baseline`, and 9 Text Field stories + docs in `check-storybook`. Automated evidence, not
WCAG conformance.

## 9. Debt
- Icon system (replaces the temporary artwork); leading/trailing icons, prefixes/suffixes and embedded actions.
- "(optional)" text is English only (localisation).
- Form-level error summary; Currency Input, Search and BSB + account-number patterns.
- Forced-colours focus offset mismatch across all components (ADR 0016 §5) — kept for Final Integration.
- Manual: VoiceOver/NVDA/TalkBack name, description and invalid announcements; autofill; Windows High Contrast;
  real-device zoom.
