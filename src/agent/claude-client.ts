import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Corpus } from "../corpus/types.js";
import { buildSystemPrompt } from "./prompt.js";
import type { Draft, ModelClient, RetryContext } from "./types.js";

export const MODEL = "claude-sonnet-5";

/**
 * Drives Sonnet 5 through the Claude Agent SDK on a Max/Pro subscription. Auth is
 * ambient - the SDK spawns the `claude` CLI, which supplies the OAuth credential.
 * There is no API key here, by design: the console key was ruled out.
 */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ClaudeClientOptions {
  /** Receives the reading prose as it forms, so the UI can stream before gating. */
  onPartialReading?(text: string): void;
  /** Anchors seen so far, so the citation phase is visible while it runs. */
  onPartialAnchors?(anchors: string[]): void;
  /** Reasoning depth. Lower is faster and cheaper; this is mostly lookup work. */
  effort?: Effort;
}

export function createClaudeClient(corpus: Corpus, options: ClaudeClientOptions = {}): ModelClient {
  const systemPrompt = buildSystemPrompt(corpus);
  return {
    async draft({ question, retry }) {
      return parseDraft(await ask(systemPrompt, promptFor(question, retry), options));
    },
  };
}

const REASONS: Record<string, string> = {
  "quote-from-contents": "that text is a table-of-contents heading, not requirement text",
  "unknown-document": "there is no document with that id",
  "quote-not-found": "that text does not appear in the document",
};

function promptFor(question: string, retry?: RetryContext): string {
  if (!retry) return question;

  const failures = retry.failures
    .map((f) => {
      if (f.reason === "uncited-claim") {
        return "- Your answer made regulatory claims but cited nothing, and did not\n  declare the corpus silent. Cite the text you are relying on, or set\n  \"silence\".";
      }
      const why = REASONS[f.reason];
      return `- ${f.citation.anchor} in ${f.citation.documentId}: ${why}\n  quote was: ${f.citation.quote}`;
    })
    .join("\n");

  return `${question}

Your previous answer was REJECTED and never shown. These citations failed
verification:

${failures}

Answer again. Copy quotations exactly from the document body. Drop any claim you
cannot support with text that is genuinely present.`;
}

async function ask(
  systemPrompt: string,
  prompt: string,
  options: ClaudeClientOptions,
): Promise<string> {
  const response = query({
    prompt,
    options: {
      model: MODEL,
      systemPrompt,
      allowedTools: [], // The corpus is resident; no tools are needed to answer.
      maxTurns: 1,
      effort: options.effort ?? "medium",
      includePartialMessages: Boolean(options.onPartialReading),
    },
  });

  let accumulated = "";
  let lastReading = "";
  let lastAnchors = "";

  for await (const message of response) {
    if (message.type === "stream_event" && (options.onPartialReading || options.onPartialAnchors)) {
      accumulated += textDeltaOf(message);

      const reading = partialReading(accumulated);
      if (options.onPartialReading && reading !== null && reading !== lastReading) {
        lastReading = reading;
        options.onPartialReading(reading);
      }

      // Selecting quotations is the long phase. Showing the anchors as they form
      // keeps the wait legible instead of a motionless "drafting…".
      const anchors = partialAnchors(accumulated);
      const key = anchors.join("|");
      if (options.onPartialAnchors && anchors.length > 0 && key !== lastAnchors) {
        lastAnchors = key;
        options.onPartialAnchors(anchors);
      }
    }
    if (message.type === "result") {
      if (message.subtype !== "success") {
        // Carry the SDK's wording through: the pipeline classifies a usage limit by
        // matching on it, and swallowing it here degrades that to a generic error.
        const detail = "result" in message ? String(message.result) : "";
        throw new Error(`Agent SDK returned ${message.subtype}${detail ? `: ${detail}` : ""}`);
      }
      return message.result;
    }
  }
  throw new Error("Agent SDK produced no result");
}

/** Pull a text delta out of a partial stream event without over-fitting its shape. */
function textDeltaOf(message: unknown): string {
  const event = (message as { event?: { delta?: { text?: unknown } } }).event;
  return typeof event?.delta?.text === "string" ? event.delta.text : "";
}

/**
 * Recover the `reading` field from incomplete JSON, so the inference register can
 * stream. Returns null until the field has started.
 */
export function partialReading(partial: string): string | null {
  const start = /"reading"\s*:\s*"/.exec(partial);
  if (!start) return null;
  let out = "";
  for (let i = start.index + start[0].length; i < partial.length; i++) {
    const ch = partial[i]!;
    if (ch === "\\") {
      const next = partial[i + 1];
      out += next === "n" ? "\n" : next === "t" ? "\t" : (next ?? "");
      i++;
      continue;
    }
    if (ch === '"') break;
    out += ch;
  }
  return out;
}

/** Anchors already written into the incomplete `cited` array. */
export function partialAnchors(partial: string): string[] {
  return [...partial.matchAll(/"anchor"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]!);
}

/** The model is asked for bare JSON; tolerate a fence or surrounding prose. */
export function parseDraft(raw: string): Draft {
  const text = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced?.[1] ?? sliceObject(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error(`Model did not return JSON. Received: ${text.slice(0, 200)}`);
  }

  const object = parsed as Partial<Draft>;
  return {
    silence:
      typeof object.silence === "string" && object.silence.trim() !== "" ? object.silence : null,
    cited: Array.isArray(object.cited)
      ? object.cited.filter(
          (c): c is Draft["cited"][number] =>
            !!c &&
            typeof c.documentId === "string" &&
            typeof c.anchor === "string" &&
            typeof c.quote === "string",
        )
      : [],
    reading: typeof object.reading === "string" ? object.reading : "",
  };
}

function sliceObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}
