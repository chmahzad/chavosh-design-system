# 0004 — Typography v1: per-property tokens and font typing

**Status:** Accepted (G3, 29 Sep 2026)

**Decision.**
- No typography composites in v1. Components set `font-family`, `font-weight`, `font-size` and `line-height` from individual public tokens. Text styles (e.g. `label/md`) are validated and recorded in the DTCG manifest (`traceability.textStyles`: style → per-property tokens) — nothing is emitted for them.
- Smallest standards-aligned DTCG typing:
  - `font/family/*` (Figma STRING) → `$type: "fontFamily"`, `$value` = the Figma string verbatim (e.g. `"Inter"`). The web fallback stack is **platform policy**, not token data: `web-policy.json` maps `Inter` → `Inter, system-ui, sans-serif` (export architecture decision 9). An unknown family fails the build.
  - `font/weight/*` (Figma FLOAT) → `$type: "fontWeight"`, `$value` = integer 1–1000; CSS output is the number (e.g. `500`).
- Letter spacing, text case and decoration stay in the Figma text style (recorded as unbound properties); Button labels use 0 letter spacing, so v1 needs no letter-spacing token.

**Deferred.** Typography composites; `layout/columns` typing.
