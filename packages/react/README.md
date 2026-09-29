# @chavosh/react

Production React components of the Chavosh Financial Design System. **Current scope: Button v1 (labels only).**
Detailed implementation contract: [`docs/decisions/0010-button-v1-implementation-mapping.md`](../../docs/decisions/0010-button-v1-implementation-mapping.md) (frozen). This README does not repeat it.

Stack: React 19.3.0 · TypeScript 7.0.2 (strict) · plain CSS · Vite 8.3.1 (bundling) — exact pins, npm workspaces, Node 22.

## Consumption (inside the workspace)
Load the generated token stylesheet **once** at the application entry, then use components. Each component imports its own CSS.
```tsx
import "@chavosh/tokens/ch-tokens.css"; // once, at the entry
import { Button } from "@chavosh/react";
```
The package is source-first (`exports: "./src/index.ts"`) and expects a bundler that handles TSX and CSS imports (Vite). A published library build is not part of v1.

## Button
```tsx
<Button onClick={save}>Save changes</Button>
<Button hierarchy="secondary" size="lg">Review</Button>
<Button hierarchy="tertiary">Cancel</Button>
<Button hierarchy="destructive">Delete transaction</Button>
<Button type="submit" form="payment">Pay now</Button>
<Button disabled>Continue</Button>
```

| Prop | Values | Default |
|---|---|---|
| `hierarchy` | `"primary"` · `"secondary"` · `"tertiary"` · `"destructive"` | `"primary"` (one per view) |
| `size` | `"sm"` · `"md"` · `"lg"` | `"md"` |
| `type` | `"button"` · `"submit"` · `"reset"` | `"button"` — never an accidental form submit |
| `disabled` | native boolean | `false` |
| `children` | the visible label = accessible name | — |
| `ref` | `Ref<HTMLButtonElement>` (React 19 ref-as-prop) | — |
| native attributes | `onClick`, `form`, `name`, `value`, `id`, `className`, `aria-*`, `data-*`, … | — |

Not part of Button v1: `loading`, spinner, `leadingIcon` / `trailingIcon` (a later enhancement), `href` / `as` (navigation → Link), `fullWidth` (width is a layout concern; Button is `inline-flex`), hover/pressed/focus props (browser states), token-override props. `style` exists only as a native attribute — do not use it (or `className`) to override design-system visual properties with raw values.

### Sizes
| Size | Min height | Label | Status |
|---|---|---|---|
| `lg` | `size/control/height/lg` | `label/md` | production-ready |
| `md` | `size/control/height/md` | `label/md` | production-ready (default) |
| `sm` | `size/control/height/sm` | `label/sm` | **RESTRICTED** — dense Desktop/Tablet data contexts only. The effective 44×44 target is **not implemented**: `size/touch-target/min` is not reachable from the canonical Button closure. Do not use `sm` where that target is required. |

Heights are minimums: vertical padding is derived from the control height and label line height, so labels wrap (never clip or truncate) and scale with text size.

### States (CSS, not props)
- **Hover** (hover-capable pointers only, `@media (hover: hover)`): label underline in the label colour; background unchanged — Tertiary also shows its subtle hover background.
- **Pressed** (`:active`): pressed colours, no underline; wins over hover.
- **Focus** (`:focus-visible`, keyboard): Chavosh focus treatment — 3px indicator + 2px outer ring; can coexist with hover.
- **Disabled** (native `disabled`): disabled colours; no hover, no pressed, never underlined; removed from the tab order.

### Brand
No brand logic in the component. Financial is the default; `data-brand="invest"` on any ancestor switches it, including nested Financial/Invest contexts — through CSS custom properties only.

### Accessibility behaviour
Native `<button>` (no role emulation); Enter and Space activate; visible label is the accessible name (put destructive meaning in the label, not in colour); keyboard focus is always visible, including in forced-colours mode (outline, system colours; disabled uses `GrayText`); labels wrap at 200 % text and 320px width. Automated checks are evidence, not a WCAG 2.2 AA conformance claim — screen-reader and manual testing remain required. Native `disabled` only in v1; focusable unavailable actions (`aria-disabled`) will be designed when a product case needs them.

## Storybook
`npm run storybook` (repository root) opens the Button documentation and stories at http://localhost:6006:
Playground (controls = the real props), Hierarchies, Sizes, States, Brand comparison, Long label, Disabled, Keyboard.
Stories sit next to the component (`src/Button/Button.stories.tsx`, `Button.mdx`) and must use only the real API.

## Verification
`npm run verify -- --strict` (repository root) includes three React groups: `check-react-types` (strict TypeScript + compile-time API contract), `check-react-tokens` (button.css uses only the 37 public Button tokens; no primitives, brand variables or raw values) and `check-react-browser` (Chromium: every hierarchy × size × state × brand, nested brands, keyboard, wrapping, 200 % text, hover-incapable devices, forced colours). `tests/storybook/check-storybook.mjs` additionally builds Storybook and runs every story's play function and the a11y addon.

## Toolchain notes
- **`skipLibCheck: true`** (`tsconfig.json`) is a toolchain compatibility workaround: TypeScript 7.0.2 reports errors
  only inside third-party declaration files (Storybook, Vite, Vitest, react-docgen-typescript). Chavosh source stays
  under `strict` type checking, and the Button API compile-time contract (`check-react-types`, with its self-test) is
  unchanged. Remove it once upstream declarations are compatible with TypeScript 7.
- **Story testing** uses the repository's Playwright against the static Storybook build
  (`tests/storybook/check-storybook.mjs`): build, runtime errors, play functions, accessibility addon results, brand
  switching, state presentation and real-Button consumption. No Vitest or Jest is added for Storybook alone.
- The **States** story is a documentation-only simulation (pseudo-states addon on the real Button CSS); the Playground
  is the real interaction. Storybook telemetry is disabled.
