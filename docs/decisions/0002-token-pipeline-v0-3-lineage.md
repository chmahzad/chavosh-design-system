# 0002 — Token pipeline v0.3 lineage

**Status:** Accepted (29 Sep 2026)

Token pipeline v0.3 is production code copied and evolved from the two frozen proofs. It has no runtime or build dependency on the proof archive.

| Behaviour | Origin | v0.3 location |
|---|---|---|
| Read-only Figma plugin, getters only, static scan + write-throwing mock + call allow-list | Proof #1 (v0.1), Proof #2 (v0.2) | `tools/figma-exporter/` (v0.3) |
| Canonical snapshot from a **manual** plugin run, byte-identical, SHA-256 provenance gate | Proof #2 | `packages/tokens/snapshots/figma/`, `build/convert-snapshot.mjs` |
| Brand mode sets, `brandDependent` semantics, internal `--ch-brand-*` layer | Proof #1 | converter + `build/build-css.mjs` |
| Semantic re-declaration on `:root, [data-brand]` so page-level and nested brand contexts re-resolve | Proof #1 (verified in Chromium) | `build/build-css.mjs` |
| Aliases kept as DTCG references; dimension objects `{value, unit:"px"}`; every Figma mode kept | Proof #2 | converter |
| Verbatim descriptions + known-artefact guard (never decode) | Proof #2 (decision 18) | `build/lib/description-guard.mjs` |
| Handwritten web unit policy; no built-in transform groups; policy check before Style Dictionary; SD warnings as errors; post-build validation vs an SD-independent expectation | Proof #2 | `source/web-policy.json`, `build/build-css.mjs` |
| Primitives source-only; mobile-first output at 48rem / 64rem with deduplicated overrides; live shadow colour reference | Proof #2 | `build/build-css.mjs` |
| Deterministic outputs; generated-file freshness and stale-file detection | Proof #1 + #2 | `tests/check-generated.mjs`, `tests/check-production.mjs` |

New in v0.3: component-rooted closure (ADR 0005), colour rule (ADR 0003), font typing (ADR 0004), brand-scoped composites (ADR 0008), unified brand + responsive output in one stylesheet.
