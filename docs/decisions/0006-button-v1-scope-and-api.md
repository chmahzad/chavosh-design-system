# 0006 — Button v1 scope, API and implementation debt

**Status:** Accepted (G5, G6, G8, 29 Sep 2026). Button itself is not implemented in this stage.

- **Scope (G6):** labels only. No icons, spinner, loading or motion tokens — a later Button enhancement.
- **API (G8, refined by ADR 0010):** `hierarchy` (primary · secondary · tertiary · destructive), `size` (sm · md · lg; **sm is restricted** — dense desktop/tablet only, documented), native `disabled` only (the optional `aria-disabled` behaviour is **not** part of v1 — ADR 0010 decision 5), `type` default `"button"`. No `href`, no polymorphic `as` — navigation uses Link.
- **States** are CSS, not props: hover (underline under `@media (hover: hover)`), pressed (`:active`), `:focus-visible` rings.
- **Implementation debt (G5):** hover-underline `text-decoration-thickness: 1px` and `text-underline-offset: 0.15em` (ADR 0010 decision 3) are component-level CSS decisions in Button v1 (Figma represents the underline as a raw 1px layer). No Figma tokens are created for them now; revisit when a second underline consumer (e.g. Link) needs the same decision.
