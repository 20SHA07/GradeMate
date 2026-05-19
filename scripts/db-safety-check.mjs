import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { backupDir, loadEnvFile } from "./library-rebuild-utils.mjs";

const auditDir = path.resolve("training-data", "launch-audit");
const reportJsonPath = path.join(auditDir, "db-safety-report.json");
const reportHtmlPath = path.join(auditDir, "db-safety-report.html");
const protectedUserTables = [
  "semesters",
  "courses",
  "assessments",
  "verified_extractions",
  "syllabus_contributions",
  "contribution_assessments",
  "profiles"
];
const sharedTemplateTables = [
  "course_templates",
  "course_template_assessments",
  "course_template_materials"
];
const libraryWriteScripts = [
  "scripts/library-import-rebuilt.mjs",
  "scripts/library-restore-backup.mjs",
  "scripts/library-backup-utils.mjs",
  "scripts/library-export-current.mjs"
];

await fs.mkdir(auditDir, { recursive: true });
loadEnvFile();

try {
  const checks = [];

  await checkFrontendSecretSafety(checks);
  await checkLibraryScriptsOnlyUseSharedTables(checks);
  await checkStaticRlsCoverage(checks);
  await checkBackups(checks);
  await checkExistingReports(checks);

  const report = {
    generatedAt: new Date().toISOString(),
    protectedUserTables,
    sharedTemplateTables,
    summary: {
      passed: checks.filter((check) => check.status === "pass").length,
      warnings: checks.filter((check) => check.status === "warn").length,
      failures: checks.filter((check) => check.status === "fail").length
    },
    checks
  };

  await fs.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(reportHtmlPath, buildHtml(report), "utf8");

  console.log("GradeMate database safety check complete");
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`Failures: ${report.summary.failures}`);
  console.log(`HTML: ${reportHtmlPath}`);

  if (report.summary.failures > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function checkFrontendSecretSafety(checks) {
  const frontendFiles = await walkFiles(path.resolve("src"));
  const serviceRoleMatches = [];

  for (const filePath of frontendFiles) {
    if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      continue;
    }

    const content = await fs.readFile(filePath, "utf8");
    if (/SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE/i.test(content)) {
      serviceRoleMatches.push(path.relative(process.cwd(), filePath));
    }
  }

  checks.push({
    area: "Secrets",
    name: "Service role key is not referenced in frontend source",
    status: serviceRoleMatches.length === 0 ? "pass" : "fail",
    detail:
      serviceRoleMatches.length === 0
        ? "No service-role references found under src/."
        : serviceRoleMatches.join(", ")
  });

  checks.push({
    area: "Secrets",
    name: "Service role key is local/server-only",
    status: process.env.SUPABASE_SERVICE_ROLE_KEY ? "pass" : "warn",
    detail: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? "SUPABASE_SERVICE_ROLE_KEY is available to local scripts."
      : "SUPABASE_SERVICE_ROLE_KEY is not set. Write/import/verify scripts will refuse or skip live checks."
  });
}

async function checkLibraryScriptsOnlyUseSharedTables(checks) {
  const tableReferences = [];
  const protectedReferences = [];
  const disallowedReferences = [];

  for (const script of libraryWriteScripts) {
    const content = await readText(script);
    const tables = extractSupabaseTableReferences(content);

    for (const table of tables) {
      const reference = { script, table };
      tableReferences.push(reference);

      if (protectedUserTables.includes(table)) {
        protectedReferences.push(reference);
      }

      if (!sharedTemplateTables.includes(table)) {
        disallowedReferences.push(reference);
      }
    }
  }

  checks.push({
    area: "Import Safety",
    name: "Course Library write scripts only target shared template tables",
    status: protectedReferences.length === 0 && disallowedReferences.length === 0 ? "pass" : "fail",
    detail:
      protectedReferences.length === 0 && disallowedReferences.length === 0
        ? `Detected table references: ${tableReferences
            .map((reference) => `${reference.script}:${reference.table}`)
            .join(", ")}`
        : `Disallowed references: ${[...protectedReferences, ...disallowedReferences]
            .map((reference) => `${reference.script}:${reference.table}`)
            .join(", ")}`
  });
}

