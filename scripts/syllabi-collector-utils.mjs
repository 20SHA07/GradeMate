import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const extractTextWorkerPath = fileURLToPath(
  new URL("./extract-text-worker.mjs", import.meta.url)
);

export const collectedRoot = path.resolve("training-data", "collected-syllabi");
export const collectedFilesDir = path.join(collectedRoot, "files");
export const manifestPath = path.join(collectedRoot, "collection-manifest.json");
export const indexJsonPath = path.join(collectedRoot, "index.json");
export const indexCsvPath = path.join(collectedRoot, "index.csv");
export const zipPath = path.join(collectedRoot, "collected-syllabi.zip");

export const supportedExtensions = new Set([".pdf", ".docx", ".doc"]);
export const textExtractableExtensions = new Set([".pdf", ".docx"]);

const positiveNamePatterns = [
  /syllabus/i,
  /syllabi/i,
  /supplement/i,
  /course[\s._-]*outline/i,
  /course[\s._-]*syllabus/i
];

const negativeNamePatterns = [
  /lecture/i,
  /slides?/i,
  /lab[\s._-]*(manual|worksheet|experiment|report|exercise)/i,
  /assignment/i,
  /homework/i,
  /\bhw\b/i,
  /\bexam\b/i,
  /midterm/i,
  /final[\s._-]*exam/i,
  /\bquiz\b/i,
  /solution/i,
  /notes?/i,
  /textbook/i,
  /chapter/i,
  /sample/i,
  /project[\s._-]*brief/i,
  /rubric/i
];

const strongTextIndicators = [
  /syllabus supplement for students/i,
  /course code and title/i,
  /assessment methodology/i,
  /\bassessment\s*:/i,
  /course catalog description/i,
  /grading scheme/i,
  /instructor name/i,
  /office hours/i,
  /teaching plan/i,
  /course syllabus/i,
  /course outline/i
];

const negativeTextPatterns = [
  /lecture\s+\d+/i,
  /lecture slides?/i,
  /lab manual/i,
  /lab worksheet/i,
  /assignment instructions?/i,
  /homework solutions?/i,
  /exam review/i,
  /sample exam/i,
  /answer key/i,
  /solution manual/i,
  /project brief/i,
  /rubric only/i
];

const courseCodePattern =
  /(?:^|[^A-Z0-9])([A-Z]{2,5})\s*-?\s*(\d{3}[A-Z]?)(?=$|[^A-Z0-9])/i;

export async function ensureCollectedDirs() {
  await fs.mkdir(collectedFilesDir, { recursive: true });
}

