import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  computeCourseTemplateUniqueKey,
  computeCourseTemplateUniqueKeyFromDb,
  fetchAllRows,
  getCanonicalReadyTemplates,
  getSupabaseServiceConfig,
  htmlEscape,
  importPlanJsonPath,
  productionVerifyHtmlPath,
  productionVerifyJsonPath,
  readRebuiltTemplates
} from "./library-rebuild-utils.mjs";

try {
  const expectedTemplates = await loadExpectedTemplates();

  if (expectedTemplates.length === 0) {
    throw new Error(
      "No expected templates found. Run npm run library:rebuild and npm run library:import-rebuilt:dry first."
    );
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseServiceConfig();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  const [productionTemplates, productionAssessments] = await Promise.all([
    fetchAllRows(supabase, "course_templates"),
    fetchAllRows(supabase, "course_template_assessments")
  ]);
  const publicRead = await verifyPublicRead(supabaseUrl);
  const report = buildVerificationReport({
    expectedTemplates,
    productionAssessments,
    productionTemplates,
    publicRead
  });

  await fs.writeFile(productionVerifyJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(productionVerifyHtmlPath, buildVerificationHtml(report), "utf8");

  console.log("Course Library production verification complete");
  console.log(`Expected imported templates: ${report.summary.expectedImportedTemplates}`);
  console.log(`Matched: ${report.summary.matched}`);
  console.log(`Missing: ${report.summary.missing}`);
  console.log(`Without assessments: ${report.summary.withoutAssessments}`);
  console.log(`Bad totals: ${report.summary.badTotals}`);
  console.log(`Duplicate unique keys: ${report.summary.duplicateUniqueKeys}`);
  console.log(`Public read: ${report.summary.publicReadStatus}`);
  console.log(`Ready: ${report.summary.ready}`);
  console.log(`HTML: ${productionVerifyHtmlPath}`);

  if (
    report.summary.missing > 0 ||
    report.summary.withoutAssessments > 0 ||
    report.summary.badTotals > 0 ||
    report.summary.duplicateUniqueKeys > 0 ||
    report.summary.publicReadStatus === "failed"
  ) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function loadExpectedTemplates() {
  const importPlan = await loadImportPlan();

  if (importPlan?.actions?.length) {
    return importPlan.actions.map((action) => ({
      source: "import plan",
      sourceFileName: action.sourceFileName,
      courseCode: action.courseCode,
      courseName: action.courseName,
      semester: action.semester,
      uniqueKey: action.uniqueKey ?? action.payload?.template?.unique_key ?? null,
      totalWeight: action.totalWeight,
      assessmentCount: action.assessmentCount,
      payload: action.payload
    }));
  }

  const rebuilt = await readRebuiltTemplates();

  return getCanonicalReadyTemplates(rebuilt).map((template) => ({
    source: "canonical ready rebuild",
    sourceFileName: template.sourceFileName,
    courseCode: template.courseCode,
    courseName: template.courseName,
    semester: template.semester,
    uniqueKey: computeCourseTemplateUniqueKey(template),
    totalWeight: template.totalWeight,
    assessmentCount: template.assessments.length,
    payload: null
  }));
}

async function loadImportPlan() {
  try {
    const content = await fs.readFile(importPlanJsonPath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function buildVerificationReport({
  expectedTemplates,
  productionAssessments,
  productionTemplates,
  publicRead
}) {
  const assessmentsByTemplateId = groupBy(
    productionAssessments,
    (assessment) => assessment.course_template_id
  );
  const rows = expectedTemplates.map((expected) => {
    const production = findProductionTemplate(productionTemplates, expected);
    const assessments = production ? assessmentsByTemplateId.get(production.id) ?? [] : [];
    const totalWeight = sumAssessments(assessments);
    const issues = [];

    if (!production) {
      issues.push("missing template");
    }

    if (production && assessments.length === 0) {
      issues.push("no assessments");
    }

    if (production && !isReadyTotal(totalWeight)) {
      issues.push(`total ${formatNumber(totalWeight)} outside 99.5-100.5`);
    }

    return {
      status: issues.length === 0 ? "ready" : "problem",
      issues,
      source: expected.source,
      sourceFileName: expected.sourceFileName,
      uniqueKey: expected.uniqueKey,
      courseCode: expected.courseCode,
      courseName: expected.courseName,
      semester: expected.semester,
      expectedAssessmentCount: expected.assessmentCount,
      expectedTotalWeight: expected.totalWeight,
      productionTemplateId: production?.id ?? null,
      productionAssessmentCount: assessments.length,
      productionTotalWeight: production ? totalWeight : null
    };
  });
  const missing = rows.filter((row) => row.issues.includes("missing template")).length;
  const withoutAssessments = rows.filter((row) => row.issues.includes("no assessments")).length;
  const badTotals = rows.filter((row) =>
    row.issues.some((issue) => issue.startsWith("total "))
  ).length;
  const duplicateUniqueKeys = findDuplicateProductionUniqueKeys(productionTemplates);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      expectedImportedTemplates: expectedTemplates.length,
      productionTemplates: productionTemplates.length,
      productionAssessments: productionAssessments.length,
      matched: rows.filter((row) => row.productionTemplateId).length,
      missing,
      withoutAssessments,
      badTotals,
      duplicateUniqueKeys: duplicateUniqueKeys.length,
      publicReadStatus: publicRead.status,
      ready: rows.filter((row) => row.status === "ready").length,
      problems: rows.filter((row) => row.status !== "ready").length
    },
    publicRead,
    duplicateUniqueKeys,
    rows
  };
}

function findProductionTemplate(productionTemplates, expected) {
  return (
    productionTemplates.find(
      (template) => computeCourseTemplateUniqueKeyFromDb(template) === expected.uniqueKey
    ) ?? null
  );
}

async function verifyPublicRead(supabaseUrl) {
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!publicKey) {
    return {
      status: "skipped",
      message:
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set."
    };
  }

  const publicClient = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false }
  });
  const { data, error } = await publicClient
    .from("course_templates")
    .select("id, unique_key, course_code, course_name")
    .eq("template_status", "ready")
    .limit(1);

  if (error) {
    return {
      status: "failed",
      message: error.message
    };
  }

  return {
    status: "passed",
    message: `Public query returned ${data?.length ?? 0} ready template(s).`
  };
}

