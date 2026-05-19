import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServiceConfig,
  htmlEscape
} from "./library-rebuild-utils.mjs";

const auditDir = path.resolve("training-data", "launch-audit");
const reportJsonPath = path.join(auditDir, "storage-cleanup-syllabi-report.json");
const reportHtmlPath = path.join(auditDir, "storage-cleanup-syllabi-report.html");

const args = process.argv.slice(2);
const confirmed = args.includes("--confirm");
const dryRun = !confirmed || args.includes("--dry-run");
const days = getNumberArg("--days", 30);
const bucket = getStringArg("--bucket", "course-syllabi");
const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

await fs.mkdir(auditDir, { recursive: true });

const report = {
  bucket,
  cutoff,
  days,
  deletedPaths: [],
  dryRun,
  errors: [],
  generatedAt: new Date().toISOString(),
  candidates: [],
  skipped: [],
  warnings: [],
  summary: {
    candidates: 0,
    deleted: 0,
    dryRun,
    skipped: 0,
    updatedContributionRows: 0
  }
};

try {
  const { supabaseUrl, serviceRoleKey } = getSupabaseServiceConfig();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const { data, error } = await supabase
    .from("syllabus_contributions")
    .select("id,status,created_at,syllabus_file_name,syllabus_file_path")
    .in("status", ["pending_review", "rejected"])
    .lt("created_at", cutoff)
    .not("syllabus_file_path", "is", null);

  if (error) {
    throw new Error(`syllabus_contributions: ${error.message}`);
  }

  const rows = data ?? [];

  for (const row of rows) {
    const normalizedPath = normalizeStoragePath(row.syllabus_file_path, bucket);
    const entry = {
      contributionId: row.id,
      createdAt: row.created_at,
      fileName: row.syllabus_file_name,
      originalPath: row.syllabus_file_path,
      status: row.status,
      storagePath: normalizedPath.path
    };

    if (!normalizedPath.safe) {
      report.skipped.push({
        ...entry,
        reason: normalizedPath.reason
      });
      continue;
    }

    report.candidates.push(entry);
  }

  report.summary.candidates = report.candidates.length;
  report.summary.skipped = report.skipped.length;

  if (!dryRun && report.candidates.length > 0) {
    const pathsToDelete = [...new Set(report.candidates.map((item) => item.storagePath))];
    const idsToUpdate = report.candidates.map((item) => item.contributionId);

    for (const chunk of chunkArray(pathsToDelete, 100)) {
      const { data: removed, error: removeError } = await supabase.storage
        .from(bucket)
        .remove(chunk);

      if (removeError) {
        throw new Error(`storage remove: ${removeError.message}`);
      }

      report.deletedPaths.push(...(removed ?? chunk));
    }

    for (const chunk of chunkArray(idsToUpdate, 200)) {
      const { error: updateError } = await supabase
        .from("syllabus_contributions")
        .update({
          syllabus_file_path: null,
          updated_at: new Date().toISOString()
        })
        .in("id", chunk);

      if (updateError) {
        throw new Error(`syllabus_contributions update: ${updateError.message}`);
      }

      report.summary.updatedContributionRows += chunk.length;
    }

    report.summary.deleted = report.deletedPaths.length;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  if (dryRun && /Missing Supabase environment variable/i.test(message)) {
    report.warnings.push(
      `${message}. Dry-run report was created, but live storage candidates could not be queried.`
    );
  } else {
    report.errors.push(message);
    process.exitCode = 1;
  }
}

await fs.writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await fs.writeFile(reportHtmlPath, buildHtml(report), "utf8");

console.log("Syllabus storage cleanup report complete");
console.log(`Mode: ${dryRun ? "dry run" : "confirmed delete"}`);
console.log(`Candidates: ${report.summary.candidates}`);
console.log(`Deleted: ${report.summary.deleted}`);
console.log(`Skipped: ${report.summary.skipped}`);
console.log(`HTML: ${reportHtmlPath}`);

function getStringArg(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) {
    return fallback;
  }

  return args[index + 1];
}

function getNumberArg(name, fallback) {
  const raw = getStringArg(name, String(fallback));
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeStoragePath(value, bucketName) {
  if (!value || typeof value !== "string") {
    return { path: "", reason: "No storage path", safe: false };
  }

  let normalized = value.trim();

  try {
    if (/^https?:\/\//i.test(normalized)) {
      const url = new URL(normalized);
      const marker = `/${bucketName}/`;
      const markerIndex = url.pathname.indexOf(marker);
      normalized =
        markerIndex >= 0
          ? url.pathname.slice(markerIndex + marker.length)
          : normalized;
    }
  } catch {
    return { path: normalized, reason: "Invalid storage URL", safe: false };
  }

  normalized = normalized
    .replace(/^\/+/, "")
    .replace(new RegExp(`^${escapeRegExp(bucketName)}\\/`), "");

  if (!normalized || normalized.includes("..") || normalized.startsWith("/")) {
    return { path: normalized, reason: "Unsafe storage path", safe: false };
  }

  return { path: normalized, safe: true };
}

function chunkArray(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHtml(value) {
  const rows = value.candidates
    .map(
      (item) => `
        <tr>
          <td>${htmlEscape(item.contributionId)}</td>
          <td>${htmlEscape(item.status)}</td>
          <td>${htmlEscape(item.createdAt)}</td>
          <td>${htmlEscape(item.fileName)}</td>
          <td><code>${htmlEscape(item.storagePath)}</code></td>
        </tr>`
    )
    .join("");
  const errors = value.errors.length
    ? `<section class="error"><h2>Errors</h2><ul>${value.errors
        .map((error) => `<li>${htmlEscape(error)}</li>`)
        .join("")}</ul></section>`
    : "";
  const warnings = value.warnings.length
    ? `<section class="warn"><h2>Warnings</h2><ul>${value.warnings
        .map((warning) => `<li>${htmlEscape(warning)}</li>`)
        .join("")}</ul></section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GradeMate Syllabus Storage Cleanup</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    main { max-width: 1100px; margin: 0 auto; padding: 32px 18px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 20px 0; }
    .card { border: 1px solid #334155; border-radius: 14px; padding: 14px; background: #111827; }
    .value { display: block; margin-top: 8px; font-size: 28px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; background: #111827; border-radius: 14px; overflow: hidden; }
    th, td { padding: 12px; border-bottom: 1px solid #334155; text-align: left; vertical-align: top; }
    .error { color: #fecdd3; }
    .warn { color: #fde68a; }
    code { color: #5eead4; }
  </style>
</head>
<body>
  <main>
    <h1>GradeMate Syllabus Storage Cleanup</h1>
    <p>Generated ${htmlEscape(value.generatedAt)}. Mode: <strong>${value.dryRun ? "dry run" : "confirmed delete"}</strong>. Cutoff: ${htmlEscape(value.cutoff)}.</p>
    <div class="cards">
      <div class="card">Candidates<span class="value">${value.summary.candidates}</span></div>
      <div class="card">Deleted<span class="value">${value.summary.deleted}</span></div>
      <div class="card">Skipped<span class="value">${value.summary.skipped}</span></div>
      <div class="card">Rows updated<span class="value">${value.summary.updatedContributionRows}</span></div>
    </div>
    ${warnings}
    ${errors}
    <table>
      <thead><tr><th>Contribution</th><th>Status</th><th>Created</th><th>File</th><th>Storage path</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5">No cleanup candidates found.</td></tr>`}</tbody>
    </table>
  </main>
</body>
</html>`;
}
