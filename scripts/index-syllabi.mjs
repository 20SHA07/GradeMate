import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import {
  buildDatasetProposal,
  loadSyllabusParser
} from "./dataset-utils.mjs";
import {
  collectedFilesDir,
  csvEscape,
  extractDocumentTextWithTimeout,
  getCollectedFilePath,
  indexCsvPath,
  indexJsonPath,
  loadManifest,
  saveManifest,
  sha256File
} from "./syllabi-collector-utils.mjs";

const manifest = await loadManifest();

if (!manifest) {
  console.error("No collected syllabus manifest found. Run npm run syllabi:collect first.");
  process.exit(1);
}

const parser = loadSyllabusParser();
const rows = [];

for (const record of manifest.records ?? []) {
  const collectedPath = getCollectedFilePath(record.collectedFileName);

  if (!fsSync.existsSync(collectedPath)) {
    rows.push({
      ...baseRow(record),
      confidence: record.confidence ?? 0,
      reasonDetected: `${record.reasonDetected}; collected file missing`
    });
    continue;
  }

  const stats = await fs.stat(collectedPath);
  const currentHash = await sha256File(collectedPath);
  let proposal = null;
  let extractionNote = record.textExtraction;

  try {
    const canExtract =
      record.fileType === "docx" ||
      (record.fileType === "pdf" && stats.size <= 8 * 1024 * 1024);

    if (canExtract) {
      const extracted = await extractDocumentTextWithTimeout(
        collectedPath,
        { maxPages: 8 },
        10000
      );
      const ruleResult = parser.extractSyllabusFromText(extracted.text);
      proposal = buildDatasetProposal(extracted.text, ruleResult, {
        id: path.basename(record.collectedFileName, path.extname(record.collectedFileName)),
        sourceFileName: record.originalFileName,
        sourcePath: record.originalRelativePath ?? record.originalPath,
        relativePath: record.originalRelativePath ?? record.originalPath,
        extension: `.${record.fileType}`,
        textFileName: null,
        textPath: null
      });
      extractionNote = "ok";
    } else if (record.fileType === "doc") {
      extractionNote = "unsupported";
    } else {
      extractionNote = "skipped: PDF too large for quick index extraction";
    }
  } catch (error) {
    extractionNote = `failed: ${getErrorMessage(error)}`;
  }

  rows.push({
    collectedFileName: record.collectedFileName,
    originalFileName: record.originalFileName,
    originalPath: record.originalPath,
    fileType: record.fileType,
    fileSize: stats.size,
    sha256Hash: currentHash,
    detectedCourseCode: proposal?.courseCode ?? record.detectedCourseCode ?? null,
    detectedCourseName: proposal?.courseName ?? null,
    detectedSemester: proposal?.semester ?? null,
    detectedInstructor: proposal?.instructor ?? null,
    confidence: proposal?.confidence ?? record.confidence ?? 0,
    reasonDetected: record.reasonDetected,
    copiedAt: record.copiedAt,
    textExtraction: extractionNote
  });
}

const index = {
  generatedAt: new Date().toISOString(),
  filesFolder: collectedFilesDir,
  count: rows.length,
  records: rows
};

await fs.writeFile(indexJsonPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
await fs.writeFile(indexCsvPath, toCsv(rows), "utf8");
await saveManifest({
  ...manifest,
  indexedAt: index.generatedAt,
  indexCount: rows.length
});

console.log(`Indexed collected syllabi: ${rows.length}`);
console.log(`JSON: ${path.relative(process.cwd(), indexJsonPath)}`);
console.log(`CSV: ${path.relative(process.cwd(), indexCsvPath)}`);

function baseRow(record) {
  return {
    collectedFileName: record.collectedFileName,
    originalFileName: record.originalFileName,
    originalPath: record.originalPath,
    fileType: record.fileType,
    fileSize: record.fileSize,
    sha256Hash: record.sha256Hash,
    detectedCourseCode: record.detectedCourseCode ?? null,
    detectedCourseName: null,
    detectedSemester: null,
    detectedInstructor: null,
    copiedAt: record.copiedAt,
    reasonDetected: record.reasonDetected,
    textExtraction: record.textExtraction
  };
}

function toCsv(records) {
  const columns = [
    "collectedFileName",
    "originalFileName",
    "originalPath",
    "fileType",
    "fileSize",
    "sha256Hash",
    "detectedCourseCode",
    "detectedCourseName",
    "detectedSemester",
    "detectedInstructor",
    "confidence",
    "reasonDetected",
    "copiedAt"
  ];
  const lines = [columns.join(",")];

  for (const record of records) {
    lines.push(columns.map((column) => csvEscape(record[column])).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
