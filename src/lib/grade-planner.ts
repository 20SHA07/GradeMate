export type PlannerAssessmentInput = {
  id: string;
  name: string;
  weightPercentage?: number | null;
  score?: number | null;
  maxScore?: number | null;
  status?: string | null;
};

export type PlannerAssessmentNeed = {
  id: string;
  name: string;
  weightPercentage: number;
  maxScore: number;
  isMaxScoreAssumed: boolean;
  neededScore: number | null;
  cappedNeededScore: number | null;
  contributionImpact: number;
  status: string;
};

export type PlannerStatus =
  | "empty"
  | "complete_achieved"
  | "complete_missed"
  | "secured"
  | "not_reachable"
  | "hard"
  | "achievable";

export type GradePlannerResult = {
  targetPercent: number;
  targetLabel: string;
  totalWeight: number;
  completedWeight: number;
  remainingWeight: number;
  currentEarnedWeighted: number;
  currentGradeOnCompleted: number | null;
  projectedFinalIfRemaining100: number;
  projectedFinalIfRemaining0: number;
  neededRemainingAverage: number | null;
  status: PlannerStatus;
  statusLabel: string;
  resultMessage: string;
  warnings: string[];
  remainingAssessments: PlannerAssessmentNeed[];
  focusSuggestions: string[];
  hasAssessments: boolean;
};

type NormalizedAssessment = {
  id: string;
  name: string;
  weightPercentage: number;
  score: number | null;
  maxScore: number | null;
  status: string | null;
  isDropped: boolean;
  isCompleted: boolean;
  isMissingWeight: boolean;
  isMissingMaxScore: boolean;
  percentage: number | null;
  weightedContribution: number;
};

const weightTolerance = 0.5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toOptionalNumber(value: number | null | undefined) {
  return isFiniteNumber(value) ? value : null;
}

function formatPlannerPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function normalizeAssessment(
  assessment: PlannerAssessmentInput
): NormalizedAssessment {
  const weight = toOptionalNumber(assessment.weightPercentage);
  const score = toOptionalNumber(assessment.score);
  const maxScore = toOptionalNumber(assessment.maxScore);
  const status = assessment.status ?? null;
  const isDropped = status === "Dropped";
  const isCompleted = score !== null && maxScore !== null && maxScore > 0;
  const percentage = isCompleted ? (score / maxScore) * 100 : null;
  const normalizedWeight = weight !== null && weight > 0 ? weight : 0;

  return {
    id: assessment.id,
    name: assessment.name.trim() || "Assessment",
    weightPercentage: normalizedWeight,
    score,
    maxScore,
    status,
    isDropped,
    isCompleted,
    isMissingWeight: weight === null || weight <= 0,
    isMissingMaxScore: maxScore === null || maxScore <= 0,
    percentage,
    weightedContribution:
      percentage === null ? 0 : (percentage / 100) * normalizedWeight
  };
}

function getStatus(
  neededRemainingAverage: number | null,
  targetPercent: number,
  currentEarnedWeighted: number,
  remainingWeight: number
): PlannerStatus {
  if (remainingWeight <= 0) {
    return currentEarnedWeighted >= targetPercent
      ? "complete_achieved"
      : "complete_missed";
  }

  if (neededRemainingAverage === null) {
    return "achievable";
  }

  if (neededRemainingAverage <= 0) {
    return "secured";
  }

  if (neededRemainingAverage > 100) {
    return "not_reachable";
  }

  if (neededRemainingAverage > 80) {
    return "hard";
  }

  return "achievable";
}

function getStatusLabel(status: PlannerStatus) {
  switch (status) {
    case "complete_achieved":
      return "Achieved";
    case "complete_missed":
      return "Missed";
    case "secured":
      return "Secured";
    case "not_reachable":
      return "Not reachable";
    case "hard":
      return "Hard";
    case "empty":
      return "Needs assessments";
    case "achievable":
    default:
      return "Achievable";
  }
}

function getResultMessage({
  neededRemainingAverage,
  status,
  targetLabel,
  targetPercent,
  currentEarnedWeighted
}: {
  neededRemainingAverage: number | null;
  status: PlannerStatus;
  targetLabel: string;
  targetPercent: number;
  currentEarnedWeighted: number;
}) {
  if (status === "empty") {
    return "Add assessments or scan your syllabus to unlock target planning.";
  }

  if (status === "complete_achieved") {
    return `Final grade is ${formatPlannerPercent(currentEarnedWeighted)}. Target ${targetLabel} was achieved.`;
  }

  if (status === "complete_missed") {
    return `Final grade is ${formatPlannerPercent(currentEarnedWeighted)}. Target ${targetLabel} was not achieved.`;
  }

  if (status === "secured") {
    return "This target is already secured.";
  }

  if (status === "not_reachable") {
    return "This target is not reachable unless extra credit is available.";
  }

  if (neededRemainingAverage === null) {
    return "Add remaining assessments to calculate what you need.";
  }

  return `You need a ${formatPlannerPercent(neededRemainingAverage)} average across remaining assessments to reach ${targetLabel || formatPlannerPercent(targetPercent)}.`;
}

