---
id: 007
title: Assemble SPEC.md
labels: [wayfinder:task]
status: closed
assignee: author
blocked-by: [002, 003, 004, 005, 006, 008]
closed: 2026-08-19
triage: ready-for-agent
parent: ../MAP.md
---

## Question

Nothing to decide — this is the destination artifact. Every decision on the map is
already made by the time this is takeable; this ticket writes them down as one coherent,
build-ready document that a build agent can execute without rediscovery.

`SPEC.md` must carry:

- The fixed constraints from the map's Notes (user, corpus, model, access path, auth).
- The access and credential design, from 001.
- The corpus preparation pipeline and its regeneration story, from 002 — including the
  resolution of the Part 130 duplicate.
- The citation contract and refusal behavior, from 003 — stated precisely enough to
  implement and to test.
- The retrieval architecture, from 004.
- The UI specification, from 005.
- The evaluation method and pass bar, from 006.
- The system prompt, in full.
- Explicit non-goals, lifted from the map's Out of scope section, so a build agent does
  not helpfully add SOP ingestion or multi-user auth.

Take this ticket only when tickets 001–006 are all closed. If any decision is still open
at that point, the map is not finished and this ticket is not takeable.

## Answer

**Resolved 2026-08-19. `SPEC.md` written to the project root** (427 lines) and labelled
`ready-for-agent`.

All seven prior Decision tickets were closed before this was taken; nothing was decided here.

**Test seams**, confirmed with the operator before writing:

| Seam | Model? | Purpose |
|---|---|---|
| `buildCorpus(pdfDir) → corpusDir` | no | build-time conversion, TOC stripping, page map |
| `verifyCitations(draft, corpus) → GateResult` | no | the hard gate; carries the 100% bars |
| `answerQuestion(question, corpus) → AnswerResult` | yes | the pipeline; Suite A runs here |

The gate was given its own seam deliberately: it is the only component with a 100% hard bar,
it is fully deterministic, and testing it through the pipeline would mean running a language
model to check a string comparison.

**Carried into the spec as explicit do-not-undo items**, because each was chosen against the
obvious alternative:

- The console API key is ruled out; citation integrity is the application's obligation.
- Streaming weakens the gate's guarantee — accepted deliberately, must not be "fixed".
- The Part 130 duplicate is excluded, **not deleted**.
- TOC stripping is a hard requirement, because a TOC stub passes the gate.
- Gate normalization is mandatory, or the gate rejects correct answers.

**Ships with one open defect:** § 130.31 requires resolution or a recorded waiver.
