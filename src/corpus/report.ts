import type { IntegrityReport } from "./integrity.js";

/** Both CLI entry points report integrity the same way; they share this. */
export function printIntegrity(report: IntegrityReport): void {
  if (report.ok) {
    console.log("\nPASS - no dangling citations");
    return;
  }
  console.log(`\nFAIL - ${report.dangling.length} dangling citation(s):\n`);
  for (const d of report.dangling) {
    console.log(`  ${d.reference.padEnd(12)} cited in ${d.documentId} (line ${d.line}) - does not exist`);
  }
}

export function sectionRange(sections: string[]): string {
  if (sections.length === 0) return "none found";
  const numbers = sections.map(Number).filter((n) => Number.isFinite(n));
  return numbers.length === 0 ? "none found" : `130.${Math.min(...numbers)}-130.${Math.max(...numbers)}`;
}
