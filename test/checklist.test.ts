import { describe, it, expect, beforeAll } from "vitest";
import { extractChecklistRows } from "../src/eval/checklist.js";
import { buildCorpus } from "../src/corpus/build.js";
import { corpusRoot } from "../src/corpus/root.js";
import type { Corpus } from "../src/corpus/types.js";

let built: Corpus;
beforeAll(() => {
  built = buildCorpus(corpusRoot());
}, 60_000);

const docOf = (id: string) => built.documents.find((d) => d.documentId.startsWith(id))!;

describe("extractChecklistRows", () => {
  it("rejoins a citation cell split vertically across lines", () => {
    // "LQSS," and "IV" sit on separate lines in the same column, which is why a
    // line-oriented regex recovers 4 citations here and misses the rest.
    const rows = extractChecklistRows(docOf("ocm-chemistry-checklist"));
    expect(rows.find((r) => r.rowId === "1")?.citation).toBe("LQSS, IV");
  });

  it("rejoins requirement text wrapped across lines", () => {
    const rows = extractChecklistRows(docOf("ocm-chemistry-checklist"));
    expect(rows.find((r) => r.rowId === "1")?.requirement).toBe(
      "Maintain a consumables log or inventory for all reagents, reference standards and media purchased and received.",
    );
  });

  it("recovers citations from every checklist, including microbiology", () => {
    // Microbiology yielded zero under the regex approach.
    for (const id of [
      "ocm-chemistry-checklist",
      "ocm-microbiology-checklist",
      "ocm-equipment-checklist",
      "ocm-sampling-checklist",
      "ocm-part-130-requirement-checklist",
    ]) {
      const rows = extractChecklistRows(docOf(id)).filter((r) => r.citation !== "");
      expect(rows.length, id).toBeGreaterThan(5);
    }
  });

  it("reads a Part 130 style citation with its subsection", () => {
    const rows = extractChecklistRows(docOf("ocm-part-130-requirement-checklist"));
    expect(rows.some((r) => /130\.19/.test(r.citation))).toBe(true);
  });

  it("gives every row the document it came from", () => {
    const rows = extractChecklistRows(docOf("ocm-sampling-checklist"));
    expect(rows.every((r) => r.documentId.startsWith("ocm-sampling-checklist"))).toBe(true);
  });
});
