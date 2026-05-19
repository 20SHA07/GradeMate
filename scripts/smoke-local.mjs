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
    ["/admin/contributions", "out/admin/contributions/index.html"]
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
    status: builtHtml.includes("Confirming your account") ? "pass" : "fail",
    detail: "out/auth/callback/index.html should exist and render the client callback shell."
  });
  addCheck({
    area: "Auth",
    name: "PKCE failure has friendly recovery copy",
    status:
      source.includes("We could not complete this sign-in link") &&
      source.includes("Continue as guest") &&
      source.includes("Resend confirmation email")
        ? "pass"
        : "fail",
    detail:
      "Callback should hide raw PKCE errors and offer login, guest mode, and resend recovery."
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