export async function loadManifest() {
  if (!fsSync.existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(await fs.readFile(manifestPath, "utf8"));
}

export async function saveManifest(manifest) {
  await ensureCollectedDirs();
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function walkFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

export async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const stream = fsSync.createReadStream(filePath);

  await new Promise((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  return hash.digest("hex");
}

export function sanitizeFileName(value) {
  const extension = path.extname(value);
  const stem = path
    .basename(value, extension)
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

  return `${stem || "syllabus"}${extension.toLowerCase()}`;
}

export function detectCourseCode(value) {
  const match = value.match(courseCodePattern);

  if (!match) {
    return null;
  }

  return `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
}

export function courseCodePrefix(courseCode) {
  return courseCode ? courseCode.replace(/\s+/g, "") : "";
}

export function getDepartment(courseCode) {
  return courseCode?.match(/^([A-Z]{2,5})\s*\d{3}/i)?.[1].toUpperCase() ?? null;
}

export function scoreSyllabusText(text) {
  return strongTextIndicators.reduce(
    (score, pattern) => score + (pattern.test(text) ? 1 : 0),
    0
  );
}

export function hasNegativeName(fileName) {
  return negativeNamePatterns.some((pattern) => pattern.test(fileName));
}

export function hasPositiveName(fileName) {
  return positiveNamePatterns.some((pattern) => pattern.test(fileName));
}

export function hasNegativeText(text) {
  return negativeTextPatterns.some((pattern) => pattern.test(text));
}

export async function evaluateSyllabusCandidate(filePath, sourceRoot) {
  const fileName = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const relativePath = path.relative(sourceRoot, filePath);
  const stats = await fs.stat(filePath);
  const nameLooksPositive = hasPositiveName(fileName);
  const nameLooksNegative = hasNegativeName(fileName);
  const reasons = [];

  if (!supportedExtensions.has(extension)) {
    return { include: false, reason: "unsupported file type", relativePath };
  }

  if (nameLooksPositive) {
    reasons.push("filename matches syllabus wording");
  }

  if (nameLooksNegative) {
    reasons.push("filename looks like course material");
  }

  let text = "";
  let textExtraction = extension === ".doc" ? "unsupported" : "not_attempted";
  let textScore = 0;
  let parseError = null;

  const shouldSniffNeutralFile =
    !nameLooksPositive && !nameLooksNegative && stats.size <= 3 * 1024 * 1024;
  const shouldExtractText =
    extension === ".docx" && (nameLooksPositive || shouldSniffNeutralFile);

  if (textExtractableExtensions.has(extension) && !shouldExtractText && !nameLooksPositive) {
    reasons.push(
      nameLooksNegative
        ? "filename indicates non-syllabus material"
        : "neutral file too large for text sniff"
    );
  }

  if (shouldExtractText) {
    try {
      const extracted = await extractDocumentTextWithTimeout(
        filePath,
        { maxPages: nameLooksPositive ? undefined : 3 },
        12000
      );
      text = extracted.text;
      textExtraction = "ok";
      textScore = scoreSyllabusText(text.slice(0, 20000));

      if (textScore > 0) {
        reasons.push(`text has ${textScore} syllabus indicators`);
      }
    } catch (error) {
      textExtraction = "failed";
      parseError = getErrorMessage(error);
      reasons.push(`text extraction failed: ${parseError}`);
    }
  }

  const negativeText = text ? hasNegativeText(text.slice(0, 12000)) : false;
  const include =
    (nameLooksPositive && !negativeText) ||
    (!nameLooksNegative && !negativeText && textScore >= 3) ||
    (extension === ".doc" && nameLooksPositive && !nameLooksNegative);

  if (!include) {
    return {
      include: false,
      reason:
        reasons.join("; ") ||
        (nameLooksNegative ? "filename indicates non-syllabus material" : "not syllabus-like"),
      relativePath,
      parseError
    };
  }

  const confidence =
    nameLooksPositive && textScore >= 2
      ? 0.95
      : textScore >= 4
        ? 0.9
        : nameLooksPositive
          ? 0.78
          : 0.68;
  const detectedCourseCode =
    detectCourseCode(`${fileName}\n${relativePath}\n${text.slice(0, 4000)}`) ?? null;

  return {
    include: true,
    confidence,
    reasonDetected: reasons.filter((reason) => !/course material/i.test(reason)).join("; "),
    detectedCourseCode,
    relativePath,
    textExtraction,
    parseError
  };
}

export async function extractDocumentTextWithTimeout(filePath, options = {}, timeoutMs = 30000) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [extractTextWorkerPath, filePath, JSON.stringify(options)],
    {
      timeout: timeoutMs,
      maxBuffer: 80 * 1024 * 1024,
      windowsHide: true
    }
  );

  return JSON.parse(stdout);
}

export function getCollectedFilePath(fileName) {
  return path.join(collectedFilesDir, fileName);
}

export async function makeUniqueCollectedName(baseName, sha256Hash) {
  let candidate = baseName;
  let candidatePath = getCollectedFilePath(candidate);

  if (!fsSync.existsSync(candidatePath)) {
    return candidate;
  }

  const existingHash = await sha256File(candidatePath);

  if (existingHash === sha256Hash) {
    return candidate;
  }

  const extension = path.extname(baseName);
  const stem = path.basename(baseName, extension);
  candidate = `${stem}_${sha256Hash.slice(0, 8)}${extension}`;
  candidatePath = getCollectedFilePath(candidate);

  if (!fsSync.existsSync(candidatePath)) {
    return candidate;
  }

  let counter = 2;

  while (fsSync.existsSync(candidatePath)) {
    candidate = `${stem}_${sha256Hash.slice(0, 8)}_${counter}${extension}`;
    candidatePath = getCollectedFilePath(candidate);
    counter += 1;
  }

  return candidate;
}

export function csvEscape(value) {
  const stringValue = value === null || value === undefined ? "" : String(value);

  if (!/[",\n\r]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
