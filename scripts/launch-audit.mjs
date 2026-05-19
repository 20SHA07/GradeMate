import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

const auditDir = path.resolve("training-data", "launch-audit");
const reportJsonPath = path.join(auditDir, "report.json");
const reportHtmlPath = path.join(auditDir, "report.html");

const checks = [];

await fs.mkdir(auditDir, { recursive: true });

await checkPackageScripts();
await checkRoutes();
await checkHomepage();
await checkNoProductionAiWording();
await checkSupabaseEnvAndSecrets();
await checkCourseLibraryReports();
await checkDatabaseSql();
await writeReports();

const failed = checks.filter((check) => check.status === "fail").length;
const warnings = checks.filter((check) => check.status === "warn").length;

console.log("GradeMate launch audit complete");
console.log(`Ready checks: ${checks.filter((check) => check.status === "pass").length}`);
console.log(`Warnings: ${warnings}`);
console.log(`Failures: ${failed}`);
console.log(`HTML: ${reportHtmlPath}`);

if (failed > 0) {
  process.exitCode = 1;
}

async function checkPackageScripts() {
  const pkg = await readJson("package.json");
  const requiredScripts = [
    "build",
    "typecheck",
    "test:extraction",
    "test:dataset",
    "library:rebuild",
    "library:review",
    "library:verify-production",
    "launch:audit",
    "db:check-rls",
    "smoke:local"
  ];

  for (const script of requiredScripts) {
    addCheck({
      area: "Scripts",
      name: `npm run ${script}`,
      status: pkg?.scripts?.[script] ? "pass" : "fail",
      detail: pkg?.scripts?.[script] ?? "Missing package script."
    });
  }
}

async function checkRoutes() {
  const routes = [
    ["Landing", "src/app/page.tsx"],
    ["Simple Mode", "src/app/simple/page.tsx"],
    ["Workspace", "src/app/(app)/workspace/page.tsx"],
    ["Dashboard", "src/app/(app)/dashboard/page.tsx"],
    ["Course Library", "src/app/(app)/course-library/page.tsx"],
    ["Contribute Syllabus", "src/app/(app)/contribute-syllabus/page.tsx"],
    ["Admin", "src/app/(app)/admin/page.tsx"],
    ["Admin Contributions", "src/app/(app)/admin/contributions/page.tsx"],
    ["Extractor Lab", "src/app/extractor-lab/page.tsx"]
  ];

  for (const [name, filePath] of routes) {
    addCheck({
      area: "Routes",
      name,
      status: fsSync.existsSync(path.resolve(filePath)) ? "pass" : "fail",
      detail: filePath
    });
  }
}

async function checkHomepage() {
  const content = await readText("src/app/page.tsx");

  addCheck({
    area: "Landing",
    name: "Mode chooser content",
    status:
      content.includes("Quick GPA Calculator") &&
      content.includes("Workspace") &&
      content.includes("Course Library")
        ? "pass"
        : "fail",
    detail: "Landing page should show quick calculator, workspace, and library choices."
  });
  addCheck({
    area: "Landing",
    name: "No README/docs landing",
    status:
      /Getting Started|Stack|Routes/i.test(content) && !content.includes("Quick GPA Calculator")
        ? "fail"
        : "pass",
    detail: "Homepage source does not look like README documentation."
  });
}

async function checkNoProductionAiWording() {
  const matches = [];
  const patterns = [
    /AI assist/i,
    /Improved with online AI/i,
    /Edge Function/i,
    /Local AI is not running/i,
    /Gemini/i,
    /Ollama/i
  ];

  for (const filePath of await walkFiles(path.resolve("src"))) {
    if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      continue;
    }

    const content = await fs.readFile(filePath, "utf8");
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        matches.push(path.relative(process.cwd(), filePath));
        break;
      }
    }
  }

  addCheck({
    area: "Extraction",
    name: "No normal production AI failure wording",
    status: matches.length === 0 ? "pass" : "warn",
    detail:
      matches.length === 0
        ? "No blocked AI/Edge Function wording found in src."
        : `Review wording in: ${matches.slice(0, 8).join(", ")}`
  });
}

