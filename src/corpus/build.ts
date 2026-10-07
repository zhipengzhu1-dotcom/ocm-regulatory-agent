import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import type { Corpus, CorpusDocument, PageRange } from "./types.js";
import { MANIFEST, EXCLUDED } from "./manifest.js";

/** Directories under the corpus root that are scanned for source PDFs. */
const SUBDIRS = ["", "inspection-checklists"];

export function buildCorpus(pdfDir: string): Corpus {
  const documents = findPdfs(pdfDir)
    .map((path) => buildDocument(path))
    .filter((d): d is CorpusDocument => d !== null)
    .sort((a, b) => a.documentId.localeCompare(b.documentId));
  return { documents };
}

function findPdfs(root: string): string[] {
  const found: string[] = [];
  for (const sub of SUBDIRS) {
    const dir = join(root, sub);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const path = join(dir, name);
      if (!name.toLowerCase().endsWith(".pdf")) continue;
      if (!statSync(path).isFile()) continue;
      found.push(path);
    }
  }
  return found;
}

function buildDocument(path: string): CorpusDocument | null {
  const documentId = basename(path, ".pdf");
  if (EXCLUDED.has(documentId)) return null;

  const entry = MANIFEST[documentId];
  if (!entry) {
    throw new Error(
      `No manifest entry for "${documentId}". Add one to src/corpus/manifest.ts — a ` +
        `document with no declared title or anchor scheme cannot be cited reliably.`,
    );
  }

  // `-layout` is not optional: it is the only mode in which a checklist row
  // identifier stays on the same line as its requirement text.
  const text = execFileSync("pdftotext", ["-layout", path, "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  return {
    documentId,
    title: entry.title,
    authority: entry.authority,
    anchorScheme: entry.anchorScheme,
    sourcePdf: path,
    text,
    tocEnd: findContentsEnd(text),
    pages: pageRanges(text),
  };
}

/** Page boundaries come from the form feeds pdftotext emits, one per page. */
export function pageRanges(text: string): PageRange[] {
  const ranges: PageRange[] = [];
  let start = 0;
  let page = 1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\f") {
      ranges.push({ page, start, end: i });
      start = i + 1;
      page++;
    }
  }
  if (start < text.length || ranges.length === 0) {
    ranges.push({ page, start, end: text.length });
  }
  return ranges;
}

/** A numbered heading, once its contents-page decoration has been stripped. */
const HEADING = /^(§\s*\d+\.\d+\s+\S.*|[IVXL]{1,5}\.\s+[A-Z]\S.*)$/;

/** No document's contents may swallow this much of it; a runaway match is ignored. */
const MAX_CONTENTS_FRACTION = 0.2;

/**
 * Locate the end of a document's table of contents.
 *
 * A contents entry is quotable verbatim but carries no requirement text, so the gate
 * must be able to reject one. Contents pages repeat the body's headings, so the rule
 * is: if the first heading occurs again later, everything before that later
 * occurrence is contents. A document whose first heading occurs once has none.
 *
 * Matching happens per line and AFTER decoration is stripped — contents lines carry
 * dotted leaders and a page number that the body copy lacks, and an earlier version
 * of this matched the raw line, so only Part 130 was ever protected.
 */
function findContentsEnd(text: string): number {
  const headings: { offset: number; label: string }[] = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    const label = stripDecoration(line);
    if (label !== "" && HEADING.test(label)) headings.push({ offset, label });
    offset += line.length + 1;
  }
  if (headings.length < 2) return 0;

  const first = headings[0]!;
  const repeat = headings.find((h) => h.offset > first.offset && h.label === first.label);
  if (!repeat) return 0;
  return repeat.offset / text.length < MAX_CONTENTS_FRACTION ? repeat.offset : 0;
}

/** Contents lines carry dotted leaders and a trailing page number; bodies do not. */
function stripDecoration(line: string): string {
  return line
    .replace(/[.\u2026]{2,}\s*\d*\s*$/, "")
    .replace(/\s{2,}\d{1,4}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}
