---
id: 001
title: Can a Claude Max/Pro subscription drive a custom local web app?
labels: [wayfinder:research]
status: closed
assignee: author
blocked-by: []
closed: 2026-08-19
parent: ../MAP.md
---

## Question

The whole design rests on driving Sonnet 5 from a Claude Max/Pro **subscription** rather
than a console API key. Before anything downstream is designed on top of that assumption,
establish whether it actually holds — technically and under Anthropic's terms.

Resolve against primary sources (Anthropic docs, Claude Agent SDK docs, current terms —
not recollection):

1. **Technical.** Can `@anthropic-ai/claude-agent-sdk` (or the Python equivalent) be
   driven by subscription OAuth credentials from a program the operator wrote themselves,
   as opposed to the Claude Code CLI? What is the actual credential-acquisition path?
2. **Terms.** Does a personal Max/Pro subscription permit use by a custom application the
   subscriber wrote, for their own single-user internal use? Quote the governing clause.
3. **Model access.** Is `claude-sonnet-5` reachable on that path, and can the model be
   pinned explicitly?
4. **Limits.** What rate/usage limits apply, and are they plausibly sufficient for a few
   dozen regulatory questions a day against an ~80K-token corpus?
5. **Capability delta.** What is *lost* versus the Messages API on this path — prompt
   caching control, `output_config.effort`, token accounting, streaming? Note anything
   that would change a downstream decision.
6. **Fallback.** If any of the above fails, state precisely what the console-API-key
   design would look like instead and what it would cost per query at Sonnet 5 rates
   (note: intro pricing $2/$10 per MTok ends 2026-08-31).

## Why this is first

If the subscription path does not hold, the access decision changes, the retrieval
decision changes, and the packaging story changes. Everything downstream would be built
on sand. Resolve before committing effort elsewhere.

## Answer

**Resolved 2026-08-19** by a `/research` subagent. The full research report is not
included in this repository.

**The question as asked — "can it?" — answers YES.** The blocker this ticket existed to
find does not exist.

1. **Technical: yes, documented.** `claude setup-token` mints a one-year subscription
   OAuth token; `CLAUDE_CODE_OAUTH_TOKEN` is documented verbatim as an "alternative to
   `/login` for **SDK** and automated environments". The Agent SDK spawns a `claude` CLI
   subprocess and inherits the whole credential stack. There is *no* `setupToken` helper
   in the SDK itself — auth is entirely ambient.
2. **Terms: permitted for this case, with live policy risk.** Consumer Terms §3 bars
   automated access "**except** … where we otherwise explicitly permit it", and Anthropic
   explicitly permits it twice (Claude Code legal page; help-centre article updated
   2026-06-16 listing "Agent SDK usage in your own projects"). The one hard prohibition —
   routing requests through subscription credentials **on behalf of your users** — is not
   tripped by a single-user local tool. **But** the same page says developers "should use
   API key authentication", and a 2026-06-15 change that would have moved SDK usage off
   subscription limits was *paused, not cancelled*.
3. **Model access: fine.** `claude-sonnet-5` pins via `model:`, native 1M context, default
   on Pro.
4. **Limits: probably sufficient, unprovably so.** Anthropic publishes **no numeric
   limits** for any tier and offers no runtime quota API. Shared pool with interactive
   Claude Code and claude.ai usage.
5. **Capability delta — this is what actually matters.** Two absences, one decisive:

   | | Agent SDK on subscription | Messages API + key |
   |---|---|---|
   | `citations` / `document` blocks | **Absent** | `char_location` spans, `cited_text` |
   | `cache_control` | **Absent** (automatic, unsteerable) | explicit breakpoints, `ttl: "1h"` |
   | `effort`, streaming, model pinning | present | present |

   Corrections to this ticket's own premises: `effort` and streaming are **not** lost.

6. **Cost, and a stale premise.** ⚠️ **Sonnet 5's $2/$10 intro rate is now permanent** —
   the September increase "will not occur". Cache multipliers: 5m write 1.25x, 1h write
   2x, read 0.1x. Warm query ≈ **$0.024**; **~$45/month at 30 questions/day**. Cache reads
   refresh the 1h TTL for free, so one question an hour keeps the corpus resident on a
   single morning write.

### What this ticket did NOT settle

The research answers *can we* but surfaces a *should we* that did not exist when this
ticket was written, and that this ticket has no mandate to decide: the Messages API's
`citations` feature returns **machine-verified pointers guaranteed to reference the
supplied documents**, whereas on the Agent SDK a citation is a prompting convention with
nothing structurally preventing a fabricated section number. Against this map's one hard
requirement, that is a live fork.

**Raised as a new ticket:** *Access path — subscription + Agent SDK, or console key +
Messages API?* This ticket is closed on its own terms; it is not the place to decide the
successor question.