async function checkSupabaseEnvAndSecrets() {
  const frontendFiles = await walkFiles(path.resolve("src"));
  const serviceRoleMatches = [];

  for (const filePath of frontendFiles) {
    if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      continue;
    }

    const content = await fs.readFile(filePath, "utf8");
    if (/SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY/i.test(content)) {
      serviceRoleMatches.push(path.relative(process.cwd(), filePath));
    }
  }

  addCheck({
    area: "Supabase",
    name: "Service role key not referenced in frontend",
    status: serviceRoleMatches.length === 0 ? "pass" : "fail",
    detail:
      serviceRoleMatches.length === 0
        ? "Frontend source does not reference service-role secrets."
        : serviceRoleMatches.join(", ")
  });

  const config = await readText("src/lib/supabase/config.ts");
  addCheck({
    area: "Supabase",
    name: "Public env config exists",
    status:
      config.includes("NEXT_PUBLIC_SUPABASE_URL") &&
      /NEXT_PUBLIC_SUPABASE_(PUBLISHABLE_KEY|ANON_KEY)/.test(config)
        ? "pass"
        : "fail",
    detail: "Frontend reads only public Supabase URL and publishable/anon key."
  });
}

async function checkCourseLibraryReports() {
  const review = await readJson("training-data/course-library-rebuild/review-report.json");
  const verify = await readJson(
    "training-data/course-library-rebuild/production-verify-report.json"
  );

  addCheck({
    area: "Course Library",
    name: "Rebuild canonical ready templates",
    status: review?.summary?.canonicalReady >= 74 ? "pass" : "warn",
    detail: review?.summary
      ? `${review.summary.canonicalReady} canonical ready / ${review.summary.ready} ready / ${review.summary.needsReview} needs review`
      : "Run npm run library:rebuild and npm run library:review."
  });

  addCheck({
    area: "Course Library",
    name: "Production verification",
    status:
      verify?.summary?.expectedImportedTemplates === 74 &&
      verify?.summary?.matched === 74 &&
      verify?.summary?.missing === 0 &&
      verify?.summary?.withoutAssessments === 0 &&
      verify?.summary?.badTotals === 0 &&
      verify?.summary?.duplicateUniqueKeys === 0
        ? "pass"
        : "warn",
    detail: verify?.summary
      ? `matched ${verify.summary.matched}/${verify.summary.expectedImportedTemplates}, public read ${verify.summary.publicReadStatus}`
      : "Run npm run library:verify-production with Supabase service-role env."
  });
}

async function checkDatabaseSql() {
  const sqlFiles = [
    "supabase/schema.sql",
    "supabase/course-template-unique-key.sql",
    "supabase/public-course-library-rls.sql",
    "supabase/syllabus-contributions.sql",
    "supabase/verified-extractions.sql"
  ];

  for (const filePath of sqlFiles) {
    addCheck({
      area: "Database",
      name: path.basename(filePath),
      status: fsSync.existsSync(path.resolve(filePath)) ? "pass" : "fail",
      detail: filePath
    });
  }
}

async function writeReports() {
  const summary = {
    generatedAt: new Date().toISOString(),
    ready: checks.filter((check) => check.status === "pass").length,
    warnings: checks.filter((check) => check.status === "warn").length,
    failures: checks.filter((check) => check.status === "fail").length
  };
  const report = {
    summary,
    checks,
    needsActionBeforeSharing: checks.filter((check) => check.status === "fail"),
    optionalReview: checks.filter((check) => check.status === "warn")
  };

  await fs.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(reportHtmlPath, buildHtml(report), "utf8");
}

function addCheck(check) {
  checks.push(check);
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(path.resolve(filePath), "utf8"));
  } catch {
    return null;
  }
}

async function readText(filePath) {
  try {
    return await fs.readFile(path.resolve(filePath), "utf8");
  } catch {
    return "";
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
      (check) => `
        <tr class="${check.status}">
          <td>${escapeHtml(check.area)}</td>
          <td>${escapeHtml(check.name)}</td>
          <td>${escapeHtml(check.status)}</td>
          <td>${escapeHtml(check.detail)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GradeMate Launch Audit</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 18px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
    .card { border: 1px solid #334155; border-radius: 14px; padding: 16px; background: #111827; }
    .card strong { display: block; font-size: 28px; color: #5eead4; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 14px; background: #111827; }
    th, td { padding: 11px 12px; border-bottom: 1px solid #334155; text-align: left; vertical-align: top; }
    th { color: #94a3b8; font-size: 12px; text-transform: uppercase; }
    tr.fail td:nth-child(3) { color: #fda4af; font-weight: 700; }
    tr.warn td:nth-child(3) { color: #facc15; font-weight: 700; }
    tr.pass td:nth-child(3) { color: #86efac; font-weight: 700; }
    @media (max-width: 720px) { .cards { grid-template-columns: 1fr; } table { font-size: 13px; } }
  </style>
</head>
<body>
  <main>
    <h1>GradeMate Launch Audit</h1>
    <p>Generated ${escapeHtml(report.summary.generatedAt)}</p>
    <section class="cards">
      <div class="card"><span>Ready</span><strong>${report.summary.ready}</strong></div>
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
