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
  "supabase/course-template-versions.sql",
  "supabase/admin-course-library.sql",
  "supabase/profile-usernames.sql",
  "supabase/verified-extractions.sql"
]);
const protectedUserTables = [
  "semesters",
  "courses",
  "assessments",
  "verified_extractions",
  "syllabus_contributions",
  "contribution_assessments",
  "course_template_versions",
  "profiles"
];

const checks = [
  check("Profiles table exists", /create table if not exists profiles/i),
  check("Profile usernames exist", /profiles add column if not exists username|username text/i),
  check("Profile username uniqueness exists", /profiles_username_unique/i),
  check("Admin role helper exists", /function public\.is_admin/i),
  ...protectedUserTables.flatMap((table) => [
    check(
      `${table} table exists`,
      new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+${table}\\b`, "i")
    ),
    check(
      `${table} RLS enabled`,
      new RegExp(`alter\\s+table\\s+${table}\\s+enable\\s+row\\s+level\\s+security`, "i")
    )
  ]),
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
    "Public template materials require ready parent",
    /course_template_materials for select[\s\S]*course_templates[\s\S]*template_status[\s\S]*ready/i
  ),
  check(
    "Anon users cannot modify course templates",
    negativePattern(/course_templates for (insert|update|delete)[^;]*to\s+anon/i)
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
  ),
  check(
    "Admin can create shared course templates",
    /Admins can create course templates[\s\S]*public\.is_admin\(\)/i
  ),
  check(
    "Admin can update shared course templates",
    /Admins can update course templates[\s\S]*public\.is_admin\(\)/i
  ),
  check(
    "Admin can delete shared course templates",
    /Admins can delete course templates[\s\S]*public\.is_admin\(\)/i
  ),
  check(
    "Admins can view all shared templates",
    /Admins can view all course templates[\s\S]*public\.is_admin\(\)/i
  ),
  check(
    "Admins can manage template assessments",
    /Admins can create template assessments[\s\S]*public\.is_admin\(\)[\s\S]*Admins can update template assessments[\s\S]*public\.is_admin\(\)[\s\S]*Admins can delete template assessments[\s\S]*public\.is_admin\(\)/i
  ),
  check(
    "Admins can manage template materials",
    /Admins can create template materials[\s\S]*public\.is_admin\(\)[\s\S]*Admins can update template materials[\s\S]*public\.is_admin\(\)[\s\S]*Admins can delete template materials[\s\S]*public\.is_admin\(\)/i
  ),
  check(
    "Template version history is admin-only",
    /course_template_versions[\s\S]*enable\s+row\s+level\s+security/i
  ),
  check(
    "Admins can create template versions",
    /Admins can create course template versions[\s\S]*public\.is_admin\(\)/i
  ),
  check(
    "Contribution publish metadata exists",
    /published_template_id[\s\S]*publish_action[\s\S]*reviewed_at|published_template_id[\s\S]*reviewed_at[\s\S]*publish_action/i
  ),
  check(
    "Course templates can store contributor credit",
    /course_templates add column if not exists contributor_username[\s\S]*contributor_name|contributor_username[\s\S]*contributor_name/i
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
  if (typeof pattern === "function") {
    return {
      name,
      status: pattern(sql) ? "pass" : "fail",
      detail: "custom static SQL check"
    };
  }

  return {
    name,
    status: pattern.test(sql) ? "pass" : "fail",
    detail: pattern.toString()
  };
}

function negativePattern(pattern) {
  return (value) => !pattern.test(value);
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
