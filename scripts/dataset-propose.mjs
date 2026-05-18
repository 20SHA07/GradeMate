import { proposeDatasetJson, formatWeight } from "./dataset-utils.mjs";

const sourceDir = process.argv[2];

if (!sourceDir) {
  console.error('Usage: npm run dataset:propose -- "C:\\path\\to\\syllabus-folder"');
  process.exit(1);
}

try {
  const { index, proposals } = await proposeDatasetJson(sourceDir);
  const needsReview = proposals.filter((proposal) => proposal.needsHumanReview);
  const complete = proposals.filter((proposal) => Math.abs(proposal.totalWeight - 100) <= 0.5);

  console.log("Dataset proposals complete");
  console.log(`Syllabus files proposed: ${proposals.length}`);
  console.log(`Complete 100% breakdowns: ${complete.length}`);
  console.log(`Needs human review: ${needsReview.length}`);
  console.log(`Proposed JSON saved to: training-data/proposed-json/`);

  const courseCodes = proposals
    .map((proposal) => proposal.courseCode)
    .filter(Boolean)
    .slice(0, 20);

  if (courseCodes.length > 0) {
    console.log(`Course codes found: ${courseCodes.join(", ")}`);
  }

  const warnings = proposals.flatMap((proposal) =>
    proposal.warnings.map((warning) => `${proposal.sourceFileName}: ${warning}`)
  );

  if (warnings.length > 0) {
    console.log("\nWarnings:");
    warnings.slice(0, 15).forEach((warning) => console.log(`- ${warning}`));

    if (warnings.length > 15) {
      console.log(`...and ${warnings.length - 15} more`);
    }
  }

  const duplicates = findDuplicateCourses(proposals);

  if (duplicates.length > 0) {
    console.log("\nPotential duplicate templates:");
    duplicates.forEach((duplicate) => console.log(`- ${duplicate}`));
  }

  if (index.parseErrors.length > 0) {
    console.log(`\nParse errors: ${index.parseErrors.length}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function findDuplicateCourses(proposals) {
  const seen = new Map();
  const duplicates = [];

  proposals.forEach((proposal) => {
    const key = `${proposal.courseCode ?? "unknown"}|${proposal.courseName ?? "unknown"}`;

    if (seen.has(key)) {
      duplicates.push(
        `${proposal.courseCode ?? "Unknown"} ${proposal.courseName ?? ""} (${proposal.sourceFileName}, ${seen.get(key)}) total ${formatWeight(proposal.totalWeight)}%`
      );
      return;
    }

    seen.set(key, proposal.sourceFileName);
  });

  return duplicates;
}
