import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllRows,
  getSupabaseServiceConfig,
  htmlEscape
} from "./library-rebuild-utils.mjs";

const auditDir = path.resolve("training-data", "launch-audit");
const reportJsonPath = path.join(auditDir, "contributions-publish-report.json");
const reportHtmlPath = path.join(auditDir, "contributions-publish-report.html");

await fs.mkdir(auditDir, { recursive: true });

try {
  const { supabaseUrl, serviceRoleKey } = getSupabaseServiceConfig();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const [
    contributions,
    templates,
    assessments,
    versions
  ] = await Promise.all([
    fetchAllRows(supabase, "syllabus_contributions"),
    fetchAllRows(supabase, "course_templates"),
    fetchAllRows(supabase, "course_template_assessments"),
    fetchAllRows(supabase, "course_template_versions")
  ]);

  const publicRead = await verifyPublishedPublicRead(supabaseUrl, contributions);
  const report = buildReport({
    assessments,
    contributions,
    publicRead,
    templates,
    versions
  });

  await fs.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(reportHtmlPath, buildHtml(report), "utf8");

  console.log("GradeMate contribution publish verification complete");
  console.log(`Approved published contributions: ${report.summary.approvedPublished}`);
  console.log(`Missing templates: ${report.summary.missingTemplates}`);
  console.log(`Published templates without assessments: ${report.summary.withoutAssessments}`);
  console.log(`Bad totals: ${report.summary.badTotals}`);
  console.log(`Missing replacement history: ${report.summary.missingVersionHistory}`);
  console.log(`Public read: ${report.publicRead.status}`);
  console.log(`HTML: ${reportHtmlPath}`);

  if (
    report.summary.missingTemplates > 0 ||
    report.summary.withoutAssessments > 0 ||
    report.summary.badTotals > 0 ||
    report.summary.missingVersionHistory > 0 ||
    report.publicRead.status === "failed"
  ) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function buildReport({ assessments, contributions, publicRead, templates, versions }) {
  const templatesById = new Map(templates.map((template) => [template.id, template]));
  const assessmentsByTemplateId = groupBy(
    assessments,
    (assessment) => assessment.course_template_id
  );
  const versionsByContributionId = groupBy(
    versions,
    (version) => version.replaced_by_contribution_id
  );
  const approvedPublished = contributions.filter(
    (contribution) =>
      contribution.status === "approved" &&
      (contribution.published_template_id || contribution.approved_course_template_id)
  );
  const rows = approvedPublished.map((contribution) => {
    const templateId =
      contribution.published_template_id ?? contribution.approved_course_template_id;
    const template = templatesById.get(templateId);
    const templateAssessments = template
      ? assessmentsByTemplateId.get(template.id) ?? []
      : [];
    const totalWeight = sumWeights(templateAssessments);
    const requiresHistory =
      contribution.publish_action === "replaced_existing" ||
      contribution.publish_action === "marked_latest";
    const history = versionsByContributionId.get(contribution.id) ?? [];
    const issues = [];

    if (!template) {
      issues.push("missing published template");
    }

    if (template && templateAssessments.length === 0) {
      issues.push("published template has no assessments");
    }

    if (
      template &&
      templateAssessments.length > 0 &&
      (totalWeight < 99.5 || totalWeight > 100.5)
    ) {
      issues.push(`assessment total ${formatNumber(totalWeight)} outside 99.5-100.5`);
    }

    if (requiresHistory && history.length === 0) {
      issues.push("missing course_template_versions history");
    }

    return {
      assessmentCount: templateAssessments.length,
      contributionId: contribution.id,
      courseCode: contribution.course_code,
      courseName: contribution.course_name,
      issues,
      publishAction: contribution.publish_action,
      publishedTemplateId: templateId,
      status: issues.length === 0 ? "ready" : "problem",
      templateStatus: template?.template_status ?? null,
      totalWeight
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    publicRead,
    summary: {
      approvedPublished: approvedPublished.length,
      badTotals: rows.filter((row) =>
        row.issues.some((issue) => issue.includes("outside 99.5-100.5"))
      ).length,
      missingTemplates: rows.filter((row) =>
        row.issues.includes("missing published template")
      ).length,
      missingVersionHistory: rows.filter((row) =>
        row.issues.includes("missing course_template_versions history")
      ).length,
      privateWorkspaceSafety:
        "Read-only verification. Publishing code only writes shared template tables, version history, and syllabus contribution review metadata.",
      ready: rows.filter((row) => row.status === "ready").length,
      withoutAssessments: rows.filter((row) =>
        row.issues.includes("published template has no assessments")
      ).length
    },
    rows
  };
}

async function verifyPublishedPublicRead(supabaseUrl, contributions) {
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const firstPublished = contributions.find(
    (contribution) =>
      contribution.status === "approved" &&
      (contribution.published_template_id || contribution.approved_course_template_id)
  );

  if (!firstPublished) {
    return {
      status: "skipped",
      message: "No approved published contributions found yet."
    };
  }

  if (!publicKey) {
    return {
      status: "skipped",
      message:
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set."
    };
  }

  const templateId =
    firstPublished.published_template_id ?? firstPublished.approved_course_template_id;
  const publicClient = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false }
  });
  const { data, error } = await publicClient
    .from("course_templates")
    .select("id, course_code, course_name, template_status")
    .eq("id", templateId)
    .eq("template_status", "ready")
    .maybeSingle();

  if (error) {
    return {
      status: "failed",
      message: error.message
    };
  }

  return data
    ? {
        status: "passed",
        message: `Published template ${templateId} is public-readable.`
      }
    : {
        status: "failed",
        message: `Published template ${templateId} was not public-readable as ready.`
      };
}

function groupBy(rows, keyFn) {
  const groups = new Map();

  for (const row of rows) {
    const key = keyFn(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return groups;
}

function sumWeights(rows) {
  return rows.reduce(
    (sum, row) => sum + Number(row.weight_percentage ?? 0),
    0
  );
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildHtml(report) {
  const rows = report.rows
    .map(
      (row) => `<tr>
        <td><span class="pill ${row.status}">${htmlEscape(row.status)}</span></td>
        <td>${htmlEscape(row.courseCode)}</td>
        <td>${htmlEscape(row.courseName)}</td>
        <td>${htmlEscape(row.publishAction)}</td>
        <td><code>${htmlEscape(row.publishedTemplateId)}</code></td>
        <td>${row.assessmentCount}</td>
        <td>${htmlEscape(formatNumber(row.totalWeight))}</td>
        <td>${htmlEscape(row.issues.join("; ") || "OK")}</td>
      </tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GradeMate Contribution Publish Verification</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 24px; color: #0f172a; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
    th { background: #f8fafc; }
    .pill { border-radius: 999px; padding: 2px 8px; font-weight: 700; font-size: 12px; }
    .ready { background: #ccfbf1; color: #115e59; }
    .problem { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <h1>GradeMate Contribution Publish Verification</h1>
  <p>Generated ${htmlEscape(report.generatedAt)}</p>
  <p>Public read: ${htmlEscape(report.publicRead.status)} - ${htmlEscape(report.publicRead.message)}</p>
  <p>${htmlEscape(report.summary.privateWorkspaceSafety)}</p>
  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Course code</th>
        <th>Course name</th>
        <th>Publish action</th>
        <th>Template</th>
        <th>Assessments</th>
        <th>Total</th>
        <th>Issues</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}
