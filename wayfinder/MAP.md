---
labels: [wayfinder:map]
created: 2026-08-19
---

# Map: OCM Regulatory Expert Chatbot

> **COMPLETE 2026-08-19** — all 8 Decision tickets closed. Destination reached:
> [`SPEC.md`](../SPEC.md). One open corpus defect (§ 130.31) requires resolution or a
> recorded waiver before the build ships.

## Destination

A **build-ready spec** (`SPEC.md`) for a single-user local web chat UI over a dedicated
agent that is an expert on NYS OCM cannabis-laboratory regulation — every architecture
decision locked and written down, so a build agent can execute it without further
discovery. No application code is written while working this map.

## Notes

**Domain.** New York State Office of Cannabis Management (OCM) laboratory regulation:
Part 130 (9 NYCRR), the Laboratory Quality System Standard (LQSS), OCM testing limits
and guidance, and six OCM inspection checklists. The user is a NY-licensed cannabis
testing lab.

**Fixed constraints** (settled during charting — do not relitigate without redrawing the
destination):

| | |
|---|---|
| User | One person, the map's owner. Daily lab-ops compliance questions. |
| Knowledge | The 16 OCM documents in `corpus/`. Nothing else. |
| Corpus size | ~59K words / **~110K–146K tokens** (may be ~30% higher if Sonnet 5 uses the newer tokenizer — settle with one `count_tokens` call) / 208 pages. All clean text layers, no OCR needed. (Charting estimated ~80K; corrected by *What artifact does the agent read*. ~7x headroom in a 1M window either way.) |
| Model | Sonnet 5 (`claude-sonnet-5`), 1M-token context |
| Access | **FIXED — Claude Max/Pro subscription + Claude Agent SDK.** Console API key ruled out by operator decision 2026-08-19 with the `citations` trade-off fully argued. Auth is ambient OAuth (`claude setup-token`). **Settled — do not relitigate.** Consequence: no API-side citation verification, so citation integrity is a design obligation. |
| Auth | None. Single user, runs locally. |
| Hard requirement | **Every claim carries a citation.** A confident wrong answer about a regulation is the failure mode that matters. |

**Corpus hazard.** `part-130-cannabis-laboratories.pdf` and
`part-130-cannabis-laboratories-adopted.pdf` are **byte-identical** (md5
`d277c1cf01508e029ca98d1106700b36`). Feeding both double-weights the regulation and
produces confusing citations. Exactly one must reach the agent.

**Latent asset.** The six inspection checklists are structured requirement tables whose
rows already cite back into LQSS and Part 130 by section ID. They are a pre-built
cross-reference layer and an unusually good ready-made evaluation set.

**Pricing note (2026-08-19).** Sonnet 5's $2/$10-per-MTok introductory rate is
**permanent** — the scheduled 2026-09-01 increase to $3/$15 will not occur. Earlier
sessions worked from the stale assumption; do not re-derive costs from it.

**Skills every session should consult:** `/grilling` and `/domain-modeling` by default;
`/research` for AFK research tickets; `/prototype` for prototype tickets; `/claude-api`
before asserting any fact about models, pricing, caching, or SDK surfaces.

**Plan, don't do.** This map is planning-only — wayfinder's default. Tickets resolve
decisions; they do not build the product.

## Tracker conventions

No issue tracker is configured for this directory, so this map uses the local-markdown
fallback.

- The map is this file. Tickets are files in `wayfinder/tickets/`.
- Ticket identity is its filename number. Front-matter carries `status`, `assignee`,
  `labels`, and `blocked-by`.
- Markdown has no native dependency edges, so **blocking is a body convention**:
  `blocked-by: [001, 002]` in front-matter.
- **The frontier** = tickets with `status: open`, `assignee: unassigned`, and every id in
  `blocked-by` already `status: closed`. Compute it with:
  `grep -H -E '^(status|assignee|blocked-by):' wayfinder/tickets/*.md`
- Claim a ticket by setting `assignee` **before** any work.

## Decisions so far

<!-- One line per closed ticket. The detail lives in the ticket, never here. -->

