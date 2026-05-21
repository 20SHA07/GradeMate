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
await checkAuthFriendTestReadiness();
await checkCourseLibraryReports();
await checkDatabaseSql();
await checkDatabaseSafetyReports();
await checkSyllabusPrivacy();
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
    "library:import-rebuilt:dry",
    "library:import-rebuilt",
    "library:restore-backup",
    "library:restore-backup:dry",
    "library:verify-production",
    "storage:cleanup-syllabi",
    "storage:cleanup-syllabi:dry",
    "launch:audit",
    "db:safety-check",
    "db:lint-sql",
    "db:check-rls",
    "user-data:backup-counts",
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
    ["Auth Callback", "src/app/(auth)/auth/callback/page.tsx"],
    ["Simple Mode", "src/app/simple/page.tsx"],
    ["Workspace", "src/app/(app)/workspace/page.tsx"],
    ["Dashboard", "src/app/(app)/dashboard/page.tsx"],
    ["Course Library", "src/app/(app)/course-library/page.tsx"],
    ["Contribute Syllabus", "src/app/(app)/contribute-syllabus/page.tsx"],
    ["Admin", "src/app/(app)/admin/page.tsx"],
    ["Admin Course Library", "src/app/(app)/admin/course-library/page.tsx"],
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

async function checkAuthFriendTestReadiness() {
  const formSource = await readText("src/components/auth/auth-form.tsx");
  const callbackSource = await readText("src/components/auth/auth-callback-client.tsx");

  addCheck({
    area: "Auth",
    name: "Password login enabled",
    status:
      formSource.includes("signInWithPassword") && !formSource.includes("signInWithOtp")
        ? "pass"
        : "fail",
    detail: "Login should use Supabase email/password auth, not passwordless email links."
  });
  addCheck({
    area: "Auth",
    name: "Signup uses email/password redirect",
    status:
      formSource.includes("signUp") &&
      formSource.includes("password") &&
      formSource.includes("emailRedirectTo: getAuthRedirectUrl()")
        ? "pass"
        : "fail",
    detail: "Signup should use email/password with the static GitHub Pages callback URL."
  });
  addCheck({
    area: "Auth",
    name: "Guest mode enabled",
    status:
      formSource.includes("Continue as guest") &&
      callbackSource.includes("Continue as guest")
        ? "pass"
        : "fail",
    detail: "Auth failures should never block local guest mode."
  });
  addCheck({
    area: "Auth",
    name: "Google login hidden",
    status:
      !formSource.includes("Continue with Google") &&
      !formSource.includes("Sign up with Google") &&
      !formSource.includes("signInWithGoogle")
        ? "pass"
        : "fail",
    detail: "Google auth is paused for friend testing."
  });
  addCheck({
    area: "Auth",
    name: "Auth callback errors are friendly",
    status:
      callbackSource.includes(
        "This sign-in link expired or was opened in a different browser. Please log in again."
      ) && !callbackSource.includes("PKCE code verifier not found in storage")
        ? "pass"
        : "fail",
    detail: "Callback should hide raw Supabase PKCE/session storage errors."
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
    "supabase/verified-extractions.sql",
    "supabase/course-template-versions.sql",
    "supabase/admin-course-library.sql"
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

async function checkDatabaseSafetyReports() {
  const safety = await readJson("training-data/launch-audit/db-safety-report.json");
  const lint = await readJson("training-data/launch-audit/sql-lint-report.json");
  const rls = await readJson("training-data/launch-audit/rls-report.json");
  const userCounts = await readJson("training-data/launch-audit/user-data-counts.json");
  const latestBackup = await findLatestCourseLibraryBackup();

  addCheck({
    area: "Database Safety",
    name: "db:safety-check report",
    status:
      safety?.summary?.failures === 0
        ? safety.summary.warnings > 0
          ? "warn"
          : "pass"
        : "warn",
    detail: safety?.summary
      ? `${safety.summary.passed} passed, ${safety.summary.warnings} warnings, ${safety.summary.failures} failures`
      : "Run npm run db:safety-check."
  });
  addCheck({
    area: "Database Safety",
    name: "db:lint-sql report",
    status:
      lint?.summary?.failures === 0
        ? lint.summary.warnings > 0
          ? "warn"
          : "pass"
        : "warn",
    detail: lint?.summary
      ? `${lint.summary.failures} failures, ${lint.summary.warnings} warnings`
      : "Run npm run db:lint-sql."
  });
  addCheck({
    area: "Database Safety",
    name: "db:check-rls report",
    status: rls?.summary?.failed === 0 ? "pass" : "warn",
    detail: rls?.summary
      ? `${rls.summary.passed} passed, ${rls.summary.failed} failed`
      : "Run npm run db:check-rls."
  });
  addCheck({
    area: "Database Safety",
    name: "Course Library backup exists",
    status: latestBackup ? "pass" : "fail",
    detail: latestBackup
      ? `${latestBackup.timestamp}; templates ${latestBackup.templates}, assessments ${latestBackup.assessments}, materials ${latestBackup.materials}`
      : "Run npm run library:export-current before real imports."
  });
  addCheck({
    area: "Database Safety",
    name: "User data count snapshot",
    status: userCounts?.status === "ok" || userCounts?.status === "skipped" ? "pass" : "warn",
    detail: userCounts
      ? `${userCounts.status}: ${userCounts.privacy}`
      : "Run npm run user-data:backup-counts when service-role env is available."
  });
}

async function checkSyllabusPrivacy() {
  const normalExtractionFiles = [
    "src/components/simple/simple-gpa-calculator.tsx",
    "src/components/courses/course-detail-client.tsx"
  ];
  const storagePatterns = [/storage\s*\.\s*from/i, /\.upload\s*\(/i, /course-syllabi/i];
  const storageMatches = [];

  for (const filePath of normalExtractionFiles) {
    const content = await readText(filePath);
    if (storagePatterns.some((pattern) => pattern.test(content))) {
      storageMatches.push(filePath);
    }
  }

  addCheck({
    area: "Privacy",
    name: "Normal PDF extraction does not upload files",
    status: storageMatches.length === 0 ? "pass" : "fail",
    detail:
      storageMatches.length === 0
        ? "Simple and Workspace extraction components have no Supabase Storage upload calls."
        : `Review storage references in: ${storageMatches.join(", ")}`
  });

  const simpleSource = await readText("src/components/simple/simple-gpa-calculator.tsx");
  const workspaceSource = await readText("src/components/courses/course-detail-client.tsx");

  addCheck({
    area: "Privacy",
    name: "Normal extraction clears PDF state after save",
    status:
      simpleSource.includes("setPdfFileByCourse") &&
      simpleSource.includes("Saved. The PDF was not stored.") &&
      workspaceSource.includes("setFile(null)") &&
      workspaceSource.includes("Saved. The PDF was not stored.")
        ? "pass"
        : "fail",
    detail: "Confirm-save paths should clear the selected PDF File object and show privacy confirmation."
  });

  const verifiedSource = await readText("src/lib/syllabus/verified-extractions.ts");
  addCheck({
    area: "Privacy",
    name: "Verified feedback stores raw text only by opt-in",
    status:
      verifiedSource.includes("includeExtractedText === true") &&
      verifiedSource.includes("source_text_hash")
        ? "pass"
        : "fail",
    detail: "Verified examples should save JSON/hash by default and store extracted text only with explicit opt-in."
  });

  const contributionSource = await readText(
    "src/components/contributions/contribute-syllabus-client.tsx"
  );
  addCheck({
    area: "Privacy",
    name: "Contribution flow asks before private review storage",
    status:
      contributionSource.includes(
        "Contribution uploads may be stored privately for admin review."
      ) && contributionSource.includes("allowAdminReviewStorage")
        ? "pass"
        : "fail",
    detail: "Contribution PDF flow should clearly distinguish admin review storage from normal extraction."
  });

  addCheck({
    area: "Privacy",
    name: "Syllabus storage cleanup script",
    status:
      fsSync.existsSync(path.resolve("scripts/storage-cleanup-syllabi.mjs")) &&
      (await readText("package.json")).includes("storage:cleanup-syllabi:dry")
        ? "pass"
        : "fail",
    detail: "Cleanup script should dry-run by default and require --confirm for deletion."
  });
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

async function findLatestCourseLibraryBackup() {
  const courseLibraryBackupDir = path.resolve("training-data", "course-library-backups");

  if (!fsSync.existsSync(courseLibraryBackupDir)) {
    return null;
  }

  const entries = await fs.readdir(courseLibraryBackupDir);
  const templateFiles = entries
    .filter((entry) => /^course_templates_.*\.json$/i.test(entry))
    .sort()
    .reverse();

  for (const templateFile of templateFiles) {
    const timestamp = templateFile
      .replace(/^course_templates_/i, "")
      .replace(/\.json$/i, "");
    const assessmentsPath = path.join(
      courseLibraryBackupDir,
      `course_template_assessments_${timestamp}.json`
    );
    const materialsPath = path.join(
      courseLibraryBackupDir,
      `course_template_materials_${timestamp}.json`
    );

    if (!fsSync.existsSync(assessmentsPath)) {
      continue;
    }

    return {
      timestamp,
      templates: await countJsonArray(path.join(courseLibraryBackupDir, templateFile)),
      assessments: await countJsonArray(assessmentsPath),
      materials: fsSync.existsSync(materialsPath) ? await countJsonArray(materialsPath) : 0
    };
  }

  return null;
}

async function countJsonArray(filePath) {
  try {
    const value = JSON.parse(await fs.readFile(filePath, "utf8"));
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
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
