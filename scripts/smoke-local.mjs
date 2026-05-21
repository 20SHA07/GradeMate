import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

const auditDir = path.resolve("training-data", "launch-audit");
const reportJsonPath = path.join(auditDir, "smoke-report.json");
const reportHtmlPath = path.join(auditDir, "smoke-report.html");

await fs.mkdir(auditDir, { recursive: true });

const checks = [];
await checkStaticExport();
await checkBuiltRoutes();
await checkLandingOutput();
await checkExtractorLabProductionOutput();
await checkAuthCallbackUx();
await checkPasswordAuthUx();
await checkGuestModeConsistency();
await checkCourseLibraryImportUx();
await checkCourseLibraryDetailsModalUx();
await checkSidebarLayoutUx();
await checkContributionSubmissionUx();
await checkAdminCourseLibraryUx();
await checkSyllabusPrivacyUx();
await writeReports();

console.log("GradeMate local smoke check complete");
console.log(`Passed: ${checks.filter((check) => check.status === "pass").length}`);
console.log(`Warnings: ${checks.filter((check) => check.status === "warn").length}`);
console.log(`Failures: ${checks.filter((check) => check.status === "fail").length}`);
console.log(`HTML: ${reportHtmlPath}`);

if (checks.some((check) => check.status === "fail")) {
  process.exitCode = 1;
}

async function checkStaticExport() {
  addCheck({
    area: "Build",
    name: "out directory exists",
    status: fsSync.existsSync(path.resolve("out")) ? "pass" : "fail",
    detail: "Run npm run build before npm run smoke:local."
  });
}

async function checkBuiltRoutes() {
  const routes = [
    ["/", "out/index.html"],
    ["/simple", "out/simple/index.html"],
    ["/course-library", "out/course-library/index.html"],
    ["/workspace", "out/workspace/index.html"],
    ["/auth/callback", "out/auth/callback/index.html"],
    ["/dashboard", "out/dashboard/index.html"],
    ["/admin", "out/admin/index.html"],
    ["/admin/contributions", "out/admin/contributions/index.html"],
    ["/admin/course-library", "out/admin/course-library/index.html"]
  ];

  for (const [route, filePath] of routes) {
    addCheck({
      area: "Routes",
      name: route,
      status: fsSync.existsSync(path.resolve(filePath)) ? "pass" : "fail",
      detail: filePath
    });
  }
}

async function checkLandingOutput() {
  const html = await readText("out/index.html");
  addCheck({
    area: "Landing",
    name: "App landing page rendered",
    status:
      html.includes("GradeMate") &&
      html.includes("Quick GPA Calculator") &&
      html.includes("Course Library") &&
      !html.includes("Getting Started")
        ? "pass"
        : "fail",
    detail: "Static homepage should render the app mode chooser, not README content."
  });
}

async function checkExtractorLabProductionOutput() {
  const html = await readText("out/extractor-lab/index.html");
  addCheck({
    area: "Extractor Lab",
    name: "Production lab is hidden by default",
    status:
      html.includes("Extractor Lab is development-only") ||
      process.env.NEXT_PUBLIC_ENABLE_EXTRACTOR_LAB === "true"
        ? "pass"
        : "warn",
    detail:
      "Extractor Lab should be dev-only unless NEXT_PUBLIC_ENABLE_EXTRACTOR_LAB=true."
  });
}

async function checkAuthCallbackUx() {
  const source = await readText("src/components/auth/auth-callback-client.tsx");
  const builtHtml = await readText("out/auth/callback/index.html");

  addCheck({
    area: "Auth",
    name: "Callback route renders in static export",
    status: builtHtml.includes("Signing you in") ? "pass" : "fail",
    detail: "out/auth/callback/index.html should exist and render the client callback shell."
  });
  addCheck({
    area: "Auth",
    name: "Sign-in link failure has friendly recovery copy",
    status:
      source.includes("This sign-in link expired or was opened in a different browser") &&
      source.includes("Continue as guest") &&
      source.includes("Resend verification email")
        ? "pass"
        : "fail",
    detail:
      "Callback should hide raw Supabase errors and offer login, guest mode, and resend recovery."
  });
  addCheck({
    area: "Auth",
    name: "No raw Supabase PKCE message in callback UI",
    status: source.includes("PKCE code verifier not found in storage")
      ? "fail"
      : "pass",
    detail: "Users should never see the raw Supabase verifier-storage error."
  });
}

