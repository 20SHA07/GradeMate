import {
  buildDiffModel,
  diffHtmlPath,
  diffJsonPath,
  loadLatestBackup,
  readRebuiltTemplates,
  writeDiffReports
} from "./library-rebuild-utils.mjs";

try {
  const templates = await readRebuiltTemplates();

  if (templates.length === 0) {
    throw new Error("No rebuilt templates found. Run npm run library:rebuild first.");
  }

  const backup = await loadLatestBackup();
  const model = buildDiffModel(templates, backup);
  await writeDiffReports(model);

  console.log("Course Library diff report written");

  if (!backup) {
    console.log(
      "No current Course Library export found. Run npm run library:export-current with Supabase service-role env vars to compare against production."
    );
  } else {
    console.log(`Compared against backup: ${backup.timestamp}`);
  }

  console.log(`New: ${model.summary.newCourses}`);
  console.log(`Changed: ${model.summary.changed}`);
  console.log(`Unchanged: ${model.summary.unchanged}`);
  console.log(`Removed/ignored: ${model.summary.removedOrIgnored}`);
  console.log(`JSON: ${diffJsonPath}`);
  console.log(`HTML: ${diffHtmlPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