function getRemainingAssessmentNeeds(
  assessments: NormalizedAssessment[],
  neededRemainingAverage: number | null,
  status: PlannerStatus
): PlannerAssessmentNeed[] {
  return assessments
    .filter((assessment) => !assessment.isDropped && !assessment.isCompleted)
    .map((assessment) => {
      const maxScore =
        assessment.maxScore !== null && assessment.maxScore > 0
          ? assessment.maxScore
          : 100;
      const neededScore =
        neededRemainingAverage === null
          ? null
          : (neededRemainingAverage / 100) * maxScore;
      const cappedNeededScore =
        neededScore === null ? null : clamp(neededScore, 0, maxScore);
      const contributionImpact =
        maxScore > 0 ? (10 / maxScore) * assessment.weightPercentage : 0;

      let rowStatus = "Remaining";

      if (assessment.weightPercentage <= 0) {
        rowStatus = "No weight";
      } else if (status === "secured") {
        rowStatus = "Secured";
      } else if (status === "not_reachable") {
        rowStatus = "Not reachable";
      } else if (neededRemainingAverage !== null && neededRemainingAverage > 80) {
        rowStatus = "Hard";
      } else if (assessment.isMissingMaxScore) {
        rowStatus = "Assumed max";
      }

      return {
        id: assessment.id,
        name: assessment.name,
        weightPercentage: assessment.weightPercentage,
        maxScore,
        isMaxScoreAssumed: assessment.isMissingMaxScore,
        neededScore,
        cappedNeededScore,
        contributionImpact,
        status: rowStatus
      };
    });
}

function getFocusSuggestions({
  assessments,
  remainingAssessments,
  remainingWeight,
  neededRemainingAverage,
  status,
  targetLabel,
  projectedFinalIfRemaining100,
  hasMissingData
}: {
  assessments: NormalizedAssessment[];
  remainingAssessments: PlannerAssessmentNeed[];
  remainingWeight: number;
  neededRemainingAverage: number | null;
  status: PlannerStatus;
  targetLabel: string;
  projectedFinalIfRemaining100: number;
  hasMissingData: boolean;
}) {
  const suggestions: string[] = [];
  const highestImpact = [...remainingAssessments]
    .filter((assessment) => assessment.weightPercentage > 0)
    .sort((first, second) => second.weightPercentage - first.weightPercentage)[0];

  if (highestImpact) {
    suggestions.push(
      `Focus most on ${highestImpact.name}: it is worth ${formatPlannerPercent(highestImpact.weightPercentage)} of your grade.`
    );
  }

  const weakestCompleted = [...assessments]
    .filter(
      (assessment) =>
        !assessment.isDropped &&
        assessment.isCompleted &&
        assessment.percentage !== null &&
        assessment.percentage < 70
    )
    .sort((first, second) => (first.percentage ?? 0) - (second.percentage ?? 0))[0];

  if (weakestCompleted && weakestCompleted.percentage !== null) {
    suggestions.push(
      `Your lowest completed score is ${weakestCompleted.name} at ${formatPlannerPercent(weakestCompleted.percentage)}. If similar work remains, prioritize it.`
    );
  }

  if (remainingWeight >= 40) {
    suggestions.push(
      "You still have a lot of your grade left, so the target is very movable."
    );
  } else if (remainingWeight > 0 && remainingWeight <= 15) {
    suggestions.push(
      `Only ${formatPlannerPercent(remainingWeight)} remains, so big grade changes are harder.`
    );
  }

  if (status === "not_reachable" && neededRemainingAverage !== null) {
    suggestions.push(
      `To reach ${targetLabel}, you would need ${formatPlannerPercent(neededRemainingAverage)} average on remaining work. The best possible final grade is ${formatPlannerPercent(projectedFinalIfRemaining100)}.`
    );
  }

  if (
    neededRemainingAverage !== null &&
    neededRemainingAverage > 0 &&
    neededRemainingAverage <= 60
  ) {
    suggestions.push(
      `This target is very realistic. Keep remaining work above ${formatPlannerPercent(neededRemainingAverage)}.`
    );
  }

  if (remainingAssessments.length > 1 && neededRemainingAverage !== null) {
    const names = remainingAssessments
      .filter((assessment) => assessment.weightPercentage > 0)
      .slice(0, 4)
      .map((assessment) => assessment.name);

    if (names.length > 1) {
      suggestions.push(
        `Try to average around ${formatPlannerPercent(Math.max(0, neededRemainingAverage))} across: ${names.join(", ")}.`
      );
    }
  }

  if (hasMissingData) {
    suggestions.push(
      "Add missing max scores and weights for a more accurate plan."
    );
  }

  return suggestions;
}

