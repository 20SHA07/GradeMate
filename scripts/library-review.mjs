import {
  buildReviewModel,
  readRebuiltTemplates,
  rebuildReviewCsvPath,
  rebuildReviewHtmlPath,
  rebuildReviewJsonPath,
  writeReviewReports
} from "./library-rebuild-utils.mjs";

try {
  const templates = await readRebuiltTemplates();

  if (templates.length === 0) {
    throw new Error("No rebuilt templates found. Run npm run library:rebuild first.");
  }

  const model = buildReviewModel(templates);
  await writeReviewReports(model);

  console.log("Course Library review reports written");
  console.log(`Templates: ${model.summary.totalTemplates}`);
  console.log(`Ready: ${model.summary.ready}`);
  console.log(`Canonical ready: ${model.summary.canonicalReady}`);
  console.log(`Needs review: ${model.summary.needsReview}`);
  console.log(`Conflicts: ${model.summary.conflicts}`);
  console.log(`JSON: ${rebuildReviewJsonPath}`);
  console.log(`CSV: ${rebuildReviewCsvPath}`);
  console.log(`HTML: ${rebuildReviewHtmlPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
