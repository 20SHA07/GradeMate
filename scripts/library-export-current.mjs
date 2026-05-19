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

try {
  await ensureRebuildDirs();
  const { supabaseUrl, serviceRoleKey } = getSupabaseServiceConfig();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  const [templates, assessments, materials] = await Promise.all([
    fetchAllRows(supabase, "course_templates"),
    fetchAllRows(supabase, "course_template_assessments"),
    fetchAllRows(supabase, "course_template_materials")
  ]);
  const timestamp = toSafeFileTimestamp();
  const templatesPath = path.join(backupDir, `course_templates_${timestamp}.json`);
  const assessmentsPath = path.join(
    backupDir,
    `course_template_assessments_${timestamp}.json`
  );
  const materialsPath = path.join(
    backupDir,
    `course_template_materials_${timestamp}.json`
  );

  await fs.writeFile(templatesPath, `${JSON.stringify(templates, null, 2)}\n`, "utf8");
  await fs.writeFile(
    assessmentsPath,
    `${JSON.stringify(assessments, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(materialsPath, `${JSON.stringify(materials, null, 2)}\n`, "utf8");

  console.log("Current Course Library export complete");
  console.log(`Templates: ${templates.length}`);
  console.log(`Assessments: ${assessments.length}`);
  console.log(`Materials: ${materials.length}`);
  console.log(`Backup folder: ${backupDir}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
