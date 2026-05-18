import {
  expectedJsonDir,
  normalizeAssessmentName,
  proposedJsonDir,
  readJsonFiles
} from "./dataset-utils.mjs";

const expectedFiles = await readJsonFiles(expectedJsonDir);
const proposedFiles = await readJsonFiles(proposedJsonDir);
const proposedByName = new Map(proposedFiles.map((file) => [file.fileName, file.value]));

if (expectedFiles.length === 0) {
  console.log("No expected dataset JSON files found yet.");
  process.exit(0);
}

let exactMatches = 0;
let failedFiles = 0;
const totals = {
  expectedAssessments: 0,
  missingAssessments: 0,
  extraAssessments: 0,
  wrongWeights: 0,
  wrongCourseInfo: 0
};

for (const expectedFile of expectedFiles) {
  const proposed = proposedByName.get(expectedFile.fileName);
  const expected = expectedFile.value;

  if (!proposed) {
    failedFiles += 1;
    console.log(`\n${expectedFile.fileName}`);
    console.log("- Missing proposed JSON file");
    continue;
  }

  const result = compareDatasetEntry(expected, proposed);
  totals.expectedAssessments += expected.assessments?.length ?? 0;
  totals.missingAssessments += result.missingAssessments.length;
  totals.extraAssessments += result.extraAssessments.length;
  totals.wrongWeights += result.wrongWeights.length;
  totals.wrongCourseInfo += result.courseInfoMismatches.length;

  if (result.exact) {
    exactMatches += 1;
    console.log(`✓ ${expectedFile.fileName}`);
    continue;
  }

  failedFiles += 1;
  console.log(`\n${expectedFile.fileName}`);
  result.courseInfoMismatches.forEach((mismatch) => console.log(`- ${mismatch}`));
  result.missingAssessments.forEach((assessment) =>
    console.log(`- Missing assessment: ${assessment.name} (${assessment.weight_percentage}%)`)
  );
  result.extraAssessments.forEach((assessment) =>
    console.log(`- Extra assessment: ${assessment.name} (${assessment.weight_percentage}%)`)
  );
  result.wrongWeights.forEach((mismatch) =>
    console.log(
      `- Wrong weight: ${mismatch.name} expected ${mismatch.expected}% got ${mismatch.actual}%`
    )
  );
}

console.log("\nDataset test summary");
console.log(`Expected files: ${expectedFiles.length}`);
console.log(`Exact matches: ${exactMatches}`);
console.log(`Failed files: ${failedFiles}`);
console.log(`Expected assessments: ${totals.expectedAssessments}`);
console.log(`Missing assessments: ${totals.missingAssessments}`);
console.log(`Extra assessments: ${totals.extraAssessments}`);
console.log(`Wrong weights: ${totals.wrongWeights}`);
console.log(`Wrong course info fields: ${totals.wrongCourseInfo}`);

if (failedFiles > 0) {
  process.exit(1);
}

function compareDatasetEntry(expected, proposed) {
  const courseInfoMismatches = [];
  const missingAssessments = [];
  const extraAssessments = [];
  const wrongWeights = [];
  const fields = ["courseCode", "courseName", "creditHours", "semester", "instructor"];

  fields.forEach((field) => {
    if (normalizeScalar(expected[field]) !== normalizeScalar(proposed[field])) {
      courseInfoMismatches.push(
        `Wrong ${field}: expected "${expected[field] ?? ""}" got "${proposed[field] ?? ""}"`
      );
    }
  });

  const expectedAssessments = new Map(
    (expected.assessments ?? []).map((assessment) => [
      normalizeAssessmentName(assessment.name),
      assessment
    ])
  );
  const proposedAssessments = new Map(
    (proposed.assessments ?? []).map((assessment) => [
      normalizeAssessmentName(assessment.name),
      assessment
    ])
  );

  expectedAssessments.forEach((expectedAssessment, key) => {
    const proposedAssessment = proposedAssessments.get(key);

    if (!proposedAssessment) {
      missingAssessments.push(expectedAssessment);
      return;
    }

    if (
      Math.abs(
        Number(expectedAssessment.weight_percentage) -
          Number(proposedAssessment.weight_percentage)
      ) > 0.1
    ) {
      wrongWeights.push({
        name: expectedAssessment.name,
        expected: expectedAssessment.weight_percentage,
        actual: proposedAssessment.weight_percentage
      });
    }
  });

  proposedAssessments.forEach((proposedAssessment, key) => {
    if (!expectedAssessments.has(key)) {
      extraAssessments.push(proposedAssessment);
    }
  });

  return {
    exact:
      courseInfoMismatches.length === 0 &&
      missingAssessments.length === 0 &&
      extraAssessments.length === 0 &&
      wrongWeights.length === 0,
    courseInfoMismatches,
    missingAssessments,
    extraAssessments,
    wrongWeights
  };
}

function normalizeScalar(value) {
  if (typeof value === "number") {
    return String(value);
  }

  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
