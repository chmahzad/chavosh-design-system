# 0013 — Link v1 implementation mapping; staged captures; Button check amendment

**Status:** Accepted (30 Sep 2026) — approved by the designer with the M1 commit, including the Button baseline amendment (§5) and staged captures (§4). Extends ADR 0012. Source of design
decisions: `chavosh-link-architecture.md` (approved 29 Sep 2026); this ADR records only how they are implemented.

## 1. Evidence
- Canonical Link capture: exporter plugin v0.4.0 (extractor v0.3.0), 30 Sep 2026, node `34:944`, 6 variants,
  128 bindings, 38 variables. Raw capture private (SHA-256 `aea3ff36…`); public snapshot
  `packages/tokens/snapshots/figma/chavosh-link.snapshot.public.json`.
- Export scope `link-v1-labels-only`: the `leading-icon` and `trailing-icon` layers are excluded (labels only). The
  Figma-only underline layer stays in scope — it binds the same link colours the production underline uses.
- Closure = contract `packages/tokens/tests/link-v1-spec.json` (15 tokens, text styles `label/md`, `label/sm`):
  `color/text/link/default|hover`, `color/focus/indicator|outer`, `focus/width/indicator|outer`,
  `size/touch-target/min`, `space/gap/xs`, `radius/sm`, `font/family/sans`, `font/weight/medium`,
  `font/size/label/md|sm`, `font/line-height/label/md|sm`. **No new tokens.** Five of them were not yet public
  (`color/text/link/default|hover`, `radius/sm`, `size/touch-target/min`, `space/gap/xs`); the public surface grows
  from 37 to 42. Button's 53 declarations are unchanged.

## 2. API
`<Link href size? children ref? …nativeAnchorAttributes>` — `href: string` and `children` (the visible label and
accessible name) are required; `size: "md" | "sm"` (default `"md"`). Native anchor attributes and `ref` pass through.
Excluded (compile-time contract `packages/react/tests/types/link-api.tsx`): `disabled`, `as`, `asChild`, icons,
`visited`, hierarchy/variant, current-page state, state props.

## 3. Rendering and state mapping
| State | Colour (text + underline) | Underline | Focus ring |
|---|---|---|---|
| Default | `color/text/link/default` | 1px | — |
| Hover (`@media (hover: hover)`) | `color/text/link/hover` | 2px | — |
| Focus-visible | `color/text/link/default` (hover colour when also hovered) | kept | 3px `focus/indicator` outline + 2px `focus/outer` ring (Button technique) |
| Pressed | no separate signal | — | — |

- Native `<a href class="ch-link" data-size>`; no role, no tabindex. Keyboard: Tab, Enter activates, Space does not.
- `display: inline-flex; align-items: center; gap: space/gap/xs; min-height: size/touch-target/min; padding: 0`.
  The Figma 44px container is the interactive target, so production uses `min-height`: wrapped labels and larger text
  grow the link. `radius/sm` shapes the focus ring only (no fill). `gap` has no visible effect without icons; it is
  kept so the anatomy matches Figma when icons arrive.
- Typography: `label/md` (md) or `label/sm` (sm) via the font tokens.
- Underline: native `text-decoration` in `currentColor`, `text-underline-offset: 0.15em`,
  `text-decoration-skip-ink: auto`. Thickness 1px at rest, 2px on hover. These are the **approved component-level
  constants** (Link architecture §3–4, expansion decisions) — not tokens; Figma cannot show the 2px hover underline.
- Hover applies only to hover-capable pointers (same rule as Button), so touch devices get no sticky hover.
- `:visited` is not styled (v1); the authored colour applies to visited links too.
- Forced colours: `LinkText` for text and underline, underline kept; focus outline `Highlight` (Button technique).
- Brand: none in the component; `data-brand` on any ancestor switches the link colours through the semantic → brand
  aliases. Focus colours are brand-independent.

## 4. Pipeline: staged captures
The five canonical captures of 30 Sep 2026 are all recorded now (raw private, capture records private, public
snapshots + provenance committed). Only released components enter the build:
- `export-config.publicSnapshots` = Button, Link (built; closure = contract; public CSS surface = union of contracts);
- `export-config.stagedSnapshots` = Text Field, Checkbox, Radio, Switch — they pass the same provenance gate, their roots
  must equal the exporter capture targets, and they must be consistent with the released captures (`mergeSnapshots`
  over all six), but they produce no DTCG or CSS. Each moves to `publicSnapshots` in its own milestone.
- Fixture checks (`check-dtcg`, `check-css`, `check-render`, `check-generated`) now use the real policy restricted to
  the fixture's component (`fixtureConfig`), because the real config now also names production-only components.
- `check-production-render` derives its expected colour set from the released contracts instead of a hard-coded
  Button count, and adds the Link dimensions.

## 5. Button regression baseline amendment
`packages/react/tests/check-react-tokens.mjs` (a frozen Button file) asserted that button.css consumes *every* public
token in the stylesheet ("the whole 37-token closure"). ADR 0012 lets later components add tokens, so that one assertion
now compares button.css with Button's approved contract (`button-v1-spec.json`) — still exactly 37 tokens, all public.
Nothing else in the file changed; Button's source, CSS, stories, docs, harness and other checks are byte-identical, and
its 53 CSS declarations are unchanged. The baseline records the new hash with an `amendments` entry pointing to this
ADR, and `check-button-baseline` validates the amendment.

## 6. Verification added
`check-link-tokens` (static discipline; closure = contract; types self-test) and `check-link-browser` (Chromium: 34
state checks across sizes, states and four brand contexts plus page-level brand; keyboard; wrapping; 200 % text;
320px reflow; hover-incapable devices; forced colours). Storybook: 7 Link stories and a docs page, checked by
`check-storybook` (play functions, a11y addon, brand toolbar, pseudo-states). Automated results are evidence, not a WCAG
conformance claim; screen-reader (VoiceOver/NVDA/TalkBack) and manual testing remain required.

## 7. Debt
- Underline thickness and offset are component-level constants (shared with Button's hover underline) — candidate
  tokens for a later Foundations review.
- Icons (leading/trailing, external-link) wait for the Icon system; `size/icon/*` stays out of the closure.
- Inverse link colour for dark/brand surfaces is a future token gap (Link architecture §5).