async function checkPasswordAuthUx() {
  const source = await readText("src/components/auth/auth-form.tsx");
  const loginHtml = await readText("out/login/index.html");
  const signupHtml = await readText("out/signup/index.html");

  addCheck({
    area: "Auth",
    name: "Login uses password flow",
    status:
      source.includes("signInWithPassword") &&
      !source.includes("signInWithOtp")
        ? "pass"
        : "fail",
    detail: "Normal login should use email/password, not passwordless email links."
  });
  addCheck({
    area: "Auth",
    name: "Signup uses email/password flow",
    status:
      source.includes("signUp") &&
      source.includes("emailRedirectTo: getAuthRedirectUrl()") &&
      source.includes("Resend verification email")
        ? "pass"
        : "fail",
    detail: "Signup should create an email/password account and support resend if confirmation is enabled."
  });
  addCheck({
    area: "Auth",
    name: "Resend verification uses Supabase signup resend",
    status:
      source.includes("supabase.auth.resend") &&
      source.includes('type: "signup"')
        ? "pass"
        : "fail",
    detail: "Resend should use Supabase signup verification email, not passwordless login."
  });
  addCheck({
    area: "Auth",
    name: "Email and password fields render",
    status:
      loginHtml.includes('type="email"') &&
      loginHtml.includes('type="password"') &&
      signupHtml.includes('type="email"') &&
      signupHtml.includes('type="password"')
        ? "pass"
        : "fail",
    detail: "Login and signup pages should render normal email/password inputs."
  });
  addCheck({
    area: "Auth",
    name: "Guest mode remains visible",
    status:
      loginHtml.includes("Continue as guest") &&
      signupHtml.includes("Continue as guest")
        ? "pass"
        : "fail",
    detail: "Auth should never block guest usage."
  });
  addCheck({
    area: "Auth",
    name: "Google login hidden",
    status:
      !loginHtml.includes("Continue with Google") &&
      !signupHtml.includes("Sign up with Google")
        ? "pass"
        : "fail",
    detail: "Google auth is paused and should not appear in the launch UI."
  });
}

async function checkGuestModeConsistency() {
  const dashboardSource = await readText("src/components/dashboard/dashboard-client.tsx");
  const appShellSource = await readText("src/components/navigation/app-shell.tsx");
  const providerSource = await readText(
    "src/components/auth/protected-session-provider.tsx"
  );
  const workspaceStoreSource = await readText("src/lib/data/workspace-store.ts");

  addCheck({
    area: "Auth",
    name: "Logged-in dashboard does not show guest badge",
    status:
      dashboardSource.includes('isGuest ? "Using Guest Mode" : "Synced workspace"') &&
      !dashboardSource.includes('<Badge tone="teal">Using Guest Mode</Badge>')
        ? "pass"
        : "fail",
    detail:
      "Dashboard should show Synced workspace for authenticated users and avoid hardcoded guest badges."
  });
  addCheck({
    area: "Auth",
    name: "Guest dashboard still shows guest badge",
    status:
      dashboardSource.includes('isGuest ? "Using Guest Mode"') &&
      dashboardSource.includes("Save progress")
        ? "pass"
        : "fail",
    detail: "Guest users should still see guest mode and save-progress prompts."
  });
  addCheck({
    area: "Auth",
    name: "Sidebar email and guest state stay consistent",
    status:
      workspaceStoreSource.includes("email: undefined") &&
      appShellSource.includes('{isGuest ? "Guest workspace" : "Signed in as"}') &&
      appShellSource.includes('{isGuest ? "Saved on this device" : user.email}')
        ? "pass"
        : "fail",
    detail:
      "A placeholder guest user should not carry an email, and the shell should branch display on isGuest."
  });
  addCheck({
    area: "Auth",
    name: "No stale guest fallback while session is loading",
    status:
      providerSource.includes('status: "loading"') &&
      providerSource.includes('session ? { status: "authenticated", session } : { status: "guest" }') &&
      !providerSource.includes("authSessionTimeoutMs")
        ? "pass"
        : "fail",
    detail:
      "Auth provider should wait for getSession/onAuthStateChange instead of timing out into guest mode."
  });
}

