---
title: OCM Regulatory Assistant — Build Specification
status: ready-for-agent
source_map: wayfinder/MAP.md
derived_from: wayfinder/tickets/001-008
date: 2026-08-19
---

# OCM Regulatory Assistant — Build Specification

> Produced by the wayfinder map at `wayfinder/MAP.md`. Every decision below is recorded in
> a closed Decision ticket under `wayfinder/tickets/`; consult those for the reasoning and
> the evidence. **Do not relitigate settled decisions** — several were chosen against the
> obvious alternative for stated reasons.

## Problem Statement

I work in a NY-licensed cannabis testing lab. My regulatory obligations
live across 16 OCM documents — Part 130, the Laboratory Quality System Standard, testing
limits, guidance documents, and six inspection checklists — totalling 208 pages.

When a compliance question comes up mid-task, answering it means knowing which of those 16
documents governs, finding the right section, and reading it. That is slow, and I do it
many times a week.

General-purpose chatbots are worse than useless here. They answer confidently about cannabis
regulation from training data that is not New York's, and they invent section numbers. **An
incorrect answer that looks correct is the worst possible outcome** — it can put the
laboratory out of compliance, and it is indistinguishable from a correct one at the moment
I read it.

## Solution

A local, single-user web chat interface over an agent whose entire knowledge is the 16 OCM
documents.

Its defining property is not fluency — it is that **every claim it makes about the
regulations is traceable to text that provably exists in those documents.** The system
verifies each quoted passage against the corpus in code before showing me an answer, and
visibly separates what the regulations say from what the agent concluded.

When the regulations are silent, it tells me so first, rather than reasoning into the gap.

## User Stories

### Asking and answering

1. As the laboratory's compliance owner, I want to ask a regulatory question in plain
   language, so that I do not have to know in advance which of the 16 documents governs it.
2. As the compliance owner, I want the agent's knowledge restricted to the 16 OCM documents,
   so that it never answers from another state's rules or from general training data.
3. As the compliance owner, I want every regulatory claim to carry the exact words from the
   source, so that I can judge the claim rather than trust the summary.
4. As the compliance owner, I want every quoted passage accompanied by its location, so that
   I know where to look without searching.
5. As the compliance owner, I want answers that draw on several documents at once, so that a
   question spanning Part 130 and the LQSS gets one coherent answer.
6. As the compliance owner, I want the agent to survey the whole corpus before concluding a
   topic is unaddressed, so that it does not declare silence it has not checked for.

### Trusting the answer

7. As the compliance owner, I want each quoted passage machine-verified against the corpus
   before I see it, so that a fabricated quotation cannot reach me.
8. As the compliance owner, I want an answer withheld entirely when a quotation cannot be
   verified, so that the system fails closed rather than open.
9. As the compliance owner, I want to see which quotation failed verification when an answer
   is withheld, so that I can tell a model error from a corpus problem.
10. As the compliance owner, I want statements of regulation kept visually separate from the
    agent's inferences, so that I never mistake an opinion for a requirement.
11. As the compliance owner, I want the agent's reasoning labelled as inference, so that its
    conclusions are legible as conclusions.
12. As the compliance owner, I want to be told when the corpus does not address my question
    **before** any reasoning is offered, so that I do not read an inference as a rule.
13. As the compliance owner, I want the nearest adjacent requirement surfaced when the corpus
    is silent, so that a gap is still an informative answer.
14. As the compliance owner, I want per-citation verification status shown, so that a
    partially-verified answer is localisable to the specific quotation that failed.

### Verifying for myself

15. As the compliance owner, I want to click a citation's location and open the source PDF at
    the cited page, so that I can confirm a claim against the governing original in seconds.
16. As the compliance owner, I want the original PDFs retained on disk, so that the authored
    document remains available regardless of what the conversion produced.
17. As the compliance owner, I want to export a single answer with its quotations and
    locations intact, so that I can paste it into an SOP justification, a CAPA, or an
    inspection response.

### Watching it work

18. As the compliance owner, I want to see the answer as it is written, so that I can follow
    the agent's reasoning rather than wait at a blank screen.
19. As the compliance owner, I want streamed text removed outright when verification fails,
    so that no incorrect statement remains on screen to be misremembered.
20. As the compliance owner, I want the system to fail gracefully when the subscription usage
    limit is reached, so that I get a clear message rather than an opaque error.