async function checkStaticRlsCoverage(checks) {
  const sql = await readSql();

  for (const table of protectedUserTables) {
    const existsPattern = new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+${table}\\b`, "i");
    const rlsPattern = new RegExp(`alter\\s+table\\s+${table}\\s+enable\\s+row\\s+level\\s+security`, "i");

    checks.push({
      area: "RLS",
      name: `${table} exists`,
      status: existsPattern.test(sql) ? "pass" : "fail",
      detail: `Expected CREATE TABLE IF NOT EXISTS ${table}.`
    });
    checks.push({
      area: "RLS",
      name: `${table} RLS enabled`,
      status: rlsPattern.test(sql) ? "pass" : "fail",
      detail: `Expected ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY.`
    });
  }

  checks.push({
    area: "RLS",
    name: "Course templates are public-read ready-only",
    status:
      /course_templates\s+for\s+select[\s\S]*to\s+anon,\s*authenticated[\s\S]*template_status[\s\S]*ready/i.test(
        sql
      )
        ? "pass"
        : "fail",
    detail: "Public users should only read ready templates."
  });
  checks.push({
    area: "RLS",
    name: "Normal users have no Course Library write policy",
    status: hasNonAdminCourseTemplateWritePolicy(sql) ? "warn" : "pass",
    detail: "Course Library writes should be admin/service role only."
  });
  checks.push({
    area: "RLS",
    name: "Admin can review/import shared templates",
    status:
      /Admins can create course templates[\s\S]*public\.is_admin\(\)/i.test(sql) &&
      /Admins can update course templates[\s\S]*public\.is_admin\(\)/i.test(sql)
        ? "pass"
        : "warn",
    detail: "Admin policies are expected for contribution approval workflows."
  });
}

function hasNonAdminCourseTemplateWritePolicy(sql) {
  return splitSqlStatements(sql).some((statement) => {
    if (!/course_templates\s+for\s+(insert|update|delete)/i.test(statement)) {
      return false;
    }

    if (/to\s+anon/i.test(statement)) {
      return true;
    }

    return /to\s+authenticated/i.test(statement) && !/public\.is_admin\(\)/i.test(statement);
  });
}

function splitSqlStatements(sql) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function checkBackups(checks) {
  if (!fsSync.existsSync(backupDir)) {
    checks.push({
      area: "Backups",
      name: "Course Library backup folder exists",
      status: "fail",
      detail: backupDir
    });
    return;
  }

  const backup = await findLatestCompleteBackup();

  checks.push({
    area: "Backups",
    name: "Course Library backup folder exists",
    status: "pass",
    detail: backupDir
  });
  checks.push({
    area: "Backups",
    name: "Latest backup includes templates and assessments",
    status: backup ? "pass" : "fail",
    detail: backup
      ? `${backup.timestamp}; templates ${backup.templatesCount}, assessments ${backup.assessmentsCount}, materials ${backup.materialsCount}`
      : "No complete course_templates/course_template_assessments backup pair found."
  });

  if (backup) {
    const ageHours = (Date.now() - backup.mtimeMs) / (1000 * 60 * 60);
    checks.push({
      area: "Backups",
      name: "Course Library backup is recent",
      status: ageHours <= 24 * 14 ? "pass" : "warn",
      detail: `Latest complete backup is ${ageHours.toFixed(1)} hours old.`
    });
  }
}

async function checkExistingReports(checks) {
  const productionVerify = await readJson(
    "training-data/course-library-rebuild/production-verify-report.json"
  );
  const sqlLint = await readJson("training-data/launch-audit/sql-lint-report.json");
  const rls = await readJson("training-data/launch-audit/rls-report.json");

  checks.push({
    area: "Verification",
    name: "Production Course Library verify report",
    status:
      productionVerify?.summary?.missing === 0 &&
      productionVerify?.summary?.withoutAssessments === 0 &&
      productionVerify?.summary?.badTotals === 0 &&
      productionVerify?.summary?.duplicateUniqueKeys === 0
        ? "pass"
        : "warn",
    detail: productionVerify?.summary
      ? `matched ${productionVerify.summary.matched}/${productionVerify.summary.expectedImportedTemplates}, public read ${productionVerify.summary.publicReadStatus}`
      : "Run npm run library:verify-production with service-role env."
  });
  checks.push({
    area: "Verification",
    name: "SQL lint report",
    status:
      sqlLint?.summary?.failures === 0
        ? sqlLint.summary.warnings > 0
          ? "warn"
          : "pass"
        : "warn",
    detail: sqlLint?.summary
      ? `${sqlLint.summary.failures} failures, ${sqlLint.summary.warnings} warnings`
      : "Run npm run db:lint-sql."
  });
  checks.push({
    area: "Verification",
    name: "RLS report",
    status: rls?.summary?.failed === 0 ? "pass" : "warn",
    detail: rls?.summary ? `${rls.summary.passed} passed, ${rls.summary.failed} failed` : "Run npm run db:check-rls."
  });
}

function extractSupabaseTableReferences(content) {
  const tables = new Set();
  const patterns = [
    /\.from\(\s*["']([a-z_]+)["']\s*\)/g,
    /fetchAllRows\(\s*supabase\s*,\s*["']([a-z_]+)["']/g,
    /deleteAllRows\(\s*supabase\s*,\s*["']([a-z_]+)["']/g,
    /insertRows\(\s*supabase\s*,\s*["']([a-z_]+)["']/g
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      tables.add(match[1]);
    }
  }

  return Array.from(tables);
}

async function findLatestCompleteBackup() {
  const entries = await fs.readdir(backupDir);
  const templateFiles = entries
    .filter((entry) => /^course_templates_.*\.json$/i.test(entry))
    .sort()
    .reverse();

  for (const templateFile of templateFiles) {
    const timestamp = templateFile
      .replace(/^course_templates_/i, "")
      .replace(/\.json$/i, "");
    const templatePath = path.join(backupDir, templateFile);
    const assessmentsPath = path.join(
      backupDir,
      `course_template_assessments_${timestamp}.json`
    );
    const materialsPath = path.join(backupDir, `course_template_materials_${timestamp}.json`);

    if (!fsSync.existsSync(assessmentsPath)) {
      continue;
    }

    const [templates, assessments, materials] = await Promise.all([
      readJson(templatePath),
      readJson(assessmentsPath),
      fsSync.existsSync(materialsPath) ? readJson(materialsPath) : []
    ]);

    return {
      timestamp,
      templatesCount: Array.isArray(templates) ? templates.length : 0,
      assessmentsCount: Array.isArray(assessments) ? assessments.length : 0,
      materialsCount: Array.isArray(materials) ? materials.length : 0,
      mtimeMs: fsSync.statSync(templatePath).mtimeMs
    };
  }

  return null;
}

async function readSql() {
  const supabaseDir = path.resolve("supabase");
  const entries = await fs.readdir(supabaseDir, { withFileTypes: true });
  const parts = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".sql")) {
      parts.push(await fs.readFile(path.join(supabaseDir, entry.name), "utf8"));
    }
  }

  return parts.join("\n\n");
}

async function readText(filePath) {
  try {
    return await fs.readFile(path.resolve(filePath), "utf8");
  } catch {
    return "";
  }
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(path.resolve(filePath), "utf8"));
  } catch {
    return null;
  }
}

async function walkFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function buildHtml(report) {
  const rows = report.checks
    .map(
      (check) => `<tr class="${check.status}">
        <td>${escapeHtml(check.area)}</td>
        <td>${escapeHtml(check.name)}</td>
        <td>${escapeHtml(check.status)}</td>
        <td>${escapeHtml(check.detail)}</td>
      </tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GradeMate Database Safety</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 18px; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
    .card { border: 1px solid #334155; border-radius: 14px; padding: 16px; background: #111827; }
    .card strong { display: block; font-size: 28px; color: #5eead4; }
    table { width: 100%; border-collapse: collapse; background: #111827; border-radius: 14px; overflow: hidden; }
    th, td { padding: 11px 12px; border-bottom: 1px solid #334155; text-align: left; vertical-align: top; }
    tr.fail td:nth-child(3) { color: #fda4af; font-weight: 700; }
    tr.warn td:nth-child(3) { color: #facc15; font-weight: 700; }
    tr.pass td:nth-child(3) { color: #86efac; font-weight: 700; }
    @media (max-width: 720px) { .cards { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main>
    <h1>GradeMate Database Safety</h1>
    <p>Generated ${escapeHtml(report.generatedAt)}</p>
    <section class="cards">
      <div class="card"><span>Passed</span><strong>${report.summary.passed}</strong></div>
      <div class="card"><span>Warnings</span><strong>${report.summary.warnings}</strong></div>
      <div class="card"><span>Failures</span><strong>${report.summary.failures}</strong></div>
    </section>
    <table>
      <thead><tr><th>Area</th><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
