import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  buildSupabasePayload,
  fetchAllRows,
  getCanonicalReadyTemplates,
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

try {
  const rebuiltTemplates = await readRebuiltTemplates();

  if (rebuiltTemplates.length === 0) {
    throw new Error("No rebuilt templates found. Run npm run library:rebuild first.");
  }

  const importableTemplates = getCanonicalReadyTemplates(rebuiltTemplates);
  const current = await loadCurrentLibraryForPlan();
  const plan = buildImportPlan(importableTemplates, current);

  await writeImportPlan(plan);
  printPlanSummary(plan);

  if (isDryRun) {
    console.log("Dry run complete. No Supabase rows were changed.");
    process.exit(0);
  }

  if (!isConfirmed) {
    throw new Error(
      "Real import requires explicit confirmation. Run: npm run library:import-rebuilt -- --confirm"
    );
  }

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

function buildImportPlan(importableTemplates, current) {
  const currentById = new Map(current.templates.map((template) => [template.id, template]));
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

  const skipped = current.templates
    .filter((template) => !actions.some((action) => action.templateId === template.id))
    .map((template) => ({
      id: template.id,
      courseCode: template.course_code,
      courseName: template.course_name,
      semester: template.semester ?? template.term ?? null
    }));

  return {
    generatedAt: new Date().toISOString(),
    currentSource: current.source,
    summary: {
      importableTemplates: importableTemplates.length,
      inserts: actions.filter((action) => action.action === "insert").length,
      updates: actions.filter((action) => action.action === "update").length,
      assessmentChanges: actions.filter((action) => action.assessmentChange).length,
      skippedExistingTemplates: skipped.length
    },
    actions,
    skipped
  };
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
  console.log(`Importable ready canonical templates: ${plan.summary.importableTemplates}`);
  console.log(`Would insert: ${plan.summary.inserts}`);
  console.log(`Would update: ${plan.summary.updates}`);
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
  const rows = plan.actions
    .map(
      (action) => `<tr>
        <td>${htmlEscape(action.action)}</td>
        <td>${htmlEscape(action.courseCode)}</td>
        <td>${htmlEscape(action.courseName)}</td>
        <td>${htmlEscape(action.semester)}</td>
        <td>${action.assessmentCount}</td>
        <td>${action.totalWeight}</td>
        <td>${action.assessmentChange ? "Yes" : "No"}</td>
        <td>${htmlEscape(action.sourceFileName)}</td>
      </tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>GradeMate Course Library Import Plan</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 24px; background: #08111f; color: #e5eefc; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 18px 0; }
    .card { background: #101d2f; border: 1px solid #213653; border-radius: 10px; padding: 14px; }
    .value { font-size: 28px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border-bottom: 1px solid #213653; padding: 8px; text-align: left; }
    th { color: #7dd3fc; }
  </style>
</head>
<body>
  <h1>GradeMate Course Library Import Plan</h1>
  <p>Current source: ${htmlEscape(plan.currentSource)}</p>
  <section class="cards">
    ${Object.entries(plan.summary)
      .map(([key, value]) => `<div class="card"><div>${htmlEscape(key)}</div><div class="value">${value}</div></div>`)
      .join("")}
  </section>
  <table>
    <thead><tr><th>Action</th><th>Code</th><th>Name</th><th>Semester</th><th>Rows</th><th>Total</th><th>Assessment change</th><th>Source</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
`;
}
