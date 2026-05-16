export type CourseStatus = "active" | "planned" | "completed";

export type Course = {
  id: string;
  code: string;
  title: string;
  credits: number;
  semesterId: string;
  status: CourseStatus;
  currentGrade: number;
  targetGrade: number;
  syllabusStatus: "missing" | "uploaded" | "parsed";
  assessments: Assessment[];
};

export type Assessment = {
  id: string;
  title: string;
  weight: number;
  score: number | null;
};

export type Semester = {
  id: string;
  title: string;
  term: string;
  year: number;
  targetGpa: number;
  currentGpa: number;
  credits: number;
};

export type DashboardMetric = {
  label: string;
  value: string;
  hint: string;
};
