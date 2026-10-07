# OCM Regulatory Agent

A local chat assistant that answers questions about New York State Office of Cannabis
Management (OCM) laboratory regulation. It answers only from 16 public OCM documents
(208 pages). These are Part 130 (9 NYCRR), the Laboratory Quality System Standard, the testing
limits, OCM guidance and Q&A documents, and six inspection checklists.

Each answer has two separate parts:

- **Cited:** quotations from the documents, each with a document and an anchor such as
  `§ 130.22(a)`, `Part IV` or `row 14`. Code checks that each quotation appears word for word in
  the corpus before the answer is shown.
- **Reading:** the model's interpretation, labelled as inference. This part is not checked.

If the documents do not address a question, the assistant says so instead of answering
from general knowledge.

It is a single-user tool that runs on `127.0.0.1`. It is not legal advice, and it does not
replace reading the regulation.

## Why it verifies quotations and re-prompts

A wrong answer about a regulation that looks right is the failure that matters most. A
chatbot that invents a section number is worse than having no tool. Telling the model to
quote accurately does not prevent this, so the application checks every quotation itself:

1. The model returns JSON: an optional `silence` statement, a `reading`, and a `cited` list
   of `{ documentId, anchor, quote }`.
2. The gate (`src/gate/verify.ts`) normalizes the quotation and the document text the same
   way: Unicode NFKC, curly quotes and dashes folded, whitespace collapsed, line-break
   hyphenation repaired. It then searches for the quotation in that document. A quotation
   fails if the document id is unknown, if the text is not found, or if it only matches a
   table-of-contents line.
3. If any quotation fails, or the answer makes claims with no citation and no silence
   statement, the draft is discarded and never shown. The model is asked again with the
   reason for each failure.
4. After 3 failed attempts, no answer is shown. The UI reports that the answer was withheld.

As a result, every quotation that is displayed exists in the source text. The gate does not
check that a quotation supports the reading, or that the anchor label is the best one. The
reading is only the model's interpretation.

## Architecture

```
corpus/*.pdf ──pdftotext -layout──▶ in-memory corpus (text + page map + TOC offset)
                                         │
question ──▶ system prompt (all 16 documents in context, no retrieval)
                                         │
                       Claude Agent SDK, claude-sonnet-5, no tools, 1 turn
                                         │
                                  JSON draft ──▶ gate ──fail──▶ re-prompt with reasons (max 3)
                                                  │
                                                 pass ──▶ answer with page numbers ──▶ UI
```

- `src/corpus/` converts the PDFs at startup with `pdftotext -layout`, records the page
  breaks, and finds where each table of contents ends. `manifest.ts` declares each
  document's title, issuing authority and anchor scheme. `integrity.ts` checks that each
  section a document cites exists in Part 130 or the LQSS (Suite B).
- `src/agent/` builds the prompt, calls the model and parses the draft. It runs the
  draft, gate and retry loop in `answer.ts`.
- `src/gate/` normalizes text and verifies quotations. It does not call the model.
- `src/server/main.ts` serves the UI (`public/index.html`), streams the reading while it is
  drafted, and serves each source PDF so that a citation opens at the cited page.
- `src/eval/` derives test questions from inspection-checklist rows and scores answers.

The whole corpus, about 146K tokens, is sent with every request instead of being
retrieved. This means a relevant document cannot be missed by a retrieval step. The cost is
a large prompt on every call, which the SDK's automatic prompt caching reduces.

The design reasoning is in `SPEC.md` and in `wayfinder/`: the map and one decision record
per question.

## Setup

Requirements:

- Node.js 20.11 or later (developed on Node 24).
- Poppler, for `pdftotext` and `pdfinfo`: `brew install poppler` or `apt install poppler-utils`.
- Access to Claude. See Authentication.

```sh
npm install
```

### Authentication

The code contains no credential handling. It calls `query()` from
`@anthropic-ai/claude-agent-sdk`, which runs the Claude Code binary bundled with the SDK. That
binary uses the credentials Claude Code would use:

- a Claude subscription login: log in once with Claude Code, or set `CLAUDE_CODE_OAUTH_TOKEN`
  from `claude setup-token`, or
- an Anthropic API key in `ANTHROPIC_API_KEY`.

The project was built for subscription auth for one person on their own machine. Anthropic
asks developers who build products for other people to use API key authentication. If you
run this for anyone other than yourself, use an API key.