async function checkCourseLibraryImportUx() {
  const source = await readText(
    "src/components/course-library/course-library-client.tsx"
  );

  addCheck({
    area: "Course Library",
    name: "Guest import uses neutral local-save copy",
    status:
      source.includes("Continue as guest. This course will be saved on this device.") &&
      source.includes("Imported to guest workspace.")
        ? "pass"
        : "fail",
    detail:
      "Normal guest imports should be described as local saves, not account-sync failures."
  });
  addCheck({
    area: "Course Library",
    name: "Logged-in import uses synced workspace copy",
    status:
      source.includes("This course will be saved to your synced workspace.") &&
      source.includes("Imported to your workspace.")
        ? "pass"
        : "fail",
    detail:
      "Authenticated users should see synced-workspace import copy."
  });
  addCheck({
    area: "Course Library",
    name: "No-semester import can create semester inline",
    status:
      source.includes("No semesters yet.") &&
      source.includes("Create one to import this course.") &&
      source.includes("createImportSemester")
        ? "pass"
        : "fail",
    detail:
      "Import modal should not send users away when they need a semester first."
  });
  addCheck({
    area: "Course Library",
    name: "Import failures keep exact details in console",
    status:
      source.includes("Course Library import failed") &&
      source.includes("Course Library workspace load failed") &&
      source.includes("Continue as guest") &&
      source.includes("Please retry.")
        ? "pass"
        : "fail",
    detail:
      "User-facing import failures should stay friendly while console keeps debug context."
  });
}

async function checkCourseLibraryDetailsModalUx() {
  const source = await readText(
    "src/components/course-library/course-library-client.tsx"
  );
  const physTemplate = await readText(
    "training-data/course-library-rebuild/templates/PHYS121_Syllabus_Summer_2025.json"
  );

  addCheck({
    area: "Course Library",
    name: "Details modal is viewport-scrollable",
    status:
      source.includes("fixed inset-0 z-50 overflow-y-auto") &&
      source.includes("max-h-[calc(100dvh-2rem)]") &&
      source.includes("min-h-0 flex-1 overflow-y-auto") &&
      source.includes("lg:sticky lg:top-4") &&
      !source.includes("max-h-[calc(90vh-6rem)]")
        ? "pass"
        : "fail",
    detail:
      "Course detail modal should scroll inside the viewport and keep the action rail reachable."
  });
  addCheck({
    area: "Course Library",
    name: "Details modal supports lower assessment rows",
    status:
      source.includes("detailTemplate.assessments.map") &&
      source.includes("closeOnEscape") &&
      physTemplate.includes("Midterm test") &&
      physTemplate.includes("Final test")
        ? "pass"
        : "fail",
    detail:
      "PHYS 121-style templates with many rows should render all mapped assessments, including lower rows."
  });
  addCheck({
    area: "Course Library",
    name: "Details modal hides source provenance",
    status:
      !source.includes("templateSourceName") &&
      !source.includes("<h3 className=\"font-semibold text-ink-900\">Source</h3>") &&
      !source.includes("source_folder_path}")
        ? "pass"
        : "fail",
    detail:
      "Students should not see internal source file or source folder metadata in Course Library details."
  });
}

