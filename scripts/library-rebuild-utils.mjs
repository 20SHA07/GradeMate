import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  buildDatasetProposal,
  createSlug,
  expectedJsonDir,
  extractDocumentText,
  htmlEscape,
  loadSyllabusParser,
  normalizeAssessmentName,
  readJsonFiles
} from "./dataset-utils.mjs";

export { htmlEscape };

export const extractorVersion = "deterministic-ku-2026-05-19";
export const rebuildRootDir = path.resolve("training-data", "course-library-rebuild");
export const rebuildTemplatesDir = path.join(rebuildRootDir, "templates");
export const rebuildReviewJsonPath = path.join(rebuildRootDir, "review-report.json");
export const rebuildReviewHtmlPath = path.join(rebuildRootDir, "review-report.html");
export const rebuildReviewCsvPath = path.join(rebuildRootDir, "review-report.csv");
export const diffJsonPath = path.join(rebuildRootDir, "diff-report.json");
export const diffHtmlPath = path.join(rebuildRootDir, "diff-report.html");
export const importPlanJsonPath = path.join(rebuildRootDir, "supabase-import-plan.json");
export const importPlanHtmlPath = path.join(rebuildRootDir, "supabase-import-plan.html");
export const productionVerifyJsonPath = path.join(rebuildRootDir, "production-verify-report.json");
export const productionVerifyHtmlPath = path.join(rebuildRootDir, "production-verify-report.html");
export const backupDir = path.resolve("training-data", "course-library-backups");
export const defaultLibrarySourceDir = path.resolve(
  "training-data",
  "collected-syllabi",
  "files"
);

const supportedExtensions = new Set([".pdf", ".docx", ".doc"]);
const criticalWarningPattern =
  /no assessments|total weight|ambiguous|possible grading scale|possible weekly schedule|not syllabus|related material|project handout|missing course code|missing course name/i;

export async function ensureRebuildDirs() {
  await Promise.all([
    fs.mkdir(rebuildRootDir, { recursive: true }),
    fs.mkdir(rebuildTemplatesDir, { recursive: true }),
    fs.mkdir(backupDir, { recursive: true })
  ]);
}

export async function cleanTemplatesDir() {
  await fs.rm(rebuildTemplatesDir, { recursive: true, force: true });
  await fs.mkdir(rebuildTemplatesDir, { recursive: true });
}

export async function walkSupportedSyllabusFiles(sourceDir) {
  const absoluteSourceDir = path.resolve(sourceDir);

  if (!fsSync.existsSync(absoluteSourceDir)) {
    throw new Error(`Syllabus source folder does not exist: ${absoluteSourceDir}`);
  }

  const files = await walkFiles(absoluteSourceDir);

  return files
    .filter((filePath) => supportedExtensions.has(path.extname(filePath).toLowerCase()))
    .sort((first, second) => first.localeCompare(second))
    .map((filePath) => ({
      absolutePath: filePath,
      relativePath: path.relative(absoluteSourceDir, filePath),
      sourceDir: absoluteSourceDir,
      fileName: path.basename(filePath),
      extension: path.extname(filePath).toLowerCase()
    }));
}

export async function buildLibraryTemplates(sourceDir = defaultLibrarySourceDir) {
  const parser = loadSyllabusParser();
  const extractedAt = new Date().toISOString();
  const files = await walkSupportedSyllabusFiles(sourceDir);
  const expectedFiles = await readJsonFiles(expectedJsonDir);
  const expectedByName = new Map(expectedFiles.map((file) => [file.fileName, file.value]));
  const templates = [];
  const parseErrors = [];

  for (const file of files) {
    const slug = createSlug(file.fileName);
    const sourceHash = await hashFile(file.absolutePath);
    let extractedText = "";
    let parseWarning = "";

    try {
      if (file.extension === ".doc") {
        extractedText = await extractLegacyDocText(file.absolutePath);
        parseWarning =
          "Legacy .doc text extraction is best-effort; verify this template manually.";
      } else {
        const extraction = await extractDocumentText(file.absolutePath);
        extractedText = extraction.text;
      }
    } catch (error) {
      parseWarning = error instanceof Error ? error.message : String(error);
      parseErrors.push({
        sourceFileName: file.fileName,
        sourcePath: file.relativePath,
        error: parseWarning
      });
    }

    const sourceType = classifySource(file, extractedText);
    const record = {
      id: slug,
      sourceFileName: file.fileName,
      sourcePath: file.relativePath,
      relativePath: file.relativePath,
      textFileName: `${slug}.txt`
    };
    const ruleResult = extractedText
      ? parser.extractSyllabusFromText(extractedText)
      : emptyRuleResult();
    const proposal = buildDatasetProposal(extractedText, ruleResult, record);
    const expectedFileName = `${slug}.json`;
    const regression = expectedByName.has(expectedFileName)
      ? compareExpectedToTemplate(expectedByName.get(expectedFileName), proposal)
      : null;

    const template = buildTemplateFromProposal({
      extractedAt,
      file,
      parseWarning,
      proposal,
      regression,
      sourceHash,
      sourceType
    });

    templates.push(template);
  }

  applyDuplicateDecisions(templates);

  return {
    generatedAt: extractedAt,
    sourceDir: displayPath(sourceDir),
    extractorVersion,
    filesScanned: files.length,
    templates,
    parseErrors,
    regressions: templates.filter((template) => template.regression?.passed === false)
  };
}

