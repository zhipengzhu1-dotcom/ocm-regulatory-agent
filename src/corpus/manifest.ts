import type { AnchorScheme } from "./types.js";

/**
 * Filenames are cryptic — `ocm-testing-limits-2-9-26.pdf` does not announce that it
 * is authoritative for action limits. Title and authority are how the agent knows
 * what a document is for, so they are declared rather than derived.
 *
 * `anchorScheme` is per-document because no single scheme covers the corpus.
 */
export interface ManifestEntry {
  title: string;
  authority: string;
  anchorScheme: AnchorScheme;
}

const OCM = "NYS Office of Cannabis Management";
const CCB = "NYS Cannabis Control Board";

export const MANIFEST: Record<string, ManifestEntry> = {
  "part-130-cannabis-laboratories": {
    title: "Part 130 — Cannabis Laboratories (9 NYCRR)",
    authority: CCB,
    anchorScheme: "section",
  },
  "laboratory-quality-system-standards-2-9-26": {
    title: "Cannabis Laboratory Quality System Standard (LQSS)",
    authority: OCM,
    anchorScheme: "roman-part",
  },
  "ocm-testing-limits-2-9-26": {
    title: "OCM Testing Limits — permitted analytes and contaminant action limits",
    authority: OCM,
    anchorScheme: "none",
  },
  "ocm-laboratory-testing-guidance-for-au-licensees-and-ros-6-12-24-revision": {
    title: "Laboratory Testing Guidance for AU Licensees and ROs",
    authority: OCM,
    anchorScheme: "none",
  },
  "ocm-guidance-for-ros-licensees-and-laboratories-testing-for-new-analytes-04-26-23": {
    title: "Guidance for ROs, Licensees and Laboratories Testing for New Analytes",
    authority: OCM,
    anchorScheme: "none",
  },
  "guidance-document-for-the-homogenization-of-whole-flower-november-2023": {
    title: "Guidance for the Homogenization of Whole Flower",
    authority: OCM,
    anchorScheme: "none",
  },
  "sampling-firm-and-lab-testing_q-and-a-2-9-26": {
    title: "Sampling Firm and Lab Testing — Questions and Answers",
    authority: OCM,
    anchorScheme: "qa-pair",
  },
  "proficiency-testing-faq-8-21-25": {
    title: "Proficiency Testing — Frequently Asked Questions",
    authority: OCM,
    anchorScheme: "qa-pair",
  },
  "cannabis-analyte-testing-specifications_v6_metrc": {
    title: "Cannabis Analyte Testing Specifications (METRC) v6",
    authority: OCM,
    anchorScheme: "none",
  },
  "crosswalk-metrc-product-categories-and-ocm-product-language_final-4-29-26": {
    title: "Crosswalk — METRC Product Categories and OCM Product Language",
    authority: OCM,
    anchorScheme: "none",
  },
  "ocm-chemistry-checklist-v11-2-2-26": {
    title: "OCM Chemistry Inspection Checklist v11",
    authority: OCM,
    anchorScheme: "row-id",
  },
  "ocm-microbiology-checklist-v5-1-14-26": {
    title: "OCM Microbiology Inspection Checklist v5",
    authority: OCM,
    anchorScheme: "row-id",
  },
  "ocm-equipment-checklist-v6-1-15-26": {
    title: "OCM Equipment Inspection Checklist v6",
    authority: OCM,
    anchorScheme: "row-id",
  },
  "ocm-sampling-checklist_v3-2-2-26": {
    title: "OCM Sampling Inspection Checklist v3",
    authority: OCM,
    anchorScheme: "row-id",
  },
  "ocm-part-130-requirement-checklist-v5-1-30-26": {
    title: "OCM Part 130 Requirement Checklist v5",
    authority: OCM,
    anchorScheme: "row-id",
  },
  "mrta-requirement-checklist-v3-1-23-26": {
    title: "MRTA Requirement Checklist v3",
    authority: OCM,
    anchorScheme: "row-id",
  },
};

/**
 * OCM also publishes Part 130 as `part-130-cannabis-laboratories-adopted.pdf`, byte-identical
 * to `part-130-cannabis-laboratories.pdf`. Only one copy ships in `corpus/`; this guards
 * against the duplicate being added back and double-weighting the regulation.
 */
export const EXCLUDED = new Set(["part-130-cannabis-laboratories-adopted"]);
