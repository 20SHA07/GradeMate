import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

const auditDir = path.resolve("training-data", "launch-audit");
const reportJsonPath = path.join(auditDir, "sql-lint-report.json");
const reportHtmlPath = path.join(auditDir, "sql-lint-report.html");
const protectedTables = [
  "semesters",
  "courses",
  "assessments",
  "verified_extractions",
  "syllabus_contributions",
  "contribution_assessments",
  "profiles"
];
const safeCommentPattern = /SAFE_MIGRATION_EXPLAIN:/i;

await fs.mkdir(auditDir, { recursive: true });

try {
  const findings = await lintSqlFiles();
  const report = {
    generatedAt: new Date().toISOString(),
    protectedTables,
    summary: {
      filesScanned: new Set(findings.map((finding) => finding.file)).size,
      failures: findings.filter((finding) => finding.severity === "fail").length,
      warnings: findings.filter((finding) => finding.severity === "warn").length,
      passed: findings.length === 0
    },
    findings
  };

  await fs.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(reportHtmlPath, buildHtml(report), "utf8");

  console.log("GradeMate SQL lint complete");
  console.log(`Failures: ${report.summary.failures}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  console.log(`HTML: ${reportHtmlPath}`);

  if (report.summary.failures > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function lintSqlFiles() {
  const supabaseDir = path.resolve("supabase");

  if (!fsSync.existsSync(supabaseDir)) {
    throw new Error("supabase/ folder not found.");
  }

  const entries = await fs.readdir(supabaseDir, { withFileTypes: true });
  const findings = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) {
      continue;
    }

    const filePath = path.join(supabaseDir, entry.name);
    const content = await fs.readFile(filePath, "utf8");
    findings.push(...lintStatements(path.relative(process.cwd(), filePath), content));
  }

  return findings;
}

function lintStatements(file, content) {
  const findings = [];
  const lines = content.split(/\r?\n/);
  let statement = "";
  let startLine = 1;

  lines.forEach((line, index) => {
    if (!statement.trim()) {
      startLine = index + 1;
    }

    statement += `${line}\n`;

    if (!line.includes(";")) {
      return;
    }

    findings.push(...lintStatement({ file, line: startLine, statement }));
    statement = "";
  });

  if (statement.trim()) {
    findings.push(...lintStatement({ file, line: startLine, statement }));
  }

  return findings;
}

function lintStatement({ file, line, statement }) {
  const normalized = statement.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  const safe = safeCommentPattern.test(statement);
  const findings = [];

  for (const table of protectedTables) {
    const tablePattern = tablePatternFor(table);

    if (new RegExp(`\\bdrop\\s+table\\b[\\s\\S]*${tablePattern}`, "i").test(normalized)) {
      findings.push(finding(file, line, "fail", `DROP TABLE on protected table ${table}`, normalized, safe));
    }

    if (new RegExp(`\\bdelete\\s+from\\s+(public\\.)?${table}\\b`, "i").test(normalized)) {
      findings.push(finding(file, line, "fail", `DELETE FROM protected table ${table}`, normalized, safe));
    }

    if (
      new RegExp(`\\balter\\s+table\\s+(public\\.)?${table}\\b[\\s\\S]*\\bdrop\\s+column\\b`, "i").test(
        normalized
      )
    ) {
      findings.push(finding(file, line, "fail", `DROP COLUMN on protected table ${table}`, normalized, safe));
    }

    if (
      new RegExp(`\\bdrop\\s+policy\\b[\\s\\S]*\\bon\\s+(public\\.)?${table}\\b`, "i").test(
        normalized
      ) &&
      !safe
    ) {
      findings.push(
        finding(
          file,
          line,
          "warn",
          `DROP POLICY on protected table ${table} should include SAFE_MIGRATION_EXPLAIN when policy replacement is intentional`,
          normalized,
          safe
        )
      );
    }
  }

  if (/\btruncate\b/i.test(lower)) {
    findings.push(finding(file, line, "fail", "TRUNCATE is not allowed in migrations", normalized, safe));
  }

  if (/\balter\s+table\b[\s\S]*\bdisable\s+row\s+level\s+security\b/i.test(normalized)) {
    findings.push(
      finding(file, line, "fail", "Disabling row level security is not allowed", normalized, safe)
    );
  }

  return findings.filter((item) => !item.safeOverride || item.severity === "warn");
}

function tablePatternFor(table) {
  return `\\b(public\\.)?${table}\\b`;
}

function finding(file, line, severity, message, statement, safeOverride) {
  return {
    file,
    line,
    severity: safeOverride && severity === "fail" ? "warn" : severity,
    safeOverride,
    message,
    statement: statement.slice(0, 500)
  };
}

function buildHtml(report) {
  const rows =
    report.findings
      .map(
        (finding) => `<tr class="${finding.severity}">
          <td>${escapeHtml(finding.severity)}</td>
          <td>${escapeHtml(finding.file)}:${finding.line}</td>
          <td>${escapeHtml(finding.message)}</td>
          <td><code>${escapeHtml(finding.statement)}</code></td>
        </tr>`
      )
      .join("\n") ||
    `<tr><td colspan="4">No dangerous SQL operations found.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GradeMate SQL Lint</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 18px; }
    table { width: 100%; border-collapse: collapse; background: #111827; border-radius: 14px; overflow: hidden; }
    td, th { padding: 11px 12px; border-bottom: 1px solid #334155; text-align: left; vertical-align: top; }
    tr.fail td:first-child { color: #fda4af; font-weight: 700; }
    tr.warn td:first-child { color: #facc15; font-weight: 700; }
    code { color: #bae6fd; white-space: pre-wrap; }
  </style>
</head>
<body>
  <main>
    <h1>GradeMate SQL Lint</h1>
    <p>${report.summary.failures} failures, ${report.summary.warnings} warnings.</p>
    <table>
      <thead><tr><th>Severity</th><th>Location</th><th>Finding</th><th>Statement</th></tr></thead>
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