export async function writeLibraryTemplates(rebuild) {
  await ensureRebuildDirs();
  await cleanTemplatesDir();

  for (const template of rebuild.templates) {
    await fs.writeFile(
      path.join(rebuildTemplatesDir, `${template.id}.json`),
      `${JSON.stringify(template, null, 2)}\n`,
      "utf8"
    );
  }

  await fs.writeFile(
    path.join(rebuildRootDir, "rebuild-index.json"),
    `${JSON.stringify(
      {
        generatedAt: rebuild.generatedAt,
        sourceDir: rebuild.sourceDir,
        extractorVersion: rebuild.extractorVersion,
        filesScanned: rebuild.filesScanned,
        templatesGenerated: rebuild.templates.length,
        ready: rebuild.templates.filter((template) => template.ready).length,
        canonicalReady: getCanonicalReadyTemplates(rebuild.templates).length,
        needsReview: rebuild.templates.filter((template) => template.needsReview).length,
        regressions: rebuild.regressions.length,
        parseErrors: rebuild.parseErrors
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

export async function readRebuiltTemplates() {
  if (!fsSync.existsSync(rebuildTemplatesDir)) {
    return [];
  }

  const entries = await fs.readdir(rebuildTemplatesDir, { withFileTypes: true });
  const templates = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(rebuildTemplatesDir, entry.name);
    templates.push(JSON.parse(await fs.readFile(filePath, "utf8")));
  }

  return templates.sort((first, second) =>
    `${first.courseCode ?? ""} ${first.courseName ?? ""} ${first.sourceFileName}`.localeCompare(
      `${second.courseCode ?? ""} ${second.courseName ?? ""} ${second.sourceFileName}`
    )
  );
}

export function getCanonicalReadyTemplates(templates) {
  return templates.filter(
    (template) =>
      template.ready &&
      template.canonical &&
      !template.needsReview &&
      template.sourceType === "syllabus"
  );
}

export function buildReviewModel(templates, extra = {}) {
  const canonicalReady = getCanonicalReadyTemplates(templates);
  const duplicateGroups = buildDuplicateSummary(templates);
  const summary = {
    generatedAt: new Date().toISOString(),
    extractorVersion,
    totalTemplates: templates.length,
    ready: templates.filter((template) => template.ready).length,
    canonicalReady: canonicalReady.length,
    needsReview: templates.filter((template) => template.needsReview).length,
    conflicts: templates.filter((template) => template.duplicateStatus === "conflict").length,
    duplicates: templates.filter((template) => template.duplicateStatus === "duplicate").length,
    regressions: templates.filter((template) => template.regression?.passed === false).length,
    noAssessments: templates.filter((template) => template.assessments.length === 0).length,
    totalWeightReady: templates.filter((template) => isTotalReady(template.totalWeight)).length,
    duplicateGroups: duplicateGroups.length,
    ...extra
  };

  return {
    summary,
    duplicateGroups,
    templates: templates.map((template) => ({
      id: template.id,
      sourceFileName: template.sourceFileName,
      courseCode: template.courseCode,
      courseName: template.courseName,
      semester: template.semester,
      instructor: template.instructor,
      assessmentCount: template.assessments.length,
      totalWeight: template.totalWeight,
      confidence: template.confidence,
      ready: template.ready,
      needsReview: template.needsReview,
      canonical: template.canonical,
      duplicateGroupKey: template.duplicateGroupKey,
      duplicateStatus: template.duplicateStatus,
      reasons: template.reasons,
      warnings: template.warnings,
      regression: template.regression,
      assessments: template.assessments
    }))
  };
}

export async function writeReviewReports(model) {
  await ensureRebuildDirs();
  await fs.writeFile(rebuildReviewJsonPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
  await fs.writeFile(rebuildReviewCsvPath, toReviewCsv(model.templates), "utf8");
  await fs.writeFile(rebuildReviewHtmlPath, buildReviewHtml(model), "utf8");
}

export async function loadLatestBackup() {
  if (!fsSync.existsSync(backupDir)) {
    return null;
  }

  const entries = await fs.readdir(backupDir);
  const templateFiles = entries
    .filter((entry) => /^course_templates_.*\.json$/i.test(entry))
    .sort()
    .reverse();

  for (const templateFile of templateFiles) {
    const timestamp = templateFile
      .replace(/^course_templates_/i, "")
      .replace(/\.json$/i, "");
    const assessmentsFile = `course_template_assessments_${timestamp}.json`;
    const templatePath = path.join(backupDir, templateFile);
    const assessmentsPath = path.join(backupDir, assessmentsFile);

    if (!fsSync.existsSync(assessmentsPath)) {
      continue;
    }

    return {
      timestamp,
      templates: JSON.parse(await fs.readFile(templatePath, "utf8")),
      assessments: JSON.parse(await fs.readFile(assessmentsPath, "utf8")),
      templatePath,
      assessmentsPath
    };
  }

  return null;
}

export function buildDiffModel(newTemplates, backup) {
  const canonicalReady = getCanonicalReadyTemplates(newTemplates);
  const oldTemplates = backup?.templates ?? [];
  const oldAssessments = backup?.assessments ?? [];
  const oldByTemplateId = groupBy(oldAssessments, (assessment) => assessment.course_template_id);
  const oldRecords = oldTemplates.map((template) => ({
    ...template,
    assessments: oldByTemplateId.get(template.id) ?? []
  }));
  const oldByKey = new Map(oldRecords.map((template) => [templateKeyFromDb(template), template]));
  const oldByLooseKey = new Map(
    oldRecords.map((template) => [looseTemplateKey(template.course_code, template.course_name), template])
  );
  const matchedOldIds = new Set();
  const changes = [];

  for (const template of canonicalReady) {
    const key = templateKeyFromRebuild(template);
    const looseKey = looseTemplateKey(template.courseCode, template.courseName);
    const oldTemplate = oldByKey.get(key) ?? oldByLooseKey.get(looseKey) ?? null;

    if (!oldTemplate) {
      changes.push({
        type: "new",
        key,
        courseCode: template.courseCode,
        courseName: template.courseName,
        semester: template.semester,
        newTemplate: template
      });
      continue;
    }

    matchedOldIds.add(oldTemplate.id);
    const oldSignature = assessmentSignatureFromDb(oldTemplate.assessments);
    const newSignature = assessmentSignature(template.assessments);
    const courseInfoChanged =
      normalizeScalar(oldTemplate.credit_hours) !== normalizeScalar(template.creditHours) ||
      normalizeScalar(oldTemplate.instructor) !== normalizeScalar(template.instructor) ||
      normalizeScalar(oldTemplate.term ?? oldTemplate.semester) !==
        normalizeScalar(template.semester);

    if (oldSignature !== newSignature || courseInfoChanged) {
      changes.push({
        type: "changed",
        key,
        courseCode: template.courseCode,
        courseName: template.courseName,
        semester: template.semester,
        oldTotal: sumDbAssessments(oldTemplate.assessments),
        newTotal: template.totalWeight,
        oldAssessmentCount: oldTemplate.assessments.length,
        newAssessmentCount: template.assessments.length,
        oldAssessments: oldTemplate.assessments,
        newAssessments: template.assessments,
        courseInfoChanged
      });
    } else {
      changes.push({
        type: "unchanged",
        key,
        courseCode: template.courseCode,
        courseName: template.courseName,
        semester: template.semester
      });
    }
  }

  for (const oldTemplate of oldRecords) {
    if (matchedOldIds.has(oldTemplate.id)) {
      continue;
    }

    changes.push({
      type: "removed-or-ignored",
      key: templateKeyFromDb(oldTemplate),
      courseCode: oldTemplate.course_code,
      courseName: oldTemplate.course_name,
      semester: oldTemplate.semester ?? oldTemplate.term ?? null,
      oldTemplate
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    backup: backup
      ? {
          timestamp: backup.timestamp,
          templatePath: path.relative(process.cwd(), backup.templatePath),
          assessmentsPath: path.relative(process.cwd(), backup.assessmentsPath)
        }
      : null,
    summary: {
      oldTemplates: oldRecords.length,
      newCanonicalReadyTemplates: canonicalReady.length,
      newCourses: changes.filter((change) => change.type === "new").length,
      changed: changes.filter((change) => change.type === "changed").length,
      unchanged: changes.filter((change) => change.type === "unchanged").length,
      removedOrIgnored: changes.filter((change) => change.type === "removed-or-ignored").length
    },
    changes
  };
}

export async function writeDiffReports(model) {
  await ensureRebuildDirs();
  await fs.writeFile(diffJsonPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
  await fs.writeFile(diffHtmlPath, buildDiffHtml(model), "utf8");
}

export function loadEnvFile() {
  for (const envPath of [".env.local", ".env"]) {
    if (!fsSync.existsSync(envPath)) {
      continue;
    }

    const lines = fsSync.readFileSync(envPath, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [rawKey, ...valueParts] = trimmed.split("=");
      const key = rawKey.trim();
      const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

export function getSupabaseServiceConfig({ requireServiceRole = true } = {}) {
  loadEnvFile();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || (requireServiceRole && !serviceRoleKey)) {
    const missing = [
      !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      requireServiceRole && !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null
    ].filter(Boolean);
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}`);
  }

  return { serviceRoleKey, supabaseUrl };
}

