import { promises as fs } from "node:fs";
import path from "node:path";

const inputDir = path.join("training-data", "verified-json");
const outputDir = path.join("training-data", "expected-json");
const force = process.argv.includes("--force");

function makeExpectedJson(example) {
  const { source, ...expected } = example;

  if (!expected.sourceFileName && source?.sourceFileName) {
    expected.sourceFileName = source.sourceFileName;
  }

  return expected;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  let files = [];

  try {
    files = (await fs.readdir(inputDir))
      .filter((file) => file.endsWith(".json"))
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log(`No verified examples found in ${inputDir}`);
      return;
    }

    throw error;
  }

  let promoted = 0;
  let skippedExisting = 0;
  let skippedFeedback = 0;

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const raw = await fs.readFile(inputPath, "utf8");
    const example = JSON.parse(raw);
    const feedback = example.source?.userFeedback;

    if (feedback !== "correct" && feedback !== "corrected") {
      skippedFeedback += 1;
      continue;
    }

    const outputPath = path.join(outputDir, file);

    if (!force && (await exists(outputPath))) {
      skippedExisting += 1;
      continue;
    }

    await fs.writeFile(
      outputPath,
      `${JSON.stringify(makeExpectedJson(example), null, 2)}\n`
    );
    promoted += 1;
  }

  console.log(`Promoted ${promoted} verified examples to ${outputDir}`);
  console.log(`Skipped existing: ${skippedExisting}`);
  console.log(`Skipped by feedback: ${skippedFeedback}`);
  if (!force) {
    console.log("Use --force to overwrite existing expected JSON files.");
  }
}

await main();
