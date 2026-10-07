import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, statSync } from "node:fs";
import { resolve } from "node:path";
import { buildCorpus } from "../corpus/build.js";
import { checkIntegrity } from "../corpus/integrity.js";
import { corpusRoot } from "../corpus/root.js";
import { createClaudeClient } from "../agent/claude-client.js";
import { answerQuestion } from "../agent/answer.js";
import type { Corpus } from "../corpus/types.js";
import { titleOf } from "../corpus/lookup.js";
import type { AnswerResult } from "../agent/types.js";

const MAX_QUESTION_BYTES = 100_000;
const PORT = Number(process.env["PORT"] ?? 4130);
const UI = resolve(import.meta.dirname, "../../public/index.html");

console.log("Building corpus…");
const corpus: Corpus = buildCorpus(corpusRoot());
const integrity = checkIntegrity(corpus);
console.log(
  `Corpus ready: ${corpus.documents.length} documents, ` +
    `integrity ${integrity.ok ? "PASS" : `FAIL (${integrity.dangling.length} dangling)`}`,
);
for (const d of integrity.dangling) {
  console.warn(`  ⚠ ${d.reference} cited in ${d.documentId} (line ${d.line}) — does not exist`);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(await readFile(UI));
    return;
  }

  if (req.method === "GET" && url.pathname === "/integrity") {
    return json(res, 200, integrity);
  }

  // Serving the PDF itself is what makes "open at the cited page" work: the browser
  // viewer honours the #page fragment the client appends.
  if (req.method === "GET" && url.pathname.startsWith("/pdf/")) {
    const id = decodeURIComponent(url.pathname.slice("/pdf/".length));
    const document = corpus.documents.find((d) => d.documentId === id);
    if (!document) return json(res, 404, { error: "unknown document" });
    try {
      statSync(document.sourcePdf);
    } catch {
      return json(res, 404, { error: "source pdf missing" });
    }
    res.writeHead(200, { "content-type": "application/pdf" });
    const stream = createReadStream(document.sourcePdf);
    // An unhandled 'error' on a stream takes the process down; statSync above is a
    // check, not a guarantee.
    stream.on("error", () => res.destroy());
    res.on("close", () => stream.destroy());
    stream.pipe(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/ask") {
    return ask(req, res);
  }

  json(res, 404, { error: "not found" });
});

async function ask(req: IncomingMessage, res: ServerResponse) {
  let question: string;
  try {
    question = (await body(req)).trim();
  } catch (error) {
    return json(res, 413, { error: error instanceof Error ? error.message : "bad request" });
  }
  if (!question) return json(res, 400, { error: "empty question" });

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  // A client that closes mid-answer must not be written to.
  let open = true;
  res.on("close", () => {
    open = false;
  });
  const send = (event: string, data: unknown) => {
    if (open) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const client = createClaudeClient(corpus, {
    onPartialReading: (text) => send("draft", { text }),
    onPartialAnchors: (anchors) => send("anchors", { anchors }),
  });

  try {
    const result = await answerQuestion(question, corpus, client, {
      events: {
        onAttempt: (attempt) => send("attempt", { attempt }),
        onRetract: () => send("retract", {}),
      },
    });
    send("result", withSources(result, corpus));
  } catch (error) {
    send("result", {
      outcome: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (open) res.end();
}

/** Attach the human-readable document title so citations are legible in the UI. */
function withSources(result: AnswerResult, corpus: Corpus) {
  if (result.outcome !== "answered") return result;
  return {
    ...result,
    cited: result.cited.map((c) => ({
      ...c,
      title: titleOf(corpus, c.documentId),
    })),
  };
}

function body(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let data = "";
    let refused = false;
    req.on("data", (chunk: Buffer) => {
      if (refused) return; // Keep draining, but stop accumulating.
      data += chunk;
      if (data.length > MAX_QUESTION_BYTES) {
        refused = true;
        data = "";
        // Don't destroy the request: that kills the response too, and the caller
        // deserves a 413 rather than a dropped connection.
        reject(new Error("question too large"));
      }
    });
    req.on("end", () => resolveBody(data));
      req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

server.listen(PORT, "127.0.0.1", async () => {
  console.log(`\nOCM Regulatory Assistant → http://127.0.0.1:${PORT}`);
  await warmCache();
});

/**
 * The corpus is ~146K tokens and is resent on every request. The first call of a
 * session pays to write it into the prompt cache; doing that at boot means the
 * operator's first real question reads a warm cache instead.
 */
async function warmCache(): Promise<void> {
  const started = Date.now();
  process.stdout.write("Warming the prompt cache… ");
  try {
    await createClaudeClient(corpus).draft({ question: "Reply with an empty cited array." });
    console.log(`ready (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch {
    console.log("skipped (the first question will be slower)");
  }
}
