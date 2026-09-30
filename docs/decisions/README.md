# Decision records

Short records of the architecture decisions behind the Chavosh Financial Design System. The underlying architecture
specifications (`chavosh-token-export-architecture.md`, `chavosh-button-architecture.md`) and the two earlier
design-to-code proofs (Proof #1, Proof #2) are kept in a separate private archive; references to them below are for
lineage. Labels such as G1–G8 identify the original architecture decisions each record implements.

| # | Decision | Status |
|---|---|---|
| [0001](0001-production-repository.md) | New production repository; proofs stay a frozen archive | Accepted (G1) |
| [0002](0002-token-pipeline-v0-3-lineage.md) | Token pipeline v0.3 evolved from Proof #1 + Proof #2 (copied, not depended on) | Accepted |
| [0003](0003-colour-output.md) | Opaque colour → hex; translucent → `rgb(R G B / A%)` | Accepted (G2) |
| [0004](0004-typography-v1.md) | Per-property typography tokens; DTCG `fontFamily` / `fontWeight` | Accepted (G3) |
| [0005](0005-component-closure-export.md) | Export = Button dependency closure derived from Figma bindings | Accepted (G4; scope mechanism approved 29 Sep 2026) |
| [0006](0006-button-v1-scope-and-api.md) | Button v1: labels only, API, implementation debt | Accepted (G5, G6, G8); refined by 0010 |
| [0007](0007-technology.md) | React, TypeScript, Vite, plain CSS, Node 22, exact pins | Accepted (G7) |
| [0008](0008-brand-scoped-composites.md) | Composite tokens that reference brand-dependent tokens are re-declared in brand scopes | Accepted (29 Sep 2026) |
| [0009](0009-pipeline-rules-v0-3.md) | v0.3 pipeline rules: unused policy rules, alias chains, exporter preconditions, PENDING state | Accepted (29 Sep 2026) |
| [0010](0010-button-v1-implementation-mapping.md) | Button v1 implementation mapping — API, states, tokens, accessibility, decisions 1–12 | **Accepted — frozen for React Button v1** |
| [0011](0011-public-snapshot-and-identifier-minimisation.md) | Private raw capture → deterministic sanitizer → public snapshot; Figma file/library keys never published | Accepted (29 Sep 2026) |
| [0012](0012-component-expansion-captures-and-button-baseline.md) | Per-component captures (Button frozen), cross-capture consistency, per-component contracts, Button regression baseline | Accepted (30 Sep 2026) |
| [0013](0013-link-v1-implementation-mapping.md) | Link v1 implementation mapping; staged (recorded, unreleased) captures; Button token-check amendment | Accepted (30 Sep 2026) |
