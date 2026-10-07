import type { Corpus } from "./types.js";

/** The human-readable name of a document, falling back to its id. */
export function titleOf(corpus: Corpus, documentId: string): string {
  return corpus.documents.find((d) => d.documentId === documentId)?.title ?? documentId;
}
