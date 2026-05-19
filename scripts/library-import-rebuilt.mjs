import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  buildSupabasePayload,
  fetchAllRows,
  getSupabaseServiceConfig,
  htmlEscape,
  importPlanHtmlPath,
  importPlanJsonPath,
  loadLatestBackup,
  readRebuiltTemplates,
  stripOptionalAssessmentColumns,
  stripOptionalTemplateColumns
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
  const result = await executeImport(supabase, plan);

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

    if (template.duplicateStatus === "conflict") {
      const explicitlyAllowed = allowConflicts || chosenAsCanonical;

      if (!effectiveCanonical || !template.ready || !explicitlyAllowed) {
        skipped.duplicateConflicts.push({
          ...skipBase,
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
        reason: template.sourceType ?? "not syllabus"
      });
      return;
    }

    if (template.duplicateStatus === "duplicate" && !effectiveCanonical) {
      skipped.nonCanonicalDuplicates.push({
        ...skipBase,
        reason: template.canonicalReason ?? "non-canonical duplicate"
      });
      return;
    }

    if (!template.ready || template.needsReview) {
      if (!allowNeedsReview) {
        skipped.needsReview.push({
          ...skipBase,
          reason: (template.reasons ?? []).join("; ") || "needs review"
        });
        return;
      }

      if (!template.courseCode || !template.courseName || template.assessments.length === 0) {
        skipped.needsReview.push({
          ...skipBase,
          reason:
            "needs-review template lacks required course info or assessments and cannot be imported"
        });
        return;
      }
    }

    if (!effectiveCanonical) {
      skipped.other.push({
        ...skipBase,
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

  return {
    importableTemplates,
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
      importableReadyCanonical: importableTemplates.filter(
        (template) => template.ready && !template.needsReview
      ).length,
      importableNeedsReview: importableTemplates.filter((template) => template.needsReview).length,
      importableConflicts: importableTemplates.filter(
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
    const existing = findExistingTemplate(current.templates, template);
    const payload = buildSupabasePayload(template);
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
      key: `${template.courseCode} | ${template.courseName} | ${template.semester ?? ""}`,
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
      existing: existing
        ? {
            id: existing.id,
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

function findExistingTemplate(currentTemplates, rebuiltTemplate) {
  const exact = currentTemplates.find(
    (template) =>
      normalizeScalar(template.course_code) === normalizeScalar(rebuiltTemplate.courseCode) &&
      normalizeScalar(template.course_name) === normalizeScalar(rebuiltTemplate.courseName) &&
      normalizeScalar(template.semester ?? template.term) ===
        normalizeScalar(rebuiltTemplate.semester)
  );

  if (exact) {
    return exact;
  }

  return (
    currentTemplates.find(
      (template) =>
        normalizeScalar(template.course_code) === normalizeScalar(rebuiltTemplate.courseCode) &&
        normalizeScalar(template.course_name) === normalizeScalar(rebuiltTemplate.courseName)
    ) ?? null
  );
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
    let templateId = action.templateId;

    if (action.action === "insert") {
      templateId = await insertTemplate(supabase, action.payload.template);
      inserted += 1;
    } else {
      await updateTemplate(supabase, templateId, action.payload.template);
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

async function insertTemplate(supabase, payload) {
  const result = await supabase
    .from("course_templates")
    .insert(payload)
    .select("id")
    .single();

  if (!result.error && result.data?.id) {
    return result.data.id;
  }

  if (!isMissingColumnError(result.error)) {
    throw new Error(`course_templates insert: ${result.error?.message ?? "Unknown error"}`);
  }

  const retry = await supabase
    .from("course_templates")
    .insert(stripOptionalTemplateColumns(payload))
    .select("id")
    .single();

  if (retry.error || !retry.data?.id) {
    throw new Error(`course_templates insert: ${retry.error?.message ?? "Unknown error"}`);
  }

  return retry.data.id;
}

async function updateTemplate(supabase, templateId, payload) {
  const result = await supabase.from("course_templates").update(payload).eq("id", templateId);

  if (!result.error) {
    return;
  }

  if (!isMissingColumnError(result.error)) {
    throw new Error(`course_templates update: ${result.error.message}`);
  }

  const retry = await supabase
    .from("course_templates")
    .update(stripOptionalTemplateColumns(payload))
    .eq("id", templateId);

  if (retry.error) {
    throw new Error(`course_templates update: ${retry.error.message}`);
  }
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
        <td>${htmlEscape(action.courseCode)}</td>
        <td>${htmlEscape(action.courseName)}</td>
        <td>${htmlEscape(action.semester)}</td>
        <td>${action.assessmentCount}</td>
        <td>${action.totalWeight}</td>
        <td>${action.assessmentChange ? "Yes" : "No"}</td>
        <td>${htmlEscape(action.duplicateStatus)}</td>
        <td>${htmlEscape(action.sourceFileName)}</td>
      </tr>`
    )
    .join("\n");

  return `<section class="section">
    <h2>${htmlEscape(title)} (${actions.length})</h2>
    <table>
      <thead><tr><th>Action</th><th>Code</th><th>Name</th><th>Semester</th><th>Rows</th><th>Total</th><th>Assessment change</th><th>Duplicate status</th><th>Source</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="9">None</td></tr>`}</tbody>
    </table>
  </section>`;
}

function buildSkippedTable(title, values) {
  const rows = values
    .map(
      (value) => `<tr>
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
      <thead><tr><th>Code</th><th>Name</th><th>Semester</th><th>Rows</th><th>Total</th><th>Duplicate status</th><th>Reason</th><th>Source</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="8">None</td></tr>`}</tbody>
    </table>
  </section>`;
}
