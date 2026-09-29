# 0003 — Colour output format

**Status:** Accepted (G2, 29 Sep 2026)

**Decision.** Web output: alpha = 1 → lowercase `#rrggbb` (as Proof #1); alpha < 1 → modern `rgb(R G B / A%)` (as Proof #2, e.g. `rgb(27 34 44 / 12%)`). Channels are `round(component × 255)`; alpha percentage keeps up to two decimals. DTCG keeps the raw sRGB object (components, alpha, derived hex) — formatting is web policy only.

**Checks.** The derived hex must agree with the components; out-of-range components or alpha fail. Tests cover both branches (`tests/check-units.mjs`, `tests/check-css.mjs`, Chromium in `tests/check-render.mjs`).