- [Can a Claude Max/Pro subscription drive a custom local web app?](tickets/001-subscription-viability.md) — **Yes**, technically and under the Consumer Terms' explicit carve-out, for genuine single-user use. But it surfaced a better reason to not use it: the Agent SDK has no `citations` and no `cache_control`. ⚠️ Sonnet 5's $2/$10 rate is now **permanent**; API path ≈ $45/mo at 30 q/day.
- [Access path — subscription + Agent SDK, or console key + Messages API?](tickets/008-access-path.md) — **Subscription + Agent SDK.** API key ruled out. Gains built-in Read/Grep/Glob and zero marginal cost; forgoes the `citations` feature and `cache_control`, so **citation integrity becomes a design obligation, not an API guarantee**.
- [Assemble SPEC.md](tickets/007-assemble-spec.md) — **Destination reached.** [`SPEC.md`](../SPEC.md) written to the project root, `ready-for-agent`. Three test seams confirmed: `buildCorpus` and `verifyCitations` (no model), `answerQuestion` (model). Ships with the § 130.31 defect open.
- [How is correctness measured before this is trusted?](tickets/006-correctness-evaluation.md) — Two suites. **Suite B (corpus integrity)** is built and **currently FAILS**: the Part 130 Requirement Checklist cites **§ 130.31, which does not exist** in Part 130 (§ 130.1–130.30). **Suite A** = checklist-derived lookup questions + 20–30 authored reasoning questions. **Per-axis bars**: mechanical axes 100% hard, judgment axes tracked targets. [Checker](prototypes/006/corpus-integrity.py).
- [What does the web UI actually look like and do?](tickets/005-ui-shape.md) — Per-citation verified marks; **stream-then-gate** with failed answers **replaced outright**; anchor opens the source PDF at the cited page; single-answer export, no history. Serif for statute / sans for chrome / mono for anchors. ⚠️ Records an accepted tension (streaming weakens the gate's guarantee — deliberate, do not "fix"). New hard requirement: **conversion must emit a page map** (`\f` breaks verified in 16/16). [Prototype](prototypes/005/answer-view.html).
- [Retrieval — grep-on-disk vs the whole corpus in context](tickets/004-retrieval-strategy.md) — **Whole corpus resident** (~110–146K tokens, all 16 docs, every turn). No retrieval step; silent miss eliminated as a *retrieval* failure (becomes an attention one). Per-answer PDF read **dropped** — conversion fidelity moves to a one-time QA pass. ⚠️ **Conversion must strip/mark TOC regions** — the gate verifies TOC stubs as valid quotes. Partly supersedes *What artifact does the agent read*.
- [What must a citation contain, and how is fabrication prevented?](tickets/003-citation-contract.md) — **Verbatim quote + structural anchor**, enforced by a **hard gate**: the app greps every quote pre-display; a miss blocks the answer, agent retries, then refuses. Answers use **two visibly separated registers** (cited vs inference) to close the unquoted-prose loophole. Silence declared before reasoning. ⚠️ Quotes and corpus **must** be Unicode-normalized first — 139 curly apostrophes and 301 en dashes would otherwise block correct answers.
- [What artifact does the agent read — raw PDFs or pre-converted markdown?](tickets/002-corpus-preparation.md) — Both. `pdftotext -layout` markdown to search, original PDF to verify before answering; **the PDF governs on conflict**. Per-document `anchor_scheme` front-matter, since no single citation anchor covers all 16. Part 130 duplicate excluded, not deleted. ✅ **Confirmed unconditional** by *Access path* — the Agent SDK supplies the filesystem tools grep-then-verify presumes.

## Known corpus defect — open

**§ 130.31 does not exist.** The OCM Part 130 Requirement Checklist v5 (2026-01-30) cites
`§ 130.31(e)`; Part 130 in this corpus runs § 130.1–§ 130.30. Verified against the source
PDF, not a conversion artifact. **Requires the operator to check OCM's currently published
Part 130** — either the corpus copy is stale, or the checklist is wrong. Until resolved,
shipping v1 needs an explicit recorded waiver. Detected by
[`prototypes/006/corpus-integrity.py`](prototypes/006/corpus-integrity.py).

## Not yet specified

In-scope fog. Too unsharp to ticket yet; graduates as the frontier advances.

- **Conversation persistence.** Whether sessions are durable, whether prior answers are
  revisitable, and whether the agent should remember anything across restarts. Hangs on
  the retrieval decision — a grep-on-disk agent and a context-stuffed one have very
  different notions of "session".
- **Local packaging and launch.** How this actually starts on the operator's machine, and
  how the subscription credential is presented to it. Blocked behind the subscription
  viability answer; the shape depends entirely on which access path survives.
- **Tools beyond reading.** Whether the agent needs anything besides document access —
  e.g. arithmetic over testing limits, unit conversion, action-limit lookups against the
  analyte tables. Suspected but unproven; may turn out to be one ticket, several, or none.
- _(Graduated 2026-08-19.)_ Corpus staleness is no longer fog: with the corpus resident and
  a one-time conversion QA pass, an OCM revision means reconvert → re-run QA → re-run the
  eval before serving. That is spec content for *Assemble SPEC.md*, not an open decision.

## Out of scope

Ruled beyond the destination. Never graduates; returns only if the destination is redrawn.

- **The lab's own analytical method SOPs**, quality manual, and other internal
  documents. Ruled out during charting: the agent is an authority on
  what OCM *requires*; the operator maps that onto their own SOPs.
- **Reg-vs-SOP conflict resolution** (e.g. an SOP stricter than OCM, and § 130.7 binding
  the lab to its own SOP). Follows the exclusion above — with no SOPs ingested, there is
  no conflict to arbitrate.
- **SOP revision tracking and docx ingestion.** Same cause.
- **Multi-user access, authentication, per-user credentials.** Single-user tool.
- **LIMS / senaite / eLabFTW integration and live batch data.** A separate effort.
- **Client- or licensee-facing use.** Internal tool only; the liability profile of an
  external-facing regulatory bot is a different destination.
