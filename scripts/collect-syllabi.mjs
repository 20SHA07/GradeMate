import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import {
  collectedFilesDir,
  collectedRoot,
  courseCodePrefix,
  ensureCollectedDirs,
  evaluateSyllabusCandidate,
  getCollectedFilePath,
  getDepartment,
  loadManifest,
  makeUniqueCollectedName,
  sanitizeFileName,
  saveManifest,
  sha256File,
  supportedExtensions,
  walkFiles
} from "./syllabi-collector-utils.mjs";

const sourceArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

if (!sourceArg) {
  console.error(
    'Missing source folder. Run: npm run syllabi:collect -- "C:\\path\\to\\course-materials"'
  );
  process.exit(1);
}

const sourceRoot = path.resolve(sourceArg);

if (!fsSync.existsSync(sourceRoot)) {
  console.error(`Source folder does not exist: ${sourceRoot}`);
  process.exit(1);
}

await ensureCollectedDirs();

const existingManifest = await loadManifest();
const existingRecords = existingManifest?.records ?? [];
const recordsByHash = new Map(existingRecords.map((record) => [record.sha256Hash, record]));
const allFiles = await walkFiles(sourceRoot);
const supportedFiles = allFiles.filter((filePath) =>
  supportedExtensions.has(path.extname(filePath).toLowerCase())
);
const skippedExamples = [];
const parseErrors = [];
const fileTypeCounts = {};
const departmentCounts = {};
let likelySyllabiFound = 0;
let copied = 0;
let duplicatesSkipped = 0;
let skippedNonSyllabi = 0;

for (const filePath of supportedFiles) {
  const extension = path.extname(filePath).toLowerCase();
  fileTypeCounts[extension.slice(1)] = (fileTypeCounts[extension.slice(1)] ?? 0) + 1;

  const evaluation = await evaluateSyllabusCandidate(filePath, sourceRoot);

  if (!evaluation.include) {
    skippedNonSyllabi += 1;

    if (skippedExamples.length < 15) {
      skippedExamples.push({
        originalFileName: path.basename(filePath),
        originalPath: path.relative(sourceRoot, filePath),
        reason: evaluation.reason
      });
    }

    if (evaluation.parseError) {
      parseErrors.push({
        originalFileName: path.basename(filePath),
        originalPath: path.relative(sourceRoot, filePath),
        error: evaluation.parseError
      });
    }

    continue;
  }

  likelySyllabiFound += 1;

  const sha256Hash = await sha256File(filePath);
  const existingRecord = recordsByHash.get(sha256Hash);

  if (existingRecord) {
    duplicatesSkipped += 1;
    continue;
  }

  const safeOriginalName = sanitizeFileName(path.basename(filePath));
  const prefix = courseCodePrefix(evaluation.detectedCourseCode);
  const baseName = prefix ? `${prefix}_${safeOriginalName}` : safeOriginalName;
  const collectedFileName = await makeUniqueCollectedName(baseName, sha256Hash);
  const destinationPath = getCollectedFilePath(collectedFileName);
  const stats = await fs.stat(filePath);

  await fs.copyFile(filePath, destinationPath);
  copied += 1;

  const department = getDepartment(evaluation.detectedCourseCode);

  if (department) {
    departmentCounts[department] = (departmentCounts[department] ?? 0) + 1;
  }

  const record = {
    collectedFileName,
    originalFileName: path.basename(filePath),
    originalPath: filePath,
    originalRelativePath: path.relative(sourceRoot, filePath),
    fileType: extension.slice(1),
    fileSize: stats.size,
    sha256Hash,
    detectedCourseCode: evaluation.detectedCourseCode,
    confidence: evaluation.confidence,
    reasonDetected: evaluation.reasonDetected || "syllabus-like filename or text",
    textExtraction: evaluation.textExtraction,
    parseError: evaluation.parseError,
    copiedAt: new Date().toISOString()
  };

  recordsByHash.set(sha256Hash, record);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceRoot,
  outputRoot: collectedRoot,
  filesFolder: collectedFilesDir,
  totalFilesScanned: allFiles.length,
  supportedFilesScanned: supportedFiles.length,
  likelySyllabiFound,
  copied,
  duplicatesSkipped,
  skippedNonSyllabi,
  fileTypeCounts,
  departmentCounts,
  skippedExamples,
  parseErrors,
  records: Array.from(recordsByHash.values()).sort((first, second) =>
    first.collectedFileName.localeCompare(second.collectedFileName)
  )
};

await saveManifest(manifest);

console.log(`Total files scanned: ${manifest.totalFilesScanned}`);
console.log(`Supported files scanned: ${manifest.supportedFilesScanned}`);
console.log(`Likely syllabi found: ${manifest.likelySyllabiFound}`);
console.log(`Copied: ${manifest.copied}`);
console.log(`Duplicates skipped: ${manifest.duplicatesSkipped}`);
console.log(`Skipped non-syllabi: ${manifest.skippedNonSyllabi}`);
console.log(`Output folder: ${collectedFilesDir}`);
console.log(`Manifest: ${path.relative(process.cwd(), path.join(collectedRoot, "collection-manifest.json"))}`);
