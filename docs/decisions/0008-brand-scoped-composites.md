# 0008 — Brand-scoped composites

**Status:** Accepted (29 Sep 2026)

**Context.** Proof #2 recorded that `var()` inside a composite custom property is substituted where that property is declared: overriding a colour in a nested scope does not reach a composite declared on `:root`. Proof #1's brand runtime re-declares brand-dependent semantic tokens on `:root, [data-brand]` for exactly this reason.

**Proposal.** Generalise the rule: any public token whose emitted value references a brand-scoped token (directly or transitively) — e.g. a shadow bound to a brand-dependent colour — is emitted in the `:root, [data-brand]` block too, so nested brand contexts re-resolve it. Implemented and tested in v0.3 (`tests/check-css.mjs`; Chromium in `tests/check-render.mjs`). Button v1 has no shadow, so the rule does not change Button output; it applies to future overlays.

**Alternative.** Forbid composites from referencing brand-dependent colours. Rejected unless you prefer it: it constrains design choices for a purely technical reason.
