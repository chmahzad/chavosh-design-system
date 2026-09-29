# 0005 — Export scope: component dependency closure

**Status:** Accepted (G4); layer-exclusion mechanism approved 29 Sep 2026. Validated on the canonical snapshot: 37-token closure = approved spec.

**Decision.** The exporter's roots are **components**, not hand-listed variables. Exporter v0.3 walks every variant of the Button component set (Figma node `20:2`, page *Components*), including hidden layers, and records every variable binding and text/effect style reference, then follows aliases across all modes (both brands, all breakpoints). The dependency list is derived from Figma, never typed by hand. The full 340-variable export is out of scope.

**Scope mechanism (approved).** The snapshot keeps *all* bindings as evidence. The converter applies the component's export scope from `export-config.json`: bindings on (or inside) excluded layers do not enter the export closure. Button v1 excludes `leading-icon`, `trailing-icon`, `spinner` (layer names confirmed by read-only inspection). Tokens bound only there (e.g. `size/icon/*`) are listed in the manifest as `excludedOnly`. A configured excluded layer that no longer exists fails the conversion.

**Cross-check.** After capture, the in-scope closure must equal the approved Button architecture (`tests/button-v1-spec.json`); any difference is reported as a Design/code mismatch for review.
