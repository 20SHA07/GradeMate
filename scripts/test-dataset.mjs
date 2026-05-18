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

let passedFiles = 0;
let failedFiles = 0;
const totals = {
  expectedAssessments: 0,
  missingAssessments: 0,
  extraAssessments: 0,
  wrongWeights: 0,
  wrongCourseInfo: 0,
  wrongAssessmentCounts: 0,
  wrongTotalWeights: 0
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
  totals.wrongAssessmentCounts += result.assessmentCountMismatches.length;
  totals.wrongTotalWeights += result.totalWeightMismatches.length;

  if (result.passed) {
    passedFiles += 1;
    console.log(`OK ${expectedFile.fileName}`);
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
  result.assessmentCountMismatches.forEach((mismatch) => console.log(`- ${mismatch}`));
  result.totalWeightMismatches.forEach((mismatch) => console.log(`- ${mismatch}`));
}

const accuracy =
  expectedFiles.length > 0 ? Math.round((passedFiles / expectedFiles.length) * 1000) / 10 : 0;

console.log("\nDataset test summary");
console.log(`Total expected examples: ${expectedFiles.length}`);
console.log(`Passed: ${passedFiles}`);
console.log(`Failed files: ${failedFiles}`);
console.log(`Expected assessments: ${totals.expectedAssessments}`);
console.log(`Missing assessments: ${totals.missingAssessments}`);
console.log(`Extra assessments: ${totals.extraAssessments}`);
console.log(`Wrong weights: ${totals.wrongWeights}`);
console.log(`Wrong course info fields: ${totals.wrongCourseInfo}`);
console.log(`Wrong assessment counts: ${totals.wrongAssessmentCounts}`);
console.log(`Wrong total weights: ${totals.wrongTotalWeights}`);
console.log(`Accuracy: ${accuracy}%`);

if (failedFiles > 0) {
  process.exit(1);
}

function compareDatasetEntry(expected, proposed) {
  const courseInfoMismatches = [];
  const missingAssessments = [];
  const extraAssessments = [];
  const wrongWeights = [];
  const assessmentCountMismatches = [];
  const totalWeightMismatches = [];
  const fields = [
    "courseCode",
    "courseName",
    "creditHours",
    "semester",
    "instructor",
    "instructorEmail",
    "schedule",
    "classroom",
    "officeRoom",
    "officeHours",
    "prerequisites",
    "courseDescription"
  ];

  fields.forEach((field) => {
    if (!hasExpectedValue(expected[field])) {
      return;
    }

    if (normalizeScalar(expected[field]) !== normalizeScalar(proposed[field])) {
      courseInfoMismatches.push(
        `Wrong ${field}: expected "${expected[field] ?? ""}" got "${proposed[field] ?? ""}"`
      );
    }
  });

  if (
    hasExpectedValue(expected.textbooks) &&
    normalizeScalar(expected.textbooks) !== normalizeScalar(proposed.textbooks)
  ) {
    courseInfoMismatches.push(
      `Wrong textbooks: expected "${expected.textbooks ?? ""}" got "${proposed.textbooks ?? ""}"`
    );
  }

  const expectedAssessments = new Map(
    (expected.assessments ?? []).map((assessment) => [
      normalizeAssessmentKey(assessment),
      assessment
    ])
  );
  const proposedAssessments = new Map(
    (proposed.assessments ?? []).map((assessment) => [
      normalizeAssessmentKey(assessment),
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
      ) > 1
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

  if ((expected.assessments?.length ?? 0) !== (proposed.assessments?.length ?? 0)) {
    assessmentCountMismatches.push(
      `Wrong assessment count: expected ${expected.assessments?.length ?? 0} got ${proposed.assessments?.length ?? 0}`
    );
  }

  const expectedTotal = getTotalWeight(expected.assessments ?? []);
  const proposedTotal = getTotalWeight(proposed.assessments ?? []);

  if (Math.abs(expectedTotal - proposedTotal) > 1) {
    totalWeightMismatches.push(
      `Wrong total weight: expected ${expectedTotal}% got ${proposedTotal}%`
    );
  }

  return {
    passed:
      courseInfoMismatches.length === 0 &&
      missingAssessments.length === 0 &&
      extraAssessments.length === 0 &&
      wrongWeights.length === 0 &&
      assessmentCountMismatches.length === 0 &&
      totalWeightMismatches.length === 0,
    assessmentCountMismatches,
    courseInfoMismatches,
    missingAssessments,
    extraAssessments,
    totalWeightMismatches,
    wrongWeights
  };
}

function normalizeScalar(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeScalar(item)).join("|");
  }

  if (typeof value === "number") {
    return String(value);
  }

  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasExpectedValue(value) {
  if (Array.isArray(value)) {
    return value.some((item) => hasExpectedValue(item));
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return String(value ?? "").trim().length > 0;
}

function normalizeAssessmentKey(assessment) {
  const weight = Number(assessment.weight_percentage);
  let key = normalizeAssessmentName(assessment.name)
    .replace(/\bquizzes\b/g, "quiz")
    .replace(/\bassignments\b/g, "assignment")
    .replace(/\blabs\b/g, "laboratory");

  if (Number.isFinite(weight)) {
    const normalizedWeight = String(weight).replace(/\.0+$/, "");
    key = key
      .split(" ")
      .filter((token, index, tokens) => {
        return !(index === tokens.length - 1 && token === normalizedWeight);
      })
      .join(" ");
  }

  return key.trim();
}

function getTotalWeight(assessments) {
  return Math.round(
    assessments.reduce(
      (sum, assessment) => sum + Number(assessment.weight_percentage ?? 0),
      0
    ) * 100
  ) / 100;
}
