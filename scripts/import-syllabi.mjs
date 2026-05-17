import { promises as fs } from "node:fs";
import path from "node:path";
import { inflateRawSync, inflateSync } from "node:zlib";

const supportedExtensions = new Set([
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);
const parseableExtensions = new Set([".pdf", ".docx", ".txt", ".md"]);
const maxParseableBytes = 25 * 1024 * 1024;
const courseCodePattern =
  /(?:^|[^A-Z0-9])([A-Z]{2,5})\s*-?\s*(\d{3}[A-Z]?)(?=$|[^A-Z0-9])/gi;
const positiveSyllabusNamePattern =
  /syllabus|syllabi|course[-_\s]*outline|course[-_\s]*information|course[-_\s]*info|course[-_\s]*guide/i;
const negativeMaterialPattern =
  /lecture|slides?|assignment|homework|\bhw\b|\blab\b|tutorial|worksheet|project\s*brief|solution|exam\s*review|notes?|reading|chapter|quiz|rubric/i;
const strongSyllabusIndicators = [
  /course\s+syllabus/i,
  /course\s+outline/i,
  /grading\s+scheme/i,
  /assessment\s+breakdown/i,
  /course\s+learning\s+outcomes?/i,
  /instructor\s+information/i,
  /office\s+hours?/i,
  /textbook/i,
  /course\s+description/i,
  /evaluation\s+criteria/i,
  /grading\s+breakdown/i,
  /assessment\s+criteria/i
];
const gradingIndicators =
  /grading|grade\s+distribution|assessment|evaluation|breakdown|weight|marks/i;
const assessmentKeywords = [
  "midterm",
  "final",
  "quiz",
  "assignment",
  "homework",
  "project",
  "participation",
  "attendance",
  "lab",
  "exam",
  "presentation",
  "report",
  "case study",
  "group study"
];

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isForce = args.includes("--force");
const sourceDirArg = args.find((arg) => !arg.startsWith("--"));
const sourceDir = sourceDirArg || process.env.COURSE_SYLLABI_SOURCE_DIR;

if (!sourceDir) {
  console.error(
    'Missing folder path. Run: npm run import:syllabi:dry -- "C:\\path\\to\\folder"'
  );
  process.exit(1);
}

const rootDir = path.resolve(sourceDir);

function cleanWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCourseCode(value) {
  const match = value.match(
    /(?:^|[^A-Z0-9])([A-Z]{2,5})\s*-?\s*(\d{3}[A-Z]?)(?=$|[^A-Z0-9])/i
  );

  if (!match) {
    return "";
  }

  return `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
}

function uniqueCourseCodes(value) {
  const matches = new Set();

  for (const match of value.matchAll(courseCodePattern)) {
    matches.add(`${match[1].toUpperCase()} ${match[2].toUpperCase()}`);
  }

  return [...matches];
}

function hasFilenameFolderCourseConflict(file) {
  const folderCodes = uniqueCourseCodes(path.dirname(file.relativePath));
  const fileNameCodes = uniqueCourseCodes(file.fileName);

  if (folderCodes.length === 0 || fileNameCodes.length === 0) {
    return null;
  }

  const matchingCode = fileNameCodes.find((code) => folderCodes.includes(code));

  if (matchingCode) {
    return null;
  }

  return `course code conflict: folder has ${folderCodes.join(", ")} but file name has ${fileNameCodes.join(", ")}`;
}

function pushReviewFile(files, file, reason) {
  file.syllabusReason = reason;
  files.push(file);
}

function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripXml(value) {
  return cleanWhitespace(
    decodeXmlEntities(
      value
        .replace(/<w:tab\/>/g, " ")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function getLocalFileHeaderDataStart(buffer, localHeaderOffset) {
  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    return null;
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);

  return localHeaderOffset + 30 + fileNameLength + extraLength;
}

function readZipEntry(buffer, wantedEntryName) {
  let eocdOffset = -1;
  const minOffset = Math.max(0, buffer.length - 66000);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset === -1) {
    return "";
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(centralDirectoryOffset) !== 0x02014b50) {
      return "";
    }

    const compressionMethod = buffer.readUInt16LE(centralDirectoryOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralDirectoryOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralDirectoryOffset + 28);
    const extraLength = buffer.readUInt16LE(centralDirectoryOffset + 30);
    const commentLength = buffer.readUInt16LE(centralDirectoryOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(centralDirectoryOffset + 42);
    const entryName = buffer
      .subarray(
        centralDirectoryOffset + 46,
        centralDirectoryOffset + 46 + fileNameLength
      )
      .toString("utf8");

    if (entryName === wantedEntryName) {
      const dataStart = getLocalFileHeaderDataStart(buffer, localHeaderOffset);

      if (dataStart === null) {
        return "";
      }

      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) {
        return compressed.toString("utf8");
      }

      if (compressionMethod === 8) {
        return inflateRawSync(compressed).toString("utf8");
      }

      return "";
    }

    centralDirectoryOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return "";
}

function extractDocxText(buffer) {
  const documentXml = readZipEntry(buffer, "word/document.xml");

  return documentXml ? stripXml(documentXml) : "";
}

function unescapePdfLiteral(value) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\[0-7]{1,3}/g, " ");
}

function extractPdfStringsFromText(value) {
  const parts = [];
  const literalPattern = /\((?:\\.|[^\\()]){2,}\)/g;
  const readablePattern = /[A-Za-z][A-Za-z0-9 ,.:;/%()[\]#&+\-]{5,}/g;

  for (const match of value.matchAll(literalPattern)) {
    const text = unescapePdfLiteral(match[0].slice(1, -1));

    if (/[A-Za-z]/.test(text)) {
      parts.push(text);
    }
  }

  for (const match of value.matchAll(readablePattern)) {
    parts.push(match[0]);
  }

  return cleanWhitespace(parts.join(" "));
}

function extractPdfText(buffer) {
  const raw = buffer.toString("latin1");
  const chunks = [extractPdfStringsFromText(raw)];
  const streamPattern = /<<[\s\S]{0,700}?\/FlateDecode[\s\S]{0,700}?>>\s*stream\r?\n/g;

  for (const match of raw.matchAll(streamPattern)) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);

    if (end === -1) {
      continue;
    }

    const streamBuffer = buffer.subarray(start, end);

    try {
      chunks.push(extractPdfStringsFromText(inflateSync(streamBuffer).toString("latin1")));
    } catch {
      try {
        chunks.push(
          extractPdfStringsFromText(inflateRawSync(streamBuffer).toString("latin1"))
        );
      } catch {
        // Unsupported PDF stream. Skip it.
      }
    }
  }

  return cleanWhitespace(chunks.join(" "));
}

async function extractFileText(file) {
  if (!parseableExtensions.has(file.extension)) {
    return { text: "", error: "" };
  }

  if (file.size > maxParseableBytes) {
    return { text: "", error: "file too large to parse" };
  }

  try {
    const buffer = await fs.readFile(file.absolutePath);

    if (file.extension === ".txt" || file.extension === ".md") {
      return { text: buffer.toString("utf8"), error: "" };
    }

    if (file.extension === ".docx") {
      return { text: extractDocxText(buffer), error: "" };
    }

    if (file.extension === ".pdf") {
      return { text: extractPdfText(buffer), error: "" };
    }
  } catch (error) {
    return {
      text: "",
      error: error instanceof Error ? error.message : "file could not be parsed"
    };
  }

  return { text: "", error: "" };
}

async function scanFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await scanFiles(entryPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();

    if (!supportedExtensions.has(extension)) {
      continue;
    }

    const stat = await fs.stat(entryPath);

    files.push({
      absolutePath: entryPath,
      relativePath: path.relative(rootDir, entryPath),
      fileName: entry.name,
      extension,
      size: stat.size,
      text: "",
      parseError: "",
      syllabusStatus: "unknown",
      syllabusConfidence: 0,
      syllabusReason: ""
    });
  }

  return files;
}

function shouldParseForSyllabus(file) {
  if (!parseableExtensions.has(file.extension)) {
    return false;
  }

  if (file.size > maxParseableBytes) {
    return false;
  }

  const text = `${file.relativePath} ${file.fileName}`;

  if (positiveSyllabusNamePattern.test(text)) {
    return true;
  }

  if (negativeMaterialPattern.test(text)) {
    return false;
  }

  return file.size <= 5 * 1024 * 1024;
}

function hasGradingBreakdown(text) {
  return gradingIndicators.test(text) && /\b\d{1,3}(?:\.\d+)?\s*%/.test(text);
}

function countSyllabusIndicators(text) {
  return strongSyllabusIndicators.reduce(
    (count, pattern) => count + (pattern.test(text) ? 1 : 0),
    0
  );
}

function classifySyllabus(file) {
  const nameText = `${file.relativePath} ${file.fileName}`;
  const positiveName = positiveSyllabusNamePattern.test(nameText);
  const negativeName = negativeMaterialPattern.test(nameText);
  const text = file.text;
  const indicatorCount = countSyllabusIndicators(text);
  const gradingFound = hasGradingBreakdown(text);

  if (negativeName && !(indicatorCount >= 4 && gradingFound)) {
    return {
      status: "skip",
      confidence: 0,
      reason: "material filename"
    };
  }

  if (positiveName && gradingFound) {
    return {
      status: "syllabus",
      confidence: 0.92,
      reason: "syllabus filename plus grading section"
    };
  }

  if (positiveName && indicatorCount >= 1) {
    return {
      status: "syllabus",
      confidence: 0.72,
      reason: "syllabus filename plus syllabus indicators"
    };
  }

  if (positiveName) {
    return {
      status: "syllabus",
      confidence: 0.55,
      reason: "syllabus filename but grading unclear"
    };
  }

  if (indicatorCount >= 4 && gradingFound) {
    return {
      status: "syllabus",
      confidence: 0.78,
      reason: "text strongly looks like syllabus"
    };
  }

  if (indicatorCount >= 2 && gradingFound) {
    return {
      status: "possible",
      confidence: 0.48,
      reason: "possible syllabus from text"
    };
  }

  return {
    status: "skip",
    confidence: 0,
    reason: text ? "not syllabus-like" : "not parsed"
  };
}

function pickCourseName(relativePath, courseCode, text) {
  const segments = relativePath.split(path.sep);

  for (const segment of segments) {
    if (normalizeCourseCode(segment) === courseCode) {
      const codeMatcher = new RegExp(courseCode.replace(" ", "\\s*-?\\s*"), "i");
      const name = cleanWhitespace(
        segment
          .replace(codeMatcher, "")
          .replace(/\.[^.]+$/, "")
          .replace(/[_-]+/g, " ")
      );

      if (name && !positiveSyllabusNamePattern.test(name)) {
        return name;
      }
    }
  }

  const titleMatch =
    text.match(/course\s+(?:title|name)\s*[:\-]\s*([^\n\r]{3,100})/i) ??
    text.match(/title\s*[:\-]\s*([^\n\r]{3,100})/i);

  if (titleMatch) {
    return cleanWhitespace(titleMatch[1]).replace(/\s+\d+\s*$/, "");
  }

  return courseCode;
}

function pickCreditHours(text) {
  const match =
    text.match(/credit\s*(?:hours?|hrs?)?\s*[:=\-]?\s*(\d+(?:\.\d+)?)/i) ??
    text.match(/(\d+(?:\.\d+)?)\s*credit\s*(?:hours?|hrs?)/i);

  if (!match) {
    return 3;
  }

  const value = Number(match[1]);

  return Number.isFinite(value) && value > 0 ? value : 3;
}

function pickInstructor(text) {
  const match =
    text.match(/(?:instructor|professor|course\s+coordinator|lecturer)\s*[:\-]\s*([A-Za-z .'-]{3,80})/i) ??
    text.match(/(?:dr\.?|prof\.?)\s+([A-Za-z .'-]{3,80})/i);

  return match ? cleanWhitespace(match[1]).slice(0, 80) : null;
}

function pickTerm(text) {
  const match =
    text.match(/\b(Fall|Spring|Summer|Winter)\s+20\d{2}\b/i) ??
    text.match(/(?:term|semester)\s*[:\-]\s*([A-Za-z]+\s+20\d{2})/i);

  return match ? cleanWhitespace(match[0].replace(/^(term|semester)\s*[:\-]\s*/i, "")) : null;
}

function pickDescription(text) {
  const match =
    text.match(/course\s+description\s*[:\-]?\s*([^\n\r]{20,400})/i) ??
    text.match(/catalog\s+description\s*[:\-]?\s*([^\n\r]{20,400})/i);

  return match ? cleanWhitespace(match[1]).slice(0, 500) : null;
}

function canonicalAssessmentName(label) {
  const lower = label.toLowerCase();

  if (lower.includes("midterm")) return "Midterm";
  if (lower.includes("final")) return "Final Exam";
  if (lower.includes("quiz")) return "Quizzes";
  if (lower.includes("assignment") || lower.includes("homework")) return "Assignments";
  if (lower.includes("project")) return "Projects";
  if (lower.includes("participation") || lower.includes("attendance")) return "Participation";
  if (lower.includes("lab")) return "Labs";
  if (lower.includes("presentation")) return "Presentation";
  if (lower.includes("report")) return "Reports";
  if (lower.includes("exam") || lower.includes("test")) return "Exams";
  if (lower.includes("case study")) return "Case Studies";
  if (lower.includes("group study")) return "Group Study";

  return "";
}

function collectAssessmentCandidate(map, label, weight, confidence, snippet) {
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
    return;
  }

  const cleanedLabel = cleanWhitespace(
    label
      .replace(/[•*]/g, " ")
      .replace(/\btotal\b/gi, " ")
      .replace(/[_\-–—:]+/g, " ")
  );
  const lower = cleanedLabel.toLowerCase();

  if (!assessmentKeywords.some((keyword) => lower.includes(keyword))) {
    return;
  }

  const name = canonicalAssessmentName(cleanedLabel);

  if (!name) {
    return;
  }

  const current = map.get(name);

  if (!current || weight > current.weight_percentage) {
    map.set(name, {
      name,
      weight_percentage: Number(weight.toFixed(2)),
      max_score: 100,
      confidence,
      source_text_snippet: cleanWhitespace(snippet).slice(0, 240)
    });
  }
}

function detectAssessments(text) {
  const assessmentMap = new Map();
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => cleanWhitespace(line))
    .filter((line) => line.includes("%") && line.length < 200);

  for (const line of lines) {
    const labelFirst = /([A-Za-z][A-Za-z0-9&/ ()#.-]{1,70}?)\s*(?:[:.\-–—]|\s)\s*(\d{1,3}(?:\.\d+)?)\s*%/g;
    const percentFirst = /(\d{1,3}(?:\.\d+)?)\s*%\s*(?:for|on|of|[-:])?\s*([A-Za-z][A-Za-z0-9&/ ()#.-]{1,70})/g;

    for (const match of line.matchAll(labelFirst)) {
      collectAssessmentCandidate(
        assessmentMap,
        match[1],
        Number(match[2]),
        0.85,
        line
      );
    }

    for (const match of line.matchAll(percentFirst)) {
      collectAssessmentCandidate(
        assessmentMap,
        match[2],
        Number(match[1]),
        0.8,
        line
      );
    }
  }

  const compactText = cleanWhitespace(text);
  const compactPattern = /([A-Za-z][A-Za-z0-9&/ ()#.-]{1,55}?)\s*(?:[:.\-–—]|\s)\s*(\d{1,3}(?:\.\d+)?)\s*%/g;

  for (const match of compactText.matchAll(compactPattern)) {
    const start = Math.max(0, match.index - 80);
    const end = Math.min(compactText.length, match.index + match[0].length + 80);

    collectAssessmentCandidate(
      assessmentMap,
      match[1],
      Number(match[2]),
      0.65,
      compactText.slice(start, end)
    );
  }

  return [...assessmentMap.values()].sort((first, second) =>
    first.name.localeCompare(second.name)
  );
}

function findCourseRootDir(file, courseCode) {
  const relativeParts = file.relativePath.split(path.sep);

  for (let index = 0; index < relativeParts.length - 1; index += 1) {
    if (normalizeCourseCode(relativeParts[index]) === courseCode) {
      return path.join(rootDir, ...relativeParts.slice(0, index + 1));
    }
  }

  return path.dirname(file.absolutePath);
}

function classifyMaterial(file) {
  const lower = `${file.relativePath} ${file.fileName}`.toLowerCase();

  if (/lecture|slides?/.test(lower)) return "lecture";
  if (/assignment|homework|\bhw\b|worksheet/.test(lower)) return "assignment";
  if (/\blab\b|laboratory/.test(lower)) return "lab";
  if (/notes?|reading|chapter/.test(lower)) return "notes";
  if (/project/.test(lower)) return "project";
  if (/exam|review|midterm|final|quiz|solution/.test(lower)) return "exam_review";

  return "other";
}

function materialForTemplate(file) {
  return {
    file_name: file.fileName,
    file_path: file.absolutePath,
    file_type: file.extension.replace(".", ""),
    material_type: classifyMaterial(file)
  };
}

function confidenceWithGradeWarning(baseConfidence, assessments) {
  if (assessments.length === 0) {
    return Number(Math.min(baseConfidence, 0.55).toFixed(2));
  }

  const totalWeight = assessments.reduce(
    (sum, assessment) => sum + assessment.weight_percentage,
    0
  );

  if (totalWeight < 95 || totalWeight > 105) {
    return Number(Math.min(baseConfidence, 0.68).toFixed(2));
  }

  return Number(baseConfidence.toFixed(2));
}

function buildTemplateFromSyllabus(file) {
  const textForCode = `${file.relativePath}\n${file.text}`;
  const courseCode = uniqueCourseCodes(textForCode)[0] ?? "";

  if (!courseCode) {
    return null;
  }

  const courseName = pickCourseName(file.relativePath, courseCode, file.text);
  const assessments = detectAssessments(file.text);
  const extractionConfidence = confidenceWithGradeWarning(
    file.syllabusConfidence,
    assessments
  );
  const sourceFolderPath = findCourseRootDir(file, courseCode);

  return {
    key: `${courseCode}::${courseName.toLowerCase()}`,
    sourceFile: file,
    sourceFolderPath,
    template: {
      course_code: courseCode,
      course_name: courseName,
      department: courseCode.split(" ")[0],
      credit_hours: pickCreditHours(file.text),
      instructor: pickInstructor(file.text),
      term: pickTerm(`${file.relativePath}\n${file.text}`),
      description:
        pickDescription(file.text) ??
        `Created from syllabus ${file.fileName}.`,
      source_file_name: file.fileName,
      source_folder_path: sourceFolderPath,
      source_syllabus_file_name: file.fileName,
      source_syllabus_path: file.absolutePath,
      extraction_confidence: extractionConfidence
    },
    assessments,
    warnings: {
      gradeTotal:
        assessments.length > 0
          ? assessments.reduce((sum, item) => sum + item.weight_percentage, 0)
          : 0
    }
  };
}

function isSameOrChildPath(filePath, folderPath) {
  const relative = path.relative(folderPath, filePath);

  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function attachMaterials(payloads, files) {
  for (const payload of payloads) {
    const courseCode = payload.template.course_code;
    const materialMap = new Map();

    for (const file of files) {
      if (file.absolutePath === payload.sourceFile.absolutePath) {
        continue;
      }

      const sameFolder = isSameOrChildPath(file.absolutePath, payload.sourceFolderPath);
      const sameCode = uniqueCourseCodes(file.relativePath).includes(courseCode);

      if (!sameFolder && !sameCode) {
        continue;
      }

      materialMap.set(file.absolutePath, materialForTemplate(file));
    }

    payload.materials = [...materialMap.values()].sort((first, second) =>
      first.file_name.localeCompare(second.file_name)
    );
  }
}

async function prepareSyllabusPayloads(files) {
  const parseErrors = [];
  const possibleSyllabi = [];
  const noCourseCode = [];
  const skippedMaterials = [];
  const syllabusFiles = [];

  for (const file of files) {
    if (shouldParseForSyllabus(file)) {
      const result = await extractFileText(file);
      file.text = result.text.slice(0, 120000);

      if (result.error) {
        file.parseError = result.error;
        parseErrors.push(`${file.relativePath}: ${result.error}`);
      }
    }

    const classification = classifySyllabus(file);
    file.syllabusStatus = classification.status;
    file.syllabusConfidence = classification.confidence;
    file.syllabusReason = classification.reason;

    if (classification.status === "possible") {
      pushReviewFile(possibleSyllabi, file, classification.reason);
      continue;
    }

    if (classification.status !== "syllabus") {
      skippedMaterials.push(file);
      continue;
    }

    const conflictReason = hasFilenameFolderCourseConflict(file);

    if (conflictReason) {
      pushReviewFile(possibleSyllabi, file, conflictReason);
      continue;
    }

    const payload = buildTemplateFromSyllabus(file);

    if (!payload) {
      noCourseCode.push(file);
      continue;
    }

    syllabusFiles.push(payload);
  }

  const payloadByKey = new Map();
  const duplicateSyllabi = [];

  for (const payload of syllabusFiles) {
    const current = payloadByKey.get(payload.key);

    if (!current || payload.template.extraction_confidence > current.template.extraction_confidence) {
      if (current) {
        duplicateSyllabi.push(current.sourceFile.relativePath);
      }

      payloadByKey.set(payload.key, payload);
    } else {
      duplicateSyllabi.push(payload.sourceFile.relativePath);
    }
  }

  const payloads = [...payloadByKey.values()];
  attachMaterials(payloads, files);

  return {
    payloads,
    summary: {
      totalFiles: files.length,
      syllabusFilesFound: syllabusFiles.length,
      skippedMaterialFiles: skippedMaterials.length,
      possibleSyllabi,
      noCourseCode,
      parseErrors,
      duplicateSyllabi
    }
  };
}

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing syllabi."
    );
  }

  return { supabaseUrl, serviceRoleKey };
}

function isMissingFieldValue(field, value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (field === "extraction_confidence") return Number(value) <= 0;
  if (field === "credit_hours") return !Number.isFinite(Number(value)) || Number(value) <= 0;
  return false;
}

function buildMissingFieldUpdate(existingTemplate, incomingTemplate) {
  const fields = [
    "department",
    "credit_hours",
    "instructor",
    "term",
    "description",
    "source_file_name",
    "source_folder_path",
    "source_syllabus_file_name",
    "source_syllabus_path",
    "extraction_confidence"
  ];
  const updates = {};

  for (const field of fields) {
    if (
      isMissingFieldValue(field, existingTemplate[field]) &&
      !isMissingFieldValue(field, incomingTemplate[field])
    ) {
      updates[field] = incomingTemplate[field];
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date().toISOString();
  }

  return updates;
}

async function batchInsert(supabase, table, rows) {
  if (rows.length === 0) {
    return 0;
  }

  const batchSize = 250;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { error } = await supabase.from(table).insert(batch);

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
  }

  return rows.length;
}

async function replaceTemplateChildren(supabase, templateId, payload) {
  const { error: assessmentDeleteError } = await supabase
    .from("course_template_assessments")
    .delete()
    .eq("course_template_id", templateId);

  if (assessmentDeleteError) {
    throw new Error(`course_template_assessments: ${assessmentDeleteError.message}`);
  }

  const { error: materialDeleteError } = await supabase
    .from("course_template_materials")
    .delete()
    .eq("course_template_id", templateId);

  if (materialDeleteError) {
    throw new Error(`course_template_materials: ${materialDeleteError.message}`);
  }

  return {
    assessmentsInserted: await batchInsert(
      supabase,
      "course_template_assessments",
      payload.assessments.map((assessment) => ({
        ...assessment,
        course_template_id: templateId
      }))
    ),
    materialsInserted: await batchInsert(
      supabase,
      "course_template_materials",
      payload.materials.map((material) => ({
        ...material,
        course_template_id: templateId
      }))
    )
  };
}

async function insertChildrenIfEmpty(supabase, templateId, payload) {
  const [assessmentResponse, materialResponse] = await Promise.all([
    supabase
      .from("course_template_assessments")
      .select("id")
      .eq("course_template_id", templateId)
      .limit(1),
    supabase
      .from("course_template_materials")
      .select("id")
      .eq("course_template_id", templateId)
      .limit(1)
  ]);

  if (assessmentResponse.error) {
    throw new Error(`course_template_assessments: ${assessmentResponse.error.message}`);
  }

  if (materialResponse.error) {
    throw new Error(`course_template_materials: ${materialResponse.error.message}`);
  }

  const assessmentsInserted =
    (assessmentResponse.data ?? []).length === 0
      ? await batchInsert(
          supabase,
          "course_template_assessments",
          payload.assessments.map((assessment) => ({
            ...assessment,
            course_template_id: templateId
          }))
        )
      : 0;
  const materialsInserted =
    (materialResponse.data ?? []).length === 0
      ? await batchInsert(
          supabase,
          "course_template_materials",
          payload.materials.map((material) => ({
            ...material,
            course_template_id: templateId
          }))
        )
      : 0;

  return { assessmentsInserted, materialsInserted };
}

async function saveSyllabusTemplates(payloads) {
  const { createClient } = await import("@supabase/supabase-js");
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  const result = {
    created: 0,
    existingMatched: 0,
    missingFieldUpdates: 0,
    forceReplaced: 0,
    assessmentsAdded: 0,
    materialsAdded: 0
  };

  for (const payload of payloads) {
    const { data: existing, error: existingError } = await supabase
      .from("course_templates")
      .select("*")
      .eq("course_code", payload.template.course_code)
      .eq("course_name", payload.template.course_name)
      .maybeSingle();

    if (existingError) {
      throw new Error(`course_templates: ${existingError.message}`);
    }

    if (existing) {
      result.existingMatched += 1;

      if (isForce) {
        const { error: updateError } = await supabase
          .from("course_templates")
          .update({ ...payload.template, updated_at: new Date().toISOString() })
          .eq("id", existing.id);

        if (updateError) {
          throw new Error(`course_templates: ${updateError.message}`);
        }

        const childResult = await replaceTemplateChildren(
          supabase,
          existing.id,
          payload
        );
        result.forceReplaced += 1;
        result.assessmentsAdded += childResult.assessmentsInserted;
        result.materialsAdded += childResult.materialsInserted;
        continue;
      }

      const missingFieldUpdate = buildMissingFieldUpdate(
        existing,
        payload.template
      );

      if (Object.keys(missingFieldUpdate).length > 0) {
        const { error: updateError } = await supabase
          .from("course_templates")
          .update(missingFieldUpdate)
          .eq("id", existing.id);

        if (updateError) {
          throw new Error(`course_templates: ${updateError.message}`);
        }

        result.missingFieldUpdates += 1;
      }

      const childResult = await insertChildrenIfEmpty(
        supabase,
        existing.id,
        payload
      );
      result.assessmentsAdded += childResult.assessmentsInserted;
      result.materialsAdded += childResult.materialsInserted;
      continue;
    }

    const { data: template, error: templateError } = await supabase
      .from("course_templates")
      .insert(payload.template)
      .select("id")
      .single();

    if (templateError || !template) {
      throw new Error(templateError?.message ?? "Template insert failed.");
    }

    result.created += 1;
    const childResult = await replaceTemplateChildren(supabase, template.id, payload);
    result.assessmentsAdded += childResult.assessmentsInserted;
    result.materialsAdded += childResult.materialsInserted;
  }

  return result;
}

async function findDatabaseDuplicates(payloads) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
    const duplicates = [];

    for (const payload of payloads) {
      const { data, error } = await supabase
        .from("course_templates")
        .select("id")
        .eq("course_code", payload.template.course_code)
        .eq("course_name", payload.template.course_name)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        duplicates.push(`${payload.template.course_code} ${payload.template.course_name}`);
      }
    }

    return duplicates;
  } catch {
    return null;
  }
}

function printList(label, values, formatter = (value) => value) {
  console.log(`${label}: ${values.length}`);

  for (const value of values.slice(0, 20)) {
    console.log(`- ${formatter(value)}`);
  }

  if (values.length > 20) {
    console.log(`- ...and ${values.length - 20} more`);
  }
}

async function printDryRunSummary(payloads, summary) {
  const databaseDuplicates = await findDatabaseDuplicates(payloads);

  console.log(`Total supported files scanned: ${summary.totalFiles}`);
  console.log(`Syllabus files found: ${summary.syllabusFilesFound}`);
  console.log(`Skipped material files: ${summary.skippedMaterialFiles}`);
  printList(
    "Possible syllabus files needing review",
    summary.possibleSyllabi,
    (file) => `${file.relativePath} (${file.syllabusReason})`
  );
  printList(
    "Syllabus files missing course code",
    summary.noCourseCode,
    (file) => file.relativePath
  );
  printList("Parse errors", summary.parseErrors);
  printList("Duplicate syllabus files in scan", summary.duplicateSyllabi);

  if (databaseDuplicates) {
    printList("Duplicates already in Supabase", databaseDuplicates);
  } else {
    console.log(
      "Duplicates already in Supabase: skipped because Supabase service role env vars are not set"
    );
  }

  console.log("\nWhat would be inserted or updated:");

  for (const payload of payloads) {
    const totalWeight = payload.assessments.reduce(
      (sum, assessment) => sum + assessment.weight_percentage,
      0
    );
    const weightWarning =
      payload.assessments.length > 0 && (totalWeight < 95 || totalWeight > 105)
        ? " (weight warning)"
        : "";

    console.log(
      `- ${payload.template.course_code}: ${payload.template.course_name} | credits ${payload.template.credit_hours} | assessments ${payload.assessments.length} | total weight ${totalWeight}%${weightWarning} | materials ${payload.materials.length} | confidence ${payload.template.extraction_confidence}`
    );

    if (payload.template.instructor) {
      console.log(`  instructor: ${payload.template.instructor}`);
    }

    if (payload.template.term) {
      console.log(`  term: ${payload.template.term}`);
    }

    console.log(`  syllabus: ${payload.template.source_syllabus_file_name}`);

    for (const assessment of payload.assessments) {
      console.log(
        `  assessment: ${assessment.name} ${assessment.weight_percentage}%`
      );
    }
  }
}

async function main() {
  const stat = await fs.stat(rootDir);

  if (!stat.isDirectory()) {
    throw new Error(`${rootDir} is not a folder.`);
  }

  console.log(`Scanning ${rootDir}`);
  const files = await scanFiles(rootDir);
  const { payloads, summary } = await prepareSyllabusPayloads(files);

  if (isDryRun) {
    await printDryRunSummary(payloads, summary);
    console.log("\nDry run complete. No Supabase rows were changed.");
    return;
  }

  console.log(
    `Found ${summary.syllabusFilesFound} syllabus file(s). Importing ${payloads.length} syllabus-created template(s).`
  );
  const result = await saveSyllabusTemplates(payloads);

  console.log(
    `Created ${result.created} template(s). Matched ${result.existingMatched} existing template(s).`
  );
  console.log(
    `Updated missing fields on ${result.missingFieldUpdates} existing template(s). Force-replaced ${result.forceReplaced} template(s).`
  );
  console.log(
    `Added ${result.assessmentsAdded} assessment row(s) and ${result.materialsAdded} material row(s).`
  );

  if (summary.noCourseCode.length > 0) {
    printList(
      "Review required: syllabus files missing course code",
      summary.noCourseCode,
      (file) => file.relativePath
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