function findDuplicateProductionUniqueKeys(productionTemplates) {
  const groups = groupBy(productionTemplates, (template) =>
    computeCourseTemplateUniqueKeyFromDb(template)
  );

  return Array.from(groups.entries())
    .filter(([key, values]) => key && values.length > 1)
    .map(([uniqueKey, values]) => ({
      uniqueKey,
      count: values.length,
      ids: values.map((value) => value.id)
    }));
}

function buildVerificationHtml(report) {
  const rows = report.rows
    .map(
      (row) => `<tr>
        <td><span class="pill ${row.status}">${htmlEscape(row.status)}</span></td>
        <td><code>${htmlEscape(row.uniqueKey)}</code></td>
        <td>${htmlEscape(row.courseCode)}</td>
        <td>${htmlEscape(row.courseName)}</td>
        <td>${htmlEscape(row.semester)}</td>
        <td>${htmlEscape(row.sourceFileName)}</td>
        <td>${row.expectedAssessmentCount}</td>
        <td>${htmlEscape(row.expectedTotalWeight)}</td>
        <td>${htmlEscape(row.productionTemplateId)}</td>
        <td>${row.productionAssessmentCount}</td>
        <td>${htmlEscape(row.productionTotalWeight)}</td>
        <td>${htmlEscape(row.issues.join("; ") || "OK")}</td>
      </tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>GradeMate Course Library Production Verification</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 24px; background: #08111f; color: #e5eefc; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 18px 0; }
    .card { background: #101d2f; border: 1px solid #213653; border-radius: 10px; padding: 14px; }
    .value { font-size: 28px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; }
    th, td { border-bottom: 1px solid #213653; padding: 8px; text-align: left; vertical-align: top; }
    th { color: #7dd3fc; }
    .pill { border-radius: 999px; padding: 2px 8px; background: #334155; color: #e2e8f0; font-size: 12px; }
    .ready { background: #065f46; }
    .problem { background: #7f1d1d; }
    .muted { color: #9fb0c7; }
  </style>
</head>
<body>
  <h1>GradeMate Course Library Production Verification</h1>
  <p class="muted">Generated ${htmlEscape(report.generatedAt)}.</p>
  <section class="cards">
    ${summaryCard("Expected imported", report.summary.expectedImportedTemplates)}
    ${summaryCard("Matched", report.summary.matched)}
    ${summaryCard("Missing", report.summary.missing)}
    ${summaryCard("No assessments", report.summary.withoutAssessments)}
    ${summaryCard("Bad totals", report.summary.badTotals)}
    ${summaryCard("Duplicate keys", report.summary.duplicateUniqueKeys)}
    ${summaryCard("Public read", report.summary.publicReadStatus)}
    ${summaryCard("Ready", report.summary.ready)}
    ${summaryCard("Production templates", report.summary.productionTemplates)}
    ${summaryCard("Production rows", report.summary.productionAssessments)}
  </section>
  <table>
    <thead><tr><th>Status</th><th>Unique key</th><th>Code</th><th>Name</th><th>Semester</th><th>Source</th><th>Expected rows</th><th>Expected total</th><th>Production id</th><th>Production rows</th><th>Production total</th><th>Issues</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
`;
}

function summaryCard(label, value) {
  return `<div class="card"><div>${htmlEscape(label)}</div><div class="value">${value}</div></div>`;
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

function sumAssessments(assessments) {
  return Number(
    assessments
      .reduce((sum, assessment) => sum + Number(assessment.weight_percentage ?? 0), 0)
      .toFixed(2)
  );
}

function isReadyTotal(value) {
  return Number(value) >= 99.5 && Number(value) <= 100.5;
}

function formatNumber(value) {
  return Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(2);
}