export async function fetchAllRows(supabase, table, select = "*") {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }

    rows.push(...(data ?? []));

    if (!data || data.length < pageSize) {
      break;
    }
  }

  return rows;
}

export function computeCourseTemplateUniqueKey(template) {
  return buildCourseTemplateUniqueKey({
    courseCode: template.courseCode,
    courseName: template.courseName,
    semester: template.semester,
    sourceHash: template.sourceHash,
    sourceFileName: template.sourceFileName,
    id: template.id
  });
}

export function computeCourseTemplateUniqueKeyFromDb(template) {
  return (
    template.unique_key ??
    buildCourseTemplateUniqueKey({
      courseCode: template.course_code,
      courseName: template.course_name,
      semester: template.semester ?? template.term,
      sourceHash: template.source_hash,
      sourceFileName:
        template.source_file_name ??
        template.source_syllabus_file_name ??
        template.source_syllabus_path,
      id: template.id
    })
  );
}

export function buildCourseTemplateUniqueKey({
  courseCode,
  courseName,
  id,
  semester,
  sourceFileName,
  sourceHash
}) {
  const code = normalizeUniqueKeyPart(courseCode) || "unknown-code";
  const name = normalizeUniqueKeyPart(courseName) || "unknown-course";
  const term = normalizeUniqueKeyPart(semester);

  if (term) {
    return `${code}::${name}::${term}`;
  }

  const sourceSuffix =
    normalizeUniqueKeyPart(sourceHash)?.slice(0, 12) ||
    normalizeUniqueKeyPart(sourceFileName)?.slice(0, 48) ||
    normalizeUniqueKeyPart(id)?.slice(0, 12) ||
    "unknown-source";

  return `${code}::${name}::unknown::${sourceSuffix}`;
}