async function checkSidebarLayoutUx() {
  const appShellSource = await readText("src/components/navigation/app-shell.tsx");
  const simpleSource = await readText("src/components/simple/simple-gpa-calculator.tsx");

  addCheck({
    area: "Navigation",
    name: "Desktop sidebar stays fixed to viewport",
    status:
      appShellSource.includes("lg:block") &&
      appShellSource.includes("h-dvh w-56 shrink-0 overflow-hidden") &&
      appShellSource.includes("lg:fixed lg:inset-y-0 lg:left-0") &&
      appShellSource.includes("lg:ml-56") &&
      appShellSource.includes("min-h-0 flex-1 space-y-1 overflow-y-auto") &&
      appShellSource.includes("max-h-[48dvh] shrink-0 space-y-3 overflow-y-auto")
        ? "pass"
        : "fail",
    detail:
      "Shared app pages such as Course Library should keep the sidebar bottom actions visible while main content scrolls."
  });
  addCheck({
    area: "Navigation",
    name: "Sidebar account text truncates safely",
    status:
      appShellSource.includes("truncate text-sm font-medium") &&
      appShellSource.includes('<span className="min-w-0 truncate">{item.label}</span>')
        ? "pass"
        : "fail",
    detail:
      "Long user emails and nav labels should not overflow the sidebar."
  });
  addCheck({
    area: "Navigation",
    name: "Syllabus review is contextual, not primary nav",
    status:
      !appShellSource.includes('label: "Syllabus Review"') &&
      !simpleSource.includes("Syllabus Review") &&
      appShellSource.includes('label: "GPA Calculator"')
        ? "pass"
        : "fail",
    detail:
      "Syllabus review should live inside calculator/course flows instead of the main sidebar."
  });
  addCheck({
    area: "GPA Calculator",
    name: "Planner is merged into GPA Calculator",
    status:
      simpleSource.includes("openPlannerFromHeader") &&
      simpleSource.includes("Grade Planner") &&
      simpleSource.includes("Planner")
        ? "pass"
        : "fail",
    detail:
      "Students should open target planning from the GPA Calculator instead of a separate review area."
  });
  addCheck({
    area: "Navigation",
    name: "Simple calculator sidebar uses same viewport shell",
    status:
      simpleSource.includes("min-h-dvh lg:block") &&
      simpleSource.includes("hidden h-dvh w-56 overflow-hidden border-r") &&
      simpleSource.includes("lg:fixed lg:inset-y-0 lg:left-0") &&
      simpleSource.includes("lg:ml-56") &&
      simpleSource.includes("min-h-0 flex-1 content-start gap-1 overflow-y-auto") &&
      simpleSource.includes("max-h-[48dvh] shrink-0 overflow-y-auto")
        ? "pass"
        : "fail",
    detail:
      "The standalone GPA calculator shell should follow the same desktop sidebar behavior."
  });
}

async function checkContributionSubmissionUx() {
  const contributionSource = await readText(
    "src/components/contributions/contribute-syllabus-client.tsx"
  );
  const myContributionsSource = await readText(
    "src/components/contributions/my-contributions-client.tsx"
  );
  const adminContributionsSource = await readText(
    "src/components/contributions/admin-contributions-client.tsx"
  );
  const verifyPublishScript = await readText(
    "scripts/contributions-verify-publish.mjs"
  );
  const courseLibrarySource = await readText(
    "src/components/course-library/course-library-client.tsx"
  );

  addCheck({
    area: "Contributions",
    name: "Contribution success confirmation is explicit",
    status:
      contributionSource.includes("Submission received") &&
      contributionSource.includes("Syllabus submitted for review.") &&
      contributionSource.includes("It will not") &&
      contributionSource.includes("appear in the Course Library until it is approved") &&
      contributionSource.includes("View my submissions") &&
      contributionSource.includes("Submit another syllabus") &&
      contributionSource.includes("Back to Course Library")
        ? "pass"
        : "fail",
    detail:
      "After a successful contribution save, users should see a clear pending-review confirmation and next actions."
  });
  addCheck({
    area: "Contributions",
    name: "Contribution submit prevents double clicks",
    status:
      contributionSource.includes("submitLockRef") &&
      contributionSource.includes("submitLockRef.current || isSubmitting") &&
      contributionSource.includes("submitLockRef.current = true") &&
      contributionSource.includes("submitLockRef.current = false") &&
      contributionSource.includes("Submitting...")
        ? "pass"
        : "fail",
    detail:
      "The submit flow should lock while saving so duplicate clicks cannot create duplicate rows."
  });
  addCheck({
    area: "Contributions",
    name: "Guest contribution path explains local drafts",
    status:
      contributionSource.includes("Please sign in to submit a syllabus for review.") &&
      contributionSource.includes("Continue editing locally") &&
      contributionSource.includes("Saved as a local draft. Sign in to submit for review.")
        ? "pass"
        : "fail",
    detail:
      "Guest users should not silently fail; they should see sign-in and local-draft options."
  });
  addCheck({
    area: "Contributions",
    name: "My Contributions shows pending submissions",
    status:
      myContributionsSource.includes("pending_review") &&
      myContributionsSource.includes("review_notes") &&
      myContributionsSource.includes("Submitted") &&
      myContributionsSource.includes("statusLabel")
        ? "pass"
        : "fail",
    detail:
      "Submitted syllabuses should be visible to the owner with status and reviewer notes."
  });
  addCheck({
    area: "Contributions",
    name: "Admin contribution review can see pending queue",
    status:
      adminContributionsSource.includes('useState<StatusFilter>("pending_review")') &&
      adminContributionsSource.includes('.from("syllabus_contributions")') &&
      adminContributionsSource.includes("Contribution review") &&
      adminContributionsSource.includes("pending_review")
        ? "pass"
        : "fail",
    detail:
      "Pending contributions should remain visible in the protected admin review queue."
  });
  addCheck({
    area: "Contributions",
    name: "Admin can publish approved contributions to Course Library",
    status:
      adminContributionsSource.includes("Replace existing template") &&
      adminContributionsSource.includes("Create new template version") &&
      adminContributionsSource.includes("Mark as latest/canonical") &&
      adminContributionsSource.includes("Approve feedback only") &&
      adminContributionsSource.includes("course_template_versions") &&
      adminContributionsSource.includes("published_template_id") &&
      adminContributionsSource.includes("This will update the shared Course Library template")
        ? "pass"
        : "fail",
    detail:
      "Admin approval should explicitly choose replace/create/latest/feedback-only and save version history."
  });
  addCheck({
    area: "Contributions",
    name: "Contribution publish path avoids private workspace tables",
    status:
      adminContributionsSource.includes("allowedPublishTables") &&
      adminContributionsSource.includes("course_templates") &&
      adminContributionsSource.includes("course_template_assessments") &&
      adminContributionsSource.includes("syllabus_contributions") &&
      !/\.from\("(semesters|courses|assessments)"\)/.test(adminContributionsSource)
        ? "pass"
        : "fail",
    detail:
      "Publishing approved contributions must not write to private user workspace tables."
  });
  addCheck({
    area: "Contributions",
    name: "Contribution publish verification script exists",
    status:
      verifyPublishScript.includes("course_template_versions") &&
      verifyPublishScript.includes("published_template_id") &&
      verifyPublishScript.includes("privateWorkspaceSafety")
        ? "pass"
        : "fail",
    detail:
      "npm run contributions:verify-publish should check published templates and replacement history."
  });
  addCheck({
    area: "Contributions",
    name: "Contributor usernames are supported",
    status:
      contributionSource.includes("Contributor credit") &&
      contributionSource.includes("Save credit") &&
      contributionSource.includes("contributor_username") &&
      adminContributionsSource.includes("contributor_username") &&
      courseLibrarySource.includes("Contributor credit") &&
      courseLibrarySource.includes("templateContributorLabel")
        ? "pass"
        : "fail",
    detail:
      "Contributors should be able to choose a username/display name and receive public-safe Course Library credit."
  });
}

