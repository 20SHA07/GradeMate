import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  createCourseLibraryBackup,
  printBackupSummary
} from "./library-backup-utils.mjs";
import {
  backupDir,
  ensureRebuildDirs,
  getSupabaseServiceConfig,
  htmlEscape,
  rebuildRootDir
} from "./library-rebuild-utils.mjs";

const args = process.argv.slice(2);
const isConfirmed = args.includes("--confirm");
const explicitDryRun = args.includes("--dry-run");
const backupArg = readFlagValue(args, "--backup") ?? "latest";
const isDryRun = explicitDryRun || !isConfirmed;
const restorePlanJsonPath = path.join(rebuildRootDir, "restore-plan.json");
const restorePlanHtmlPath = path.join(rebuildRootDir, "restore-plan.html");

try {
  await ensureRebuildDirs();

  if (!isDryRun && !isConfirmed) {
    throw new Error("Restore requires --confirm. Dry run is the default.");
  }

  const backup = await loadBackupSet(backupArg);
  const plan = buildRestorePlan(backup, { isDryRun });
  await writeRestorePlan(plan);
  printRestorePlan(plan);

  if (isDryRun) {
    console.log("Dry run complete. No Supabase rows were changed.");
    process.exit(0);
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseServiceConfig();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  const preRestoreBackup = await createCourseLibraryBackup({
    reason: `pre-restore backup before restoring ${backup.timestamp}`
  });
  printBackupSummary(preRestoreBackup);
  const result = await restoreCourseLibraryTables(supabase, backup);

  console.log("Course Library restore complete");
  console.log(`Templates restored: ${result.templates}`);
  console.log(`Assessments restored: ${result.assessments}`);
  console.log(`Materials restored: ${result.materials}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function readFlagValue(values, flagName) {
  const index = values.indexOf(flagName);

  if (index >= 0 && values[index + 1]) {
    return values[index + 1];
  }

  const inline = values.find((value) => value.startsWith(`${flagName}=`));
  return inline ? inline.slice(flagName.length + 1) : null;
}

async function loadBackupSet(value) {
  const resolved = path.resolve(value);

  if (value === "latest") {
    return loadBackupByTimestamp(await findLatestTimestamp(backupDir));
  }

  if (fsSync.existsSync(resolved) && fsSync.statSync(resolved).isDirectory()) {
    return loadBackupByTimestamp(await findLatestTimestamp(resolved), resolved);
  }

  if (fsSync.existsSync(resolved) && fsSync.statSync(resolved).isFile()) {
    const manifest = JSON.parse(await fs.readFile(resolved, "utf8"));
    return loadBackupByTimestamp(manifest.timestamp, path.dirname(resolved));
  }

  return loadBackupByTimestamp(value, backupDir);
}

async function findLatestTimestamp(directory) {
  if (!fsSync.existsSync(directory)) {
    throw new Error(`Backup folder does not exist: ${directory}`);
  }

  const entries = await fs.readdir(directory);
  const latest = entries
    .filter((entry) => /^course_templates_.*\.json$/i.test(entry))
    .map((entry) => entry.replace(/^course_templates_/i, "").replace(/\.json$/i, ""))
    .sort()
    .pop();

  if (!latest) {
    throw new Error(`No Course Library backup found in ${directory}`);
  }

  return latest;
}

async function loadBackupByTimestamp(timestamp, directory = backupDir) {
  const templatesPath = path.join(directory, `course_templates_${timestamp}.json`);
  const assessmentsPath = path.join(directory, `course_template_assessments_${timestamp}.json`);
  const materialsPath = path.join(directory, `course_template_materials_${timestamp}.json`);

  for (const filePath of [templatesPath, assessmentsPath]) {
    if (!fsSync.existsSync(filePath)) {
      throw new Error(`Backup file is missing: ${filePath}`);
    }
  }

  return {
    timestamp,
    templates: JSON.parse(await fs.readFile(templatesPath, "utf8")),
    assessments: JSON.parse(await fs.readFile(assessmentsPath, "utf8")),
    materials: fsSync.existsSync(materialsPath)
      ? JSON.parse(await fs.readFile(materialsPath, "utf8"))
      : [],
    templatesPath,
    assessmentsPath,
    materialsPath: fsSync.existsSync(materialsPath) ? materialsPath : null
  };
}

function buildRestorePlan(backup, { isDryRun }) {
  return {
    generatedAt: new Date().toISOString(),
    dryRun: isDryRun,
    backup: {
      timestamp: backup.timestamp,
      templatesPath: path.relative(process.cwd(), backup.templatesPath),
      assessmentsPath: path.relative(process.cwd(), backup.assessmentsPath),
      materialsPath: backup.materialsPath
        ? path.relative(process.cwd(), backup.materialsPath)
        : null
    },
    protectedUserTablesTouched: false,
    sharedTablesRestored: [
      "course_templates",
      "course_template_assessments",
      "course_template_materials"
    ],
    counts: {
      templates: backup.templates.length,
      assessments: backup.assessments.length,
      materials: backup.materials.length
    }
  };
}

async function writeRestorePlan(plan) {
  await fs.writeFile(restorePlanJsonPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  await fs.writeFile(restorePlanHtmlPath, buildRestorePlanHtml(plan), "utf8");
}

function printRestorePlan(plan) {
  console.log("Course Library restore plan written");
  console.log(`Backup timestamp: ${plan.backup.timestamp}`);
  console.log(`Dry run: ${plan.dryRun ? "yes" : "no"}`);
  console.log(`Templates: ${plan.counts.templates}`);
  console.log(`Assessments: ${plan.counts.assessments}`);
  console.log(`Materials: ${plan.counts.materials}`);
  console.log(`HTML: ${restorePlanHtmlPath}`);
}

async function restoreCourseLibraryTables(supabase, backup) {
  await deleteAllRows(supabase, "course_template_materials");
  await deleteAllRows(supabase, "course_template_assessments");
  await deleteAllRows(supabase, "course_templates");

  await insertRows(supabase, "course_templates", backup.templates);
  await insertRows(supabase, "course_template_assessments", backup.assessments);
  await insertRows(supabase, "course_template_materials", backup.materials);

  return {
    templates: backup.templates.length,
    assessments: backup.assessments.length,
    materials: backup.materials.length
  };
}

async function deleteAllRows(supabase, table) {
  const { error } = await supabase.from(table).delete().not("id", "is", null);

  if (error) {
    throw new Error(`${table} restore delete: ${error.message}`);
  }
}

async function insertRows(supabase, table, rows) {
  if (rows.length === 0) {
    return;
  }

  const chunkSize = 500;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);

    if (error) {
      throw new Error(`${table} restore insert: ${error.message}`);
    }
  }
}

function buildRestorePlanHtml(plan) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GradeMate Course Library Restore Plan</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    main { max-width: 920px; margin: 0 auto; padding: 32px 18px; }
    .card { border: 1px solid #334155; border-radius: 14px; padding: 16px; background: #111827; margin: 12px 0; }
    strong { color: #5eead4; }
    code { color: #bae6fd; }
  </style>
</head>
<body>
  <main>
    <h1>Course Library Restore Plan</h1>
    <p>Generated ${htmlEscape(plan.generatedAt)}</p>
    <div class="card">
      <p><strong>Dry run:</strong> ${plan.dryRun ? "Yes" : "No"}</p>
      <p><strong>Protected user tables touched:</strong> ${plan.protectedUserTablesTouched ? "Yes" : "No"}</p>
      <p><strong>Backup:</strong> <code>${htmlEscape(plan.backup.timestamp)}</code></p>
    </div>
    <div class="card">
      <p><strong>Templates:</strong> ${plan.counts.templates}</p>
      <p><strong>Assessments:</strong> ${plan.counts.assessments}</p>
      <p><strong>Materials:</strong> ${plan.counts.materials}</p>
    </div>
    <div class="card">
      <p>Restore affects only shared Course Library tables:</p>
      <p><code>${plan.sharedTablesRestored.map(htmlEscape).join("</code>, <code>")}</code></p>
    </div>
  </main>
</body>
</html>`;
}
