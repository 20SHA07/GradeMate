import {
  buildDatasetSummary,
  extractedTextDir,
  proposedJsonDir,
  readDatasetIndex,
  readJsonFiles
} from "./dataset-utils.mjs";
import fs from "node:fs/promises";
import path from "node:path";

const proposals = await readJsonFiles(proposedJsonDir);

if (proposals.length === 0) {
  console.error("No proposed JSON files found. Run npm run dataset:propose first.");
  process.exit(1);
}

const summary = buildDatasetSummary(proposals, await readDatasetIndex());

console.log("GradeMate dataset summary");
console.log(`Total files scanned: ${summary.totalFilesScanned ?? "n/a"}`);
console.log(`Likely syllabi found: ${summary.likelySyllabiFound}`);
console.log(`Total proposed: ${summary.proposedJsonFilesCreated}`);
console.log(`Ready: ${summary.ready}`);
console.log(`Needs review: ${summary.needsReview}`);
console.log(`Failed: ${summary.failed}`);
console.log(`Skipped: ${summary.skipped}`);
console.log(`Weight exactly 100%: ${summary.totalWeightExactly100}`);
console.log(`Weight below 100%: ${summary.totalWeightBelow100}`);
console.log(`Weight above 100%: ${summary.totalWeightAbove100}`);
console.log(`No assessments found: ${summary.noAssessmentsFound}`);
console.log(`Low confidence: ${summary.lowConfidence}`);

if (!summary.cosc101Ready) {
  console.log("COSC101 golden test failed");
} else {
  console.log("COSC101 golden test ready");
}

if (summary.errorReasonCounts.length > 0) {
  console.log("\nTop error reasons:");
  summary.errorReasonCounts.slice(0, 10).forEach((item, index) => {
    console.log(`${index + 1}. ${item.reason}: ${item.count}`);
  });
}

await printExamples(
  "Example failed files",
  summary.analyses.filter((file) => file.analysis.status === "failed").slice(0, 10)
);
await printExamples(
  "Example needs-review files",
  summary.analyses
    .filter((file) => file.analysis.status === "needs-review")
    .slice(0, 10)
);

async function printExamples(title, files) {
  if (files.length === 0) {
    return;
  }

  console.log(`\n${title}:`);

  for (const file of files) {
    const reason = file.analysis.reasons[0] ?? "needs review";
    const snippet = await getGradingSnippet(file.value.sourceTextFileName);
    console.log(`- ${file.value.sourceFileName ?? file.fileName}`);
    console.log(`  reason: ${reason}`);

    if (snippet) {
      console.log(`  snippet: ${snippet}`);
    }
  }
}

async function getGradingSnippet(textFileName) {
  if (!textFileName) {
    return "";
  }

  try {
    const text = await fs.readFile(path.join(extractedTextDir, textFileName), "utf8");
    const match = text.match(
      /(.{0,120}(assessment|evaluation|grading|marks?|weight|coursework|final examination|continuous assessment).{0,220})/is
    );
    return (match?.[1] ?? text.slice(0, 260)).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}
