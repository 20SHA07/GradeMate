import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  createCourseLibraryBackup,
  printBackupSummary
} from "./library-backup-utils.mjs";
import {
  buildSupabasePayload,
  computeCourseTemplateUniqueKey,
  computeCourseTemplateUniqueKeyFromDb,
  fetchAllRows,
  getSupabaseServiceConfig,
  htmlEscape,
  importPlanHtmlPath,
  importPlanJsonPath,
  loadLatestBackup,
  readRebuiltTemplates,
  rebuildRootDir,
  stripOptionalAssessmentColumns
} from "./library-rebuild-utils.mjs";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isConfirmed = args.includes("--confirm");
const includeNeedsReview = args.includes("--include-needs-review");
const resolveConflicts = args.includes("--resolve-conflicts");
const chosenCanonicalFiles = parseRepeatedValueFlag(args, "--canonical-file");

try {
  if (!isDryRun && !isConfirmed) {
    throw new Error(
      "Real import requires explicit confirmation. Run: npm run library:import-rebuilt -- --confirm"
    );
  }

  if (!isDryRun) {
    getSupabaseServiceConfig();
  }

  const rebuiltTemplates = await readRebuiltTemplates();

  if (rebuiltTemplates.length === 0) {
    throw new Error("No rebuilt templates found. Run npm run library:rebuild first.");
  }

  const selection = classifyRebuiltTemplates(rebuiltTemplates, {
    chosenCanonicalFiles,
    includeNeedsReview,
    resolveConflicts
  });
  const current = await loadCurrentLibraryForPlan();
  const plan = buildImportPlan(selection.importableTemplates, current, selection);

  await writeImportPlan(plan);
  printPlanSummary(plan);

  if (isDryRun) {
    console.log("Dry run complete. No Supabase rows were changed.");
    process.exit(0);
  }

  assertRealImportGuards(plan);

  const { supabaseUrl, serviceRoleKey } = getSupabaseServiceConfig();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  await assertSupabaseSchemaReady(supabase, plan);
  const backup = await createCourseLibraryBackup({ reason: "pre-import safety backup" });
  printBackupSummary(backup);
  let result;

  try {
    result = await executeImport(supabase, plan);
    await writeImportLog({ backup, plan, result, status: "complete" });
  } catch (importError) {
    await writeImportLog({
      backup,
      error: importError instanceof Error ? importError.message : String(importError),
      plan,
      result,
      status: "failed"
    });
    throw importError;
  }

  console.log("Course Library import complete");
  console.log(`Inserted: ${result.inserted}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Assessment rows replaced: ${result.assessmentsInserted}`);
  console.log(`Material rows written: ${result.materialsInserted}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function parseRepeatedValueFlag(values, flagName) {
  const selected = new Set();

  values.forEach((value, index) => {
    if (value === flagName && values[index + 1]) {
      selected.add(values[index + 1]);
      return;
    }

    if (value.startsWith(`${flagName}=`)) {
      selected.add(value.slice(flagName.length + 1));
    }
  });

  return selected;
}

async function loadCurrentLibraryForPlan() {
  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseServiceConfig();
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
    const [templates, assessments] = await Promise.all([
      fetchAllRows(supabase, "course_templates"),
      fetchAllRows(supabase, "course_template_assessments")
    ]);

    return {
      source: "supabase",
      templates,
      assessments
    };
  } catch (error) {
    const backup = await loadLatestBackup();

    if (backup) {
      return {
        source: `backup ${backup.timestamp}`,
        templates: backup.templates,
        assessments: backup.assessments
      };
    }

    return {
      source: `none (${error instanceof Error ? error.message : String(error)})`,
      templates: [],
      assessments: []
    };
  }
}

function classifyRebuiltTemplates(
  templates,
  { chosenCanonicalFiles, includeNeedsReview: allowNeedsReview, resolveConflicts: allowConflicts }
) {
  const importableTemplates = [];
  const skipped = {
    needsReview: [],
    duplicateConflicts: [],
    nonCanonicalDuplicates: [],
    relatedMaterials: [],
    other: []
  };

  templates.forEach((template) => {
    const skipBase = summarizeTemplateForSkip(template);
    const chosenAsCanonical = chosenCanonicalFiles.has(template.sourceFileName);
    const effectiveCanonical = template.canonical || chosenAsCanonical;
    const uniqueKey = computeCourseTemplateUniqueKey(template);

    if (template.duplicateStatus === "conflict") {
      const explicitlyAllowed = allowConflicts || chosenAsCanonical;

      if (!effectiveCanonical || !template.ready || !explicitlyAllowed) {
        skipped.duplicateConflicts.push({
          ...skipBase,
          uniqueKey,
          reason: template.canonical
            ? "duplicate conflict skipped until --resolve-conflicts or --canonical-file is used"
            : "non-canonical duplicate conflict"
        });
        return;
      }
    }

    if (template.sourceType !== "syllabus") {
      skipped.relatedMaterials.push({
        ...skipBase,
        uniqueKey,
        reason: template.sourceType ?? "not syllabus"
      });
      return;
    }

    if (template.duplicateStatus === "duplicate" && !effectiveCanonical) {
      skipped.nonCanonicalDuplicates.push({
        ...skipBase,
        uniqueKey,
        reason: template.canonicalReason ?? "non-canonical duplicate"
      });
      return;
    }

    if (!template.ready || template.needsReview) {
      if (!allowNeedsReview) {
        skipped.needsReview.push({
          ...skipBase,
          uniqueKey,
          reason: (template.reasons ?? []).join("; ") || "needs review"
        });
        return;
      }

      if (!template.courseCode || !template.courseName || template.assessments.length === 0) {
        skipped.needsReview.push({
          ...skipBase,
          uniqueKey,
          reason:
            "needs-review template lacks required course info or assessments and cannot be imported"
        });
        return;
      }
    }

    if (!effectiveCanonical) {
      skipped.other.push({
        ...skipBase,
        uniqueKey,
        reason: template.canonicalReason ?? "not canonical"
      });
      return;
    }

    importableTemplates.push(
      chosenAsCanonical
        ? {
            ...template,
            canonical: true,
            canonicalReason: "selected by --canonical-file"
          }
        : template
    );
  });

  const deduped = dedupeImportableTemplatesByUniqueKey(importableTemplates, skipped);

  return {
    importableTemplates: deduped,
    skipped,
    summary: {
      totalRebuilt: templates.length,
      readyCanonical: templates.filter(
        (template) =>
          template.ready &&
          template.canonical &&
          !template.needsReview &&
          template.sourceType === "syllabus"
      ).length,
      importableReadyCanonical: deduped.filter(
        (template) => template.ready && !template.needsReview
      ).length,
      importableNeedsReview: deduped.filter((template) => template.needsReview).length,
      importableConflicts: deduped.filter(
        (template) => template.duplicateStatus === "conflict"
      ).length,
      skippedNeedsReview: skipped.needsReview.length,
      skippedDuplicateConflicts: skipped.duplicateConflicts.length,
      skippedNonCanonicalDuplicates: skipped.nonCanonicalDuplicates.length,
      skippedRelatedMaterials: skipped.relatedMaterials.length,
      skippedOther: skipped.other.length
    }
  };
}

function dedupeImportableTemplatesByUniqueKey(importableTemplates, skipped) {
  const groups = groupBy(importableTemplates, (template) => computeCourseTemplateUniqueKey(template));
  const deduped = [];

  for (const [uniqueKey, templates] of groups.entries()) {
    if (templates.length === 1) {
      deduped.push(templates[0]);
      continue;
    }

    const [canonical, ...duplicates] = [...templates].sort(
      (first, second) =>
        Number(second.confidence ?? 0) - Number(first.confidence ?? 0) ||
        (second.assessments?.length ?? 0) - (first.assessments?.length ?? 0)
    );

    deduped.push(canonical);

    duplicates.forEach((template) => {
      skipped.duplicateConflicts.push({
        ...summarizeTemplateForSkip(template),
        uniqueKey,
        reason: `same unique_key as ${canonical.sourceFileName}`
      });
    });
  }

  return deduped;
}

function summarizeTemplateForSkip(template) {
  return {
    id: template.id,
    sourceFileName: template.sourceFileName,
    courseCode: template.courseCode,
    courseName: template.courseName,
    semester: template.semester,
    totalWeight: template.totalWeight,
    assessmentCount: template.assessments?.length ?? 0,
    ready: template.ready,
    needsReview: template.needsReview,
    canonical: template.canonical,
    duplicateStatus: template.duplicateStatus,
    duplicateGroupKey: template.duplicateGroupKey,
    reasons: template.reasons ?? [],
    warnings: template.warnings ?? []
  };
}

function buildImportPlan(importableTemplates, current, selection) {
  const assessmentsByTemplateId = groupBy(
    current.assessments,
    (assessment) => assessment.course_template_id
  );
  const actions = importableTemplates.map((template) => {
    const payload = buildSupabasePayload(template);
    const uniqueKey = payload.template.unique_key;
    const existing = findExistingTemplate(current.templates, uniqueKey);
    const oldCourseCodeNameConflicts = findOldCourseCodeNameConflicts(
      current.templates,
      template,
      uniqueKey
    );
    const existingAssessments = existing
      ? assessmentsByTemplateId.get(existing.id) ?? []
      : [];
    const action = existing ? "update" : "insert";
    const assessmentChange = existing
      ? assessmentSignatureFromPayload(payload.assessments) !==
        assessmentSignatureFromDb(existingAssessments)
      : true;

    return {
      action,
      templateId: existing?.id ?? null,
      key: uniqueKey,
      uniqueKey,
      sourceFileName: template.sourceFileName,
      courseCode: template.courseCode,
      courseName: template.courseName,
      semester: template.semester,
      totalWeight: template.totalWeight,
      assessmentCount: template.assessments.length,
      confidence: template.confidence,
      ready: template.ready,
      needsReview: template.needsReview,
      canonical: template.canonical,
      duplicateStatus: template.duplicateStatus,
      duplicateGroupKey: template.duplicateGroupKey,
      assessmentChange,
      oldCourseCodeNameConflict: oldCourseCodeNameConflicts.length > 0,
      oldCourseCodeNameConflicts,
      existing: existing
        ? {
            id: existing.id,
            uniqueKey: computeCourseTemplateUniqueKeyFromDb(existing),
            courseCode: existing.course_code,
            courseName: existing.course_name,
            semester: existing.semester ?? existing.term ?? null,
            totalWeight: sumDbAssessments(existingAssessments),
            assessmentCount: existingAssessments.length
          }
        : null,
      payload
    };
  });

  const existingTemplatesNotTouched = current.templates
    .filter((template) => !actions.some((action) => action.templateId === template.id))
    .map((template) => ({
      id: template.id,
      courseCode: template.course_code,
      courseName: template.course_name,
      semester: template.semester ?? template.term ?? null
    }));
  const skippedRebuiltCount = Object.values(selection.skipped).reduce(
    (sum, values) => sum + values.length,
    0
  );

  return {
    generatedAt: new Date().toISOString(),
    currentSource: current.source,
    options: {
      includeNeedsReview,
      resolveConflicts,
      chosenCanonicalFiles: Array.from(chosenCanonicalFiles)
    },
    summary: {
      totalRebuilt: selection.summary.totalRebuilt,
      readyCanonical: selection.summary.readyCanonical,
      importableReadyCanonical: selection.summary.importableReadyCanonical,
      importableNeedsReview: selection.summary.importableNeedsReview,
      importableConflicts: selection.summary.importableConflicts,
      wouldInsert: actions.filter((action) => action.action === "insert").length,
      wouldUpdate: actions.filter((action) => action.action === "update").length,
      wouldSkip: skippedRebuiltCount,
      needsReviewCount: selection.summary.skippedNeedsReview,
      conflictCount: selection.summary.skippedDuplicateConflicts,
      duplicateCount: selection.summary.skippedNonCanonicalDuplicates,
      relatedMaterialCount: selection.summary.skippedRelatedMaterials,
      otherSkippedCount: selection.summary.skippedOther,
      assessmentChanges: actions.filter((action) => action.assessmentChange).length,
      oldCourseCodeNameConflicts: actions.filter((action) => action.oldCourseCodeNameConflict)
        .length,
      existingTemplatesNotTouched: existingTemplatesNotTouched.length
    },
    actions,
    skipped: {
      ...selection.skipped,
      existingTemplatesNotTouched
    }
  };
}

function assertRealImportGuards(plan) {
  const needsReviewActions = plan.actions.filter((action) => action.needsReview);

  if (needsReviewActions.length > 0 && !includeNeedsReview) {
    throw new Error(
      `Refusing to import ${needsReviewActions.length} needs-review template(s) without --include-needs-review.`
    );
  }

  const conflictActions = plan.actions.filter((action) => action.duplicateStatus === "conflict");

  if (conflictActions.length > 0 && !resolveConflicts && chosenCanonicalFiles.size === 0) {
    throw new Error(
      `Refusing to import ${conflictActions.length} duplicate-conflict template(s) without --resolve-conflicts or --canonical-file.`
    );
  }
}

function findExistingTemplate(currentTemplates, uniqueKey) {
  return (
    currentTemplates.find(
      (template) => computeCourseTemplateUniqueKeyFromDb(template) === uniqueKey
    ) ?? null
  );
}

function findOldCourseCodeNameConflicts(currentTemplates, rebuiltTemplate, uniqueKey) {
  return currentTemplates
    .filter(
      (template) =>
        normalizeScalar(template.course_code) === normalizeScalar(rebuiltTemplate.courseCode) &&
        normalizeScalar(template.course_name) === normalizeScalar(rebuiltTemplate.courseName) &&
        computeCourseTemplateUniqueKeyFromDb(template) !== uniqueKey
    )
    .map((template) => ({
      id: template.id,
      uniqueKey: computeCourseTemplateUniqueKeyFromDb(template),
      semester: template.semester ?? template.term ?? null,
      sourceFileName:
        template.source_file_name ??
        template.source_syllabus_file_name ??
        template.source_syllabus_path ??
        null
    }));
}

async function writeImportPlan(plan) {
  await fs.writeFile(importPlanJsonPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  await fs.writeFile(importPlanHtmlPath, buildImportPlanHtml(plan), "utf8");
}

function printPlanSummary(plan) {
  console.log("Course Library import plan written");
  console.log(`Current source: ${plan.currentSource}`);
  console.log(`Insertable ready canonical templates: ${plan.summary.importableReadyCanonical}`);
  console.log(`Would insert: ${plan.summary.wouldInsert}`);
  console.log(`Would update: ${plan.summary.wouldUpdate}`);
  console.log(`Would skip: ${plan.summary.wouldSkip}`);
  console.log(`Needs review skipped: ${plan.summary.needsReviewCount}`);
  console.log(`Duplicate conflicts skipped: ${plan.summary.conflictCount}`);
  console.log(`Non-canonical duplicates skipped: ${plan.summary.duplicateCount}`);
  console.log(`Old course_code+course_name conflicts: ${plan.summary.oldCourseCodeNameConflicts}`);
  console.log(`Assessment changes: ${plan.summary.assessmentChanges}`);
  console.log(`JSON: ${importPlanJsonPath}`);
  console.log(`HTML: ${importPlanHtmlPath}`);
}

async function executeImport(supabase, plan) {
  let inserted = 0;
  let updated = 0;
  let assessmentsInserted = 0;
  let materialsInserted = 0;

  for (const action of plan.actions) {
    const templateId = await upsertTemplate(supabase, action.payload.template);

    if (action.action === "insert") {
      inserted += 1;
    } else {
      updated += 1;
    }

    await replaceAssessments(supabase, templateId, action.payload.assessments);
    assessmentsInserted += action.payload.assessments.length;

    const materialInserted = await replaceMaterial(supabase, templateId, action.payload.material);
    materialsInserted += materialInserted;
  }

  return {
    inserted,
    updated,
    assessmentsInserted,
    materialsInserted
  };
}

async function writeImportLog({ backup, error = null, plan, result = null, status }) {
  const log = {
    generatedAt: new Date().toISOString(),
    status,
    error,
    backup: {
      timestamp: backup.timestamp,
      manifestPath: path.relative(process.cwd(), backup.manifestPath),
      templatesPath: path.relative(process.cwd(), backup.templatesPath),
      assessmentsPath: path.relative(process.cwd(), backup.assessmentsPath),
      materialsPath: path.relative(process.cwd(), backup.materialsPath),
      counts: backup.counts
    },
    protectedUserTablesTouched: false,
    sharedTablesWritten: [
      "course_templates",
      "course_template_assessments",
      "course_template_materials"
    ],
    summary: plan.summary,
    result,
    actions: plan.actions.map((action) => ({
      action: action.action,
      uniqueKey: action.uniqueKey,
      courseCode: action.courseCode,
      courseName: action.courseName,
      semester: action.semester,
      sourceFileName: action.sourceFileName,
      assessmentCount: action.assessmentCount,
      totalWeight: action.totalWeight
    }))
  };
  const logPath = path.join(rebuildRootDir, `import-log-${backup.timestamp}.json`);

  await fs.writeFile(logPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  console.log(`Import log: ${logPath}`);
}

async function assertSupabaseSchemaReady(supabase, plan) {
  const duplicateActionKeys = findDuplicateActionKeys(plan.actions);

  if (duplicateActionKeys.length > 0) {
    throw new Error(
      `Refusing to import duplicate unique_key values: ${duplicateActionKeys.join(", ")}`
    );
  }

  const result = await supabase
    .from("course_templates")
    .select("id, unique_key")
    .limit(1);

  if (isUniqueKeySchemaError(result.error)) {
    throw new Error("Run supabase/course-template-unique-key.sql first.");
  }

  if (result.error) {
    throw new Error(`course_templates schema check: ${result.error.message}`);
  }
}

async function upsertTemplate(supabase, payload) {
  const result = await supabase
    .from("course_templates")
    .upsert(payload, { onConflict: "unique_key" })
    .select("id")
    .single();

  if (result.error || !result.data?.id) {
    if (isUniqueKeySchemaError(result.error) || isOldCodeNameUniqueError(result.error)) {
      throw new Error("Run supabase/course-template-unique-key.sql first.");
    }

    throw new Error(`course_templates upsert: ${result.error?.message ?? "Unknown error"}`);
  }

  return result.data.id;
}

function findDuplicateActionKeys(actions) {
  const counts = new Map();

  actions.forEach((action) => {
    counts.set(action.uniqueKey, (counts.get(action.uniqueKey) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}

async function replaceAssessments(supabase, templateId, assessments) {
  const deleteResult = await supabase
    .from("course_template_assessments")
    .delete()
    .eq("course_template_id", templateId);

  if (deleteResult.error) {
    throw new Error(`course_template_assessments delete: ${deleteResult.error.message}`);
  }

  if (assessments.length === 0) {
    return;
  }

  const rows = assessments.map((assessment) => ({
    ...assessment,
    course_template_id: templateId
  }));
  const result = await supabase.from("course_template_assessments").insert(rows);

  if (!result.error) {
    return;
  }

  if (!isMissingColumnError(result.error)) {
    throw new Error(`course_template_assessments insert: ${result.error.message}`);
  }

  const retry = await supabase
    .from("course_template_assessments")
    .insert(rows.map(stripOptionalAssessmentColumns));

  if (retry.error) {
    throw new Error(`course_template_assessments insert: ${retry.error.message}`);
  }
}

async function replaceMaterial(supabase, templateId, material) {
  const deleteResult = await supabase
    .from("course_template_materials")
    .delete()
    .eq("course_template_id", templateId);

  if (deleteResult.error) {
    return 0;
  }

  const result = await supabase
    .from("course_template_materials")
    .insert({ ...material, course_template_id: templateId });

  return result.error ? 0 : 1;
}

function isMissingColumnError(error) {
  return /column|schema cache|Could not find/i.test(error?.message ?? "");
}

function isUniqueKeySchemaError(error) {
  const message = error?.message ?? "";
  return (
    /unique_key|on conflict|constraint/i.test(message) &&
    (isMissingColumnError(error) || /no unique|no constraint|on conflict/i.test(message))
  );
}

function isOldCodeNameUniqueError(error) {
  return /course_templates_code_name_unique|duplicate key value/i.test(error?.message ?? "");
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

function assessmentSignatureFromPayload(assessments) {
  return assessments
    .map(
      (assessment) =>
        `${normalizeAssessmentNameLocal(assessment.name)}:${Number(assessment.weight_percentage ?? 0)}`
    )
    .sort()
    .join("|");
}

function assessmentSignatureFromDb(assessments) {
  return assessments
    .map(
      (assessment) =>
        `${normalizeAssessmentNameLocal(assessment.name)}:${Number(assessment.weight_percentage ?? 0)}`
    )
    .sort()
    .join("|");
}

function sumDbAssessments(assessments) {
  return Number(
    assessments
      .reduce((sum, assessment) => sum + Number(assessment.weight_percentage ?? 0), 0)
      .toFixed(2)
  );
}

function normalizeAssessmentNameLocal(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeScalar(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildImportPlanHtml(plan) {
  const readyCanonicalActions = plan.actions.filter(
    (action) => !action.needsReview && action.duplicateStatus !== "conflict"
  );
  const selectedNeedsReviewActions = plan.actions.filter((action) => action.needsReview);
  const selectedConflictActions = plan.actions.filter(
    (action) => action.duplicateStatus === "conflict"
  );
  const skippedSections = [
    ["Skipped: needs review", plan.skipped.needsReview],
    ["Skipped: duplicate conflicts", plan.skipped.duplicateConflicts],
    ["Skipped: non-canonical duplicates", plan.skipped.nonCanonicalDuplicates],
    ["Skipped: related/non-syllabus material", plan.skipped.relatedMaterials],
    ["Skipped: other rebuilt templates", plan.skipped.other]
  ]
    .map(([title, values]) => buildSkippedTable(title, values))
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>GradeMate Course Library Import Plan</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 24px; background: #08111f; color: #e5eefc; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 18px 0; }
    .card { background: #101d2f; border: 1px solid #213653; border-radius: 10px; padding: 14px; }
    .value { font-size: 28px; font-weight: 800; }
    .muted { color: #9fb0c7; }
    .section { margin-top: 28px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border-bottom: 1px solid #213653; padding: 8px; text-align: left; vertical-align: top; }
    th { color: #7dd3fc; }
    .pill { border-radius: 999px; padding: 2px 8px; background: #24364f; color: #dbeafe; font-size: 12px; }
    .insert { background: #064e3b; }
    .update { background: #713f12; }
    code { color: #5eead4; }
  </style>
</head>
<body>
  <h1>GradeMate Course Library Import Plan</h1>
  <p class="muted">Generated ${htmlEscape(plan.generatedAt)}. Current source: ${htmlEscape(plan.currentSource)}</p>
  <section class="cards">
    ${summaryCard("Would insert", plan.summary.wouldInsert)}
    ${summaryCard("Would update", plan.summary.wouldUpdate)}
    ${summaryCard("Would skip", plan.summary.wouldSkip)}
    ${summaryCard("Needs review", plan.summary.needsReviewCount)}
    ${summaryCard("Conflicts", plan.summary.conflictCount)}
    ${summaryCard("Duplicates", plan.summary.duplicateCount)}
    ${summaryCard("Old code/name conflicts", plan.summary.oldCourseCodeNameConflicts)}
    ${summaryCard("Ready canonical", plan.summary.readyCanonical)}
    ${summaryCard("Importable", plan.summary.importableReadyCanonical)}
  </section>
  <p class="muted">Real import requires <code>--confirm</code>. Needs-review templates require <code>--include-needs-review</code>. Duplicate conflicts require <code>--resolve-conflicts</code> or <code>--canonical-file</code>.</p>
  ${buildActionTable("Insertable Ready Canonical Templates", readyCanonicalActions)}
  ${buildActionTable("Selected Needs-Review Templates", selectedNeedsReviewActions)}
  ${buildActionTable("Selected Duplicate Conflicts", selectedConflictActions)}
  ${skippedSections}
</body>
</html>
`;
}

function summaryCard(label, value) {
  return `<div class="card"><div>${htmlEscape(label)}</div><div class="value">${value}</div></div>`;
}

function buildActionTable(title, actions) {
  const rows = actions
    .map(
      (action) => `<tr>
        <td><span class="pill ${htmlEscape(action.action)}">${htmlEscape(action.action)}</span></td>
        <td><code>${htmlEscape(action.uniqueKey)}</code></td>
        <td>${htmlEscape(action.courseCode)}</td>
        <td>${htmlEscape(action.courseName)}</td>
        <td>${htmlEscape(action.semester)}</td>
        <td>${action.assessmentCount}</td>
        <td>${action.totalWeight}</td>
        <td>${action.assessmentChange ? "Yes" : "No"}</td>
        <td>${action.oldCourseCodeNameConflict ? "Yes" : "No"}</td>
        <td>${htmlEscape(action.duplicateStatus)}</td>
        <td>${htmlEscape(action.sourceFileName)}</td>
      </tr>`
    )
    .join("\n");

  return `<section class="section">
    <h2>${htmlEscape(title)} (${actions.length})</h2>
    <table>
      <thead><tr><th>Action</th><th>Unique key</th><th>Code</th><th>Name</th><th>Semester</th><th>Rows</th><th>Total</th><th>Assessment change</th><th>Old code/name conflict</th><th>Duplicate status</th><th>Source</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="11">None</td></tr>`}</tbody>
    </table>
  </section>`;
}

function buildSkippedTable(title, values) {
  const rows = values
    .map(
      (value) => `<tr>
        <td><code>${htmlEscape(value.uniqueKey)}</code></td>
        <td>${htmlEscape(value.courseCode)}</td>
        <td>${htmlEscape(value.courseName)}</td>
        <td>${htmlEscape(value.semester)}</td>
        <td>${value.assessmentCount}</td>
        <td>${value.totalWeight ?? ""}</td>
        <td>${htmlEscape(value.duplicateStatus)}</td>
        <td>${htmlEscape(value.reason)}</td>
        <td>${htmlEscape(value.sourceFileName)}</td>
      </tr>`
    )
    .join("\n");

  return `<section class="section">
    <h2>${htmlEscape(title)} (${values.length})</h2>
    <table>
      <thead><tr><th>Unique key</th><th>Code</th><th>Name</th><th>Semester</th><th>Rows</th><th>Total</th><th>Duplicate status</th><th>Reason</th><th>Source</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="9">None</td></tr>`}</tbody>
    </table>
  </section>`;
}