export function normalizeUniqueKeyPart(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

export function buildSupabasePayload(template) {
  const uniqueKey = computeCourseTemplateUniqueKey(template);

  return {
    template: {
      unique_key: uniqueKey,
      course_code: template.courseCode,
      course_name: template.courseName,
      department: template.department,
      credit_hours: template.creditHours ?? 3,
      instructor: template.instructor,
      term: template.semester,
      description: template.courseDescription,
      source_file_name: template.sourceFileName,
      source_folder_path: template.sourceRelativePath,
      source_syllabus_file_name: template.sourceFileName,
      source_syllabus_path: template.sourceRelativePath,
      extraction_confidence: template.confidence,
      source_hash: template.sourceHash,
      extractor_version: template.extractorVersion,
      extraction_warnings: template.warnings,
      template_status: template.ready ? "ready" : "needs_review",
      semester: template.semester,
      instructor_email: template.instructorEmail,
      schedule: template.schedule,
      classroom: template.classroom,
      office_hours: template.officeHours,
      prerequisites: template.prerequisites,
      textbooks: template.textbooks ?? [],
      course_description: template.courseDescription,
      updated_at: new Date().toISOString()
    },
    assessments: template.assessments.map((assessment) => ({
      name: assessment.name,
      weight_percentage: assessment.weightPercentage,
      max_score: assessment.maxScore ?? 100,
      confidence: assessment.confidence,
      source_text_snippet: assessment.source,
      source: assessment.source,
      inferred: assessment.inferred,
      warning: assessment.warning
    })),
    material: {
      file_name: template.sourceFileName,
      file_path: template.sourceRelativePath,
      file_type: path.extname(template.sourceFileName).replace(".", ""),
      material_type: "syllabus"
    }
  };
}

export function stripOptionalTemplateColumns(payload) {
  const allowed = new Set([
    "unique_key",
    "course_code",
    "course_name",
    "department",
    "credit_hours",
    "instructor",
    "term",
    "description",
    "source_file_name",
    "source_folder_path",
    "source_syllabus_file_name",
    "source_syllabus_path",
    "extraction_confidence",
    "updated_at"
  ]);

  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.has(key)));
}

