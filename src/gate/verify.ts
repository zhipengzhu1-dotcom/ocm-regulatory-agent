import type { Citation, Corpus, CorpusDocument } from "../corpus/types.js";
import { normalize, type Normalized } from "./normalize.js";

export type FailureReason =
  | "unknown-document"
  | "quote-not-found"
  | "quote-from-contents"
  /** Raised by the pipeline, not the gate: an answer with no citation and no silence. */
  | "uncited-claim";

export interface VerifiedCitation extends Citation {
  page: number;
}

export interface CitationFailure {
  citation: Citation;
  reason: FailureReason;
}

export interface GateResult {
  ok: boolean;
  citations: VerifiedCitation[];
  failures: CitationFailure[];
}

/** Normalizing a 500KB corpus per citation would be wasteful; documents are immutable. */
const cache = new WeakMap<CorpusDocument, Normalized>();

function normalizedOf(document: CorpusDocument): Normalized {
  let n = cache.get(document);
  if (!n) {
    n = normalize(document.text);
    cache.set(document, n);
  }
  return n;
}

/**
 * Find `quote` in the normalized document, returning its normalized offset or -1.
 *
 * A quotation elided with an ellipsis matches when every segment appears, in order,
 * without overlapping. The returned offset is that of the first segment.
 */
function locate(quote: string, haystack: Normalized): number {
  const segments = quote
    .split(/\s*(?:\u2026|\.\.\.)\s*/)
    .map((s) => normalize(s).text)
    .filter((s) => s !== "");
  if (segments.length === 0) return -1;

  let cursor = 0;
  let first = -1;
  for (const segment of segments) {
    const at = haystack.text.indexOf(segment, cursor);
    if (at === -1) return -1;
    if (first === -1) first = at;
    cursor = at + segment.length;
  }
  return first;
}

export function verifyCitations(citations: Citation[], corpus: Corpus): GateResult {
  const verified: VerifiedCitation[] = [];
  const failures: CitationFailure[] = [];

  for (const citation of citations) {
    const document = corpus.documents.find((d) => d.documentId === citation.documentId);
    if (!document) {
      failures.push({ citation, reason: "unknown-document" });
      continue;
    }

    const haystack = normalizedOf(document);
    const at = locate(citation.quote, haystack);
    if (at === -1) {
      failures.push({ citation, reason: "quote-not-found" });
      continue;
    }

    const origin = haystack.map[at] ?? 0;
    if (origin < document.tocEnd) {
      // Quotable verbatim, but it is a contents entry and carries no requirement.
      // Testing the start is sufficient: the contents region is a prefix, so a span
      // beginning past `tocEnd` lies wholly past it, elided segments included.
      failures.push({ citation, reason: "quote-from-contents" });
      continue;
    }

    const page = document.pages.find((p) => origin >= p.start && origin < p.end);
    verified.push({ ...citation, page: page?.page ?? 1 });
  }

  return { ok: failures.length === 0, citations: verified, failures };
}