### Keeping the corpus sound

21. As the compliance owner, I want every citation appearing in any corpus document checked
    against the section it names, so that a document referencing a non-existent section is
    caught before it misleads me.
22. As the compliance owner, I want the corpus rebuilt from the PDFs by a repeatable script,
    so that an OCM revision is absorbed by rerunning it.
23. As the compliance owner, I want the integrity check to run on every rebuild, so that a
    revision that breaks a cross-reference is caught immediately.
24. As the compliance owner, I want duplicate documents excluded from the corpus, so that a
    regulation is not double-weighted.

### Measuring it

25. As the compliance owner, I want a suite of questions with known correct citations, so
    that I can measure the assistant rather than form an impression of it.
26. As the compliance owner, I want questions derived from the inspection checklists, so that
    measurement covers the corpus systematically rather than only where I thought to look.
27. As the compliance owner, I want to add my own hard questions to the suite, so that
    reasoning and silence-handling are measured, not just lookup.
28. As the compliance owner, I want deterministic axes held to 100%, so that a failure there
    is unambiguously a defect and not a model judgment call.
29. As the compliance owner, I want the evaluation rerun after any corpus or prompt change,
    so that a regression is caught before I rely on it.

## Implementation Decisions

### Access and model — settled, do not revisit

- **Claude Max/Pro subscription driven through the Claude Agent SDK.** The console API key
  and Messages API are **ruled out**. Authentication is ambient OAuth (`claude setup-token`
  / `CLAUDE_CODE_OAUTH_TOKEN`); the SDK spawns a `claude` CLI subprocess and inherits the
  credential. There is no in-SDK auth helper to call.
- **Model: `claude-sonnet-5`,** pinned explicitly. Native 1M-token context.
- This was chosen **knowing** the Messages API offers a first-party `citations` feature
  returning machine-verified spans, and that the Agent SDK offers neither `citations` nor
  `cache_control`. See *Access path*. **The consequence is that citation integrity is this
  application's obligation, discharged by the gate below.** A build agent must not
  reintroduce an API-key path.
- The Agent SDK caches automatically and exposes no `cache_control` handle. Do not attempt
  to steer caching.
- Accepted risks, recorded so they are not rediscovered: subscription usage limits are
  unpublished and unqueryable; Consumer-versus-Commercial Terms for the Agent SDK are
  unresolved in Anthropic's published documentation; a 2026-06 change moving SDK usage off
  subscription limits was paused, not cancelled. **The application must fail gracefully on
  a usage-limit error rather than assume headroom.**
- With the corpus resident and no per-answer document reads, **the agent requires no
  filesystem tools for normal operation.** The design reduces to a large cached system
  prompt plus a conversation.

### Corpus construction (Seam 1)

Build-time, no model involved. Input: the 16 source PDFs. Output: a corpus directory.

- **Extraction is `pdftotext -layout`.** Not optional. It is the only mode in which a
  checklist row identifier stays attached to its requirement text; raw mode and
  whitespace-squeezed mode both detach them. `-layout` costs ~35% more tokens (~146K versus
  ~108K) — irrelevant in a 1M window.
- **Exclude `part-130-cannabis-laboratories-adopted.pdf`.** It is byte-identical to
  `part-130-cannabis-laboratories.pdf` (md5 `d277c1cf01508e029ca98d1106700b36`). **Exclude,
  do not delete** — the operator's files are not removed.
- **Strip or explicitly mark the table-of-contents region of every document.** This is a
  hard requirement, not an optimization. Part 130's TOC contains
  `§ 130.22 Testing of Cannabis Product and Medical Cannabis.` verbatim at line 36, with the
  real section at line 1760. A TOC stub quoted as a citation **passes the gate** — the string
  genuinely is in the corpus — while carrying no requirement text. It is the one
  fabrication-adjacent failure nothing else in this design defends against.
- **Emit a page map** — page number to character/line range, per document. Required by the
  click-to-open-PDF behaviour. `pdftotext -layout` emits form-feed (`\f`) page breaks whose
  count matches the true page count in **16 of 16** documents, so page position is
  recoverable corpus-wide. (Note the distinction: *printed* "Page X of Y" text appears in
  only 13 of 16; *structural* page breaks appear in all 16. The latter is what this uses.)
