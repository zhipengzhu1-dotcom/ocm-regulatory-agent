---
id: 003
title: What must a citation contain, and how is fabrication prevented?
labels: [wayfinder:grilling]
status: closed
assignee: author
blocked-by: [002, 008]
closed: 2026-08-19
parent: ../MAP.md
---

## Question

"Every claim carries a citation" is the map's one hard requirement. Turn it into a
contract precise enough to build against and to grade.

- **Anchor granularity.** What identifies a cited passage — document + section symbol
  (`Part 130 § 130.22(b)`), document + page, a stable markdown anchor, a verbatim quoted
  span, or some combination? Different documents have different natural anchors: Part 130
  has `§` numbers, LQSS has roman-numeral parts, the checklists have row IDs, the testing
  limits are tables.
- **Granularity of the claim.** Per sentence, per paragraph, or per answer? Per-sentence
  is rigorous and unreadable; per-answer is readable and unverifiable.
- **Anti-fabrication.** The named failure mode is a confident wrong answer. A plausible
  but non-existent `§ 130.31` is worse than a refusal. What structurally prevents it —
  requiring a verbatim quote the operator can eyeball, mechanically verifying every cited
  anchor exists before the answer is displayed, constraining the agent to cite only
  passages it actually read this turn, or something else?
- **Refusal behavior.** What the agent does when the corpus is silent. "OCM guidance does
  not address this; the nearest requirement is X, and here is the gap" is the target
  shape — but when is it obligated to say that rather than reason from adjacent text?
- **Inference boundary.** Regulatory questions often need a short inferential step from
  the text. Is the agent allowed to take it, and if so must it mark that step as
  inference rather than citation?

Depends on 002 because an anchor can only be as precise as the corpus format allows.

## Answer

**Resolved 2026-08-19.** Four decisions, and one implementation constraint discovered while
testing them.

### 1. A citation is a verbatim quote **plus** a structural anchor

Both are required. The **quote is the proof** — machine-checkable, and the only thing that
works across the whole corpus. The **anchor is the address** — it uses each document's own
vocabulary (`§ 130.22(b)`, `LQSS Part IV`, `Chem Checklist row 14`) and exists to make
verification fast for the operator.

Evidence: a 9-word span pulled from the middle of each document was recovered under
whitespace normalization in **16 of 16** documents. Nothing else comes close — page numbers
cover 13 of 16, and structural anchors share no common scheme across the corpus. Crucially,
**a fabricated anchor is undetectable on its own** (`§ 130.31` looks exactly as plausible as
`§ 130.22`), whereas a fabricated quote is caught by grep. Pairing them means the quote
defends the anchor.

### 2. Enforcement is a hard gate in the application, not model self-discipline

Before any answer reaches the operator, the app greps **every quoted span** against the
corpus.

- All quotes match → answer displayed.
- Any quote misses → **answer is never displayed.** The agent is told *which* quote failed
  and retries.
- After N attempts → the app reports that it could not answer with verifiable citations.
  It does not answer anyway.

This is deterministic code outside the model, and it is the replacement for the Messages
API `citations` guarantee forgone in *Access path*. The checker must not be the same model
that could fabricate.

### 3. Answers use two visibly separated registers

The hard gate has a loophole: **it only inspects quoted spans.** Unquoted connective prose
passes trivially, so an agent can satisfy the gate perfectly and still be wrong —

> "§ 130.22(b) requires `"Testing of the phytocannabinoid profile…"` — **so you must re-run
> the entire batch.**"

— where the quote verifies and the conclusion is invented. Regulatory work genuinely needs
that inferential step, so it cannot simply be banned. It is **separated** instead:

| Register | Content | Gate |
|---|---|---|
| **What the regs say** | Only quoted, anchored statements | Every line checked |
| **My reading** | The agent's inference | Explicitly labelled; never dressed as citation |

The operator always knows which half they are reading.

### 4. Silence is declared before any reasoning

When nothing in the 16 documents governs the question, the agent **says so first** — as a
heading, above everything else — then may still surface the nearest adjacent requirement
and name the gap. The silence is never buried under the reasoning. The gap is frequently
the most useful output the tool can produce; what it must never do is let an inference
about an unregulated topic read as a requirement.

### 5. Implementation constraint — normalize before comparing

**Discovered by testing, and load-bearing.** The corpus contains **139 × `’` (U+2019)**,
**301 × `–` (U+2013)**, and **58 × curly double quotes**. A model emitting a straight `'`
where the source has `’` produces a **miss on text it quoted correctly** — the hard gate
would block a right answer, the agent would retry, and it would refuse. This turns a
safety mechanism into a denial-of-service.

Before comparison, both the quote and the corpus **must** be normalized:

- curly quotes/apostrophes → straight (`’‘` → `'`, `“”` → `"`)
- en/em dash → hyphen (`–—` → `-`)
- collapse all whitespace runs to a single space (required anyway — `-layout` pads columns
  and breaks sentences across lines)
- Unicode NFKC

The gate must also tolerate the agent eliding mid-quote with `…`, by matching the segments
either side independently.

### Hand-offs

- **UI ticket** inherits a fixed answer structure: a silence banner when applicable, a
  gate-checked citation register, and a visually distinct inference register. Its
  citation-display question is now "how are these three rendered", not "what shape is an
  answer".
- **Correctness ticket** inherits four independently gradable axes: did every quote verify;
  was the anchor correct; was each statement in the right register; was silence declared
  when the corpus was genuinely silent. The gate's own pass/fail is free eval signal.
- **Retrieval ticket** is unaffected but reinforced — the silent-miss risk it carries is now
  the *only* remaining path to a confidently wrong answer, since fabrication is closed off.
