import type { Corpus, CorpusDocument } from "../src/corpus/types.js";
import { pageRanges } from "../src/corpus/build.js";

/** A miniature stand-in for Part 130, with a TOC region and two real sections. */
export const PART_130_TEXT = [
  "§ 130.22 Testing of Cannabis Product and Medical Cannabis.", // TOC stub
  "§ 130.26 Record Retention.", // TOC stub
  "\f",
  "§ 130.22 Testing of Cannabis Product and Medical Cannabis.",
  "(a)      All testing of samples provided by a laboratory sampling firm",
  "shall be conducted by a cannabis laboratory employing methods approved",
  "by the Office and shall:",
  "\f",
  "§ 130.26 Record Retention.",
  "Records shall be retained for the laboratory’s permit period – no less",
  "than five years.",
].join("\n");

export function doc(over: Partial<CorpusDocument> = {}): CorpusDocument {
  const text = over.text ?? PART_130_TEXT;
  return {
    documentId: "part-130-cannabis-laboratories",
    title: "Part 130 — Cannabis Laboratories (9 NYCRR)",
    authority: "NYS Cannabis Control Board",
    sourcePdf: "../part-130-cannabis-laboratories.pdf",
    anchorScheme: "section",
    text,
    tocEnd: text.indexOf("\f") + 1,
    pages: pagesOf(text),
    ...over,
  };
}

/**
 * Page boundaries, from the real implementation rather than a copy of it. The
 * independent check on this lives in corpus.test.ts, which compares page counts
 * against `pdfinfo`.
 */
export const pagesOf = pageRanges;

export const corpus = (...documents: CorpusDocument[]): Corpus => ({
  documents: documents.length ? documents : [doc()],
});