export function stripOptionalAssessmentColumns(payload) {
  const allowed = new Set([
    "course_template_id",
    "name",
    "weight_percentage",
    "max_score",
    "confidence",
    "source_text_snippet"
  ]);

  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.has(key)));
}

export function toSafeFileTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function buildTemplateFromProposal({
  extractedAt,
  file,
  parseWarning,
  proposal,
  regression,
  sourceHash,
  sourceType
}) {
  const assessments = (proposal.assessments ?? []).map((assessment) => {
    const source = assessment.source_text_snippet ?? "";
    const warning = assessment.warning ?? inferAssessmentWarning(assessment, proposal.warnings);

    return {
      name: assessment.name,
      weightPercentage: Number(assessment.weight_percentage ?? 0),
      maxScore: Number(assessment.max_score ?? 100),
      source,
      confidence: Number(assessment.confidence ?? proposal.confidence ?? 0),
      inferred: Boolean(assessment.inferred) || /split|shared|evenly|inferred|group/i.test(`${source} ${warning ?? ""}`),
      warning
    };
  });
  const totalWeight = Number(
    assessments
      .reduce((sum, assessment) => sum + Number(assessment.weightPercentage ?? 0), 0)
      .toFixed(2)
  );
  const warnings = [
    ...(proposal.warnings ?? []),
    ...(parseWarning ? [parseWarning] : []),
    ...(sourceType !== "syllabus" ? [`Source marked ${sourceType}`] : []),
    ...(regression?.passed === false ? [`Regression against expected JSON: ${regression.summary}`] : [])
  ];
  const reasons = buildTemplateReasons({
    assessments,
    confidence: proposal.confidence,
    courseCode: proposal.courseCode,
    courseName: proposal.courseName,
    sourceType,
    totalWeight,
    warnings
  });
  const needsReview = reasons.length > 0;
  const ready = !needsReview;

  return {
    id: createSlug(file.fileName),
    uniqueKey: buildCourseTemplateUniqueKey({
      courseCode: proposal.courseCode,
      courseName: proposal.courseName,
      semester: proposal.semester,
      sourceHash,
      sourceFileName: file.fileName,
      id: createSlug(file.fileName)
    }),
    sourceFileName: file.fileName,
    sourcePath: file.relativePath,
    sourceRelativePath: file.relativePath,
    sourceHash,
    sourceType,
    extractorVersion,
    extractedAt,
    courseCode: proposal.courseCode,
    courseName: proposal.courseName,
    department: proposal.courseCode?.split(/\s+/)[0] ?? null,
    creditHours: proposal.creditHours,
    semester: proposal.semester,
    instructor: proposal.instructor,
    instructorEmail: proposal.instructorEmail,
    schedule: proposal.schedule,
    classroom: proposal.classroom,
    officeRoom: proposal.officeRoom,
    officeHours: proposal.officeHours,
    prerequisites: proposal.prerequisites,
    textbooks: proposal.textbooks ?? [],
    courseDescription: proposal.courseDescription,
    assessments,
    totalWeight,
    confidence: proposal.confidence,
    warnings,
    reasons,
    ready,
    needsReview,
    duplicateGroupKey: duplicateGroupKey({
      courseCode: proposal.courseCode,
      courseName: proposal.courseName,
      semester: proposal.semester
    }),
    duplicateStatus: "unique",
    canonical: ready,
    canonicalReason: ready ? "unique ready template" : "needs review",
    regression
  };
}

function buildTemplateReasons({
  assessments,
  confidence,
  courseCode,
  courseName,
  sourceType,
  totalWeight,
  warnings
}) {
  const reasons = [];

  if (!courseCode) reasons.push("missing course code");
  if (!courseName) reasons.push("missing course name");
  if (assessments.length === 0) reasons.push("no assessments");
  if (!isTotalReady(totalWeight)) reasons.push(`total weight ${formatNumber(totalWeight)} is not 100`);
  if (Number(confidence ?? 0) < 0.7) reasons.push("low confidence");
  if (sourceType !== "syllabus") reasons.push(sourceType);

  for (const warning of warnings) {
    if (criticalWarningPattern.test(warning)) {
      reasons.push(warning);
    }
  }

  return Array.from(new Set(reasons));
}