- **Each document carries front-matter.** Filenames are cryptic —
  `ocm-testing-limits-2-9-26.pdf` does not announce that it is authoritative for action
  limits — so title and authority are load-bearing:

  ```yaml
  document_id:    part-130-cannabis-laboratories
  title:          "Part 130 — Cannabis Laboratories (9 NYCRR)"
  authority:      NYS Cannabis Control Board
  source_pdf:     ../part-130-cannabis-laboratories.pdf
  effective_date: <where the document states one>
  anchor_scheme:  section        # section | roman-part | row-id | qa-pair | none
  ```

- **`anchor_scheme` is per-document because no single scheme covers the corpus.** Part 130
  uses `§ 130.x(a)`; LQSS uses roman-numeral parts; the checklists use numbered rows; the
  Q&A documents have only question text; the one-page analyte specifications have no internal
  structure at all.
- The PDFs remain on disk **for the operator**, reachable from the interface. The agent does
  not read them at request time.

### Retrieval — there isn't any

- **The entire converted corpus is resident in the system prompt on every turn**
  (~110K–146K tokens of a 1M window). There is no search step, no index, no vector store, no
  chunking.
- This eliminates the silent miss as a *retrieval* failure. **It converts it into an
  attention failure** — presence in context is not attention to the right passage. The system
  prompt must therefore direct the agent to survey the corpus before concluding a topic is
  unaddressed.
- An auto-extracted structural index was measured at ~1,357 tokens but finds headings in only
  7 of 16 documents — blind on `ocm-testing-limits` (where every action limit lives), all
  three Q&A/FAQ documents, and both guidance documents. Residency makes any index redundant.
- **Note:** an earlier decision specified a grep-then-verify workflow with a per-answer PDF
  read. **That is superseded.** Residency removed the search step; the gate replaced the
  agent's PDF verification with deterministic code; conversion fidelity moved to a one-time
  QA pass.

### The citation contract

- **A citation is a verbatim quotation plus a structural anchor.** Both required.
- The **quotation is the proof** — the only element verifiable across the whole corpus. A
  9-word span drawn from the middle of each document was recovered under whitespace
  normalization in **16 of 16**.
- The **anchor is the address**, in the document's own vocabulary.
- A fabricated anchor is undetectable on its own: `§ 130.31` reads exactly as plausibly as
  `§ 130.22`. Pairing means **the quotation defends the anchor**.

### The gate (Seam 2) — pure, deterministic, no model

Runs on every answer before it is finalised.

- Extract every quoted span from the draft; match each against the corpus.
- **All match** → answer stands. **Any miss** → answer is withheld; the agent is told *which*
  quotation failed and retries; after N attempts the system reports it could not answer with
  verifiable citations. **It does not answer anyway.**
- **Normalization is mandatory on both sides before comparison.** The corpus contains 139 ×
  `’` (U+2019), 301 × `–` (U+2013), and 58 × curly double quotes. A model emitting a
  straight `'` where the source has `’` **misses on text it quoted correctly** — turning the
  safety mechanism into a denial of service. Apply: Unicode NFKC; curly quotes and
  apostrophes folded to straight; en/em dashes folded to hyphen; all whitespace runs collapsed
  to a single space (required regardless, since `-layout` pads columns and breaks sentences
  across lines).
- Tolerate mid-quotation elision (`…`) by matching the segments either side independently.
- Resolve each verified quotation's offset to a page via the page map, for the
  click-to-open behaviour.

### Answer structure

Fixed. Two registers plus a conditional banner.

| Element | Content | Gated |
|---|---|---|
| **Silence banner** | Shown only when the corpus does not address the question. Appears **above everything else**, before any reasoning. | n/a |
| **What the regulations say** | Only quoted, anchored statements. | Every line |
| **My reading** | The agent's inference. Explicitly labelled; never dressed as a citation. | Not gated |

- The two-register split exists because **the gate inspects only quoted spans** — unquoted
  connective prose passes trivially, so an agent can satisfy the gate and still be wrong by
  putting the wrongness in the conclusion. Regulatory work genuinely needs that inferential
  step, so it is separated rather than banned.
- When the corpus is silent the agent may still surface the nearest adjacent requirement and
  name the gap — but the silence is declared first, never buried under the reasoning.

### Interface (above Seam 3)

