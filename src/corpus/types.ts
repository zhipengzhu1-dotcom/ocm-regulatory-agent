/** How a document addresses its own passages. No single scheme covers the corpus. */
export type AnchorScheme = "section" | "roman-part" | "row-id" | "qa-pair" | "none";

export interface PageRange {
  page: number;
  /** Character offset of the first character on this page. */
  start: number;
  /** Character offset one past the last character on this page. */
  end: number;
}

export interface CorpusDocument {
  documentId: string;
  title: string;
  authority: string;
  sourcePdf: string;
  anchorScheme: AnchorScheme;
  /** Converted text, `pdftotext -layout` output with the TOC still present. */
  text: string;
  /**
   * Character offset one past the end of the table-of-contents region. Quotations
   * drawn from before this point are rejected: a TOC stub is quotable verbatim but
   * carries no requirement text.
   */
  tocEnd: number;
  pages: PageRange[];
}

export interface Corpus {
  documents: CorpusDocument[];
}

export interface Citation {
  documentId: string;
  /** The address, in the document's own vocabulary. */
  anchor: string;
  /** The proof: text that must appear in the document. */
  quote: string;
}
