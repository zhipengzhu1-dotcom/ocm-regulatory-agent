// Stratified-sample driver around the app's own eval pieces (no app source is modified).
// Usage: npx tsx eval/run-sample.mts   (env: SEED, N, CONC, ONLY, OUT)
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { buildCorpus } from "../src/corpus/build.js";
import { corpusRoot } from "../src/corpus/root.js";
import { createClaudeClient, MODEL } from "../src/agent/claude-client.js";
import { answerQuestion } from "../src/agent/answer.js";
import { deriveQuestions, loadAuthored } from "../src/eval/questions.js";
import { scoreAnswer, summarise } from "../src/eval/score.js";

const HERE = import.meta.dirname;
const SEED = Number(process.env.SEED ?? 20261007);
const N = Number(process.env.N ?? 50);
const CONC = Number(process.env.CONC ?? 3);
const ONLY = process.env.ONLY ? Number(process.env.ONLY) : undefined;
const OUT = resolve(process.env.OUT ?? resolve(HERE, "results/results.jsonl"));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, ""); // rows are appended as they finish; start each run empty

function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = mulberry32(SEED);
function shuffle<T>(xs: T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const corpus = buildCorpus(corpusRoot());
const derived = deriveQuestions(corpus);
// Stratify by source checklist, proportional allocation (largest remainder).
const strata = new Map<string, any[]>();
for (const q of derived) { const k = q.origin.documentId; strata.set(k, [...(strata.get(k) ?? []), q]); }
const alloc = [...strata.entries()].map(([k, qs]) => { const exact = (qs.length / derived.length) * N; return { k, qs, n: Math.floor(exact), rem: exact - Math.floor(exact) }; });
let left = N - alloc.reduce((s, a) => s + a.n, 0);
for (const a of [...alloc].sort((x, y) => y.rem - x.rem)) { if (left-- <= 0) break; a.n++; }
const sample = alloc.flatMap((a) => shuffle(a.qs).slice(0, a.n));
const authored = loadAuthored(resolve(HERE, "authored.json"));
let questions = [...authored, ...sample];
if (ONLY !== undefined) questions = questions.slice(0, ONLY);
writeFileSync(resolve(dirname(OUT), "sample.json"), JSON.stringify({ seed: SEED, N, alloc: alloc.map((a) => ({ stratum: a.k, pool: a.qs.length, n: a.n })), ids: questions.map((q) => q.id) }, null, 2));
console.log(`model=${MODEL} seed=${SEED} n=${questions.length} conc=${CONC}`);

const client = createClaudeClient(corpus);
let next = 0;
const rows: any[] = [];
async function worker() {
  while (next < questions.length) {
    const i = next++;
    const q = questions[i];
    const attempts: any[] = [];
    const wrapped = { async draft(input: any) {
      const t = Date.now();
      try { const d = await client.draft(input); attempts.push({ ms: Date.now() - t, priorFailures: input.retry?.failures?.map((f: any) => f.reason) ?? [] , nCited: d.cited.length, silence: d.silence !== null }); return d; }
      catch (e) { attempts.push({ ms: Date.now() - t, error: String(e).slice(0, 300) }); throw e; }
    } };
    const t0 = Date.now();
    const result = await answerQuestion(q.question, corpus, wrapped);
    const ms = Date.now() - t0;
    const score = scoreAnswer(q, result, corpus);
    const row = { i, id: q.id, source: q.source, expect: q.expect, ms, outcome: result.outcome, attempts, score,
      cited: result.outcome === "answered" ? result.cited.map((c: any) => ({ documentId: c.documentId, anchor: c.anchor, page: c.page })) : undefined,
      silence: result.outcome === "answered" ? result.silence : undefined,
      reading: result.outcome === "answered" ? result.reading : undefined,
      failures: result.outcome === "withheld" ? result.failures : undefined,
      message: result.outcome === "error" ? result.message : undefined };
    rows.push(row);
    appendFileSync(OUT, JSON.stringify(row) + "\n");
    console.log(`${String(rows.length).padStart(3)}/${questions.length} ${result.outcome} att=${attempts.length} ${(ms / 1000).toFixed(1)}s doc=${score.citedExpectedDocument} ${q.id}`);
    if (result.outcome === "usage-limit") { console.log("USAGE LIMIT"); process.exit(2); }
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log(JSON.stringify(summarise(rows.map((r) => r.score)), null, 2));
