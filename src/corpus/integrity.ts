import type { Corpus } from "./types.js";

export interface DanglingCitation {
  documentId: string;
  /** The section or part named by the citation, e.g. "130.31" or "LQSS XIII". */
  reference: string;
  line: number;
}

export interface IntegrityReport {
  ok: boolean;
  dangling: DanglingCitation[];
  /** Parts present in the LQSS, in source order — a gap here is worth knowing about. */
  lqssParts: string[];
  part130Sections: string[];
}

const PART_130 = "part-130-cannabis-laboratories";
const LQSS = "laboratory-quality-system-standards-2-9-26";

/**
 * Suite B. Cross-checks every regulatory citation appearing in any corpus document
 * against the section or part it names.
 *
 * This is the only check that detects two official documents contradicting each
 * other. The gate stops fabricated quotations and residency stops missed documents;
 * neither notices that a checklist cites a section its own regulation lacks.
 */
export function checkIntegrity(corpus: Corpus): IntegrityReport {
  const part130 = corpus.documents.find((d) => d.documentId === PART_130);
  const lqss = corpus.documents.find((d) => d.documentId === LQSS);

  // A section exists when the regulation declares it as a heading in its body — not
  // merely because the number appears somewhere. Deriving from any substring would
  // let a passing mention of a section mask the fact that it was never enacted.
  // A heading may sit immediately after a form feed, so `^` alone is not enough.
  const sections = new Set(
    [...body(part130).matchAll(/^[\f\t ]*§\s*130\.(\d+)\s/gm)].map((m) => m[1]!),
  );
  const parts = new Set(
    [...body(lqss).matchAll(/^[\f\t ]*([IVXL]{1,5})\.\s+[A-Z]/gm)].map((m) => m[1]!),
  );

  const dangling: DanglingCitation[] = [];
  for (const document of corpus.documents) {
    if (document.documentId === PART_130) continue;
    for (const match of document.text.matchAll(/130\.(\d+)/g)) {
      if (sections.size > 0 && !sections.has(match[1]!)) {
        dangling.push({
          documentId: document.documentId,
          reference: `130.${match[1]}`,
          line: lineOf(document.text, match.index!),
        });
      }
    }
    if (document.documentId === LQSS) continue;
    for (const match of document.text.matchAll(/LQSS,?\s*([IVXL]{1,5})\b/g)) {
      if (parts.size > 0 && !parts.has(match[1]!)) {
        dangling.push({
          documentId: document.documentId,
          reference: `LQSS ${match[1]}`,
          line: lineOf(document.text, match.index!),
        });
      }
    }
  }

  return {
    ok: dangling.length === 0,
    dangling: dedupe(dangling),
    lqssParts: [...parts],
    part130Sections: [...sections],
  };
}

/** Everything after the contents region, where a document actually says things. */
function body(document: { text: string; tocEnd: number } | undefined): string {
  return document ? document.text.slice(document.tocEnd) : "";
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === "\n") line++;
  return line;
}

function dedupe(items: DanglingCitation[]): DanglingCitation[] {
  const seen = new Set<string>();
  return items.filter((d) => {
    const key = `${d.documentId}|${d.reference}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
