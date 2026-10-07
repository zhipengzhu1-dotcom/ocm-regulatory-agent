/**
 * Fold the typographic variation between what a model emits and what the source
 * documents contain, so that correctly-quoted text still matches.
 *
 * Returns the normalized text alongside an index map: `map[i]` is the offset in the
 * ORIGINAL text of the character that produced normalized character `i`. The map is
 * what lets a match in normalized space resolve back to a real page.
 */
export interface Normalized {
  text: string;
  map: number[];
}

const FOLD: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "‛": "'",
  "“": '"', "”": '"', "„": '"', "‟": '"',
  "–": "-", "—": "-", "‒": "-", "―": "-", "−": "-",
  " ": " ", " ": " ", " ": " ", "​": "",
  "­": "", "﻿": "",
};

const GRAPHEMES = new Intl.Segmenter("en", { granularity: "grapheme" });

export function normalize(input: string): Normalized {
  const out: string[] = [];
  const map: number[] = [];
  let lastWasSpace = false;

  // Iterate grapheme clusters, not code units: NFKC must see a base character and
  // its combining marks together, or a decomposed "e + acute" never composes to the
  // precomposed form a model is likely to emit.
  for (const { segment, index: i } of GRAPHEMES.segment(input)) {
    const folded = FOLD[segment] ?? segment;
    if (folded === "") continue;

    if (/^\s+$/.test(folded)) {
      // Collapse every run of whitespace to one space. `-layout` pads columns and
      // breaks sentences across lines; neither should defeat a match.
      if (!lastWasSpace && out.length > 0) {
        out.push(" ");
        map.push(i);
        lastWasSpace = true;
      }
      continue;
    }

    // PDFs hyphenate across line breaks, so the source renders "co- precipitation"
    // where the word is "co-precipitation". Drop the space a model would not write.
    // The hyphen must be attached to the preceding word and followed by a lowercase
    // continuation, so a spaced dash between words ("Disposal - rendered") survives.
    if (
      lastWasSpace &&
      /^[a-z]/.test(folded) &&
      out[out.length - 2] === "-" &&
      /[A-Za-z0-9]/.test(out[out.length - 3] ?? "")
    ) {
      out.pop();
      map.pop();
    }

    lastWasSpace = false;
    // NFKC may expand one cluster into several code points; each maps to this origin.
    for (const ch of folded.normalize("NFKC")) {
      out.push(ch);
      map.push(i);
    }
  }

  while (out.length > 0 && out[out.length - 1] === " ") {
    out.pop();
    map.pop();
  }
  return { text: out.join(""), map };
}
