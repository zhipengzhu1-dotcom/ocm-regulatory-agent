---
id: 004
title: Retrieval — grep-on-disk vs the whole corpus in context
labels: [wayfinder:grilling]
status: closed
assignee: author
blocked-by: [002, 008]
closed: 2026-08-19
parent: ../MAP.md
---

## Question

How the agent gets regulatory text in front of itself. At ~80K tokens in a 1M-token
window, **no vector database or chunking scheme is needed** — that is settled. What
remains is a real fork with different failure modes:

- **(a) Agent-navigated.** Leave the corpus on disk; give the agent Read/Grep/Glob and
  let it search and read on demand, exactly the way Claude Code works over a codebase.
  Cheap per query, naturally citable (the agent knows which file and line it read), scales
  if the corpus ever grows. Risk: the agent may search badly and miss a governing section
  it never looked at — a silent, dangerous failure for a compliance tool.
- **(b) Whole corpus resident.** Put all ~80K tokens in context every turn. The agent
  cannot miss anything because everything is present. Risk: higher per-query cost, and
  what prompt caching looks like on the subscription path is an open question (see 001).
- **(c) Hybrid.** A resident index or table-of-contents — cheap, always present, tells the
  agent what exists and where — plus on-demand reads of full sections.

Decide against the citation contract from 003 and the corpus format from 002. Note that
(a) and (c) only exist if the Agent SDK's built-in file tools are available on the access
path 001 settles.

The tiebreaker to argue explicitly: **which failure is worse for a regulated lab** — an
agent that occasionally fails to find a governing section, or a design that costs more
per query?

## Narrowed by *What artifact does the agent read* (2026-08-19)

That ticket settled a **grep-then-verify** workflow: search the markdown, open the source
PDF, confirm, answer. That rules out option (b) — whole corpus resident in context — as the
primary mechanism, and makes (a)/(c) the live fork. What remains open here:

- **The silent-miss risk.** An agent that searches badly never discovers it missed a
  governing section. For a compliance tool this is the dangerous failure, and grep-then-
  verify does nothing to mitigate it — verification confirms what *was* found, never
  surfaces what was not. Does a resident index or table-of-contents (cheap, always present,
  tells the agent what exists and where) belong in the design?
- **The TOC/body collision.** Grepping `§ 130.22` hits Part 130's table of contents at
  line 36 before the real section at line 1760. Is that handled at conversion time (mark
  or strip the TOC region) or at retrieval time (skip it)?
- **Search competence.** What the agent is instructed to search for, and whether one grep
  pass is ever sufficient for a question spanning several documents.

## Answer

**Resolved 2026-08-19: the whole corpus is resident in context. No retrieval step, no
per-answer PDF read.**

### The decision

All 16 converted markdown documents (~110K–146K tokens) sit in the system prompt on every
turn. The agent answers from what is present rather than searching for it. The Agent SDK
caches automatically, and on a subscription there is no per-token bill — the cost is
consumption against opaque usage limits, an accepted risk recorded in *Access path*.

**The silent miss is eliminated as a retrieval failure.** Nothing can be un-found, because
nothing has to be found.

**Stated honestly: this converts a retrieval failure into an attention failure.** Presence
in context is not attention to the right passage. It is a large improvement, not a
guarantee, and the system prompt must still direct the agent to survey the corpus before
concluding a topic is unaddressed.

### Why not an index

An auto-extracted structural index would cost only ~1,357 tokens (1.1% of corpus) but
finds headings in just **7 of 16 documents**. The nine it cannot see include
`ocm-testing-limits` — where every action limit lives — plus all three Q&A/FAQ documents
and both guidance documents. Same root cause as the anchor problem in the citation ticket:
most of this corpus has no extractable internal structure. An authored descriptive index
would have fixed that at ~3K tokens, but residency makes any index redundant.

### The per-answer PDF read is dropped

*What artifact does the agent read* chose **grep-then-verify** — grep markdown, open the
source PDF, confirm, answer. That was selected when it was the **only** anti-fabrication
mechanism available. Two later decisions took that job away from it:

- The **hard gate** (*What must a citation contain*) verifies quotes mechanically, in code,
  against the corpus — deterministic where the PDF read was model judgment.
- **Residency** (this ticket) removes the grep step, because there is nothing to locate.

What the PDF read still covered was **conversion fidelity** — markdown misrepresenting its
source. That is a **one-time** risk, fixed at the source, so it is handled by a **one-time
QA pass over all 16 conversions** rather than re-litigated on every answer. PDFs remain on
disk for the operator's own spot-checks.

### ⚠️ Surviving hazard the gate cannot catch

The **TOC/body collision** does not go away — it gets worse, and the gate is blind to it.

Part 130's table of contents contains the line `§ 130.22 Testing of Cannabis Product and
Medical Cannabis.` verbatim. With the whole document resident, the agent can quote that TOC
stub, and **the hard gate will verify it** — the string genuinely is in the corpus. The
result is a citation that passes every check and carries no requirement text at all.

**Therefore the conversion step must strip or explicitly mark the table-of-contents region
of every document.** This is now a hard requirement, not an optimization. It is the one
fabrication-adjacent failure the gate provides no defence against.

### Consequence worth noting for the spec

With the corpus resident and no PDF reads, **the agent needs no filesystem tools for normal
operation** — the design reduces to a large cached system prompt plus a conversation. The
Agent SDK's built-in Read/Grep/Glob, one of the stated advantages of the subscription path,
turn out to be unnecessary here. Recorded as an observation for the spec; *Access path* is
settled and is **not** reopened by it.
