import { inflateRawSync, inflateSync } from "node:zlib";
import { promises as fs } from "node:fs";
import path from "node:path";

const supportedMaterialExtensions = new Set([
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
const likelyTemplateTextPattern =
  /syllabus|outline|grading|grade|score|course\s*plan|supplement|assessment|evaluation|breakdown/i;
const courseCodePattern = /\b([A-Z]{2,5})\s*-?\s*(\d{3}[A-Z]?)\b/gi;
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
const sourceDir = sourceDirArg || process.env.COURSE_TEMPLATE_SOURCE_DIR;

if (!sourceDir) {
  console.error(
    "Missing folder path. Run: npm run import:templates -- \"C:\\\\path\\\\to\\\\course-folder\""
  );
  process.exit(1);
}

const rootDir = path.resolve(sourceDir);

function normalizeCourseCode(value) {
  const match = value.match(/\b([A-Z]{2,5})\s*-?\s*(\d{3}[A-Z]?)\b/i);

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

function cleanWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
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
  const signature = buffer.readUInt32LE(localHeaderOffset);

  if (signature !== 0x04034b50) {
    return null;
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);

  return localHeaderOffset + 30 + fileNameLength + extraLength;
}

function readZipEntry(buffer, wantedEntryName) {
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  const minOffset = Math.max(0, buffer.length - 66000);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
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

  for (const match of value.matchAll(literalPattern)) {
    const text = unescapePdfLiteral(match[0].slice(1, -1));

    if (/[A-Za-z]/.test(text)) {
      parts.push(text);
    }
  }

  const readablePattern = /[A-Za-z][A-Za-z0-9 ,.:;/%()[\]#&+\-]{5,}/g;

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
        // Some PDF streams are images or use unsupported filters. Skip them.
      }
    }
  }

  return cleanWhitespace(chunks.join(" "));
}

async function extractFileText(filePath, extension, size) {
  if (!parseableExtensions.has(extension) || size > maxParseableBytes) {
    return { text: "", warning: size > maxParseableBytes ? "file too large to parse" : "" };
  }

  try {
    const buffer = await fs.readFile(filePath);

    if (extension === ".txt" || extension === ".md") {
      return { text: buffer.toString("utf8"), warning: "" };
    }

    if (extension === ".docx") {
      return { text: extractDocxText(buffer), warning: "" };
    }

    if (extension === ".pdf") {
      return { text: extractPdfText(buffer), warning: "" };
    }
  } catch (error) {
    return {
      text: "",
      warning: error instanceof Error ? error.message : "file could not be parsed"
    };
  }

  return { text: "", warning: "" };
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

    if (!supportedMaterialExtensions.has(extension)) {
      continue;
    }

    const stat = await fs.stat(entryPath);
    files.push({
      absolutePath: entryPath,
      relativePath: path.relative(rootDir, entryPath),
      fileName: entry.name,
      extension,
      size: stat.size
    });
  }

  return files;
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

      if (name) {
        return name;
      }
    }
  }

  const titleMatch =
    text.match(/course\s+(?:title|name)\s*[:\-]\s*([^\n\r]{3,90})/i) ??
    text.match(/title\s*[:\-]\s*([^\n\r]{3,90})/i);

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
    return { creditHours: 3, found: false };
  }

  const creditHours = Number(match[1]);

  return {
    creditHours: Number.isFinite(creditHours) && creditHours > 0 ? creditHours : 3,
    found: Number.isFinite(creditHours) && creditHours > 0
  };
}

function canonicalAssessmentName(label) {
  const lower = label.toLowerCase();

  if (lower.includes("midterm")) return "Midterm";
  if (lower.includes("final")) return "Final Exam";
  if (lower.includes("quiz")) return "Quizzes";
  if (lower.includes("assignment") || lower.includes("homework")) {
    return "Assignments";
  }
  if (lower.includes("project")) return "Projects";
  if (lower.includes("participation") || lower.includes("attendance")) {
    return "Participation";
  }
  if (lower.includes("lab")) return "Labs";
  if (lower.includes("presentation")) return "Presentation";
  if (lower.includes("report")) return "Reports";
  if (lower.includes("exam") || lower.includes("test")) return "Exams";
  if (lower.includes("case study")) return "Case Studies";
  if (lower.includes("group study")) return "Group Study";

  return "";
}

function normalizeAssessmentLabel(label) {
  return cleanWhitespace(
    label
      .replace(/[•*]/g, " ")
      .replace(/\b\d+\b/g, " ")
      .replace(/\btotal\b/gi, " ")
      .replace(/[_\-–—:]+/g, " ")
  );
}

