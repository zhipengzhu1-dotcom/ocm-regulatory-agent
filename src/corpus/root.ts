import { resolve } from "node:path";

/** The corpus root is the directory holding the source PDFs: `corpus/` at the repo root. */
export function corpusRoot(): string {
  return process.env["OCM_CORPUS_ROOT"] ?? resolve(import.meta.dirname, "../../corpus");
}
