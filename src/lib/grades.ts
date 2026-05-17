import type { AssessmentRecord } from "@/types/database";
import {
  getLetterGrade as getOfficialLetterGrade,
  type LetterGrade
} from "@/lib/grading";

export type GradeSummary = {
  totalWeight: number;
  completedWeight: number;
  remainingWeight: number;
  unscoredWeight: number;
  completedContribution: number;
  currentGrade: number | null;
  finalProjectedGrade: number | null;
  allAssessmentsScored: boolean;
};

export function getAssessmentName(assessment: AssessmentRecord) {
  return assessment.name ?? assessment.title ?? "Assessment";
}

export function getAssessmentWeight(assessment: AssessmentRecord) {
  return Number(assessment.weight_percentage ?? assessment.weight ?? 0);
}

export function getAssessmentMaxScore(assessment: AssessmentRecord) {
  if (assessment.max_score !== null && assessment.max_score !== undefined) {
    return Number(assessment.max_score);
  }

  return null;
}

export function getAssessmentStatus(assessment: AssessmentRecord) {
  if (assessment.category === "Dropped") {
    return "Dropped";
  }

  if (isCompletedAssessment(assessment)) {
    return "Completed";
  }

  return assessment.category === "Completed"
    ? "Planned"
    : assessment.category ?? "Planned";
}

export function isCompletedAssessment(assessment: AssessmentRecord) {
  const score = assessment.score;
  const maxScore = getAssessmentMaxScore(assessment);

  return (
    score !== null &&
    score !== undefined &&
    maxScore !== null &&
    Number(maxScore) > 0
  );
}

export function getWeightedContribution(assessment: AssessmentRecord) {
  if (!isCompletedAssessment(assessment)) {
    return null;
  }

  const score = Number(assessment.score);
  const maxScore = Number(getAssessmentMaxScore(assessment));
  const weight = getAssessmentWeight(assessment);

  return (score / maxScore) * weight;
}

export function getLetterGrade(percentage: number | null): LetterGrade | "N/A" {
  if (percentage === null) {
    return "N/A";
  }

  return getOfficialLetterGrade(percentage);
}

export function formatPercent(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value.toFixed(digits)}%`;
}

export function getCourseGradeSummary(
  assessments: AssessmentRecord[]
): GradeSummary {
  const activeAssessments = assessments.filter(
    (assessment) => getAssessmentStatus(assessment) !== "Dropped"
  );
  const totalWeight = activeAssessments.reduce(
    (sum, assessment) => sum + getAssessmentWeight(assessment),
    0
  );
  const completedAssessments = activeAssessments.filter(isCompletedAssessment);
  const completedWeight = completedAssessments.reduce(
    (sum, assessment) => sum + getAssessmentWeight(assessment),
    0
  );
  const completedContribution = completedAssessments.reduce(
    (sum, assessment) => sum + Number(getWeightedContribution(assessment) ?? 0),
    0
  );
  const currentGrade =
    completedWeight > 0 ? (completedContribution / completedWeight) * 100 : null;
  const allAssessmentsScored =
    activeAssessments.length > 0 && activeAssessments.every(isCompletedAssessment);
  const finalProjectedGrade = completedContribution;

  return {
    totalWeight,
    completedWeight,
    remainingWeight: Math.max(100 - totalWeight, 0),
    unscoredWeight: Math.max(totalWeight - completedWeight, 0),
    completedContribution,
    currentGrade,
    finalProjectedGrade,
    allAssessmentsScored
  };
}
