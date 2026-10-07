import type { CorpusDocument } from "../corpus/types.js";

export interface ChecklistRow {
  documentId: string;
  /** The row number printed in the checklist's ID column. */
  rowId: string;
  /** The governing citation, e.g. "LQSS, IV" or "§ 130.19 (j)". May be empty. */
  citation: string;
  requirement: string;
}

/**
 * A citation, or one vertical fragment of one: "LQSS,", "IV", "§ 130.19 (j)",
 * "SQSS, Section IV A and D". Anchored at the start only, because the citation and
 * requirement columns are sometimes separated by a single space rather than the run
 * of spaces that marks a column elsewhere — so a cell may hold both.
 */
const CITATION_PREFIX =
  /^(?:(?:LQSS|SQSS|MRTA)[,.]?(?:\s+Section)?(?:\s+[IVXL]{1,5})?[,.]?(?:\s+[A-Z](?:\s+and\s+[A-Z])?)?|§\s*\d+\.\d+(?:\s*\([a-z0-9]\))*(?:\s+and\s+§?\s*\d+\.\d+(?:\s*\([a-z0-9]\))*)?|Section\s+[IVXL]{1,5}(?:\s+[A-Z](?:\s+and\s+[A-Z])?)?|[IVXL]{1,5}[,.]?|\([a-z0-9]\)|\d{1,2}\)\s*[a-z]?)(?=$|\s)/;

/**
 * Read an OCM inspection checklist as a table.
 *
 * These are column layouts, not line patterns: a citation cell is vertically centred
 * in a tall row, so "LQSS," and "IV" land on different lines at the same character
 * offset. Reading line by line recovers a small and misleading fraction — 4 citations
 * from the chemistry checklist and none at all from microbiology.
 *
 * The six checklists share no geometry — their prose columns start anywhere from 21
 * to 41, ragged by two or three characters within a single document, and their
 * headers do not align with their bodies. So rather than infer a global grid, each
 * rendered line is split into cells and each cell classified on its own.
 */
export function extractChecklistRows(document: CorpusDocument): ChecklistRow[] {
  const rows: ChecklistRow[] = [];

  // Rows are separated by blank lines. Grouping on the ID line instead would split
  // rows in the wrong place: the row number is vertically centred like the citation,
  // so a row's first line of prose sits ABOVE its number.
  for (const block of blocksOf(document.text).flatMap(splitMultiRow)) {
    const rowId: string[] = [];
    const citation: string[] = [];
    const requirement: string[] = [];

    for (const line of block) {
      for (const cell of cellsOf(line)) {
        if (/^\d{1,3}$/.test(cell.text)) {
          rowId.push(cell.text);
          continue;
        }
        const split = peelCitation(cell.text);
        if (split.citation !== "") citation.push(split.citation);
        if (split.rest.length >= 10) requirement.push(split.rest);
      }
    }

    if (rowId.length === 0 || requirement.join(" ").trim().length <= 20) continue;
    rows.push({
      documentId: document.documentId,
      rowId: rowId[0]!,
      citation: tidy(citation.join(" ")),
      requirement: tidy(requirement.join(" ")),
    });
  }
  return rows;
}

/** Separate a leading citation from any requirement text sharing the same cell. */
function peelCitation(text: string): { citation: string; rest: string } {
  const match = CITATION_PREFIX.exec(text);
  if (!match) return { citation: "", rest: text };
  const citation = match[0].trim();
  const rest = text.slice(match[0].length).trim();
  // A lone roman numeral is only a citation fragment when nothing else follows it;
  // otherwise it is a sentence that happens to start with "I" or "V".
  if (/^[IVXL]{1,5}[,.]?$/.test(citation) && rest !== "") return { citation: "", rest: text };
  return { citation, rest };
}

/**
 * Blank-line blocks hold one row in some checklists and many in others — equipment
 * and the Part 130 checklist run rows together with no separator. Where a block
 * carries more than one row number, split it again at each number.
 *
 * Only safe in the run-together case: where a row IS blank-separated, its number is
 * vertically centred and splitting there would cut the row in half.
 */
function splitMultiRow(block: string[]): string[][] {
  const idLines = block.filter((line) => {
    const first = cellsOf(line)[0];
    return first !== undefined && /^\d{1,3}$/.test(first.text);
  });
  if (idLines.length < 2) return [block];

  const parts: string[][] = [];
  let current: string[] = [];
  for (const line of block) {
    if (idLines.includes(line) && current.length > 0) {
      parts.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

/** One checklist row per blank-line-separated block of rendered lines. */
function blocksOf(text: string): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of text.split("\n")) {
    if (line.includes("\f") || line.trim() === "") {
      if (current.length > 0) blocks.push(current);
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

/**
 * Split a rendered line into table cells. `-layout` separates columns with runs of
 * two or more spaces; a single space is word spacing inside one cell.
 */
function cellsOf(line: string): { start: number; text: string }[] {
  const cells: { start: number; text: string }[] = [];
  for (const match of line.matchAll(/\S(?:(?! {2})[^\n])*/g)) {
    const text = match[0].trimEnd();
    if (text !== "") cells.push({ start: match.index, text });
  }
  return cells;
}

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
