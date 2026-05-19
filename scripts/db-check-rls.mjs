import fs from "node:fs/promises";
import path from "node:path";

const auditDir = path.resolve("training-data", "launch-audit");
const reportJsonPath = path.join(auditDir, "rls-report.json");
const reportHtmlPath = path.join(auditDir, "rls-report.html");

await fs.mkdir(auditDir, { recursive: true });

const sql = await loadSql([
  "supabase/schema.sql",
  "supabase/public-course-library-rls.sql",
  "supabase/syllabus-contributions.sql",
  "supabase/verified-extractions.sql"
]);

const checks = [
  check("Profiles table exists", /create table if not exists profiles/i),
  check("Admin role helper exists", /function public\.is_admin/i),
  check("Private semesters use owner RLS", /semesters for select[\s\S]*auth\.uid\(\) = user_id/i),
  check("Private courses use owner RLS", /courses for select[\s\S]*auth\.uid\(\) = user_id/i),
  check("Private assessments use owner RLS", /assessments for select[\s\S]*auth\.uid\(\) = user_id/i),
  check(
    "Public templates expose ready only",
    /course_templates for select[\s\S]*template_status[\s\S]*ready/i
  ),
  check(
    "Public template assessments require ready parent",
    /course_template_assessments for select[\s\S]*course_templates[\s\S]*template_status[\s\S]*ready/i
  ),
  check(
    "Users can create own syllabus contributions",
    /syllabus_contributions for insert[\s\S]*auth\.uid\(\) = submitted_by_user_id/i
  ),
  check(
    "Admins can review all contributions",
    /Admins can view all contributions[\s\S]*public\.is_admin\(\)/i
  ),
  check(
    "Users can create own verified feedback",
    /verified_extractions for insert[\s\S]*auth\.uid\(\) = user_id/i
  ),
  check(
    "Admins can view verified feedback",
    /Admins can view all verified extractions[\s\S]*(public\.is_admin\(\)|profiles[\s\S]*role = 'admin')/i
  ),
  check(
    "Service import uniqueness uses unique_key",
    /course_templates_unique_key_unique|unique_key text/i
  )
];

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    passed: checks.filter((item) => item.status === "pass").length,
    failed: checks.filter((item) => item.status === "fail").length
  },
  checks
};

await fs.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await fs.writeFile(reportHtmlPath, buildHtml(report), "utf8");

console.log("GradeMate RLS check complete");
console.log(`Passed: ${report.summary.passed}`);
console.log(`Failed: ${report.summary.failed}`);
console.log(`HTML: ${reportHtmlPath}`);

if (report.summary.failed > 0) {
  process.exitCode = 1;
}

async function loadSql(files) {
  const parts = [];

  for (const file of files) {
    try {
      parts.push(await fs.readFile(path.resolve(file), "utf8"));
    } catch {
      parts.push("");
    }
  }

  return parts.join("\n\n");
}

function check(name, pattern) {
  return {
    name,
    status: pattern.test(sql) ? "pass" : "fail",
    detail: pattern.toString()
  };
}

function buildHtml(report) {
  const rows = report.checks
    .map(
      (item) => `
      <tr class="${item.status}">
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.status)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GradeMate RLS Check</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    main { max-width: 900px; margin: 0 auto; padding: 32px 18px; }
    table { width: 100%; border-collapse: collapse; background: #111827; border-radius: 14px; overflow: hidden; }
    td, th { padding: 12px; border-bottom: 1px solid #334155; text-align: left; }
    tr.pass td:last-child { color: #86efac; font-weight: 700; }
    tr.fail td:last-child { color: #fda4af; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>GradeMate RLS Check</h1>
    <p>${report.summary.passed} passed, ${report.summary.failed} failed.</p>
    <table><tbody>${rows}</tbody></table>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
