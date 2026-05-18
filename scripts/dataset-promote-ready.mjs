import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import {
  buildDatasetSummary,
  buildExpectedJson,
  ensureTrainingDirs,
  expectedJsonDir,
  proposedJsonDir,
  readDatasetIndex,
  readJsonFiles
} from "./dataset-utils.mjs";

await ensureTrainingDirs();

const proposals = await readJsonFiles(proposedJsonDir);

if (proposals.length === 0) {
  console.error("No proposed JSON files found. Run npm run dataset:propose first.");
  process.exit(1);
}

const summary = buildDatasetSummary(proposals, await readDatasetIndex());
const readyFiles = summary.analyses.filter((file) => file.analysis.status === "ready");
let promoted = 0;
let skippedExisting = 0;

for (const file of readyFiles) {
  const destinationPath = path.join(expectedJsonDir, file.fileName);

  if (fsSync.existsSync(destinationPath)) {
    skippedExisting += 1;
    console.log(`Skipped existing expected JSON: ${file.fileName}`);
    continue;
  }

  await fs.writeFile(
    destinationPath,
    `${JSON.stringify(buildExpectedJson(file.value), null, 2)}\n`,
    "utf8"
  );
  promoted += 1;
  console.log(`Promoted: ${file.fileName}`);
}

console.log("\nPromotion summary");
console.log(`Ready proposals: ${readyFiles.length}`);
console.log(`Promoted: ${promoted}`);
console.log(`Skipped existing: ${skippedExisting}`);

if (!summary.cosc101Ready) {
  console.log("COSC101 golden test failed");
}
