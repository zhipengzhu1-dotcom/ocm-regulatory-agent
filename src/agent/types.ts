import type { Citation } from "../corpus/types.js";
import type { CitationFailure, VerifiedCitation } from "../gate/verify.js";

/** What the model produces, before the gate has looked at it. */
export interface Draft {
  /**
   * Set when nothing in the corpus governs the question. Declared above everything
   * else so a gap is never read as a rule.
   */
  silence: string | null;
  /** The cited register: quoted, anchored statements. Every one is gated. */
  cited: Citation[];
  /** The inference register: the agent's reading. Labelled, never gated. */
  reading: string;
}

export interface RetryContext {
  failures: CitationFailure[];
}

export interface ModelClient {
  draft(input: { question: string; retry?: RetryContext }): Promise<Draft>;
}

export interface AnswerEvents {
  /** The streamed text must be removed, not annotated. */
  onRetract?(): void;
  onAttempt?(attempt: number): void;
}

export type AnswerResult =
  | {
      outcome: "answered";
      silence: string | null;
      cited: VerifiedCitation[];
      reading: string;
      attempts: number;
    }
  | { outcome: "withheld"; failures: CitationFailure[]; attempts: number }
  | { outcome: "usage-limit" }
  | { outcome: "error"; message: string };
