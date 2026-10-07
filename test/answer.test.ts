import { describe, it, expect, vi } from "vitest";
import { answerQuestion } from "../src/agent/answer.js";
import type { Draft, ModelClient } from "../src/agent/types.js";
import { corpus } from "./fixtures.js";

const REAL_QUOTE = "employing methods approved";
const FAKE_QUOTE = "Total yeast and mould shall not exceed 10,000 CFU/g";

const draft = (over: Partial<Draft> = {}): Draft => ({
  silence: null,
  cited: [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 130.22(a)", quote: REAL_QUOTE }],
  reading: "Approved methods are required.",
  ...over,
});

const model = (...drafts: Draft[]): ModelClient => {
  const queue = [...drafts];
  return { draft: vi.fn(async () => queue.shift() ?? drafts.at(-1)!) };
};

describe("answerQuestion", () => {
  it("returns a verified answer when every quotation checks out", async () => {
    const result = await answerQuestion("Which methods may we use?", corpus(), model(draft()));

    expect(result.outcome).toBe("answered");
    if (result.outcome !== "answered") return;
    expect(result.cited[0]?.page).toBe(2);
    expect(result.reading).toBe("Approved methods are required.");
    expect(result.attempts).toBe(1);
  });

  it("retries when the gate rejects a quotation, and succeeds on a later attempt", async () => {
    const bad = draft({
      cited: [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 130.31(e)", quote: FAKE_QUOTE }],
    });
    const result = await answerQuestion("q", corpus(), model(bad, draft()));

    expect(result.outcome).toBe("answered");
    if (result.outcome !== "answered") return;
    expect(result.attempts).toBe(2);
  });

  it("tells the model which quotation failed so the retry is informed", async () => {
    const bad = draft({
      cited: [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 130.31(e)", quote: FAKE_QUOTE }],
    });
    const client = model(bad, draft());
    await answerQuestion("q", corpus(), client);

    const retryArg = vi.mocked(client.draft).mock.calls[1]?.[0];
    expect(retryArg?.retry?.failures[0]?.citation.quote).toBe(FAKE_QUOTE);
  });

  it("withholds the answer entirely when the gate never passes", async () => {
    const bad = draft({
      cited: [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 130.31(e)", quote: FAKE_QUOTE }],
    });
    const result = await answerQuestion("q", corpus(), model(bad), { maxAttempts: 3 });

    expect(result.outcome).toBe("withheld");
    if (result.outcome !== "withheld") return;
    expect(result.attempts).toBe(3);
    expect(result.failures[0]?.citation.anchor).toBe("§ 130.31(e)");
  });

  it("retracts streamed text when the answer is withheld", async () => {
    const bad = draft({
      cited: [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 130.31(e)", quote: FAKE_QUOTE }],
    });
    const onRetract = vi.fn();
    await answerQuestion("q", corpus(), model(bad), { maxAttempts: 2, events: { onRetract } });

    expect(onRetract).toHaveBeenCalled();
  });

  it("carries a declaration of silence through to the result", async () => {
    const silent = draft({
      silence: "OCM does not address instrument audit-trail exports.",
      cited: [],
      reading: "This is a gap, not a permission.",
    });
    const result = await answerQuestion("q", corpus(), model(silent));

    expect(result.outcome).toBe("answered");
    if (result.outcome !== "answered") return;
    expect(result.silence).toMatch(/does not address/);
  });

  it("reports a usage limit distinctly rather than as a generic failure", async () => {
    const client: ModelClient = {
      draft: vi.fn(async () => {
        throw new Error("Claude AI usage limit reached|1234567890");
      }),
    };
    const result = await answerQuestion("q", corpus(), client);
    expect(result.outcome).toBe("usage-limit");
  });
});

describe("answerQuestion refusing an answer that cites nothing", () => {
  it("withholds a regulatory claim carrying neither a citation nor a declaration of silence", () => {
    // The gate only inspects quoted spans, so an uncited claim would pass trivially.
    const uncited = draft({ silence: null, cited: [], reading: "You must re-run the batch." });
    return answerQuestion("q", corpus(), model(uncited), { maxAttempts: 2 }).then((result) => {
      expect(result.outcome).toBe("withheld");
    });
  });

  it("allows an answer with no citations when silence is declared", async () => {
    const silent = draft({ silence: "OCM does not address this.", cited: [], reading: "A gap." });
    const result = await answerQuestion("q", corpus(), model(silent));
    expect(result.outcome).toBe("answered");
  });
});
