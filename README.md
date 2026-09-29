# Chavosh Financial Design System

A multi-brand (Financial · Invest), accessibility-first design system, built as a traceable design-to-code pipeline.

```
Figma variables & components
  → read-only exporter plugin (v0.3, manual run)        tools/figma-exporter/
  → private raw capture → sanitized public snapshot      packages/tokens/snapshots/figma/
  → DTCG token source                                    packages/tokens/generated/dtcg/
  → Style Dictionary 5.5.5 (handwritten web policy)
  → CSS custom properties                                packages/tokens/dist/ch-tokens.css
  → React components                                     packages/react/        (Button v1)
  → Storybook (coded-component reference)                .storybook/, *.stories.tsx
```

## Status (v0.3)
| Layer | Status |
|---|---|
| Token pipeline v0.3 (exporter, converter, CSS build, verification) | built · verified on test fixtures |
| Canonical Button snapshot → production `ch-tokens.css` | captured (manual run) · built · strict verification passes |
| React Button v1 (labels only) | implemented · verified (Chromium) · contract: `docs/decisions/0010-button-v1-implementation-mapping.md` |
| Storybook 10.6 (Button v1 docs + stories) | built locally · verified (static build, play functions, a11y addon) · not deployed |
| Documentation (Zeroheight) | upcoming |

## Principles in the pipeline
- **Figma is the source of design decisions; generated files are never edited.** Every output is rebuilt and compared in `npm run verify`.
- **Export scope is derived, not listed:** the exporter walks the Button component and follows its bindings (ADR 0005).
- **Layers:** primitives are build-time only; `--ch-brand-*` is an internal runtime layer; components use public semantic `--ch-*` tokens.
- **Brand at runtime:** Financial by default; `data-brand="invest"` on any ancestor, including nested contexts.
- **Web units by policy:** rem for scalable sizes, px for borders/focus, `9999px` pill radius, mobile-first breakpoints at 48rem / 64rem.
- **Accessibility-first:** WCAG 2.2 AA target; automated checks are evidence, not compliance claims.

## Commands (Node 22)
```
npm ci
npx playwright install chromium   # only if Chromium 141 is not already available
npm run bundle:exporter           # build the Figma plugin bundle
npm run build                     # bundle → convert → build:css
npm run verify                    # all checks
npm run verify -- --strict        # release gate: PENDING counts as failure
npm run storybook                 # Storybook dev server → http://localhost:6006
npm run build-storybook           # static Storybook → storybook-static/ (git-ignored)
```

## Storybook and Zeroheight
**Storybook** is the reference for *coded components*: it renders the real `@chavosh/react` components with the real
`ch-tokens.css`, shows the actual API (controls = props), browser states, keyboard behaviour and both brands (toolbar
**Brand** → `data-brand`), and its interaction and accessibility checks run in `npm run verify`. It is for engineers and
designers checking how the implementation behaves. It does not define design decisions and adds no tokens.

**Zeroheight** (upcoming) will hold the broader guidance — principles, content and usage guidance, patterns, and
design/Figma documentation — and link to Storybook for live component behaviour. The contract for each component stays
in `docs/decisions` (for Button: ADR 0010).

### Storybook toolchain notes (approved, Slice C)
- **`skipLibCheck: true`** (`packages/react/tsconfig.json`) is a toolchain compatibility workaround: TypeScript 7.0.2
  reports errors only inside third-party declaration files (Storybook, Vite, Vitest, react-docgen-typescript). Chavosh
  source stays under `strict` type checking, and the Button API compile-time contract (`check-react-types`, with its
  self-test) is unchanged. Remove it once upstream declarations are compatible with TypeScript 7.
- **Story testing** uses the repository's Playwright 1.56.1 against the static build (`tests/storybook/check-storybook.mjs`,
  part of `npm run verify`): build, runtime errors, play functions, a11y addon results, brand switching, state
  presentation and real-Button consumption. `@storybook/addon-vitest` / `@storybook/test-runner` are not used, so no
  Vitest or Jest is added for Storybook alone.
- The **States** story is a documentation-only simulation (pseudo-states addon on the real Button CSS); the Playground is
  the real interaction. Storybook telemetry is disabled (`.storybook/main.ts`).

## Provenance
The pipeline evolves two frozen design-to-code proofs kept in a separate archive repository: Proof #1 (multi-brand colour chain, tag `proof-1-closed`) and Proof #2 (dimension, responsive and effect tokens, tag `proof-2-closed`). See `docs/decisions/0002-token-pipeline-v0-3-lineage.md`.

Decisions: [`docs/decisions`](docs/decisions/README.md).
