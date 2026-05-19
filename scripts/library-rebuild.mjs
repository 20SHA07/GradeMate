import {
  buildLibraryTemplates,
  defaultLibrarySourceDir,
  rebuildTemplatesDir,
  writeLibraryTemplates
} from "./library-rebuild-utils.mjs";

const sourceDir = process.argv.find((arg, index) => index > 1 && !arg.startsWith("--")) ?? defaultLibrarySourceDir;

try {
  const rebuild = await buildLibraryTemplates(sourceDir);
  await writeLibraryTemplates(rebuild);

  const ready = rebuild.templates.filter((template) => template.ready).length;
  const canonicalReady = rebuild.templates.filter(
    (template) => template.ready && template.canonical && !template.needsReview
  ).length;
  const needsReview = rebuild.templates.filter((template) => template.needsReview).length;
  const conflicts = rebuild.templates.filter(
    (template) => template.duplicateStatus === "conflict"
  ).length;

  console.log("Course Library rebuild complete");
  console.log(`Source: ${rebuild.sourceDir}`);
  console.log(`Files scanned: ${rebuild.filesScanned}`);
  console.log(`Templates generated: ${rebuild.templates.length}`);
  console.log(`Ready: ${ready}`);
  console.log(`Canonical ready: ${canonicalReady}`);
  console.log(`Needs review: ${needsReview}`);
  console.log(`Duplicate conflicts: ${conflicts}`);
  console.log(`Output: ${rebuildTemplatesDir}`);

  if (rebuild.regressions.length > 0) {
    console.error("\nExpected-json regression(s) detected:");
    rebuild.regressions.slice(0, 20).forEach((template) => {
      console.error(`- ${template.sourceFileName}: ${template.regression.summary}`);
    });
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