export function buildGradePlanner({
  assessments,
  targetLabel,
  targetPercent
}: {
  assessments: PlannerAssessmentInput[];
  targetLabel: string;
  targetPercent: number;
}): GradePlannerResult {
  const normalizedTarget = clamp(
    Number.isFinite(targetPercent) ? targetPercent : 90,
    0,
    100
  );
  const normalized = assessments
    .map(normalizeAssessment)
    .filter((assessment) => !assessment.isDropped);
  const hasAssessments = normalized.length > 0;

  if (!hasAssessments) {
    return {
      targetPercent: normalizedTarget,
      targetLabel,
      totalWeight: 0,
      completedWeight: 0,
      remainingWeight: 0,
      currentEarnedWeighted: 0,
      currentGradeOnCompleted: null,
      projectedFinalIfRemaining100: 0,
      projectedFinalIfRemaining0: 0,
      neededRemainingAverage: null,
      status: "empty",
      statusLabel: getStatusLabel("empty"),
      resultMessage: getResultMessage({
        neededRemainingAverage: null,
        status: "empty",
        targetLabel,
        targetPercent: normalizedTarget,
        currentEarnedWeighted: 0
      }),
      warnings: [],
      remainingAssessments: [],
      focusSuggestions: [],
      hasAssessments: false
    };
  }

  const totalWeight = normalized.reduce(
    (sum, assessment) => sum + assessment.weightPercentage,
    0
  );
  const completedWeight = normalized.reduce(
    (sum, assessment) =>
      sum + (assessment.isCompleted ? assessment.weightPercentage : 0),
    0
  );
  const currentEarnedWeighted = normalized.reduce(
    (sum, assessment) => sum + assessment.weightedContribution,
    0
  );
  const remainingWeight = Math.max(100 - completedWeight, 0);
  const currentGradeOnCompleted =
    completedWeight > 0 ? (currentEarnedWeighted / completedWeight) * 100 : null;
  const projectedFinalIfRemaining100 = currentEarnedWeighted + remainingWeight;
  const projectedFinalIfRemaining0 = currentEarnedWeighted;
  const neededRemainingAverage =
    remainingWeight > 0
      ? ((normalizedTarget - currentEarnedWeighted) / remainingWeight) * 100
      : null;
  const status = getStatus(
    neededRemainingAverage,
    normalizedTarget,
    currentEarnedWeighted,
    remainingWeight
  );
  const warnings: string[] = [];
  const hasMissingData = normalized.some(
    (assessment) => assessment.isMissingWeight || assessment.isMissingMaxScore
  );

  if (Math.abs(totalWeight - 100) > weightTolerance) {
    warnings.push(
      `Assessment weights total ${formatPlannerPercent(totalWeight)}. Planner is most accurate when weights total 100%.`
    );
  }

  const remainingAssessments = getRemainingAssessmentNeeds(
    normalized,
    neededRemainingAverage,
    status
  );

  return {
    targetPercent: normalizedTarget,
    targetLabel,
    totalWeight,
    completedWeight,
    remainingWeight,
    currentEarnedWeighted,
    currentGradeOnCompleted,
    projectedFinalIfRemaining100,
    projectedFinalIfRemaining0,
    neededRemainingAverage:
      status === "secured" ? 0 : neededRemainingAverage,
    status,
    statusLabel: getStatusLabel(status),
    resultMessage: getResultMessage({
      neededRemainingAverage:
        status === "secured" ? 0 : neededRemainingAverage,
      status,
      targetLabel,
      targetPercent: normalizedTarget,
      currentEarnedWeighted
    }),
    warnings,
    remainingAssessments,
    focusSuggestions: getFocusSuggestions({
      assessments: normalized,
      remainingAssessments,
      remainingWeight,
      neededRemainingAverage:
        status === "secured" ? 0 : neededRemainingAverage,
      status,
      targetLabel,
      projectedFinalIfRemaining100,
      hasMissingData
    }),
    hasAssessments
  };
}
