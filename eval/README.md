# Suite A — answer correctness

Two sources, because neither alone is sufficient.

**Derived** (~300, free). Every inspection-checklist row states a requirement and names
the section imposing it, so the row's citation column is ground truth. Generated at run
time by `deriveQuestions`; nothing to maintain. These test **lookup**.

**Authored** (`authored.json`, yours to write). The questions the derived set cannot
produce: where the answer needs a step of reasoning, or where the corpus is genuinely
silent and saying so is the correct answer. These test **inference** and **silence**.
Two seed examples ship; the spec calls for 20–30.

```jsonc
{
  "id": "authored:short-slug",
  "question": "…as you would actually ask it…",
  "expect": {
    "documentId": "laboratory-quality-system-standards-2-9-26", // optional
    "silent": true                                              // optional
  }
}
```

## Running it

```sh
npm run eval              # authored questions only (default — cheap)
npm run eval -- --all     # authored + every derived question
npm run eval -- --limit 25
```

Each question is one model call against your subscription, so `--all` is several
hundred. Start with the authored set.

## Bars

| Axis | Bar | Why |
|---|---|---|
| `quoteVerified` | **100%, hard** | deterministic — a failure is a gate defect |
| `anchorResolves` | **100%, hard** | mechanically checkable against the page map |
| `citedExpectedDocument` | 90%, target | ground truth itself can be wrong |
| `silenceCorrect` | 90%, target | whether the corpus is genuinely silent is a judgment |

Substantive correctness and register correctness are **not** auto-scored — they need
your judgment. The runner prints each answer so you can read them.

## Stratified sample

`run-sample.mts` runs a reproducible subset instead of all ~285 derived questions. It
allocates `N` derived questions across the checklists in proportion to their size, draws
them with a seeded shuffle, adds the authored questions, and runs them `CONC` at a time.

```sh
npx tsx eval/run-sample.mts              # N=50, SEED=20261007, CONC=3
python3 eval/analyze.py                  # reads eval/results/results.jsonl
```

Each row in `results.jsonl` records the outcome, the timing of each attempt, the rejection
reasons, and the score. Results from past runs are in `results/`.

Suite B (corpus integrity) is separate and runs on every rebuild: `npm run integrity`.
