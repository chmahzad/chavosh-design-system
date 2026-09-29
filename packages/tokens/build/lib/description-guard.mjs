// AUTHORED. Description guard — carried forward from Proof #2 (tag proof-2-closed; export architecture decision 18).
// Descriptions are copied VERBATIM from the Figma plugin snapshot (raw capture → public snapshot): never decoded, never normalised.
// Entity-encoded text (&#39; &quot; …) only ever appeared through an automation read route; if one of these known
// artefacts reaches a canonical snapshot, the extraction route/source must be investigated — the pipeline fails
// instead of guessing. Scoped to the five known artefacts only.

export const KNOWN_EXTRACTION_ARTEFACTS = ["&#39;", "&quot;", "&amp;", "&lt;", "&gt;"];

export function findDescriptionArtefacts(snapshot) {
  const found = [];
  const check = (where, text) => {
    if (typeof text !== "string") return;
    for (const a of KNOWN_EXTRACTION_ARTEFACTS) if (text.includes(a)) found.push({ where, artefact: a });
  };
  for (const v of snapshot.variables || []) check(`variable ${v.name} (${v.id})`, v.description);
  for (const kind of ["effect", "text"]) for (const s of (snapshot.styles && snapshot.styles[kind]) || []) check(`${kind} style ${s.name} (${s.id})`, s.description);
  for (const c of snapshot.components || []) check(`component ${c.name} (${c.nodeId})`, c.description);
  return found;
}

export function assertNoDescriptionArtefacts(snapshot, label = "snapshot") {
  const found = findDescriptionArtefacts(snapshot);
  if (found.length) {
    const list = found.map((f) => `${f.where}: ${f.artefact}`).join("; ");
    throw new Error(
      `${label}: description contains known extraction artefact(s) — ${list}. Descriptions are copied verbatim and are not decoded; ` +
        "investigate the extraction route/source (canonical snapshots must come from a manual Figma plugin run).",
    );
  }
}
