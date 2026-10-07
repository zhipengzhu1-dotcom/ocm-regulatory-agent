import { buildCorpus } from "./build.js";
import { checkIntegrity } from "./integrity.js";
import { corpusRoot } from "./root.js";
import { printIntegrity, sectionRange } from "./report.js";

const report = checkIntegrity(buildCorpus(corpusRoot()));
console.log(`Part 130 sections : ${sectionRange(report.part130Sections)}`);
console.log(`LQSS parts        : ${report.lqssParts.join(" ") || "none found"}`);
printIntegrity(report);
process.exit(report.ok ? 0 : 1);