- **Streaming: the answer streams as it is produced; the gate runs after.**
- **⚠️ Accepted tension, recorded deliberately.** This was chosen *knowing* it conflicts with
  why the hard gate was chosen: the gate exists so an incorrect answer cannot reach the
  reader, and streaming means it reaches them and is then withdrawn. The guarantee weakens
  from "you never see it" to "you never see it un-retracted." This is a deliberate trade for
  a single expert reader who wants to watch the work. **A build agent must not "fix" this
  back to complete-only rendering.**
- **Retraction replaces, it does not annotate.** On gate failure the streamed text is
  **removed** and the withheld-answer panel takes its place, showing the unverified quotation
  and its claimed anchor. Nothing incorrect remains on screen.
- **Verification status is shown per citation**, not summarised once, so a partial state is
  localisable to a specific quotation.
- **Clicking an anchor opens the source PDF at the cited page.**
- **Single-answer export** with quotations and anchors intact. **No persistent history.**
- **Typography carries the register distinction:** quoted regulation in a serif, interface
  chrome in a sans, anchors and gate status in mono. Statutory text should look statutory;
  identifiers should look like identifiers. The effect is that the register being read is
  identifiable before a word is parsed. Prototype: `wayfinder/prototypes/005/answer-view.html`.
- There is **no authentication** — single user, local.

## Testing Decisions

**What makes a good test here:** assert on externally observable behaviour — what the caller
receives — never on internal structure. A gate test asserts "this draft is rejected and names
this quotation", not which helper was invoked. Because the two deterministic seams need no
model, they must be fast, free, and exhaustive; reserve model calls for the one seam that
genuinely requires them.

**No prior art exists in this repository** — it contains no application code.

### Seam 1 — `buildCorpus(pdfDir) → corpusDir`

Build-time, no model. Assert on produced artefacts:

- All 16 documents converted; the Part 130 duplicate excluded.
- Checklist row identifiers remain on the same line as their requirement text (the `-layout`
  regression test).
- TOC regions stripped or marked — specifically, that Part 130's TOC copy of
  `§ 130.22 Testing of Cannabis Product and Medical Cannabis.` is not quotable as a citation.
- Page map emitted for every document; page count matches `pdfinfo` for all 16.
- Front-matter present and complete, with a valid `anchor_scheme`.

### Seam 2 — `verifyCitations(draft, corpus) → GateResult`

Pure and deterministic. **This is where the 100% bars live**, and it must be testable in
milliseconds with no API calls. Cover:

- A quotation present verbatim → passes.
- A fabricated quotation → rejected, and the result **names which** quotation failed.
- **Normalization matrix** — the highest-value tests in the suite, because getting these
  wrong makes the gate reject correct answers: straight versus curly apostrophe; hyphen
  versus en dash; straight versus curly double quotes; whitespace runs and mid-sentence line
  breaks; NFKC-normalizable forms.
- Elided quotations (`…`) matching on both segments.
- Anchor-to-page resolution correct against the page map.
- A quotation drawn from a TOC region → rejected (guards the Seam 1 requirement from the
  other side).

### Seam 3 — `answerQuestion(question, corpus) → AnswerResult`

The pipeline; the only seam requiring a model. This is where **Suite A** runs:

- **Checklist-derived questions (~100+)** — each checklist row becomes a lookup question whose
  ground-truth citation is the row's own citation column. Gives systematic coverage of 208
  pages. **⚠️ Extraction is not a regex job:** citation cells are vertically centred and split
  across lines, yielding 106 extractable strings from the equipment checklist and 57 from
  Part 130's, but 4 from chemistry and 0 from microbiology. Budget real work.
- **Operator-authored questions (20–30)** — real questions needing reasoning, and questions
  where the corpus is genuinely silent. The derived set tests **lookup**; only these test
  **inference** and **silence**.

Assert per question: every quotation verified; the anchor correct; each statement in the
correct register; silence declared when and only when the corpus is silent.

Also test: graceful failure on a usage-limit error; gate-failure retry then refusal.

### Suite B — corpus integrity

Already built and passing as a script: `wayfinder/prototypes/006/corpus-integrity.py`.
Cross-checks every regulatory citation in every corpus document against the section or part
it names; exits non-zero on any dangling citation. Runs on every rebuild.

**It currently FAILS, by design, on a real defect** — see Further Notes.

### Pass bars — per axis, not one number

