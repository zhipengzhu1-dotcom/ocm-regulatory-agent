import { resolve } from "node:path";
import { buildCorpus } from "../corpus/build.js";
import { checkIntegrity } from "../corpus/integrity.js";
import { corpusRoot } from "../corpus/root.js";
import { createClaudeClient } from "../agent/claude-client.js";
import { answerQuestion } from "../agent/answer.js";
import { deriveQuestions, loadAuthored } from "./questions.js";
import { scoreAnswer, summarise, BARS } from "./score.js";
import type { AxisScore, EvalQuestion } from "./types.js";

const args = process.argv.slice(2);
const includeDerived = args.includes("--all");
const limitIndex = args.indexOf("--limit");
const limit = limitIndex === -1 ? Infinity : Number(args[limitIndex + 1]);

const corpus = buildCorpus(corpusRoot());
const integrity = checkIntegrity(corpus);
if (!integrity.ok) {
  console.log(`⚠ Suite B failing: ${integrity.dangling.length} dangling citation(s).`);
  for (const d of integrity.dangling) console.log(`   ${d.reference} in ${d.documentId}`);
  console.log("   Answers touching those areas may be wrong for reasons the model cannot fix.\n");
}

const authored = loadAuthored(resolve(import.meta.dirname, "../../eval/authored.json"));
const questions: EvalQuestion[] = [...authored, ...(includeDerived ? deriveQuestions(corpus) : [])]
  .slice(0, limit);

if (questions.length === 0) {
  console.log("No questions. Write some in eval/authored.json, or pass --all.");
  process.exit(1);
}
console.log(
  `Suite A — ${questions.length} question(s) ` +
    `(${authored.length} authored${includeDerived ? `, ${questions.length - authored.length} derived` : ""}).\n`,
);

const client = createClaudeClient(corpus);
const scores: AxisScore[] = [];

for (const [index, question] of questions.entries()) {
  const result = await answerQuestion(question.question, corpus, client);
  const score = scoreAnswer(question, result, corpus);
  scores.push(score);

  const mechanical = score.quoteVerified && score.anchorResolves;
  console.log(`${String(index + 1).padStart(4)}. ${mechanical ? "ok  " : "FAIL"} ${question.id}`);
  if (result.outcome === "answered") {
    for (const c of result.cited.slice(0, 3)) {
      console.log(`        ${c.anchor} p.${c.page} — ${c.documentId.slice(0, 40)}`);
    }
    if (result.silence) console.log(`        SILENCE: ${result.silence.slice(0, 88)}`);
    if (score.citedExpectedDocument === false) {
      console.log(`        expected a citation in ${question.expect.documentId}`);
    }
  } else {
    console.log(`        outcome=${result.outcome}`);
    if (result.outcome === "usage-limit") {
      console.log("\nStopping: subscription usage limit reached. Partial results below.\n");
      break;
    }
  }
}

const summary = summarise(scores);
console.log(`\n${"axis".padEnd(24)} ${"rate".padStart(7)}  bar      n`);
for (const axis of summary.axes) {
  const bar = `${BARS[axis.axis].kind === "hard" ? "100% H" : `${Math.round(axis.threshold * 100)}% t`}`;
  console.log(
    `${axis.axis.padEnd(24)} ${`${(axis.rate * 100).toFixed(1)}%`.padStart(7)}  ${bar.padEnd(7)} ${axis.scored}` +
      `${axis.passed ? "" : "   <-- BELOW BAR"}`,
  );
}
console.log(`\nSuite A: ${summary.ok ? "PASS" : "FAIL"}`);
console.log("Substantive and register correctness are not auto-scored — read the answers above.");
process.exit(summary.ok ? 0 : 1);
