# 0010 — Button v1 implementation mapping (frozen)

**Status:** Accepted — FROZEN decision record for React Button v1 (29 Sep 2026). Change only if implementation evidence reveals a genuine contradiction, and then by a new ADR.
**Sources:** canonical Button capture (private raw capture, SHA-256 `adecb1cc8587634f057eb4bddb34a6a789012d65340f08cdd92dc81abe6b0a52`, 490 808 bytes, exporter 0.3.0, schema 1.2.0, Button `20:2`; public build input `packages/tokens/snapshots/figma/chavosh-button.snapshot.public.json` per ADR 0011); `chavosh-button-architecture.md` (approved design spec); ADRs 0003–0009.

## 1. Canonical Figma model (verified from the snapshot)
- Component set **Button** `20:2`, page *Components*: **60 variants** = Hierarchy {Primary, Secondary, Tertiary, Destructive} × Size {sm, md, lg} × State {Default, Hover, Pressed, Focus, Disabled}; no gaps, no extras.
- 1 626 bindings (Dimension 1 116 · Color 390 · Responsive 120); **0 direct Brand/Primitive bindings**. 540 bindings sit on hidden `leading-icon`, `trailing-icon`, `spinner` layers (excluded by the labels-only scope, ADR 0005).
- Labels-only closure = **37 tokens** + text styles `label/md` (md, lg) and `label/sm` (sm) — identical to the approved spec (`packages/tokens/tests/button-v1-spec.json`).
- Figma-only representations: `hover-underline` layer (visible only in the 12 Hover variants) = CSS `text-decoration`; `focus-indicator` / `focus-outer` layers (only in the 12 Focus variants) = `:focus-visible` treatment; Loading and icon booleans (deferred).

| Hierarchy | Default | Hover | Pressed | Focus | Disabled |
|---|---|---|---|---|---|
| Primary | bg `action/primary/background/default` · fg `…/foreground/default` | Default + underline | bg `…/background/pressed` | Default + rings | bg `action/disabled/background` · fg `action/disabled/foreground` |
| Secondary | bg `…/secondary/background/default` · border `…/border/default` · fg `…/foreground/default` | Default + underline | bg `…/background/pressed` · border `…/border/hover` · fg `…/foreground/hover` | Default + rings | bg `action/disabled/background` · border `border/disabled` · fg `action/disabled/foreground` |
| Tertiary | no fill · fg `…/tertiary/foreground/default` | bg `…/background/hover` · fg `…/foreground/hover` + underline | bg `…/background/pressed` · fg `…/foreground/hover` | Default + rings | no fill · fg `action/disabled/foreground` |
| Destructive | bg `…/destructive/background/default` · fg `…/foreground/default` | Default + underline | bg `…/background/pressed` | Default + rings | as Primary disabled |

| Size | Min height | Padding-inline | Padding-block | Gap | Label |
|---|---|---|---|---|---|
| sm (restricted) | `size/control/height/sm` | `space/component/lg` | calc((height − line height) / 2) | `space/gap/sm` | `label/sm` |
| md (default) | `size/control/height/md` | `space/component/xl` | same rule | `space/gap/sm` | `label/md` |
| lg | `size/control/height/lg` | `space/component/xl` | same rule | `space/gap/sm` | `label/md` |
All sizes: `radius/md`; Secondary border `border-width/default`; `box-sizing: border-box`.

