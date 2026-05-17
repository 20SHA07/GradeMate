export type LetterGrade =
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D"
  | "F";

export const gradeScale = [
  { letter: "A", min: 93, max: 100, points: 4.0 },
  { letter: "A-", min: 90, max: 92, points: 3.7 },
  { letter: "B+", min: 87, max: 89, points: 3.3 },
  { letter: "B", min: 83, max: 86, points: 3.0 },
  { letter: "B-", min: 80, max: 82, points: 2.7 },
  { letter: "C+", min: 77, max: 79, points: 2.3 },
  { letter: "C", min: 73, max: 76, points: 2.0 },
  { letter: "C-", min: 70, max: 72, points: 1.7 },
  { letter: "D", min: 60, max: 69, points: 1.0 },
  { letter: "F", min: 0, max: 59, points: 0.0 }
] as const;

export const gradeScaleValidationCases = [
  { percentage: 92.4, letter: "A-", roundedPercentage: 92 },
  { percentage: 92.5, letter: "A", roundedPercentage: 93 },
  { percentage: 89.6, letter: "A-", roundedPercentage: 90 },
  { percentage: 59.9, letter: "D", roundedPercentage: 60 },
  { percentage: 59.4, letter: "F", roundedPercentage: 59 },
  { percentage: 93, letter: "A", roundedPercentage: 93 },
  { percentage: 90, letter: "A-", roundedPercentage: 90 },
  { percentage: 87, letter: "B+", roundedPercentage: 87 },
  { percentage: 83, letter: "B", roundedPercentage: 83 },
  { percentage: 80, letter: "B-", roundedPercentage: 80 },
  { percentage: 77, letter: "C+", roundedPercentage: 77 },
  { percentage: 73, letter: "C", roundedPercentage: 73 },
  { percentage: 70, letter: "C-", roundedPercentage: 70 },
  { percentage: 60, letter: "D", roundedPercentage: 60 },
  { percentage: 59, letter: "F", roundedPercentage: 59 }
] as const satisfies readonly {
  percentage: number;
  letter: LetterGrade;
  roundedPercentage: number;
}[];

export function roundGradePercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value);
}

export function getLetterGrade(percentage: number): LetterGrade {
  const rounded = roundGradePercentage(percentage);
  const clamped = Math.max(0, Math.min(100, rounded));
  const match = gradeScale.find(
    (grade) => clamped >= grade.min && clamped <= grade.max
  );

  return match?.letter ?? "F";
}

export function getGradePoint(letterGrade: LetterGrade): number {
  return gradeScale.find((grade) => grade.letter === letterGrade)?.points ?? 0;
}

export function getGradeInfo(percentage: number) {
  const rounded = roundGradePercentage(percentage);
  const clamped = Math.max(0, Math.min(100, rounded));
  const letter = getLetterGrade(clamped);
  const points = getGradePoint(letter);

  return {
    rawPercentage: percentage,
    roundedPercentage: clamped,
    letter,
    points
  };
}
