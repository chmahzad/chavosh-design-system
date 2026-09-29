# 0001 — Production repository and proof archive

**Status:** Accepted (G1, 29 Sep 2026)

**Context.** The proof repository's root *is* Proof #1, and Proof #2 enforces that nothing changes outside `proof-2/`. A production layer inside it would either break Proof #2's verification or require restructuring frozen work.

**Decision.** `chavosh-design-system` is a new, independent production repository/workspace. The proof repository remains unchanged as the design-to-code proof archive (Proof #1 `427a79d` / `proof-1-closed`; Proof #2 `40b5293` / `proof-2-closed`). Production code may copy and evolve proof code with provenance (ADR 0002) but never imports from, links to, or modifies the archive.

**Consequences.** Two repositories; the production README is the portfolio entry point and cites the proof tags as evidence. Nothing is pushed until a remote is configured and approved.
