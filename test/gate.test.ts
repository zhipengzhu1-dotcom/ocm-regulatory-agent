import { describe, it, expect } from "vitest";
import { verifyCitations } from "../src/gate/verify.js";
import { corpus, doc } from "./fixtures.js";

describe("the citation gate", () => {
  it("verifies a quotation that appears verbatim, and reports the page it is on", () => {
    const result = verifyCitations(
      [
        {
          documentId: "part-130-cannabis-laboratories",
          anchor: "§ 130.22(a)",
          quote: "employing methods approved",
        },
      ],
      corpus(),
    );

    expect(result.ok).toBe(true);
    expect(result.citations[0]?.page).toBe(2);
  });
});

describe("the gate rejecting fabrications", () => {
  it("rejects a quotation that does not appear, and names the one that failed", () => {
    const result = verifyCitations(
      [
        {
          documentId: "part-130-cannabis-laboratories",
          anchor: "§ 130.22(a)",
          quote: "employing methods approved",
        },
        {
          documentId: "part-130-cannabis-laboratories",
          anchor: "§ 130.31(e)",
          quote: "Total yeast and mould shall not exceed 10,000 CFU/g",
        },
      ],
      corpus(),
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.citation.anchor).toBe("§ 130.31(e)");
    expect(result.failures[0]?.reason).toBe("quote-not-found");
  });

  it("rejects a citation naming a document that is not in the corpus", () => {
    const result = verifyCitations(
      [{ documentId: "no-such-document", anchor: "§ 1", quote: "anything" }],
      corpus(),
    );
    expect(result.ok).toBe(false);
    expect(result.failures[0]?.reason).toBe("unknown-document");
  });
});

/**
 * The corpus contains 139 curly apostrophes, 301 en dashes and 58 curly double
 * quotes. A model that emits the straight equivalent has quoted the text
 * *correctly*; without normalization the gate would reject it, retry, and refuse.
 * These are the tests that stop the safety mechanism becoming a denial of service.
 */
describe("the gate normalizing before it compares", () => {
  const cite = (quote: string) => [
    { documentId: "part-130-cannabis-laboratories", anchor: "§ 130.26", quote },
  ];

  it("matches a straight apostrophe against the corpus curly apostrophe", () => {
    expect(verifyCitations(cite("the laboratory's permit period"), corpus()).ok).toBe(true);
  });

  it("matches a plain hyphen against the corpus en dash", () => {
    expect(verifyCitations(cite("permit period - no less"), corpus()).ok).toBe(true);
  });

  it("matches straight double quotes against curly double quotes", () => {
    const c = corpus(doc({ text: 'The term “cannabis laboratory” means a lab.' }));
    expect(verifyCitations(
      [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 130.1", quote: 'The term "cannabis laboratory" means' }],
      c,
    ).ok).toBe(true);
  });

  it("matches across a mid-sentence line break in the source", () => {
    expect(verifyCitations(cite("no less than five years"), corpus()).ok).toBe(true);
  });

  it("matches across the column padding that -layout inserts", () => {
    expect(verifyCitations(cite("All testing of samples provided by"), corpus()).ok).toBe(true);
  });

  it("still rejects a fabrication that only looks like a normalization difference", () => {
    expect(verifyCitations(cite("no less than seven years"), corpus()).ok).toBe(false);
  });
});

/**
 * A table-of-contents entry is quotable verbatim and carries no requirement text.
 * Without this rule the gate happily verifies a citation that says nothing.
 */
describe("the gate rejecting table-of-contents stubs", () => {
  it("rejects a quotation drawn from the table of contents", () => {
    const result = verifyCitations(
      [{
        documentId: "part-130-cannabis-laboratories",
        anchor: "§ 130.22",
        quote: "§ 130.22 Testing of Cannabis Product and Medical Cannabis.",
      }],
      corpus(),
    );
    expect(result.ok).toBe(false);
    expect(result.failures[0]?.reason).toBe("quote-from-contents");
  });

  it("accepts the same heading where it appears in the body", () => {
    const result = verifyCitations(
      [{
        documentId: "part-130-cannabis-laboratories",
        anchor: "§ 130.26",
        quote: "§ 130.26 Record Retention. Records shall be retained",
      }],
      corpus(),
    );
    expect(result.ok).toBe(true);
  });
});

describe("the gate matching elided quotations", () => {
  it("matches a quotation elided with an ellipsis on both segments", () => {
    const result = verifyCitations(
      [{
        documentId: "part-130-cannabis-laboratories",
        anchor: "§ 130.22(a)",
        quote: "All testing of samples … employing methods approved",
      }],
      corpus(),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects an elided quotation when a segment is fabricated", () => {
    const result = verifyCitations(
      [{
        documentId: "part-130-cannabis-laboratories",
        anchor: "§ 130.22(a)",
        quote: "All testing of samples … using unapproved instrumentation",
      }],
      corpus(),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an elided quotation whose segments appear out of order", () => {
    const result = verifyCitations(
      [{
        documentId: "part-130-cannabis-laboratories",
        anchor: "§ 130.22(a)",
        quote: "employing methods approved … All testing of samples",
      }],
      corpus(),
    );
    expect(result.ok).toBe(false);
  });
});

describe("the gate folding composed and decomposed accents", () => {
  it("matches a precomposed accent against a decomposed one in the source", () => {
    const c = corpus(doc({ text: "The café method shall be validated." })); // e + combining acute
    const result = verifyCitations(
      [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 1", quote: "The café method" }],
      c,
    );
    expect(result.ok).toBe(true);
  });
});

describe("the gate checking the whole span of an elided quotation", () => {
  it("rejects an elided quotation whose later segment lies in the contents", () => {
    // Segment one is body text; segment two is a contents stub further on.
    const text = [
      "§ 130.1 Definitions.",
      "Body text about approved methods here.",
      "§ 130.1 Definitions.",
      "Real definitions follow in the body.",
    ].join("\n");
    const c = corpus(doc({ text, tocEnd: text.indexOf("§ 130.1 Definitions.", 5) }));
    const result = verifyCitations(
      [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 130.1", quote: "Body text … Definitions." }],
      c,
    );
    expect(result.ok).toBe(false);
  });
});

/**
 * PDFs hyphenate across line breaks: the source renders "co-" at the end of one line
 * and "precipitation" at the start of the next. Collapsing the newline leaves
 * "co- precipitation", while a model reading it correctly writes "co-precipitation".
 * Without this, the gate rejects a correctly quoted passage and forces a retry.
 */
describe("the gate rejoining words hyphenated across a line break", () => {
  const text = "profiles, co-\nprecipitation evaluations, and electrode response checks.";

  it("matches the rejoined word a model would naturally write", () => {
    const result = verifyCitations(
      [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 1", quote: "co-precipitation evaluations" }],
      corpus(doc({ text })),
    );
    expect(result.ok).toBe(true);
  });

  it("still matches the literal form as the source renders it", () => {
    const result = verifyCitations(
      [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 1", quote: "co- precipitation evaluations" }],
      corpus(doc({ text })),
    );
    expect(result.ok).toBe(true);
  });

  it("does not join a spaced dash between separate words", () => {
    const c = corpus(doc({ text: "Disposal - rendered unrecoverable." }));
    const result = verifyCitations(
      [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 1", quote: "Disposal -rendered" }],
      c,
    );
    expect(result.ok).toBe(false);
  });
});
