export interface EvalQuestion {
  id: string;
  /** Derived from a checklist row, or written by the operator. */
  source: "derived" | "authored";
  question: string;
  expect: {
    /** The document whose text should govern the answer. */
    documentId?: string;
    /** The anchor the answer should land on, where known. */
    anchor?: string;
    /** True when the corpus genuinely says nothing and silence must be declared. */
    silent?: boolean;
  };
  /** Where a derived question came from, for tracing a bad question back. */
  origin?: { documentId: string; rowId: string };
}

export interface AxisScore {
  quoteVerified: boolean;
  anchorResolves: boolean;
  citedExpectedDocument: boolean;
  /** Null when the question does not exercise silence. */
  silenceCorrect: boolean | null;
}
