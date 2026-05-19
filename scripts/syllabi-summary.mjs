import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import {
  collectedFilesDir,
  collectedRoot,
  getDepartment,
  indexJsonPath,
  loadManifest,
  zipPath
} from "./syllabi-collector-utils.mjs";

const manifest = await loadManifest();
const index = fsSync.existsSync(indexJsonPath)
  ? JSON.parse(await fs.readFile(indexJsonPath, "utf8"))
  : null;

if (!manifest) {
  console.log("No collected syllabus manifest found. Run npm run syllabi:collect first.");
  process.exit(0);
}

const records = index?.records ?? manifest.records ?? [];
const departments = {};

for (const record of records) {
  const department = getDepartment(record.detectedCourseCode);

  if (department) {
    departments[department] = (departments[department] ?? 0) + 1;
  }
}

console.log("Collected syllabus summary");
console.log("--------------------------");
console.log(`Total files scanned: ${manifest.totalFilesScanned ?? 0}`);
console.log(`Likely syllabi found: ${manifest.likelySyllabiFound ?? records.length}`);
console.log(`Copied: ${manifest.copied ?? 0}`);
console.log(`Duplicates skipped: ${manifest.duplicatesSkipped ?? 0}`);
console.log(`Skipped non-syllabi: ${manifest.skippedNonSyllabi ?? 0}`);
console.log(`Indexed records: ${records.length}`);
console.log(`File type counts: ${formatCounts(manifest.fileTypeCounts)}`);
console.log(`Top detected departments: ${formatCounts(limitCounts(departments, 10))}`);
console.log(`Output folder: ${collectedFilesDir}`);
console.log(
  `Zip: ${fsSync.existsSync(zipPath) ? zipPath : `${zipPath} (not created yet)`}`
);

const skipped = manifest.skippedExamples ?? [];

if (skipped.length > 0) {
  console.log("");
  console.log("Examples of skipped ambiguous/non-syllabus files:");

  for (const item of skipped.slice(0, 10)) {
    console.log(`- ${item.originalFileName}: ${item.reason}`);
  }
}

const parseErrors = manifest.parseErrors ?? [];

if (parseErrors.length > 0) {
  console.log("");
  console.log("Parse errors:");

  for (const item of parseErrors.slice(0, 10)) {
    console.log(`- ${item.originalFileName}: ${item.error}`);
  }
}

console.log("");
console.log(`Collector root: ${collectedRoot}`);

function formatCounts(counts = {}) {
  const entries = Object.entries(counts).sort((first, second) => second[1] - first[1]);

  if (entries.length === 0) {
    return "none";
  }

  return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
}

function limitCounts(counts, limit) {
  return Object.fromEntries(
    Object.entries(counts)
      .sort((first, second) => second[1] - first[1])
      .slice(0, limit)
  );
}
