# 0012 — Component expansion: per-component captures, cross-capture consistency, Button baseline

**Status:** Accepted (30 Sep 2026). Extends ADR 0005 (component-rooted closure) and ADR 0011 (public snapshot).

**Context.** Button was captured and released alone. The next components (Link, Text Field, Checkbox, Radio, Switch) share many tokens with Button and with each other. A capture is the only evidence of a component's dependency closure, and Button is now the published reference implementation.

**Decision.**
1. **Per-component canonical captures.**
   - Each component has its own raw capture, its own sanitized public snapshot and its own provenance (ADR 0011).
   - `export-config.json` lists them in `publicSnapshots`; each entry names exactly the components it contains.
   - The **Button capture (29 Sep 2026) is frozen** and never re-captured to add another component.
2. **One capture run, separate files.**
   - Exporter plugin **v0.4.0** runs the unchanged extractor v0.3.0 once per capture target (`CHAVOSH_CAPTURE_TARGETS` in `tools/figma-exporter/code.js`: Link 34:944, Text Field 42:745, Checkbox 52:1034, Radio 56:1281, Switch 63:1411).
   - It offers one raw file per component. A failing target is reported on its own; it never contaminates another capture.
   - Button is not a target.
3. **Cross-capture consistency.**
   - Before conversion, `mergeSnapshots` unions the captures.
   - Any variable, collection or style that appears in several captures must be identical everywhere: name, collection, type, description, scopes, code syntax, and every mode's value or alias.
   - Refused: any divergence, a name with two IDs, a component present in two captures, and captures from different files, schemas or sanitizer versions.
   - The fix is a new capture, never a silent choice.
4. **Contracts per component.**
   - Each configured component names its approved contract (`components.<name>.contract`).
   - Its derived closure must equal that contract.
   - The public CSS surface must equal the union of the released contracts.
5. **Button regression baseline.** `packages/react/tests/baseline/button-v1.baseline.json` (recorded from `e509d35`) and `check-button-baseline` freeze:
   - Button's source, CSS, stories, docs, verification files, contract and ADR 0010 (byte-identical);
   - the resolved CSS of its 37 public tokens plus the 16 internal brand declarations they reference.

   Later components may add tokens but may not change, remove or add overrides for Button's.
6. **Raw re-derivation.** `CHAVOSH_RAW_SNAPSHOT` may point to one raw file or a directory. Every raw capture found there (matched by its attested SHA-256) is re-derived byte-for-byte. It remains optional; public verification never needs private files.

**Consequences.**
- `_manifest.json` records `snapshots[]`.
- The `ch-tokens.css` header lists every snapshot; token values are unaffected.
- New components start in `export-config` only when their capture exists.
- Unbuilt Figma components (Select, Listbox, Listbox Option) are not capture targets.
