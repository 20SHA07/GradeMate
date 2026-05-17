import {
  getGradePoint,
  getLetterGrade,
  gradeScale,
  type LetterGrade
} from "@/lib/grading";

export type GradeOption = {
  label: LetterGrade;
  points: number;
};

export type GpaCourseInput = {
  id: string;
  name: string;
  credits: number;
  gradePoints: number;
};

export const gradeOptions: GradeOption[] = gradeScale.map((grade) => ({
  label: grade.letter,
  points: grade.points
}));

export function getGradePoints(letterGrade: string) {
  return gradeOptions.some((grade) => grade.label === letterGrade)
    ? getGradePoint(letterGrade as LetterGrade)
    : 0;
}

export function percentageToLetterGrade(percentage: number | null) {
  if (percentage === null || Number.isNaN(percentage)) {
    return "";
  }

  return getLetterGrade(percentage);
}

export function calculateGpa(courses: GpaCourseInput[]) {
  const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0);
  const totalPoints = courses.reduce(
    (sum, course) => sum + course.credits * course.gradePoints,
    0
  );

  return {
    totalCredits,
    totalPoints,
    gpa: totalCredits > 0 ? totalPoints / totalCredits : 0
  };
}
