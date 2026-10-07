import type { Corpus } from "../corpus/types.js";
import { verifyCitations, type CitationFailure } from "../gate/verify.js";
import type { AnswerEvents, AnswerResult, ModelClient, RetryContext } from "./types.js";

export interface AnswerOptions {
  maxAttempts?: number;
  events?: AnswerEvents;
}

const DEFAULT_ATTEMPTS = 3;

/**
 * Seam 3. Ask the question, gate the answer, retry on failure, refuse rather than
 * answer unverifiably.
 */
export async function answerQuestion(
  question: string,
  corpus: Corpus,
  model: ModelClient,
  options: AnswerOptions = {},
): Promise<AnswerResult> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_ATTEMPTS;
  const events = options.events;

  let retry: RetryContext | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    events?.onAttempt?.(attempt);

    let draft;
    try {
      draft = await model.draft({ question, retry });
    } catch (error) {
      if (isUsageLimit(error)) return { outcome: "usage-limit" };
      return { outcome: "error", message: error instanceof Error ? error.message : String(error) };
    }

    const gate = verifyCitations(draft.cited, corpus);
    if (gate.ok && !isUncitedClaim(draft)) {
      return {
        outcome: "answered",
        silence: draft.silence,
        cited: gate.citations,
        reading: draft.reading,
        attempts: attempt,
      };
    }

    // The draft may already be on screen. It is removed, not annotated.
    events?.onRetract?.();
    retry = { failures: gate.ok ? [uncitedFailure()] : gate.failures };

    if (attempt === maxAttempts) {
      return { outcome: "withheld", failures: retry.failures, attempts: attempt };
    }
  }

  /* c8 ignore next */
  return { outcome: "error", message: "unreachable" };
}

/**
 * The gate inspects quoted spans only, so an answer that cites nothing passes it
 * trivially — a regulatory claim could hide entirely in the ungated inference
 * register. An answer must therefore carry either a citation or a declaration that
 * the corpus is silent.
 */
function isUncitedClaim(draft: { silence: string | null; cited: unknown[]; reading: string }): boolean {
  return draft.cited.length === 0 && draft.silence === null && draft.reading.trim() !== "";
}

function uncitedFailure(): CitationFailure {
  return {
    citation: { documentId: "-", anchor: "-", quote: "" },
    reason: "uncited-claim",
  };
}

function isUsageLimit(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /usage limit reached/i.test(message);
}