## Running

```sh
npm run dev            # UI at http://127.0.0.1:4130 (PORT to change)
npm run typecheck
npm test               # unit and corpus tests; no model calls
npm run build:corpus   # convert the corpus and print per-document stats and the integrity report
npm run integrity      # Suite B only
```

At startup, `npm run dev` sends one model request to warm the prompt cache.

### Evaluation (calls the model)

```sh
npm run eval                      # the authored questions in eval/authored.json
npm run eval -- --all             # authored plus all ~285 checklist-derived questions
npx tsx eval/run-sample.mts       # stratified sample: N=50 derived (seed 20261007) + authored
python3 eval/analyze.py           # summarize eval/results/results.jsonl
```

`run-sample.mts` reads `SEED`, `N`, `CONC` (concurrency), `ONLY` (truncate the question list)
and `OUT` (results path) from the environment. See `eval/README.md` for the scoring axes and
bars.

## Measured results

One run on 2026-10-07: 52 questions (50 checklist-derived, stratified by checklist, seed
20261007, plus 2 authored), `claude-sonnet-5`, up to 3 attempts, concurrency 3. Full write-up:
[`eval/results/2026-10-07-sample52.md`](eval/results/2026-10-07-sample52.md).

| | |
|---|---|
| Answered | 44 / 52 |
| Withheld after 3 attempts | 3 / 52 |
| Errors | 5 / 52 |
| Displayed quotations not found in the source | 0, because the gate blocks them |
| Drafts rejected by the gate | 35 / 85 (41%) |
| Questions that needed at least one retry | 24 / 52 (46%) |
| Correct source document, among answered questions with an expected document | 34 / 36 (94.4%) |
| Latency, median / p90 | 18.8 s / 61 s |

The model often quotes text that is not in the source: 41% of drafts contained at least one
such quotation. The gate keeps those quotations from being shown. It cannot make the model
quote accurately.

Limitations of this measurement:

- It is one run of 52 questions. The derived questions mostly test lookup.
- The authored set has only 2 questions, against 20–30 in the spec. Reasoning questions
  and questions the corpus does not answer are barely measured.
- "Correct source document" checks only which document was cited. Nobody graded the answers
  for substance.

## Known issues

- **Tool calls despite `allowedTools: []`.** The model sometimes tries to call a tool. The SDK
  then ends with `error_max_turns`. This caused 3 of the 5 errors.
- **Invalid JSON is not retried.** A draft that does not parse is reported as an error
  instead of being re-prompted. This caused 2 of the 5 errors.
- **Quotations from tables fail the gate.** `pdftotext -layout` places neighbouring columns
  between the lines of a table cell, so text from inside a cell may not occur in the extracted
  text as one run. All 3 withheld answers were caused by this.
- **Suite B fails on the corpus as shipped.** The Part 130 Requirement Checklist v5
  (2026-01-30) cites § 130.31(e). The copy of Part 130 in this repository ends at § 130.30.
  Either this copy of Part 130 is out of date or the checklist is wrong. This has not been
  resolved. `npm run integrity` exits non-zero until it is.

## Corpus

`corpus/` contains the 16 source documents, all published by the NYS Office of Cannabis
Management or the NYS Cannabis Control Board (Part 130). They were downloaded from the OCM
website (cannabis.ny.gov). The per-document download URLs were not recorded. OCM revises these
documents, and filenames carry the version date where OCM gave one.

- `corpus/*.pdf`: Part 130, the LQSS, the testing limits, guidance documents, the FAQs, the
  METRC analyte specification and the product-category crosswalk.
- `corpus/inspection-checklists/*.pdf`: the six OCM inspection checklists.
- `corpus/markdown/*.md`: `pdftotext -layout` conversions of all 16 documents, kept for
  reading and grepping. The application does not use them. It converts the PDFs at startup.

OCM also publishes Part 130 as `part-130-cannabis-laboratories-adopted.pdf`, which is
byte-identical. Only one copy is included.

When OCM revises a document, replace the PDF, update `src/corpus/manifest.ts` if the
filename changed, then run `npm run build:corpus` and the evaluation again before relying on
answers.

## License

The code and documentation are released under the MIT License (see `LICENSE`). The documents
in `corpus/` are public documents of the State of New York. They are not covered by this
license.
