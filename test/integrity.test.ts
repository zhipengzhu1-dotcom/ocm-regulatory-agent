import { describe, it, expect, beforeAll } from "vitest";
import { checkIntegrity } from "../src/corpus/integrity.js";
import { buildCorpus } from "../src/corpus/build.js";
import { corpusRoot } from "../src/corpus/root.js";
import { corpus, doc } from "./fixtures.js";
import type { Corpus } from "../src/corpus/types.js";

describe("Suite B — corpus integrity", () => {
  it("passes when every cited section exists", () => {
    const report = checkIntegrity(corpus());
    expect(report.ok).toBe(true);
    expect(report.dangling).toHaveLength(0);
  });

  it("flags a citation naming a Part 130 section that does not exist", () => {
    const checklist = doc({
      documentId: "ocm-part-130-requirement-checklist-v5-1-30-26",
      anchorScheme: "row-id",
      text: "73    § 130.31 (e)    Samples - Be stored in such a manner as to protect",
    });
    const report = checkIntegrity(corpus(doc(), checklist));
    expect(report.ok).toBe(false);
    expect(report.dangling[0]?.reference).toBe("130.31");
    expect(report.dangling[0]?.documentId).toBe("ocm-part-130-requirement-checklist-v5-1-30-26");
  });

  it("does not flag a section that does exist", () => {
    const checklist = doc({
      documentId: "ocm-part-130-requirement-checklist-v5-1-30-26",
      text: "12    § 130.22 (a)    Testing must use approved methods",
    });
    expect(checkIntegrity(corpus(doc(), checklist)).ok).toBe(true);
  });
});

describe("Suite B against the real corpus", () => {
  let built: Corpus;
  beforeAll(() => {
    built = buildCorpus(corpusRoot());
  }, 60_000);

  it("reports the known § 130.31 defect and nothing else", () => {
    const report = checkIntegrity(built);
    expect(report.dangling.map((d) => d.reference)).toEqual(["130.31"]);
  });
});