| Axis | Bar | Kind |
|---|---|---|
| Quotation verified against corpus | 100% | **hard** — deterministic; anything less is a gate defect |
| Dangling citations in corpus | 0 | **hard**, or an explicitly recorded waiver |
| Anchor resolves to correct page | 100% | **hard** — mechanically checkable |
| Answer substantively correct | ~90% | target, tracked |
| Statement in correct register | ~95% | target, tracked |
| Silence declared when corpus silent | ~90% | target, tracked |

Mechanical axes are absolute because they are deterministic. Judgment axes are tracked
against a target rather than gated — gating on a model-judgment number would make the bar
meaningless.

### Regression

On any OCM revision or system-prompt change: **reconvert → rerun conversion QA → run Suite B
→ run Suite A**, in that order, before serving answers.

## Out of Scope

- **The lab's own analytical method SOPs, quality manual, and other internal documents.** The assistant is an authority on what OCM *requires*; the
  operator maps that onto their own procedures. Considered and explicitly rejected.
- **Reg-versus-SOP conflict resolution.** Follows from the above — with no SOPs ingested there
  is no conflict to arbitrate.
- **SOP revision tracking and `.docx` ingestion.** Same cause.
- **Multi-user access, authentication, per-user credentials.** Single-user tool.
- **LIMS, senaite, eLabFTW integration, and live batch data.** A separate effort.
- **Client- or licensee-facing use.** Internal only; an external-facing regulatory assistant
  carries a different liability profile and would be a different specification.
- **Persistent conversation history.** Single-answer export only.
- **Console API key / Messages API.** Ruled out with the trade-off fully argued.
- **Vector databases, embeddings, chunking, RAG.** The corpus fits in context.

## Further Notes

### ⚠️ Open corpus defect — resolve or waive before shipping

**§ 130.31 does not exist.** The **OCM Part 130 Requirement Checklist v5** (dated 2026-01-30)
cites `§ 130.31(e)` for a sample-storage requirement at line 392. **Part 130 in this corpus
runs § 130.1 – § 130.30 and stops.** Adjacent rows cite `§ 130.30(d)` — but § 130.30 is
*Severability*, which says nothing about storage.

The incrementing pattern across rows 69–73 (`130.27(a)`, `130.28(b)`, `130.29(a)/(c)`,
`130.30(d)`, `130.31(e)`) suggests these should be subsections of one section, most plausibly
§ 130.27 *Security, Safety and Storage of Cannabis*. **This is verified against the source
PDF — it is not a conversion artefact.**

Whether the Part 130 copy is outdated or the checklist's citation column is wrong **cannot be
determined from the corpus.** It requires checking OCM's currently published Part 130. Until
resolved, shipping requires an explicitly recorded waiver — a conscious decision, not a
silent skip.

This defect matters beyond itself: everything else in this design defends a different failure.
The gate stops fabricated quotations; residency stops missed documents. **Nothing else detects
that two official documents contradict each other.**

### Other corpus observations

- **Part 130's own table of contents is stale relative to its body** — the TOC lists to
  § 130.26 while the body runs to § 130.30.
- **LQSS has no Part XIII** — it runs I–XII then jumps to XIV (Change Record). Nothing cites
  XIII, so it is not a live defect, but a question about it would find genuine silence.

### Corpus size

~59,000 words / **~110K–146K tokens** depending on extraction mode / 208 pages. Charting
estimated ~80K, which was low. Sonnet 5 may use a tokenizer counting ~30% higher, in which
case the true figure is nearer 190K. **Settle it with one `count_tokens` call before tuning
anything on the number.** Either way there is substantial headroom in a 1M window and no
decision turns on it.

### Decision provenance

| Decision ticket | Settles |
|---|---|
| 001 Subscription viability | Subscription path works and is permitted; surfaced the `citations` trade-off |
| 002 Corpus preparation | `-layout`, anchor schemes, duplicate exclusion, TOC hazard (grep-then-verify since superseded) |
| 003 Citation contract | Quote + anchor, hard gate, two registers, silence, normalization |
| 004 Retrieval | Whole corpus resident; per-answer PDF read dropped; TOC stripping promoted to hard requirement |
| 005 UI shape | Streaming, retraction, per-citation status, click-to-PDF, export, typography |
| 006 Correctness evaluation | Suites A and B, question sources, per-axis pass bars, regression order |
| 008 Access path | Subscription + Agent SDK; API key ruled out |
