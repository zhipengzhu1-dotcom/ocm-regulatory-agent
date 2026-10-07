import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { buildCorpus } from "../src/corpus/build.js";
import { corpusRoot } from "../src/corpus/root.js";
import { verifyCitations } from "../src/gate/verify.js";
import type { Corpus } from "../src/corpus/types.js";

const PDF_DIR = corpusRoot();

let built: Corpus;
beforeAll(() => {
  built = buildCorpus(PDF_DIR);
}, 60_000);

describe("buildCorpus assembling the OCM corpus", () => {
  it("converts every source document exactly once", () => {
    expect(built.documents).toHaveLength(16);
  });

  it("excludes the byte-identical Part 130 duplicate", () => {
    const ids = built.documents.map((d) => d.documentId);
    expect(ids).toContain("part-130-cannabis-laboratories");
    expect(ids).not.toContain("part-130-cannabis-laboratories-adopted");
  });

  it("gives every document a title, an authority and a valid anchor scheme", () => {
    for (const d of built.documents) {
      expect(d.title, d.documentId).not.toBe("");
      expect(d.authority, d.documentId).not.toBe("");
      expect(
        ["section", "roman-part", "row-id", "qa-pair", "none"],
        d.documentId,
      ).toContain(d.anchorScheme);
      expect(d.sourcePdf, d.documentId).toMatch(/\.pdf$/);
    }
  });

  it("emits a page map whose page count matches the PDF for every document", () => {
    for (const d of built.documents) {
      const info = execFileSync("pdfinfo", [d.sourcePdf], { encoding: "utf8" });
      const pages = Number(/^Pages:\s*(\d+)/m.exec(info)?.[1]);
      expect(d.pages.at(-1)?.page, d.documentId).toBe(pages);
    }
  });

  it("keeps checklist row identifiers on the same line as their requirement text", () => {
    // The -layout regression test: raw extraction detaches these.
    const chem = built.documents.find((d) => d.documentId.startsWith("ocm-chemistry"));
    expect(chem?.text).toMatch(/LQSS,\s+Deteriorated or outdated reagents/);
  });

  it("marks the Part 130 contents region so its stubs cannot be cited", () => {
    const p130 = built.documents.find((d) => d.documentId === "part-130-cannabis-laboratories")!;
    expect(p130.tocEnd).toBeGreaterThan(0);

    const result = verifyCitations(
      [{
        documentId: "part-130-cannabis-laboratories",
        anchor: "§ 130.22",
        quote: "§ 130.22 Testing of Cannabis Product and Medical Cannabis.",
      }],
      built,
    );
    expect(result.failures[0]?.reason).toBe("quote-from-contents");
  });

  it("still allows citing real requirement text from the body of Part 130", () => {
    const result = verifyCitations(
      [{
        documentId: "part-130-cannabis-laboratories",
        anchor: "§ 130.22(a)",
        quote: "shall be conducted by a cannabis laboratory employing methods approved by the Office",
      }],
      built,
    );
    expect(result.ok).toBe(true);
    expect(result.citations[0]?.page).toBeGreaterThan(1);
  });
});

/**
 * A contents entry is quotable verbatim and carries no requirement. The first
 * version of this only covered Part 130, and 15 of 16 documents silently had no
 * contents region marked at all.
 */
describe("contents detection across the whole corpus", () => {
  it("marks a contents region in every document that has one", () => {
    const withContents = built.documents.filter((d) => d.tocEnd > 0).map((d) => d.documentId);
    expect(withContents).toContain("part-130-cannabis-laboratories");
    expect(withContents).toContain("laboratory-quality-system-standards-2-9-26");
  });

  it("rejects a quotation taken from the LQSS contents page", () => {
    const result = verifyCitations(
      [{
        documentId: "laboratory-quality-system-standards-2-9-26",
        anchor: "Part IX",
        quote: "IX. Record Retention",
      }],
      built,
    );
    expect(result.ok).toBe(false);
    expect(result.failures[0]?.reason).toBe("quote-from-contents");
  });

  it("still accepts real requirement text from the LQSS body", () => {
    const result = verifyCitations(
      [{
        documentId: "laboratory-quality-system-standards-2-9-26",
        anchor: "Part IV",
        quote: "within their expiration or re-qualification dates at the time of use",
      }],
      built,
    );
    expect(result.ok).toBe(true);
    expect(result.citations[0]?.page).toBeGreaterThan(5);
  });

  it("never marks so much of a document as contents that the body is unreachable", () => {
    for (const d of built.documents) {
      expect(d.tocEnd / d.text.length, d.documentId).toBeLessThan(0.2);
    }
  });
});