async function checkAdminCourseLibraryUx() {
  const adminPageSource = await readText("src/app/(app)/admin/page.tsx");
  const adminLibrarySource = await readText(
    "src/components/admin/admin-course-library-client.tsx"
  );
  const adminLibrarySql = await readText("supabase/admin-course-library.sql");

  addCheck({
    area: "Admin",
    name: "Admin Course Library manager route is linked",
    status:
      adminPageSource.includes("/admin/course-library") &&
      adminLibrarySource.includes("Course Library Manager")
        ? "pass"
        : "fail",
    detail:
      "Admin landing should link to the shared Course Library template manager."
  });
  addCheck({
    area: "Admin",
    name: "Admin editor only targets shared template tables",
    status:
      adminLibrarySource.includes('.from("course_templates")') &&
      adminLibrarySource.includes('.from("course_template_assessments")') &&
      adminLibrarySource.includes('.from("course_template_materials")') &&
      adminLibrarySource.includes("course_template_versions") &&
      !/\.from\("(semesters|courses|assessments)"\)/.test(adminLibrarySource)
        ? "pass"
        : "fail",
    detail:
      "Manual admin library edits must not touch private workspace tables."
  });
  addCheck({
    area: "Admin",
    name: "Admin can permanently remove shared templates",
    status:
      adminLibrarySource.includes("Remove permanently") &&
      adminLibrarySource.includes("deleteTemplatePermanently") &&
      adminLibrarySource.includes("It does not change courses students already imported") &&
      adminLibrarySource.includes('.from("course_templates")') &&
      adminLibrarySource.includes(".delete()") &&
      adminLibrarySql.includes("Admins can delete course templates")
        ? "pass"
        : "fail",
    detail:
      "Admin template removal should be explicit, confirmed, and limited to shared Course Library templates."
  });
  addCheck({
    area: "Admin",
    name: "Admin Course Library RLS migration exists",
    status:
      adminLibrarySql.includes("Admins can view all course templates") &&
      adminLibrarySql.includes("Admins can create template materials") &&
      adminLibrarySql.includes("public.is_admin()")
        ? "pass"
        : "fail",
    detail:
      "The admin editor needs policies for non-ready templates and material rows."
  });
}

