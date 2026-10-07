import { describe, it, expect } from "vitest";
import { parseDraft, partialReading, partialAnchors } from "../src/agent/claude-client.js";

const VALID = JSON.stringify({
  silence: null,
  cited: [{ documentId: "part-130-cannabis-laboratories", anchor: "§ 130.22(a)", quote: "x" }],
  reading: "y",
});

describe("parseDraft", () => {
  it("parses the bare JSON object the model is asked for", () => {
    const draft = parseDraft(VALID);
    expect(draft.cited).toHaveLength(1);
    expect(draft.reading).toBe("y");
  });

  it("tolerates the model wrapping its JSON in a markdown fence", () => {
    expect(parseDraft("```json\n" + VALID + "\n```").cited).toHaveLength(1);
  });

  it("tolerates prose around the object", () => {
    expect(parseDraft("Here you go:\n" + VALID + "\nHope that helps.").cited).toHaveLength(1);
  });

  it("treats an empty silence string as no silence", () => {
    expect(parseDraft(JSON.stringify({ silence: "   ", cited: [], reading: "" })).silence).toBeNull();
  });

  it("drops malformed citations rather than passing them to the gate", () => {
    const draft = parseDraft(
      JSON.stringify({ silence: null, reading: "", cited: [{ anchor: "§ 1" }, null, "nope"] }),
    );
    expect(draft.cited).toHaveLength(0);
  });

  it("throws when the model returns no JSON at all", () => {
    expect(() => parseDraft("I cannot help with that.")).toThrow(/did not return JSON/);
  });
});

describe("partialReading", () => {
  it("returns null before the reading field has started", () => {
    expect(partialReading('{"silence": null, "cited": [')).toBeNull();
  });

  it("recovers the prose written so far from incomplete JSON", () => {
    expect(partialReading('{"reading": "Under Part IV the standard')).toBe(
      "Under Part IV the standard",
    );
  });

  it("stops at the closing quote once the field is complete", () => {
    expect(partialReading('{"reading": "Done.", "cited": []}')).toBe("Done.");
  });

  it("unescapes a newline inside the streamed prose", () => {
    expect(partialReading('{"reading": "One.\\nTwo.')).toBe("One.\nTwo.");
  });

  it("keeps an escaped quote rather than ending the field early", () => {
    expect(partialReading('{"reading": "He said \\"no\\" firmly')).toBe('He said "no" firmly');
  });
});

describe("partialAnchors", () => {
  it("returns nothing before any anchor has been written", () => {
    expect(partialAnchors('{"reading": "Under Part IV')).toEqual([]);
  });

  it("lists anchors as they appear in the incomplete cited array", () => {
    expect(
      partialAnchors('{"cited": [{"documentId":"x","anchor":"§ 130.22(a)","quote":"q"},{"anchor":"Part IV"'),
    ).toEqual(["§ 130.22(a)", "Part IV"]);
  });

  it("keeps an escaped quote inside an anchor", () => {
    expect(partialAnchors('{"cited":[{"anchor":"row \\"14\\""')).toEqual(['row \\"14\\"']);
  });
});
