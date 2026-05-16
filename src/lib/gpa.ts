export type GradeOption = {
  label: string;
  points: number;
};

export type GpaCourseInput = {
  id: string;
  name: string;
  credits: number;
  gradePoints: number;
};

export const gradeOptions: GradeOption[] = [
  { label: "A", points: 4 },
  { label: "A-", points: 3.7 },
  { label: "B+", points: 3.3 },
  { label: "B", points: 3 },
  { label: "B-", points: 2.7 },
  { label: "C+", points: 2.3 },
  { label: "C", points: 2 },
  { label: "C-", points: 1.7 },
  { label: "D+", points: 1.3 },
  { label: "D", points: 1 },
  { label: "F", points: 0 }
];

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
