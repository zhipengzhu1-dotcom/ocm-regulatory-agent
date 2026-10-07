import type { Corpus } from "../corpus/types.js";
import type { AnswerResult } from "../agent/types.js";
import type { AxisScore, EvalQuestion } from "./types.js";

export type Axis = keyof AxisScore;

export interface Bar {
  kind: "hard" | "target";
  threshold: number;
  why: string;
}

/**
 * Per axis, not one number. The mechanical axes are deterministic, so anything below
 * 100% there is a defect rather than a model shortfall; gating on a model-judgment
 * number would make the bar meaningless, so those are tracked instead.
 */
export const BARS: Record<Axis, Bar> = {
  quoteVerified: {
    kind: "hard",
    threshold: 1,
    why: "deterministic — a failure is a gate defect, not a model shortfall",
  },
  anchorResolves: {
    kind: "hard",
    threshold: 1,
    why: "mechanically checkable against the page map",
  },
  citedExpectedDocument: {
    kind: "target",
    threshold: 0.9,
    why: "which document governs is a judgment the ground truth can be wrong about",
  },
  silenceCorrect: {
    kind: "target",
    threshold: 0.9,
    why: "judgment: whether the corpus is genuinely silent",
  },
};

export function scoreAnswer(
  question: EvalQuestion,
  result: AnswerResult,
  corpus: Corpus,
): AxisScore {
  if (result.outcome !== "answered") {
    return {
      quoteVerified: false,
      anchorResolves: false,
      citedExpectedDocument: false,
      silenceCorrect: question.expect.silent === true ? false : null,
    };
  }

  const anchorResolves = result.cited.every((c) => {
    const document = corpus.documents.find((d) => d.documentId === c.documentId);
    const last = document?.pages.at(-1)?.page ?? 0;
    return c.page >= 1 && c.page <= last;
  });

  const expected = question.expect.documentId;
  return {
    quoteVerified: true,
    anchorResolves,
    citedExpectedDocument:
      expected === undefined ? true : result.cited.some((c) => c.documentId === expected),
    // Declaring silence AND citing the nearest adjacent requirement is the specified
    // behaviour, not a failure — the gap is often the most useful part of the answer.
    // What matters is that the silence was declared, above the reasoning.
    silenceCorrect: question.expect.silent === true ? result.silence !== null : null,
  };
}

export interface AxisSummary {
  axis: Axis;
  kind: Bar["kind"];
  threshold: number;
  scored: number;
  passed: boolean;
  rate: number;
}

export interface RunSummary {
  ok: boolean;
  axes: AxisSummary[];
}

export function summarise(scores: AxisScore[]): RunSummary {
  const axes = (Object.keys(BARS) as Axis[]).map((axis) => {
    const applicable = scores.map((s) => s[axis]).filter((v): v is boolean => v !== null);
    const bar = BARS[axis];
    const rate = applicable.length === 0 ? 1 : applicable.filter(Boolean).length / applicable.length;
    return {
      axis,
      kind: bar.kind,
      threshold: bar.threshold,
      scored: applicable.length,
      rate,
      passed: rate >= bar.threshold,
    };
  });
  return { ok: axes.every((a) => a.passed), axes };
}
