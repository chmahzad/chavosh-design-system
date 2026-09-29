# Chavosh Financial Design System

A multi-brand (Financial · Invest), accessibility-first design system, built as a traceable design-to-code pipeline.

```
Figma variables & components
  → read-only exporter plugin (v0.3, manual run)        tools/figma-exporter/
  → private raw capture → sanitized public snapshot      packages/tokens/snapshots/figma/
  → DTCG token source                                    packages/tokens/generated/dtcg/
  → Style Dictionary 5.5.5 (handwritten web policy)
  → CSS custom properties                                packages/tokens/dist/ch-tokens.css
  → React components                                     packages/react/        (upcoming)
  → Storybook                                                                   (upcoming)
```

## Status (v0.3)
| Layer | Status |
|---|---|
| Token pipeline v0.3 (exporter, converter, CSS build, verification) | built · verified on test fixtures |
| Canonical Button snapshot → production `ch-tokens.css` | captured (manual run) · built · strict verification passes |
| React Button v1 (labels only) | upcoming — frozen mapping: `docs/decisions/0010-button-v1-implementation-mapping.md` |
| Storybook | upcoming |
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
```

## Provenance
The pipeline evolves two frozen design-to-code proofs kept in a separate archive repository: Proof #1 (multi-brand colour chain, tag `proof-1-closed`) and Proof #2 (dimension, responsive and effect tokens, tag `proof-2-closed`). See `docs/decisions/0002-token-pipeline-v0-3-lineage.md`.

Decisions: [`docs/decisions`](docs/decisions/README.md).
