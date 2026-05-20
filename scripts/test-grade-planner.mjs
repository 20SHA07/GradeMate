import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const sourcePath = "src/lib/grade-planner.ts";
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;
const moduleShim = { exports: {} };

new Function("exports", "module", compiled)(moduleShim.exports, moduleShim);

const { buildGradePlanner } = moduleShim.exports;

function plan(assessments, targetPercent = 90, targetLabel = "A-") {
  return buildGradePlanner({ assessments, targetPercent, targetLabel });
}

function closeTo(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 0.001,
    `${message}: expected ${expected}, got ${actual}`
  );
}

const noAssessments = plan([]);
assert.equal(noAssessments.status, "empty");
assert.equal(
  noAssessments.resultMessage,
  "Add assessments or scan your syllabus to unlock target planning."
);

const noCompleted = plan([
  { id: "midterm", name: "Midterm", weightPercentage: 40, maxScore: 100 },
  { id: "final", name: "Final Exam", weightPercentage: 60, maxScore: 100 }
]);
assert.equal(noCompleted.completedWeight, 0);
assert.equal(noCompleted.remainingWeight, 100);
assert.equal(noCompleted.currentGradeOnCompleted, null);
closeTo(noCompleted.neededRemainingAverage, 90, "no completed needed average");

const mixed = plan([
  {
    id: "quiz",
    name: "Quiz 1",
    weightPercentage: 20,
    score: 80,
    maxScore: 100
  },
  { id: "final", name: "Final Exam", weightPercentage: 80, maxScore: 100 }
]);
closeTo(mixed.completedWeight, 20, "mixed completed weight");
closeTo(mixed.currentEarnedWeighted, 16, "mixed earned weighted");
closeTo(mixed.neededRemainingAverage, 92.5, "mixed needed average");
closeTo(mixed.remainingAssessments[0].neededScore, 92.5, "mixed needed score");

const secured = plan(
  [
    {
      id: "coursework",
      name: "Coursework",
      weightPercentage: 95,
      score: 95,
      maxScore: 100
    },
    { id: "participation", name: "Participation", weightPercentage: 5 }
  ],
  90,
  "A-"
);
assert.equal(secured.status, "secured");
assert.equal(secured.neededRemainingAverage, 0);
assert.match(secured.resultMessage, /already secured/i);

const impossible = plan(
  [
    {
      id: "midterm",
      name: "Midterm",
      weightPercentage: 80,
      score: 50,
      maxScore: 100
    },
    { id: "final", name: "Final Exam", weightPercentage: 20, maxScore: 100 }
  ],
  90,
  "A-"
);
assert.equal(impossible.status, "not_reachable");
closeTo(impossible.neededRemainingAverage, 250, "impossible needed average");
assert.match(impossible.resultMessage, /not reachable/i);

const completeAchieved = plan(
  [
    {
      id: "all",
      name: "All work",
      weightPercentage: 100,
      score: 85,
      maxScore: 100
    }
  ],
  83,
  "B"
);
assert.equal(completeAchieved.status, "complete_achieved");
closeTo(completeAchieved.currentEarnedWeighted, 85, "complete final grade");

const completeMissed = plan(
  [
    {
      id: "all",
      name: "All work",
      weightPercentage: 100,
      score: 85,
      maxScore: 100
    }
  ],
  90,
  "A-"
);
assert.equal(completeMissed.status, "complete_missed");

const missingWeights = plan([
  {
    id: "quiz",
    name: "Quiz",
    weightPercentage: 20,
    score: 18,
    maxScore: 20
  },
  { id: "project", name: "Project", weightPercentage: 30, maxScore: 100 }
]);
assert.match(missingWeights.warnings[0], /Assessment weights total 50\.0%/);

const missingMax = plan(
  [
    {
      id: "midterm",
      name: "Midterm",
      weightPercentage: 20,
      score: 80,
      maxScore: 100
    },
    { id: "final", name: "Final Exam", weightPercentage: 80, maxScore: null }
  ],
  84,
  "B"
);
assert.equal(missingMax.remainingAssessments[0].maxScore, 100);
assert.equal(missingMax.remainingAssessments[0].isMaxScoreAssumed, true);

const highestImpact = plan([
  {
    id: "quiz",
    name: "Quiz 1",
    weightPercentage: 10,
    score: 9,
    maxScore: 10
  },
  { id: "project", name: "Project", weightPercentage: 20, maxScore: 100 },
  { id: "final", name: "Final Exam", weightPercentage: 35, maxScore: 100 }
]);
assert.ok(
  highestImpact.focusSuggestions.some((suggestion) =>
    suggestion.includes("Focus most on Final Exam")
  )
);

const weakCompleted = plan([
  {
    id: "quiz2",
    name: "Quiz 2",
    weightPercentage: 10,
    score: 62,
    maxScore: 100
  },
  { id: "final", name: "Final Exam", weightPercentage: 90, maxScore: 100 }
]);
assert.ok(
  weakCompleted.focusSuggestions.some((suggestion) =>
    suggestion.includes("Quiz 2 at 62.0%")
  )
);

console.log("Grade planner tests passed.");