function applyDuplicateDecisions(templates) {
  const groups = groupBy(
    templates.filter((template) => template.duplicateGroupKey !== "unknown"),
    (template) => template.duplicateGroupKey
  );

  for (const group of groups.values()) {
    if (group.length === 1) {
      continue;
    }

    const signatures = new Set(group.map((template) => assessmentSignature(template.assessments)));
    const hasConflict = signatures.size > 1;
    const sorted = [...group].sort((first, second) => templateScore(second) - templateScore(first));
    const canonical = sorted[0];

    if (!hasConflict) {
      group.forEach((template) => {
        template.duplicateStatus = "duplicate";
        template.canonical = template === canonical && template.ready;
        template.canonicalReason =
          template === canonical
            ? "highest-confidence duplicate"
            : `duplicate of ${canonical.sourceFileName}`;
      });
      continue;
    }

    const preferred = pickPreferredConflictCanonical(sorted);

    group.forEach((template) => {
      template.duplicateStatus = "conflict";

      if (template === preferred) {
        template.canonical = template.ready;
        template.canonicalReason =
          "selected as best mathematically valid duplicate conflict";
        template.warnings = Array.from(
          new Set([
            ...template.warnings,
            "Duplicate conflict resolved by selecting the best valid detailed template."
          ])
        );
        return;
      }

      template.canonical = false;
      template.ready = false;
      template.needsReview = true;
      template.reasons = Array.from(
        new Set([...template.reasons, "duplicate conflict with different assessment rows"])
      );
      template.canonicalReason = preferred
        ? `conflicts with canonical ${preferred.sourceFileName}`
        : "duplicate conflict requires review";
    });
  }
}

function pickPreferredConflictCanonical(sorted) {
  const ready = sorted.filter((template) => template.ready && isTotalReady(template.totalWeight));

  if (ready.length === 0) {
    return null;
  }

  const [first, second] = ready;

  if (!second) {
    return first;
  }

  if (first.assessments.length > second.assessments.length) {
    return first;
  }

  if (first.confidence >= 0.85 && first.confidence - second.confidence >= 0.02) {
    return first;
  }

  return null;
}

function templateScore(template) {
  return (
    (template.ready ? 1000 : 0) +
    Number(template.confidence ?? 0) * 100 +
    template.assessments.length * 4 +
    (isTotalReady(template.totalWeight) ? 100 : 0) +
    (/supplement|methodology/i.test(template.sourceFileName) ? 8 : 0)
  );
}

function classifySource(file, text) {
  const context = `${file.fileName}\n${text.slice(0, 3000)}`;

  if (
    /project[\s._-]*phase|coursework\s+assessment\s+project\s+phase/i.test(context) &&
    !/course\s+code\s+and\s+title|assessment\s+methodology|course\s+catalog\s+description/i.test(
      context
    )
  ) {
    return "related_material";
  }

  if (/project[\s._-]*phase/i.test(file.fileName)) {
    return "not_syllabus_project_handout";
  }

  return "syllabus";
}

function inferAssessmentWarning(assessment, warnings = []) {
  const source = `${assessment.name ?? ""} ${assessment.source_text_snippet ?? ""}`;
  const splitWarning = warnings.find((warning) => /split/i.test(warning));

  if (/split|shared|evenly/i.test(source) && splitWarning) {
    return splitWarning;
  }

  return null;
}