function collectAssessmentCandidate(map, label, weight, confidence) {
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100) {
    return;
  }

  const cleanedLabel = normalizeAssessmentLabel(label);
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
      confidence
    });
  }
}

function detectAssessments(text) {
  const normalized = text.replace(/\r/g, "\n");
  const assessmentMap = new Map();
  const lines = normalized
    .split("\n")
    .map((line) => cleanWhitespace(line))
    .filter((line) => line.includes("%") && line.length < 180);

  for (const line of lines) {
    const labelFirst = /([A-Za-z][A-Za-z0-9&/ ()#.-]{1,60}?)\s*(?:[:.\-–—]|\s)\s*(\d{1,3}(?:\.\d+)?)\s*%/g;
    const percentFirst = /(\d{1,3}(?:\.\d+)?)\s*%\s*(?:for|on|of|[-:])?\s*([A-Za-z][A-Za-z0-9&/ ()#.-]{1,60})/g;

    for (const match of line.matchAll(labelFirst)) {
      collectAssessmentCandidate(assessmentMap, match[1], Number(match[2]), 0.8);
    }

    for (const match of line.matchAll(percentFirst)) {
      collectAssessmentCandidate(assessmentMap, match[2], Number(match[1]), 0.75);
    }
  }

  const compactText = cleanWhitespace(normalized);
  const commonPattern = /([A-Za-z][A-Za-z0-9&/ ()#.-]{1,45}?)\s*(?:[:.\-–—]|\s)\s*(\d{1,3}(?:\.\d+)?)\s*%/g;

  for (const match of compactText.matchAll(commonPattern)) {
    collectAssessmentCandidate(assessmentMap, match[1], Number(match[2]), 0.6);
  }

  return [...assessmentMap.values()].sort((first, second) =>
    first.name.localeCompare(second.name)
  );
}

function pickSourceFile(files) {
  return (
    files.find((file) => /syllabus|outline|course plan/i.test(file.fileName)) ??
    files.find((file) => /grading|grade|score/i.test(file.fileName)) ??
    files.find((file) => parseableExtensions.has(file.extension)) ??
    files[0]
  );
}

function commonDirectory(files) {
  if (files.length === 0) {
    return rootDir;
  }

  const splitPaths = files.map((file) => path.dirname(file.absolutePath).split(path.sep));
  const common = [];

  for (let index = 0; index < splitPaths[0].length; index += 1) {
    const segment = splitPaths[0][index];

    if (splitPaths.every((item) => item[index] === segment)) {
      common.push(segment);
    } else {
      break;
    }
  }

  return common.join(path.sep) || rootDir;
}

function buildDescription(group) {
  const assessmentCount = group.assessments.length;
  const materialCount = group.files.length;
  const assessmentText =
    assessmentCount === 0
      ? "No grading breakdown detected."
      : `${assessmentCount} grading item${assessmentCount === 1 ? "" : "s"} detected.`;

  return `${assessmentText} ${materialCount} source material${
    materialCount === 1 ? "" : "s"
  } linked from the imported folder.`;
}

function confidenceForGroup(group, creditFound) {
  let confidence = 0.35;

  if (group.courseName && group.courseName !== group.courseCode) {
    confidence += 0.15;
  }

  if (group.sourceFile && /syllabus|outline|course plan/i.test(group.sourceFile.fileName)) {
    confidence += 0.15;
  }

  if (creditFound) {
    confidence += 0.1;
  }

  if (group.assessments.length > 0) {
    confidence += 0.25;
  }

  return Number(Math.min(confidence, 0.95).toFixed(2));
}

function buildTemplatePayloads(groups) {
  return [...groups.values()]
    .sort((first, second) => first.courseCode.localeCompare(second.courseCode))
    .map((group) => {
      const allText = group.textSnippets.join("\n").slice(0, 120000);
      const credit = pickCreditHours(allText);
      group.assessments = detectAssessments(allText);
      group.sourceFile = pickSourceFile(group.files);

      return {
        template: {
          course_code: group.courseCode,
          course_name: group.courseName,
          department: group.courseCode.split(" ")[0],
          credit_hours: credit.creditHours,
          description: buildDescription(group),
          source_file_name: group.sourceFile?.fileName ?? null,
          source_folder_path: commonDirectory(group.files),
          extraction_confidence: confidenceForGroup(group, credit.found)
        },
        assessments: group.assessments,
        materials: group.files.map((file) => ({
          file_name: file.fileName,
          file_path: file.absolutePath,
          file_type: file.extension.replace(".", "")
        }))
      };
    });
}

async function createGroups(files) {
  const groups = new Map();
  const warnings = {
    noCourseCode: [],
    unclearGrading: [],
    parseFailures: []
  };

  for (const file of files) {
    const pathText = file.relativePath.replace(/\.[^.]+$/, "").replace(/[\\/_-]+/g, " ");
    let text = "";
    let parseWarning = "";
    let courseCode = uniqueCourseCodes(pathText)[0] ?? "";
    const shouldExtractText =
      file.extension === ".txt" ||
      file.extension === ".md" ||
      likelyTemplateTextPattern.test(file.relativePath) ||
      (!courseCode && file.size <= 5 * 1024 * 1024);

    if (parseableExtensions.has(file.extension) && shouldExtractText) {
      const result = await extractFileText(file.absolutePath, file.extension, file.size);
      text = result.text.slice(0, 50000);
      parseWarning = result.warning;
    }

    if (!courseCode && text) {
      courseCode = uniqueCourseCodes(text)[0] ?? "";
    }

    if (parseWarning) {
      warnings.parseFailures.push(`${file.relativePath}: ${parseWarning}`);
    }

    if (!courseCode) {
      warnings.noCourseCode.push(file.relativePath);
      continue;
    }

    if (!groups.has(courseCode)) {
      groups.set(courseCode, {
        courseCode,
        courseName: pickCourseName(file.relativePath, courseCode, text),
        files: [],
        textSnippets: [],
        assessments: [],
        sourceFile: null
      });
    }

    const group = groups.get(courseCode);
    const courseName = pickCourseName(file.relativePath, courseCode, text);

    if (courseName && courseName !== courseCode && group.courseName === courseCode) {
      group.courseName = courseName;
    }

    group.files.push(file);

    if (text) {
      group.textSnippets.push(text);
    }
  }

  const payloads = buildTemplatePayloads(groups);

  for (const payload of payloads) {
    if (payload.assessments.length === 0) {
      warnings.unclearGrading.push(payload.template.course_code);
    }
  }

  return { payloads, warnings };
}

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing templates."
    );
  }

  return { supabaseUrl, serviceRoleKey };
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

function isMissingFieldValue(field, value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim() === "";
  }

  if (field === "extraction_confidence") {
    return Number(value) <= 0;
  }

  if (field === "credit_hours") {
    return !Number.isFinite(Number(value)) || Number(value) <= 0;
  }

  return false;
}

function buildMissingFieldUpdate(existingTemplate, incomingTemplate) {
  const fields = [
    "department",
    "credit_hours",
    "description",
    "source_file_name",
    "source_folder_path",
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

  return updates;
}

async function insertMissingAssessments(supabase, templateId, assessments) {
  const { data, error } = await supabase
    .from("course_template_assessments")
    .select("name")
    .eq("course_template_id", templateId);

  if (error) {
    throw new Error(`course_template_assessments: ${error.message}`);
  }

  if ((data ?? []).length > 0) {
    return 0;
  }

  const existingNames = new Set(
    (data ?? []).map((assessment) => assessment.name.toLowerCase())
  );
  const missingAssessments = assessments.filter(
    (assessment) => !existingNames.has(assessment.name.toLowerCase())
  );

  return batchInsert(
    supabase,
    "course_template_assessments",
    missingAssessments.map((assessment) => ({
      ...assessment,
      course_template_id: templateId
    }))
  );
}

async function insertMissingMaterials(supabase, templateId, materials) {
  const { data, error } = await supabase
    .from("course_template_materials")
    .select("file_path")
    .eq("course_template_id", templateId);

  if (error) {
    throw new Error(`course_template_materials: ${error.message}`);
  }

  if ((data ?? []).length > 0) {
    return 0;
  }

  const existingPaths = new Set(
    (data ?? []).map((material) => material.file_path.toLowerCase())
  );
  const missingMaterials = materials.filter(
    (material) => !existingPaths.has(material.file_path.toLowerCase())
  );

  return batchInsert(
    supabase,
    "course_template_materials",
    missingMaterials.map((material) => ({
      ...material,
      course_template_id: templateId
    }))
  );
}

async function replaceTemplateChildren(supabase, templateId, payload) {
  const { error: assessmentDeleteError } = await supabase
    .from("course_template_assessments")
    .delete()
    .eq("course_template_id", templateId);

  if (assessmentDeleteError) {
    throw new Error(
      `course_template_assessments: ${assessmentDeleteError.message}`
    );
  }

  const { error: materialDeleteError } = await supabase
    .from("course_template_materials")
    .delete()
    .eq("course_template_id", templateId);

  if (materialDeleteError) {
    throw new Error(`course_template_materials: ${materialDeleteError.message}`);
  }

  const assessmentsInserted = await batchInsert(
    supabase,
    "course_template_assessments",
    payload.assessments.map((assessment) => ({
      ...assessment,
      course_template_id: templateId
    }))
  );
  const materialsInserted = await batchInsert(
    supabase,
    "course_template_materials",
    payload.materials.map((material) => ({
      ...material,
      course_template_id: templateId
    }))
  );

  return { assessmentsInserted, materialsInserted };
}

async function saveTemplates(payloads) {
  const { createClient } = await import("@supabase/supabase-js");
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  let created = 0;
  let existingMatched = 0;
  let missingFieldUpdates = 0;
  let forceReplaced = 0;
  let assessmentsAdded = 0;
  let materialsAdded = 0;

  for (const payload of payloads) {
    const { data: existing, error: existingError } = await supabase
      .from("course_templates")
      .select("*")
      .eq("course_code", payload.template.course_code)
      .eq("course_name", payload.template.course_name)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing) {
      existingMatched += 1;

      if (isForce) {
        const { error: updateError } = await supabase
          .from("course_templates")
          .update(payload.template)
          .eq("id", existing.id);

        if (updateError) {
          throw new Error(`course_templates: ${updateError.message}`);
        }

        const replaceResult = await replaceTemplateChildren(
          supabase,
          existing.id,
          payload
        );
        forceReplaced += 1;
        assessmentsAdded += replaceResult.assessmentsInserted;
        materialsAdded += replaceResult.materialsInserted;
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

        missingFieldUpdates += 1;
      }

      assessmentsAdded += await insertMissingAssessments(
        supabase,
        existing.id,
        payload.assessments
      );
      materialsAdded += await insertMissingMaterials(
        supabase,
        existing.id,
        payload.materials
      );
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

    created += 1;
    assessmentsAdded += await batchInsert(
      supabase,
      "course_template_assessments",
      payload.assessments.map((assessment) => ({
        ...assessment,
        course_template_id: template.id
      }))
    );
    materialsAdded += await batchInsert(
      supabase,
      "course_template_materials",
      payload.materials.map((material) => ({
        ...material,
        course_template_id: template.id
      }))
    );
  }

  return {
    created,
    existingMatched,
    missingFieldUpdates,
    forceReplaced,
    assessmentsAdded,
    materialsAdded
  };
}

function printWarnings(warnings) {
  const warningEntries = [
    ["No course code found", warnings.noCourseCode],
    ["Grading breakdown unclear", warnings.unclearGrading],
    ["File could not be parsed", warnings.parseFailures]
  ];

  for (const [label, values] of warningEntries) {
    if (values.length === 0) {
      continue;
    }

    console.warn(`\n${label}: ${values.length}`);

    for (const value of values.slice(0, 20)) {
      console.warn(`- ${value}`);
    }

    if (values.length > 20) {
      console.warn(`- ...and ${values.length - 20} more`);
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
  console.log(`Found ${files.length} supported course material file(s).`);

  const { payloads, warnings } = await createGroups(files);
  console.log(`Detected ${payloads.length} course template(s).`);

  for (const payload of payloads) {
    console.log(
      `- ${payload.template.course_code}: ${payload.template.course_name} (${payload.assessments.length} assessments, ${payload.materials.length} materials, confidence ${payload.template.extraction_confidence})`
    );
  }

  printWarnings(warnings);

  if (isDryRun) {
    console.log("\nDry run complete. No Supabase rows were changed.");
    console.log("Run without --dry-run to upload templates. Add --force to overwrite matching templates.");
    return;
  }

  const result = await saveTemplates(payloads);
  console.log(
    `\nCreated ${result.created} template(s). Matched ${result.existingMatched} existing template(s).`
  );
  console.log(
    `Updated missing fields on ${result.missingFieldUpdates} existing template(s). Force-replaced ${result.forceReplaced} template(s).`
  );
  console.log(
    `Added ${result.assessmentsAdded} assessment row(s) and ${result.materialsAdded} material row(s).`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
