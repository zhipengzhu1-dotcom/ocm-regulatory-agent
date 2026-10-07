import { buildCorpus } from "./build.js";
import { checkIntegrity } from "./integrity.js";
import { corpusRoot } from "./root.js";
import { printIntegrity } from "./report.js";

const corpus = buildCorpus(corpusRoot());
console.log(`Converted ${corpus.documents.length} documents.\n`);
for (const d of corpus.documents) {
  const words = d.text.split(/\s+/).length;
  console.log(
    `  ${String(d.pages.at(-1)?.page ?? 0).padStart(3)}pp  ${String(words).padStart(6)}w  ` +
      `${d.anchorScheme.padEnd(11)} ${d.documentId}`,
  );
}
const report = checkIntegrity(corpus);
printIntegrity(report);
process.exit(report.ok ? 0 : 1);
