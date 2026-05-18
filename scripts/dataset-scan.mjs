import { scanDatasetSource } from "./dataset-utils.mjs";

const sourceDir = process.argv[2];

if (!sourceDir) {
  console.error('Usage: npm run dataset:scan -- "C:\\path\\to\\syllabus-folder"');
  process.exit(1);
}

try {
  const index = await scanDatasetSource(sourceDir, { writeText: true });

  console.log("Dataset scan complete");
  console.log(`Total files scanned: ${index.totalFilesScanned}`);
  console.log(`Supported PDFs/DOCX scanned: ${index.supportedFilesScanned}`);
  console.log(`Syllabus files found: ${index.syllabusFilesFound}`);
  console.log(`Skipped material files: ${index.skippedMaterialFiles}`);
  console.log(`Possible syllabus files needing review: ${index.possibleSyllabusFiles}`);
  console.log(`Parse errors: ${index.parseErrors.length}`);
  console.log("Extracted text saved to: training-data/extracted-text/");

  if (index.parseErrors.length > 0) {
    console.log("\nParse errors:");
    index.parseErrors.slice(0, 10).forEach((error) => {
      console.log(`- ${error.relativePath}: ${error.error}`);
    });

    if (index.parseErrors.length > 10) {
      console.log(`...and ${index.parseErrors.length - 10} more`);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