function compareExpectedToTemplate(expected, proposal) {
  const issues = [];
  const expectedAssessments = expected.assessments ?? [];
  const actualAssessments = proposal.assessments ?? [];

  if (expected.courseCode && normalizeScalar(expected.courseCode) !== normalizeScalar(proposal.courseCode)) {
    issues.push(`course code expected ${expected.courseCode} got ${proposal.courseCode ?? ""}`);
  }

  if (expected.courseName && normalizeScalar(expected.courseName) !== normalizeScalar(proposal.courseName)) {
    issues.push(`course name expected ${expected.courseName} got ${proposal.courseName ?? ""}`);
  }

  if (expectedAssessments.length !== actualAssessments.length) {
    issues.push(`assessment count expected ${expectedAssessments.length} got ${actualAssessments.length}`);
  }

  const actualByName = new Map(
    actualAssessments.map((assessment) => [normalizeAssessmentName(assessment.name), assessment])
  );

  for (const expectedAssessment of expectedAssessments) {
    const actual = actualByName.get(normalizeAssessmentName(expectedAssessment.name));

    if (!actual) {
      issues.push(`missing assessment ${expectedAssessment.name}`);
      continue;
    }

    if (
      Math.abs(
        Number(expectedAssessment.weight_percentage) - Number(actual.weight_percentage)
      ) > 1
    ) {
      issues.push(
        `${expectedAssessment.name} expected ${expectedAssessment.weight_percentage} got ${actual.weight_percentage}`
      );
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    summary: issues.slice(0, 3).join("; ")
  };
}

function emptyRuleResult() {
  return {
    courseCode: null,
    courseName: null,
    creditHours: null,
    instructor: null,
    instructorEmail: null,
    semester: null,
    schedule: null,
    classroom: null,
    officeHours: null,
    prerequisites: null,
    textbooks: [],
    courseDescription: null,
    assessments: [],
    warnings: ["No extracted text available"],
    confidence: 0,
    fieldConfidence: {}
  };
}

async function extractLegacyDocText(filePath) {
  const buffer = await fs.readFile(filePath);
  const text = buffer
    .toString("latin1")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

async function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  const buffer = await fs.readFile(filePath);
  hash.update(buffer);
  return hash.digest("hex");
}

async function walkFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function buildDuplicateSummary(templates) {
  return Array.from(groupBy(templates, (template) => template.duplicateGroupKey).entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      count: group.length,
      status: group.some((template) => template.duplicateStatus === "conflict")
        ? "conflict"
        : "duplicate",
      canonical: group.find((template) => template.canonical)?.sourceFileName ?? null,
      files: group.map((template) => ({
        sourceFileName: template.sourceFileName,
        totalWeight: template.totalWeight,
        assessmentCount: template.assessments.length,
        ready: template.ready,
        canonical: template.canonical
      }))
    }))
    .sort((first, second) => second.count - first.count || first.key.localeCompare(second.key));
}

