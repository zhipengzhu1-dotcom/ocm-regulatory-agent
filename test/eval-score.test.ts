import { describe, it, expect } from "vitest";
import { scoreAnswer, summarise, BARS } from "../src/eval/score.js";
import type { EvalQuestion } from "../src/eval/types.js";
import { corpus } from "./fixtures.js";

const question: EvalQuestion = {
  id: "d1",
  source: "derived",
  question: "Must reference standards be within their expiration dates at the time of use?",
  expect: { documentId: "part-130-cannabis-laboratories" },
};

const answered = {
  outcome: "answered" as const,
  silence: null,
  cited: [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 130.22(a)", quote: "q", page: 2 }],
  reading: "r",
  attempts: 1,
};

describe("scoreAnswer", () => {
  it("passes the mechanical axes when the gate answered with a resolvable page", () => {
    const s = scoreAnswer(question, answered, corpus());
    expect(s.quoteVerified).toBe(true);
    expect(s.anchorResolves).toBe(true);
    expect(s.citedExpectedDocument).toBe(true);
  });

  it("fails quoteVerified when the answer was withheld", () => {
    const s = scoreAnswer(question, { outcome: "withheld", failures: [], attempts: 3 }, corpus());
    expect(s.quoteVerified).toBe(false);
  });

  it("fails anchorResolves when a page falls outside the document", () => {
    const bad = { ...answered, cited: [{ ...answered.cited[0]!, page: 99 }] };
    expect(scoreAnswer(question, bad, corpus()).anchorResolves).toBe(false);
  });

  it("fails citedExpectedDocument when the wrong document was cited", () => {
    const q = { ...question, expect: { documentId: "laboratory-quality-system-standards-2-9-26" } };
    expect(scoreAnswer(q, answered, corpus()).citedExpectedDocument).toBe(false);
  });

  it("scores silence only for questions that expect it", () => {
    const q: EvalQuestion = { ...question, expect: { silent: true } };
    expect(scoreAnswer(q, answered, corpus()).silenceCorrect).toBe(false);
    const silent = { ...answered, silence: "OCM does not address this.", cited: [] };
    expect(scoreAnswer(q, silent, corpus()).silenceCorrect).toBe(true);

    // Declaring silence and still citing the nearest adjacent requirement is what
    // the answer contract asks for; it must not be scored as a miss.
    const silentWithAdjacent = { ...answered, silence: "OCM does not address this." };
    expect(scoreAnswer(q, silentWithAdjacent, corpus()).silenceCorrect).toBe(true);
    expect(scoreAnswer(question, answered, corpus()).silenceCorrect).toBeNull();
  });
});

describe("summarise", () => {
  it("fails the run when a hard axis is below 100 percent", () => {
    const scores = [
      { quoteVerified: true, anchorResolves: true, citedExpectedDocument: true, silenceCorrect: null },
      { quoteVerified: false, anchorResolves: true, citedExpectedDocument: true, silenceCorrect: null },
    ];
    const summary = summarise(scores);
    expect(summary.ok).toBe(false);
    expect(summary.axes.find((a) => a.axis === "quoteVerified")?.passed).toBe(false);
  });

  it("passes a soft axis that meets its target without being perfect", () => {
    const scores = Array.from({ length: 10 }, (_, i) => ({
      quoteVerified: true,
      anchorResolves: true,
      citedExpectedDocument: i > 0,
      silenceCorrect: null,
    }));
    const summary = summarise(scores);
    expect(BARS.citedExpectedDocument.kind).toBe("target");
    expect(summary.axes.find((a) => a.axis === "citedExpectedDocument")?.passed).toBe(true);
    expect(summary.ok).toBe(true);
  });
});