async function checkSyllabusPrivacyUx() {
  const simpleSource = await readText("src/components/simple/simple-gpa-calculator.tsx");
  const workspaceSource = await readText("src/components/courses/course-detail-client.tsx");
  const verifiedSource = await readText("src/lib/syllabus/verified-extractions.ts");
  const contributionSource = await readText(
    "src/components/contributions/contribute-syllabus-client.tsx"
  );
  const cleanupScript = await readText("scripts/storage-cleanup-syllabi.mjs");

  addCheck({
    area: "Privacy",
    name: "Simple PDF extraction has no storage upload",
    status:
      !/storage\s*\.\s*from|\.upload\s*\(|course-syllabi/i.test(simpleSource)
        ? "pass"
        : "fail",
    detail: "Simple Mode should read PDFs locally and never upload them during normal extraction."
  });
  addCheck({
    area: "Privacy",
    name: "Workspace PDF extraction has no storage upload",
    status:
      !/storage\s*\.\s*from|\.upload\s*\(|course-syllabi/i.test(workspaceSource)
        ? "pass"
        : "fail",
    detail: "Workspace extraction should read PDFs locally and never upload them during normal extraction."
  });
  addCheck({
    area: "Privacy",
    name: "Confirm save clears PDF state",
    status:
      simpleSource.includes("setPdfFileByCourse") &&
      simpleSource.includes("Saved. The PDF was not stored.") &&
      workspaceSource.includes("setFile(null)") &&
      workspaceSource.includes("Saved. The PDF was not stored.")
        ? "pass"
        : "fail",
    detail: "Saving reviewed PDF extraction should discard file state and show the privacy confirmation."
  });
  addCheck({
    area: "Privacy",
    name: "Verified feedback saves JSON/hash by default",
    status:
      verifiedSource.includes("includeExtractedText === true") &&
      verifiedSource.includes("sourceTextForHash")
        ? "pass"
        : "fail",
    detail: "Raw extracted text should be stored only when the user checks the opt-in box."
  });
  addCheck({
    area: "Privacy",
    name: "Contribute syllabus is the only PDF storage exception",
    status:
      contributionSource.includes(
        "Contribution uploads may be stored privately for admin review."
      ) &&
      contributionSource.includes("allowAdminReviewStorage") &&
      !/storage\s*\.\s*from|\.upload\s*\(/i.test(simpleSource + workspaceSource)
        ? "pass"
        : "fail",
    detail: "Only contribution review flow may ask to store syllabus source files."
  });
  addCheck({
    area: "Privacy",
    name: "Storage cleanup dry-run exists",
    status:
      cleanupScript.includes("const dryRun = !confirmed") &&
      cleanupScript.includes("syllabus_contributions") &&
      cleanupScript.includes("course-syllabi")
        ? "pass"
        : "fail",
    detail: "storage:cleanup-syllabi should default to dry-run and require --confirm to delete files."
  });
}

async function writeReports() {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      passed: checks.filter((check) => check.status === "pass").length,
      warnings: checks.filter((check) => check.status === "warn").length,
      failures: checks.filter((check) => check.status === "fail").length
    },
    checks
  };

  await fs.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(reportHtmlPath, buildHtml(report), "utf8");
}

async function readText(filePath) {
  try {
    return await fs.readFile(path.resolve(filePath), "utf8");
  } catch {
    return "";
  }
}

function addCheck(check) {
  checks.push(check);
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
  <title>GradeMate Smoke Report</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 18px; }
    table { width: 100%; border-collapse: collapse; background: #111827; border-radius: 14px; overflow: hidden; }
    th, td { padding: 12px; border-bottom: 1px solid #334155; text-align: left; }
    tr.pass td:nth-child(3) { color: #86efac; font-weight: 700; }
    tr.warn td:nth-child(3) { color: #facc15; font-weight: 700; }
    tr.fail td:nth-child(3) { color: #fda4af; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>GradeMate Smoke Report</h1>
    <p>${report.summary.passed} passed, ${report.summary.warnings} warnings, ${report.summary.failures} failures.</p>
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
