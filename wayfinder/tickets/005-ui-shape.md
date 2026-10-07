---
id: 005
title: What does the web UI actually look like and do?
labels: [wayfinder:prototype]
status: closed
assignee: author
blocked-by: [003]
closed: 2026-08-19
parent: ../MAP.md
---

## Question

Settle the interface. It is single-user and local, so there is no navigation, no account
surface, and no onboarding — which makes the few real questions sharper:

- **Citation display.** The load-bearing UI decision. Inline footnote markers, a source
  panel beside the answer, expandable quoted passages, or links that open the underlying
  document at the cited section? The operator must be able to verify a claim in seconds,
  or the citation requirement is decorative.
- **Verification affordance.** Can the operator get from a cited `§ 130.22(b)` to the
  actual text without leaving the app? If not, will they actually check?
- **Streaming vs. considered answer.** Regulatory answers may involve the agent reading
  several documents before it can respond. Does the operator watch it work — which
  builds trust and exposes bad searches — or wait for a finished, cited answer?
- **Transparency of retrieval.** Should the UI show which documents were consulted? For a
  compliance tool this doubles as an audit trail and as a check on failure mode (a) in
  ticket 004.
- **History.** Is a prior answer revisitable, and does the operator need to export one —
  e.g. to paste a cited answer into an SOP justification or an inspection response?

Build a rough clickable or static prototype of the answer view — the citation-display
question in particular is not settleable in the abstract. Link it as an asset.

Depends on 003: you cannot design the display of a citation before deciding what a
citation is.

## Answer

**Resolved 2026-08-19.** Prototype:
[`../prototypes/005/answer-view.html`](../prototypes/005/answer-view.html) — published at
https://claude.ai/code/artifact/92edd7c4-3bfe-4cc0-833f-e238ce6da60a (three states, real
corpus text throughout).

### Decisions

| | |
|---|---|
| **Verification display** | **Per citation.** Every citation carries its own visible verified mark. Repetitive when all pass, but it makes a partial-verification state instantly localisable to a specific quote. |
| **Streaming** | **Stream, then gate.** Answer text streams as produced; the gate runs after. |
| **Retraction** | **Replaced outright.** On gate failure the streamed text is removed and the withheld-answer panel takes its place. Nothing incorrect remains on screen. |
| **Verification path** | **Anchor opens the source PDF at the cited page.** |
| **History** | **Single-answer export** — quotes and anchors intact, for pasting into an SOP justification, CAPA, or inspection response. No persistent history. |
| **Retrieval transparency** | **Moot.** *Retrieval* made the whole corpus resident, so there is no "documents consulted" to disclose — only documents cited, which the citation register already shows. |

### Typographic decision worth carrying into the build

Quoted regulation is set in a **serif** (Spectral); UI chrome in a **sans** (IBM Plex Sans);
anchors and gate status in **mono** (IBM Plex Mono). Statutory text should look statutory,
and identifiers should look like identifiers. The effect is that the register you are
reading is identifiable before a word is parsed — which is the citation contract's
two-register separation expressed typographically rather than only by heading.

### ⚠️ Accepted tension, recorded deliberately

The operator chose **stream-then-gate** having been shown that it conflicts with why the
hard gate was chosen in *What must a citation contain*: the gate exists so a confident
wrong answer cannot reach the reader, and streaming means it reaches them and is then
withdrawn. The guarantee weakens from *"you never see it"* to *"you never see it
un-retracted."*

This is a deliberate trade for a single expert reader who wants to watch the work, **not an
oversight**. It is recorded here so the build does not silently "fix" it back to
complete-only rendering. Its mitigation is the retraction rule above: replacement, not
annotation, so nothing wrong is left readable.

### New requirement this surfaced — page mapping

"Anchor opens the PDF at the cited page" requires a page number per citation, which the
citation contract does **not** record — its anchors are structural (`§ 130.22(a)`,
`LQSS Part IV`, row IDs).

**Verified during this ticket: `pdftotext -layout` emits form-feed (`\f`) page breaks whose
count matches the true page count in 16 of 16 documents.** Page position is therefore
recoverable for the entire corpus.

Note the distinction from the earlier finding: *printed* "Page X of Y" text is present in
only 13 of 16, but *structural* page boundaries are present in all 16. The latter is what
matters here.

**Therefore the conversion step must additionally emit a page map** — page number to
character/line range per document — so a verified quote's offset resolves to a page. This
joins TOC-stripping as a hard conversion requirement.

### Hand-off

**Correctness ticket** gains a gradable axis: does the anchor resolve to the page the quote
actually appears on? The page map makes that checkable automatically.