## 2. Production API (React 19, exact pin)
```tsx
<Button hierarchy="primary" size="md" onClick={…}>Continue</Button>
```
| Prop | Type / default | Notes |
|---|---|---|
| `hierarchy` | `"primary" \| "secondary" \| "tertiary" \| "destructive"` = `"primary"` | Figma default variant |
| `size` | `"sm" \| "md" \| "lg"` = `"md"` | `sm` restricted (see §6) |
| `children` | visible label | = accessible name (2.5.3) |
| `disabled` | `boolean` (native) | Decision 5: no `disabledBehavior`, no first-class `aria-disabled` in v1 |
| `type` | `"button" \| "submit" \| "reset"` = **`"button"`** | Decision 4 |
| native button attributes | incl. `className`, event handlers, `form`, `name`, `value`, `aria-*`, `data-*` | Decision 7: no style-override props; `style` (inherited type) is not a supported token override; consumers must not override visual properties with raw values |
| `ref` | React 19 ref-as-prop, to the `<button>` | Decision 8: no legacy `forwardRef` |
**Not props:** hover, pressed, focus (browser states); `loading`, icons (deferred, G6); `fullWidth` (Decision 6 — width is a layout concern; Button is `inline-flex`); `href`, `as` (navigation uses Link).

## 3. State → browser/CSS mapping
| Figma state | Trigger | Selector / behaviour | Tokens |
|---|---|---|---|
| Default | — | `.ch-button[data-hierarchy][data-size]` | per §1 |
| Hover | hover-capable pointer only | `@media (hover: hover) { .ch-button:hover:not(:active, :disabled) }` → `text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.15em; text-decoration-color: currentColor; text-decoration-skip-ink: auto` (Decision 3; G5 component-level debt). Tertiary also: hover background + foreground | Tertiary `…/background/hover`, `…/foreground/hover` |
| Pressed | pointer/key down | `.ch-button:active:not(:disabled)` → pressed colours, **no underline** (wins over Hover) | per §1 |
| Focus | keyboard | `:focus-visible` → `outline: var(--ch-focus-width-indicator) solid var(--ch-color-focus-indicator)` + `box-shadow: 0 0 0 calc(var(--ch-focus-width-indicator) + var(--ch-focus-width-outer)) var(--ch-color-focus-outer)`; may combine with Hover | `color/focus/*`, `focus/width/*` |
| Disabled | `disabled` | `:disabled` → disabled tokens; never underlined, no pressed | `action/disabled/*`, `border/disabled` |
| Loading | — | **deferred** (never underlined, suppresses icons, never with Disabled/Pressed) | — |
No transitions in v1 (motion deferred).

## 4. Token → CSS custom property map (Button CSS may use only these public tokens)
Colours (21; 11 brand-dependent, re-declared on `:root, [data-brand]`): `--ch-color-action-primary-{background-default, background-pressed, foreground-default}`, `--ch-color-action-secondary-{background-default, background-pressed, border-default, border-hover, foreground-default, foreground-hover}`, `--ch-color-action-tertiary-{foreground-default, foreground-hover, background-hover, background-pressed}`, `--ch-color-action-destructive-{background-default, background-pressed, foreground-default}`, `--ch-color-action-disabled-{background, foreground}`, `--ch-color-border-disabled`, `--ch-color-focus-{indicator, outer}`.
Dimensions (12): `--ch-size-control-height-{sm, md, lg}`, `--ch-space-component-{lg, xl}`, `--ch-space-gap-sm`, `--ch-radius-md`, `--ch-border-width-default`, `--ch-focus-width-{indicator, outer}`, `--ch-font-family-sans`, `--ch-font-weight-medium`.
Responsive (4): `--ch-font-size-label-{md, sm}`, `--ch-font-line-height-label-{md, sm}`.
Forbidden in Button CSS: primitives, `--ch-brand-*`, raw design values (exceptions: `transparent` for Tertiary rest/disabled fill, the two G5 underline values, `0`/`0px`, system colours in forced-colours mode). Implementation-private `--_btn-*` variables are allowed inside `button.css` only (§8).

## 5. Typography (per-property, ADR 0004)
`label/md` → `--ch-font-family-sans`, `--ch-font-weight-medium`, `--ch-font-size-label-md`, `--ch-font-line-height-label-md`; `label/sm` → same family/weight + `…-label-sm`. Letter spacing 0 %, case and decoration defaults: nothing emitted.

