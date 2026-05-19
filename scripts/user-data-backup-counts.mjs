import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceConfig,
  htmlEscape
} from "./library-rebuild-utils.mjs";

const auditDir = path.resolve("training-data", "launch-audit");
const reportJsonPath = path.join(auditDir, "user-data-counts.json");
const reportHtmlPath = path.join(auditDir, "user-data-counts.html");
const userTables = [
  "profiles",
  "semesters",
  "courses",
  "assessments",
  "verified_extractions",
  "syllabus_contributions",
  "contribution_assessments"
];

await fs.mkdir(auditDir, { recursive: true });

try {
  const report = await buildCountsReport();

  await fs.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(reportHtmlPath, buildHtml(report), "utf8");

  console.log("GradeMate user data count report complete");
  console.log(`Status: ${report.status}`);
  console.log(`JSON: ${reportJsonPath}`);
  console.log(`HTML: ${reportHtmlPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function buildCountsReport() {
  let config;

  try {
    config = getSupabaseServiceConfig();
  } catch (error) {
    return {
      generatedAt: new Date().toISOString(),
      status: "skipped",
      message:
        error instanceof Error
          ? error.message
          : "Supabase service role env is not configured.",
      privacy: "No private rows were exported. This report contains counts only.",
      tables: userTables.map((table) => ({ table, count: null, status: "skipped" }))
    };
  }

  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false }
  });
  const tables = [];

  for (const table of userTables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    tables.push({
      table,
      count: count ?? null,
      status: error ? "error" : "ok",
      error: error?.message ?? null
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    status: tables.some((table) => table.status === "error") ? "warning" : "ok",
    privacy: "No private rows were exported. This report contains counts only.",
    tables
  };
}

function buildHtml(report) {
  const rows = report.tables
    .map(
      (row) => `<tr class="${row.status}">
        <td>${htmlEscape(row.table)}</td>
        <td>${htmlEscape(row.count ?? "-")}</td>
        <td>${htmlEscape(row.status)}</td>
        <td>${htmlEscape(row.error ?? "")}</td>
      </tr>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GradeMate User Data Counts</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    main { max-width: 900px; margin: 0 auto; padding: 32px 18px; }
    table { width: 100%; border-collapse: collapse; background: #111827; border-radius: 14px; overflow: hidden; }
    td, th { padding: 11px 12px; border-bottom: 1px solid #334155; text-align: left; }
    tr.error td:nth-child(3) { color: #fda4af; font-weight: 700; }
    tr.ok td:nth-child(3) { color: #86efac; font-weight: 700; }
    tr.skipped td:nth-child(3) { color: #facc15; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>GradeMate User Data Counts</h1>
    <p>${htmlEscape(report.privacy)}</p>
    <p>Status: <strong>${htmlEscape(report.status)}</strong></p>
    <table>
      <thead><tr><th>Table</th><th>Count</th><th>Status</th><th>Note</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
}
