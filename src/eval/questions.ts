import { readFileSync, existsSync } from "node:fs";
import type { Corpus } from "../corpus/types.js";
import { extractChecklistRows } from "./checklist.js";
import type { EvalQuestion } from "./types.js";

/**
 * Turn checklist rows into lookup questions. Each row states a requirement and names
 * the section that imposes it, so the row's own citation column is the ground truth —
 * a question set with answers already attached, covering all 208 pages systematically
 * rather than only where someone thought to look.
 *
 * These test LOOKUP only. Reasoning and silence-handling need authored questions.
 */
export function deriveQuestions(corpus: Corpus): EvalQuestion[] {
  const questions: EvalQuestion[] = [];
  for (const document of corpus.documents) {
    if (!document.documentId.includes("checklist")) continue;
    for (const row of extractChecklistRows(document)) {
      if (row.citation === "" || row.requirement.length < 30) continue;
      questions.push({
        id: `derived:${document.documentId}:${row.rowId}`,
        source: "derived",
        question: `Does OCM require the following, and which section imposes it? "${row.requirement}"`,
        expect: { documentId: governingDocument(row.citation), anchor: row.citation },
        origin: { documentId: document.documentId, rowId: row.rowId },
      });
    }
  }
  return questions;
}

/** A checklist cites into the regulation or the quality standard, not into itself. */
function governingDocument(citation: string): string | undefined {
  if (/^§?\s*130\./.test(citation) || /130\.\d/.test(citation)) {
    return "part-130-cannabis-laboratories";
  }
  if (/^LQSS/.test(citation)) return "laboratory-quality-system-standards-2-9-26";
  return undefined; // SQSS and MRTA cite documents outside this corpus.
}

/**
 * Questions written by the operator. The derived set cannot produce these: they are
 * the ones where the answer needs a step of reasoning, or where the corpus is
 * genuinely silent and saying so is the correct answer.
 */
export function loadAuthored(path: string): EvalQuestion[] {
  if (!existsSync(path)) return [];
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${path} must contain a JSON array`);
  return parsed.map((entry, index) => {
    const q = entry as Partial<EvalQuestion>;
    if (typeof q.question !== "string" || q.question.trim() === "") {
      throw new Error(`${path}[${index}] has no question`);
    }
    return {
      id: q.id ?? `authored:${index + 1}`,
      source: "authored",
      question: q.question,
      expect: q.expect ?? {},
    };
  });
}