function groupBy(values, keyFn) {
  const groups = new Map();

  values.forEach((value) => {
    const key = keyFn(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  });

  return groups;
}

function duplicateGroupKey({ courseCode, courseName, semester }) {
  const code = normalizeScalar(courseCode);
  const name = normalizeScalar(courseName);
  const term = normalizeScalar(semester);

  if (!code || !name) {
    return "unknown";
  }

  return `${code}|${name}|${term || "unknown-term"}`;
}

function templateKeyFromRebuild(template) {
  return duplicateGroupKey({
    courseCode: template.courseCode,
    courseName: template.courseName,
    semester: template.semester
  });
}

function templateKeyFromDb(template) {
  return duplicateGroupKey({
    courseCode: template.course_code,
    courseName: template.course_name,
    semester: template.semester ?? template.term
  });
}

function looseTemplateKey(courseCode, courseName) {
  return `${normalizeScalar(courseCode)}|${normalizeScalar(courseName)}`;
}

function assessmentSignature(assessments) {
  return assessments
    .map(
      (assessment) =>
        `${normalizeAssessmentName(assessment.name)}:${Number(assessment.weightPercentage ?? 0)}`
    )
    .sort()
    .join("|");
}

function assessmentSignatureFromDb(assessments) {
  return assessments
    .map(
      (assessment) =>
        `${normalizeAssessmentName(assessment.name)}:${Number(assessment.weight_percentage ?? 0)}`
    )
    .sort()
    .join("|");
}

function isTotalReady(totalWeight) {
  return Number(totalWeight) >= 99.5 && Number(totalWeight) <= 100.5;
}

function sumDbAssessments(assessments) {
  return Number(
    assessments
      .reduce((sum, assessment) => sum + Number(assessment.weight_percentage ?? 0), 0)
      .toFixed(2)
  );
}

function normalizeScalar(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatNumber(value) {
  return Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(2);
}

function displayPath(value) {
  const absolute = path.resolve(value);
  const relative = path.relative(process.cwd(), absolute);

  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? relative
    : absolute;
}

function toReviewCsv(templates) {
  const header = [
    "sourceFileName",
    "courseCode",
    "courseName",
    "semester",
    "assessmentCount",
    "totalWeight",
    "confidence",
    "ready",
    "needsReview",
    "canonical",
    "duplicateGroupKey",
    "duplicateStatus",
    "reasons"
  ];
  const rows = templates.map((template) =>
    [
      template.sourceFileName,
      template.courseCode,
      template.courseName,
      template.semester,
      template.assessmentCount,
      template.totalWeight,
      template.confidence,
      template.ready,
      template.needsReview,
      template.canonical,
      template.duplicateGroupKey,
      template.duplicateStatus,
      (template.reasons ?? []).join("; ")
    ].map(csvEscape)
  );

  return [header, ...rows].map((row) => row.join(",")).join("\n") + "\n";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildReviewHtml(model) {
  const rows = model.templates
    .map(
      (template) => `<tr>
        <td>${htmlEscape(template.sourceFileName)}</td>
        <td>${htmlEscape(template.courseCode)}</td>
        <td>${htmlEscape(template.courseName)}</td>
        <td>${htmlEscape(template.semester)}</td>
        <td>${template.assessmentCount}</td>
        <td>${template.totalWeight}</td>
        <td>${template.confidence}</td>
        <td>${template.ready ? "Ready" : "Needs review"}</td>
        <td>${template.canonical ? "Yes" : "No"}</td>
        <td>${htmlEscape(template.duplicateStatus)}</td>
        <td>${htmlEscape((template.reasons ?? []).join("; "))}</td>
      </tr>`
    )
    .join("\n");
  const details = model.templates
    .map(
      (template) => `<details>
        <summary>${htmlEscape(template.courseCode)} ${htmlEscape(template.courseName)} - ${htmlEscape(template.sourceFileName)}</summary>
        <p><strong>Warnings:</strong> ${htmlEscape((template.warnings ?? []).join("; ") || "None")}</p>
        <p><strong>Duplicate group:</strong> ${htmlEscape(template.duplicateGroupKey)}</p>
        <table>
          <thead><tr><th>Assessment</th><th>Weight</th><th>Confidence</th><th>Warning</th></tr></thead>
          <tbody>${(template.assessments ?? [])
            .map(
              (assessment) => `<tr><td>${htmlEscape(assessment.name)}</td><td>${assessment.weightPercentage}</td><td>${assessment.confidence}</td><td>${htmlEscape(assessment.warning)}</td></tr>`
            )
            .join("")}</tbody>
        </table>
      </details>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>GradeMate Course Library Rebuild Review</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 24px; background: #08111f; color: #e5eefc; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 18px 0; }
    .card, details { background: #101d2f; border: 1px solid #213653; border-radius: 10px; padding: 14px; }
    .value { font-size: 28px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border-bottom: 1px solid #213653; padding: 8px; text-align: left; vertical-align: top; }
    th { color: #7dd3fc; }
    details { margin: 10px 0; }
    summary { cursor: pointer; font-weight: 700; }
  </style>
</head>
<body>
  <h1>GradeMate Course Library Rebuild Review</h1>
  <p>Generated ${htmlEscape(model.summary.generatedAt)} with ${htmlEscape(model.summary.extractorVersion)}.</p>
  <section class="cards">
    ${Object.entries(model.summary)
      .filter(([, value]) => typeof value === "number")
      .map(([key, value]) => `<div class="card"><div>${htmlEscape(key)}</div><div class="value">${value}</div></div>`)
      .join("")}
  </section>
  <h2>Compact Review Table</h2>
  <table>
    <thead><tr><th>Source</th><th>Code</th><th>Name</th><th>Semester</th><th>Rows</th><th>Total</th><th>Confidence</th><th>Status</th><th>Canonical</th><th>Duplicate</th><th>Reason</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <h2>Template Details</h2>
  ${details}
</body>
</html>
`;
}

function buildDiffHtml(model) {
  const rows = model.changes
    .map(
      (change) => `<tr>
        <td>${htmlEscape(change.type)}</td>
        <td>${htmlEscape(change.courseCode)}</td>
        <td>${htmlEscape(change.courseName)}</td>
        <td>${htmlEscape(change.semester)}</td>
        <td>${htmlEscape(change.oldTotal ?? "")}</td>
        <td>${htmlEscape(change.newTotal ?? "")}</td>
        <td>${htmlEscape(change.oldAssessmentCount ?? "")}</td>
        <td>${htmlEscape(change.newAssessmentCount ?? "")}</td>
      </tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>GradeMate Course Library Diff</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 24px; background: #08111f; color: #e5eefc; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 18px 0; }
    .card { background: #101d2f; border: 1px solid #213653; border-radius: 10px; padding: 14px; }
    .value { font-size: 28px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border-bottom: 1px solid #213653; padding: 8px; text-align: left; }
    th { color: #7dd3fc; }
  </style>
</head>
<body>
  <h1>GradeMate Course Library Diff</h1>
  ${
    model.backup
      ? `<p>Compared against backup ${htmlEscape(model.backup.timestamp)}.</p>`
      : "<p>No old export was found. Run <code>npm run library:export-current</code> with Supabase service-role env vars to enable old-vs-new comparison.</p>"
  }
  <section class="cards">
    ${Object.entries(model.summary)
      .map(([key, value]) => `<div class="card"><div>${htmlEscape(key)}</div><div class="value">${value}</div></div>`)
      .join("")}
  </section>
  <table>
    <thead><tr><th>Type</th><th>Code</th><th>Name</th><th>Semester</th><th>Old total</th><th>New total</th><th>Old rows</th><th>New rows</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
`;
}
