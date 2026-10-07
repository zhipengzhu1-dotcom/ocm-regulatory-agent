---
id: 006
title: How is correctness measured before this is trusted?
labels: [wayfinder:grilling]
status: closed
assignee: author
blocked-by: [003]
closed: 2026-08-19
parent: ../MAP.md
---

## Question

The operator flagged citation as mandatory but left measurement open. A regulatory
assistant that is not measured is vibe-checked, and the failure mode that matters —
confident and wrong — is precisely the one vibe-checking misses.

- **Is a formal eval in scope for v1 at all?** Argue it honestly. This is a single-user
  internal tool; a heavyweight harness may be over-engineering.
- **Where do the questions come from?** The six inspection checklists are structured
  requirement tables whose rows already carry citations into LQSS and Part 130 — a
  ready-made question/answer set with ground-truth citations, essentially free. Is that
  sufficient, or does it only test lookup and not the harder reasoning questions the
  operator actually asks?
- **What is scored?** Candidate axes: did it cite the *correct* section; did every cited
  anchor *exist*; was the substantive answer right; did it refuse when the corpus was
  genuinely silent. These are separable and a build could implement only some.
- **What is the pass bar,** and what happens if it is not met?
- **Regression.** When OCM revises a document or the system prompt changes, does the eval
  re-run, and is that automated or manual?

Depends on 003: you cannot grade a citation before defining what a valid one is.

## Answer

**Resolved 2026-08-19.** A formal evaluation **is** in scope for v1, in two suites — and
writing this ticket found a real defect in the corpus, which settled the scope question by
demonstration rather than argument.

### Suite B — corpus integrity (built, runs, currently FAILS)

Asset: [`../prototypes/006/corpus-integrity.py`](../prototypes/006/corpus-integrity.py)

Cross-checks every regulatory citation appearing in any corpus document against the
section or part it names. Exit 1 on any dangling citation.

**Current result: 1 dangling citation.**

```
130.31  cited in ocm-part-130-requirement-checklist-v5-1-30-26.md (line 392)
        - target does not exist
```

The **OCM Part 130 Requirement Checklist v5** (dated 2026-01-30) cites `§ 130.31(e)` for a
sample-storage requirement. **Part 130 in this corpus runs § 130.1 – § 130.30 and stops.**
Adjacent rows cite `§ 130.30(d)` — but § 130.30 is *Severability*, which says nothing about
storage. The incrementing pattern across rows 69–73 (`130.27(a)`, `130.28(b)`,
`130.29(a)/(c)`, `130.30(d)`, `130.31(e)`) suggests these should all be subsections of one
section, most plausibly § 130.27 *Security, Safety and Storage of Cannabis*.

**Verified against the source PDF — this is not a conversion artifact.** Whether the Part
130 copy is outdated or the checklist's citation column is wrong **cannot be determined
from the corpus**. This requires the operator to check OCM's current published Part 130.

Also recorded: **LQSS has no Part XIII** — it runs I–XII then jumps to XIV (Change Record).
Nothing cites XIII, so it is not a live defect, but a question about it would find genuine
silence.

**Why this suite earns its place.** Everything else on the map defends a different failure:
the hard gate stops fabricated quotes, residency stops missed documents. **Nothing detected
that two official documents contradict each other.** A chatbot asked about § 130.31 answers
"OCM does not address this" — correct against the corpus, wrong against the checklist in the
same folder.

### Suite A — answer correctness

Two sources, because neither alone is sufficient:

1. **Checklist-derived (~100+, cheap).** Each checklist row becomes a lookup question whose
   ground-truth citation is the row's own citation column. Gives systematic breadth across
   208 pages. ⚠️ **Not a regex job** — citation cells are vertically centred and split across
   lines (106 extractable from the equipment checklist, 57 from Part 130's, but 4 from
   chemistry and 0 from microbiology). Budget real work for the extractor.
2. **Operator-authored (20–30).** Real questions of the mid-run-expiry kind, where the
   answer needs reasoning and the corpus may be silent. The derived set tests **lookup**;
   only these test **inference** and **silence**, which is what the two-register design
   exists for.

### Pass bars — per axis, not one number

| Axis | Bar | Kind |
|---|---|---|
| Quote verified against corpus | **100%** | **hard** — deterministic; anything less is a gate bug, not a model shortfall |
| Corpus dangling citations | **0** | **hard**, or an explicit recorded waiver |
| Anchor resolves to correct page | **100%** | **hard** — mechanically checkable via the page map |
| Answer substantively correct | ~90% | target, tracked |
| Statement in correct register | ~95% | target, tracked |
| Silence declared when corpus silent | ~90% | target, tracked |

The mechanical axes are held absolutely because they are deterministic. Model-judgment axes
are tracked against a target, not gated, because pretending judgment is binary would make
the bar meaningless.

**§ 130.31 requires a waiver to ship v1**, or a corpus update. It must be a conscious
decision, not a silent skip.

### Regression

Determined, not open: when OCM revises any document, or the system prompt changes —
**reconvert → re-run the conversion QA → run Suite B → run Suite A**, in that order, before
serving answers. Suite B is cheap enough to run on every conversion.
