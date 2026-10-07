---
id: 002
title: What artifact does the agent read — raw PDFs or pre-converted markdown?
labels: [wayfinder:prototype]
status: closed
assignee: author
blocked-by: []
closed: 2026-08-19
parent: ../MAP.md
---

## Question

Decide the on-disk form of the corpus the agent reads. This drives citation quality more
than any other decision on the map: the agent can only cite as precisely as the artifact
lets it locate a passage.

The fork:

- **(a) Raw PDFs, read in place.** Zero preparation, zero staleness risk, nothing to
  regenerate when OCM revises a document. But page/section anchoring is only as good as
  whatever the reading tool returns, and grep over a PDF is not possible.
- **(b) Pre-converted markdown with explicit section anchors.** One-time conversion
  (`pdftotext` is available and all 16 documents have clean text layers). Makes documents
  greppable and lets every heading carry a stable anchor — `part-130.md#130-22` — so a
  citation can point at something addressable. Costs a conversion pipeline and a
  regeneration story.
- **(c) Both** — markdown for retrieval and anchoring, PDFs retained for page-number
  fidelity.

Raise the fidelity of this discussion by **actually converting two contrasting documents**
and inspecting the result. Suggested pair: `part-130-cannabis-laboratories.pdf` (deep
`§ 130.x` hierarchy, 62pp) and `inspection-checklists/ocm-chemistry-checklist-v11-2-2-26.pdf`
(21pp of tabular requirement rows — the format most likely to convert badly). If tables
survive conversion legibly, (b) is viable; if they shred, that is decisive.

Also settle here:

- **The Part 130 duplicate.** `part-130-cannabis-laboratories.pdf` and
  `-adopted.pdf` are byte-identical. Which one reaches the agent, and is the other
  removed, ignored, or moved aside?
- **Document identity.** How each document announces itself to the agent — filename alone
  is cryptic (`ocm-testing-limits-2-9-26.pdf` does not say it is authoritative for action
  limits). Does each document need a title/authority/effective-date header?

Link the converted samples as assets; do not paste them into this ticket.

## Answer

**Resolved 2026-08-19.** The corpus is **both** converted markdown and the original PDFs,
and the agent reads both — markdown to search, the source PDF to verify before answering.

### The decision

1. **Convert all 16 documents with `pdftotext -layout`** into markdown, one file per
   document, under a `corpus-md/` directory. `-layout` is not optional: it is the only
   extraction mode that keeps a checklist row ID attached to its requirement text.
2. **Retain the original PDFs.** They are not merely a regeneration source — the agent
   opens them.
3. **The agent workflow is grep-then-verify.** Search the markdown to locate a passage,
   then open the source PDF and confirm the passage before presenting it in an answer.
4. **The PDF governs on conflict.** Markdown is a search index, not an authority. Where a
   conversion artifact makes the two disagree, the PDF is correct by definition.
5. **Every markdown file carries front-matter pointing back at its source PDF.** This is
   forced by (3) — without a `source_pdf` pointer the verification step has nothing to
   open. Minimum fields:

   ```yaml
   ---
   document_id:   part-130-cannabis-laboratories
   title:         "Part 130 — Cannabis Laboratories (9 NYCRR)"
   authority:     NYS Cannabis Control Board
   source_pdf:    ../part-130-cannabis-laboratories.pdf
   effective_date: <where the document states one>
   anchor_scheme: section        # section | row-id | page | none
   ---
   ```

   `anchor_scheme` is per-document because no single scheme covers the corpus (see
   Evidence 3 below). Filenames alone are cryptic — `ocm-testing-limits-2-9-26.pdf` does
   not announce that it is authoritative for action limits — so `title` and `authority`
   are load-bearing, not decoration.
6. **The Part 130 duplicate is excluded, not deleted.**
   `part-130-cannabis-laboratories-adopted.pdf` is byte-identical to
   `part-130-cannabis-laboratories.pdf` (md5 `d277c1cf01508e029ca98d1106700b36`). Convert
   and expose only the latter. Leave the file on disk untouched; the spec states the
   exclusion, it does not remove the operator's file.

### Evidence

Prototype artifacts: all 16 documents converted, now under `corpus/markdown/` in this
repository. The raw-vs-layout samples are not included.

1. **`-layout` is the only viable extraction mode.** In raw mode the chemistry checklist
   detaches every row ID and its `LQSS, IV` citation from the requirement text they
   belong to. In `-layout` the table is visually coherent and attributable. Squeezing the
   whitespace to recover tokens re-breaks it — the row ID floats mid-paragraph again.

2. **The whitespace tax is real and worth paying.**

   | Mode | Est. tokens | Tables |
   |---|---|---|
   | raw | ~108K | mangled |
   | `-layout` squeezed | ~110K | mangled |
   | **`-layout` full** | **~146K** | **legible** |

   35% more tokens for readable tables, in a 1M-token window, is free.

3. **No single citation anchor covers the corpus.** Part 130's `§` headings extract
   cleanly — 28 body occurrences, zero duplicates, TOC separable by position. But page
   markers are present in only **13 of 16** documents; `mrta-requirement-checklist`,
   `cannabis-analyte-testing-specifications`, `crosswalk-metrc-product-categories`, and
   `sampling-firm-and-lab-testing_q-and-a` have none. Hence per-document
   `anchor_scheme`. **Hand-off to ticket 003** — this constrains the citation contract.

4. **TOC/body collision hazard.** Grepping `§ 130.22` in Part 130 hits the table of
   contents at line 36 before the real section at line 1760. A naive search lands on a
   TOC stub containing no requirement text. The conversion must mark or strip the TOC
   region, or retrieval must skip it. **Carried into ticket 004.**

5. **Corpus size correction.** The map's charting-time figure of ~80K tokens was low —
   it used too optimistic a tokens-per-word ratio for text this dense in `§` symbols,
   numbers, and tables. Real figure is **~110K–146K** depending on extraction mode. No
   decision changes; headroom in a 1M window is still ~7x. A precise count via
   `count_tokens` needs API access and is blocked behind ticket 001.

### ⚠️ SUPERSEDED IN PART — see *Retrieval* (2026-08-19)

The **grep-then-verify workflow decided here no longer stands**. Residency removed the grep
step; the hard gate replaced the agent's PDF verification with a deterministic code check;
conversion fidelity moved to a one-time QA pass. Read that ticket for the current design.

**Still binding from this ticket:** `-layout` as the only usable extraction mode; the
per-document `anchor_scheme` finding; the Part 130 duplicate exclusion; PDFs retained on
disk (now for the operator, not the agent); "the PDF governs on conflict" (now resolved at
conversion-QA time rather than per answer). The **TOC/body collision** identified here is
promoted to a hard conversion requirement.

### Superseded note (was: Status confirmed 2026-08-19)

*Access path* selected the Agent SDK, which supplies Read/Grep/Glob. The grep-then-verify
workflow below is therefore **confirmed unconditionally** — and, with no API-side
`citations` feature available, it is now the design's primary anti-fabrication mechanism
rather than a convenience.

### Consequences for other tickets

- **004 (retrieval) is narrowed, not resolved.** Choosing grep-then-verify rules out
  "whole corpus resident in context" as the primary mechanism. What survives is the
  silent-miss risk: an agent that searches badly never learns it missed a governing
  section. Whether a resident index/TOC is needed to mitigate that is still open.
- **003 (citation contract)** inherits the per-document `anchor_scheme` finding and the
  "PDF governs" rule.
