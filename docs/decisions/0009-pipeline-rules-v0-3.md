# 0009 — Pipeline rules introduced in v0.3

**Status:** Accepted (29 Sep 2026)

1. **Unused web-policy rules are allowed.** Proof #2 failed on unused rules to keep its policy slice-exact. In production the policy records approved architecture (every rule cites its basis, e.g. decision 15); rules that match nothing in the current export are listed in the build report instead of failing. Unclassified or ambiguous tokens still fail.
2. **Dimension alias chains.** A non-primitive dimension that aliases another non-primitive dimension is refused (its web unit depends on its own rule). None exists in the architecture (dimensions alias primitives). Colour, font-family and font-weight values pass through unchanged when they alias an already-formatted token (e.g. semantic → Brand colour), because their formatting does not depend on the token path.
3. **Exporter preconditions.** The plugin refuses to run if `figma.skipInvisibleInstanceChildren` is true (hidden layers would be skipped) or if the component's page is not the current page (the plugin never switches pages). Remote library variables/styles are refused.
4. **Verification states.** `npm run verify` reports `PENDING` for a documented outstanding manual step (the canonical snapshot capture) instead of passing silently or failing the whole run; `npm run verify -- --strict` fails on PENDING. While PENDING, no production outputs may exist.
