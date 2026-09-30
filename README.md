# Chavosh Financial Design System

A multi-brand financial design system exploring scalable token architecture, accessible components and a verifiable
design-to-code workflow.

**Storybook:** coming soon · **Case study:** coming soon

## About the project

Chavosh Financial Design System is a **self-directed portfolio project**. Chavosh Financial is a **fictional
financial-services ecosystem** with two brands, **Financial** and **Invest**. They are used to explore how one design
system can serve several brands without duplicating its components, and how design decisions made in Figma can reach
production code without being re-typed or lost on the way.

## My role

**Mahzad Chavoshi — Product / Design System Designer**

I defined:
- the design-system architecture and its layers;
- the token model, naming and multi-brand theming;
- component specifications: anatomy, variants, states and behaviour;
- accessibility criteria, targeting WCAG 2.2 AA;
- responsive behaviour and breakpoints;
- governance and the design-to-code contract, recorded as [decision records](docs/decisions/README.md).

## The challenge

Financial products need consistent, trustworthy and accessible interfaces across brands and platforms. Two things
make that hard to scale:
- **Brands multiply work.** Without a clear separation between brand values and design intent, every new brand
  risks a forked component library.
- **Design and code drift.** Values copied by hand from design files diverge silently, and nobody can say which
  decision a CSS value came from.

The goals of this system are a layered token architecture where brands change *values* but never *components*, and a
pipeline in which every production value can be traced back to a Figma variable and re-verified automatically.

## System architecture

```
Primitive       →  Brand              →  Semantic                                  →  Component
color.navy.800     brand.primary.800     color.action.primary.background.default      Button
```

- **Primitive** — raw, intentional scales (colour, space, radius, type). Build-time only; never used by components.
- **Brand** — each brand maps its roles to primitives (Financial → navy, Invest → violet). This is an internal
  runtime layer.
- **Semantic** — design intent (`action`, `border`, `focus`, `space`, `size`…): the public tokens (`--ch-*`) that
  components consume.
- **Component** — components use semantic tokens directly. Component-level tokens are added only when a semantic
  token cannot express the decision; Button v1 needs none.

**Financial / Invest theming.** Financial is the default. Setting `data-brand="invest"` on any element re-themes
everything inside it, including nested brand contexts, through CSS custom properties only. There is no brand logic in
components.

## Accessibility

Accessibility is part of each component's specification, not a final audit. The target is **WCAG 2.2 AA**.

**Automated checks** (Chromium) cover:
- keyboard operation and visible focus (`:focus-visible`);
- forced-colours mode;
- 200 % text and 320 px reflow without clipping;
- touch devices without hover;
- per-state token colours in both brands;
- axe-core checks in Storybook.

**Still required:**
- screen-reader testing (for example VoiceOver and NVDA);
- manual zoom and device testing;
- WebKit and Firefox coverage.

Automated results are evidence, not a WCAG certification or conformance claim.

## Design-to-code

```
Figma → Public Snapshot → DTCG → Style Dictionary → CSS Custom Properties → React → Storybook
```

1. A read-only Figma plugin captures each component (one capture per component) and every variable it depends on.
2. The raw capture is kept **private** as the root of trust. A deterministic sanitizer removes Figma file and library
   keys and produces the **public snapshot** this repository builds from. Its provenance records the raw capture's
   SHA-256 ([ADR 0011](docs/decisions/0011-public-snapshot-and-identifier-minimisation.md)).
3. The snapshot is converted to Design Tokens Community Group (**DTCG**) format. Style Dictionary then applies a
   handwritten web policy (rem units, colour format, font stacks, mobile-first breakpoints at 48rem / 64rem) and emits
   one stylesheet, `ch-tokens.css`.
4. React components use only the public CSS custom properties, and Storybook documents the real components with the
   real tokens.

## Current implementation

**Button v1** (labels only):
- hierarchies: **Primary, Secondary, Tertiary, Destructive**;
- sizes: **sm / md / lg**;
- brands: **Financial / Invest**;
- a **37-token closure** derived from the Figma component's bindings. The pipeline exports only what the component
  actually uses;
- states: hover (underline, for hover-capable pointers), pressed, focus-visible and disabled;
- behaviour: labels wrap and scale with text size;
- a forced-colours treatment;
- native `<button>` semantics, with `type="button"` by default;
- **Storybook** documentation: docs page, playground, states, brand comparison, keyboard and long-label stories.

**Size `sm` is restricted:** its effective 44 × 44 px target is not yet implemented, so it is not production-ready
where that target is required. `md` and `lg` exceed 44 px.

**Link v1** (standalone, labels only):
- native `<a href>` navigation, sizes **md / sm** (`label/md`, `label/sm`);
- a **15-token closure** from its own Figma capture; together with Button, the stylesheet publishes **42 public tokens**;
- always underlined (1px, 2px on hover), 44 px minimum target, focus-visible rings, forced-colours treatment;
- Financial / Invest through `data-brand` only;
- **Storybook** documentation: docs page, playground, sizes, states, brand comparison, examples, keyboard and
  long-label stories. Inline links are a documented recipe, not a component.

Not yet included: loading, icons, Checkbox, Radio, Switch, Text Field (captured, not yet released), Select, full token
export, native platforms.

## Verification

`npm run verify -- --strict` runs 17 check groups on every build:
- the read-only exporter never writes to Figma;
- the sanitizer changes nothing but the approved identifiers;
- generated tokens and CSS are fresh, deterministic and never hand-edited;
- each released component's token closure matches its approved specification, and captures are mutually consistent;
- components use only public tokens; Button is frozen against a regression baseline;
- Chromium tests cover every Button hierarchy × size × state × brand and every Link size × state × brand;
- the Storybook static build, interaction tests and accessibility checks pass.

The same verification runs in CI on every push.

## AI-assisted implementation

The design-system architecture, token model, component specifications, accessibility criteria and design decisions
were defined by Mahzad Chavoshi. AI-assisted development was used to support implementation, pipeline automation,
testing and technical validation.

## Run locally

Requires Node 22.

```
npm ci
npx playwright install chromium   # browser for the verification checks
npm run build                     # snapshot → DTCG → CSS
npm run verify -- --strict        # all checks
npm run storybook                 # Storybook at http://localhost:6006
npm run build-storybook           # static Storybook → storybook-static/
```

## Repository structure

| Path | Contents |
|---|---|
| `tools/figma-exporter/` | read-only Figma plugin that captures a component and its variables |
| `packages/tokens/` | public snapshot, sanitizer, DTCG conversion, Style Dictionary build, `dist/ch-tokens.css` |
| `packages/react/` | React components (Button v1, Link v1) and their tests |
| `.storybook/`, `*.stories.tsx`, `*.mdx` | Storybook configuration and component documentation |
| `docs/decisions/` | architecture decision records |
| `scripts/verify.mjs`, `tests/` | verification entry point and Storybook checks |

## License

[MIT](LICENSE) © 2026 Mahzad Chavoshi.

Chavosh Financial is a fictional brand created for this portfolio. Its name and visual identity are presented as
portfolio and design-system material. They do not represent, and are not endorsed by, any real financial institution.