## 6. Accessibility requirements
- Native `<button>`, default `type="button"`; Enter/Space; no positive `tabindex`; visible label = accessible name; destructive meaning in the label.
- Native `disabled` only in v1 (removed from tab order; unavailability explained by surrounding content). Focusable unavailable actions revisited with a concrete use case.
- `:focus-visible` Chavosh rings; not clipped by `overflow: hidden` ancestors; not obscured (2.4.11).
- Text scaling: `min-height` + derived `padding-block`; labels wrap, never clip or truncate (1.4.4, 1.4.10, 1.4.12); 200 % text supported.
- Hover underline = non-colour signal. Pressed is a transient colour change only.
- **Forced colours (Decision 10):** `@media (forced-colors: active)` — every hierarchy gets a `ButtonText` boundary (§8.1); disabled uses `GrayText` for text and border; focus uses the outline (box-shadow is dropped by the browser); underline survives.
- **Target size:** md 48 and lg 56 exceed 44. **sm (40) is restricted and not production-ready where the effective 44×44 hit area is required** until `size/touch-target/min` is reachable (Decision 1; §7). No hard-coded 44px, no replacement token.
- Requires implementation-level and assistive-technology testing; Figma evidence and automated checks are not a WCAG 2.2 AA claim.

## 7. Decisions (29 Sep 2026) and open items
1. Touch target — principle 1a approved (`size/touch-target/min` is the source; never 44px raw); no extra manual export now; token pipeline stays on the 37-token closure; **open: reachability** (Figma cannot bind hit areas, so it is absent from the derived closure).
2. Fixed Figma height → `min-height`; `padding-block: calc((control height − label line height) / 2)` from existing tokens; no padding token.
3. Underline `1px` / `0.15em` — component CSS (G5 debt).
4. `type="button"` default.
5. Native `disabled` only.
6. No `fullWidth`; `inline-flex`.
7. Native attribute passthrough incl. `className`; no style-override props.
8. React 19, exact pin, ref as prop.
9. Button owns/imports `button.css`; `ch-tokens.css` is loaded once at the package/application entry; Button CSS uses only public tokens.
10. Forced-colours treatment for disabled with system colours.
11. ADR 0008, ADR 0009 and the layer-scope mechanism (ADR 0005) approved.
12. `box-sizing: border-box`; Secondary border counts toward final control dimensions. Figma stroke alignment is not captured by the exporter snapshot (documented, non-blocking).

Deferred: loading, spinner, icons, motion tokens, Icon system, Icon Button (+ Tooltip), typography composites, Text Style description audit (both label styles have empty descriptions), full 340-variable export, Storybook, Zeroheight, native platforms, Code Connect, WebKit/Firefox coverage.

## 8. Slice B implementation interpretations (approved 29 Sep 2026)
1. **Forced-colours boundary.** In `@media (forced-colors: active)` all hierarchies receive a `ButtonText` border (width `--ch-border-width-default`, padding compensated so the height is unchanged) so borderless hierarchies remain perceivable as controls. Accessibility adaptation only; the normal visual design is unchanged. Disabled keeps `GrayText`; the focus treatment is preserved.
2. **Secondary border inset.** `box-sizing: border-box`; Secondary padding (block and inline) is reduced by its border width so the outer control height equals the control-height token. The resulting 1px content inset relative to borderless hierarchies is accepted.
3. **Private `--_btn-*` variables.** Implementation-private CSS plumbing scoped to `button.css`; not design tokens, not public API, never documented as consumer tokens; values derived only from approved public `--ch-*` tokens (or the §4 keyword exceptions). Consumers must not depend on them.
4. **Cursor.** No cursor rule in Button v1; browser-native behaviour until the design system defines a cursor policy.
5. **sm.** The documented restriction stands; no invented or hard-coded 44×44 hit area.
6. **Packaging.** `@chavosh/react` is source-first for now; a distributable library build is addressed when package publishing/consumption is designed.
