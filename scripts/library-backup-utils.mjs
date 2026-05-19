import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  backupDir,
  ensureRebuildDirs,
  fetchAllRows,
  getSupabaseServiceConfig,
  toSafeFileTimestamp
} from "./library-rebuild-utils.mjs";

export const courseLibraryTables = [
  "course_templates",
  "course_template_assessments",
  "course_template_materials"
];

export async function createCourseLibraryBackup({ reason = "manual" } = {}) {
  await ensureRebuildDirs();

  const { supabaseUrl, serviceRoleKey } = getSupabaseServiceConfig();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  const timestamp = toSafeFileTimestamp();
  const [templates, assessments, materials] = await Promise.all([
    fetchAllRows(supabase, "course_templates"),
    fetchAllRows(supabase, "course_template_assessments"),
    fetchAllRows(supabase, "course_template_materials")
  ]);
  const templatesPath = path.join(backupDir, `course_templates_${timestamp}.json`);
  const assessmentsPath = path.join(
    backupDir,
    `course_template_assessments_${timestamp}.json`
  );
  const materialsPath = path.join(
    backupDir,
    `course_template_materials_${timestamp}.json`
  );
  const manifestPath = path.join(backupDir, `course_library_backup_${timestamp}.json`);

  await fs.writeFile(templatesPath, `${JSON.stringify(templates, null, 2)}\n`, "utf8");
  await fs.writeFile(
    assessmentsPath,
    `${JSON.stringify(assessments, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(materialsPath, `${JSON.stringify(materials, null, 2)}\n`, "utf8");

  const manifest = {
    timestamp,
    reason,
    createdAt: new Date().toISOString(),
    protectedUserTablesTouched: false,
    tables: {
      course_templates: {
        count: templates.length,
        path: path.relative(process.cwd(), templatesPath)
      },
      course_template_assessments: {
        count: assessments.length,
        path: path.relative(process.cwd(), assessmentsPath)
      },
      course_template_materials: {
        count: materials.length,
        path: path.relative(process.cwd(), materialsPath)
      }
    }
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    timestamp,
    manifest,
    manifestPath,
    templatesPath,
    assessmentsPath,
    materialsPath,
    counts: {
      templates: templates.length,
      assessments: assessments.length,
      materials: materials.length
    }
  };
}

export function printBackupSummary(backup) {
  console.log("Course Library backup complete");
  console.log(`Reason: ${backup.manifest.reason}`);
  console.log(`Templates: ${backup.counts.templates}`);
  console.log(`Assessments: ${backup.counts.assessments}`);
  console.log(`Materials: ${backup.counts.materials}`);
  console.log(`Backup folder: ${backupDir}`);
  console.log(`Manifest: ${backup.manifestPath}`);
}
