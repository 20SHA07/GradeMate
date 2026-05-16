import type { Course, DashboardMetric, Semester } from "@/types";

export const semesters: Semester[] = [
  {
    id: "spring-2026",
    title: "Spring 2026",
    term: "Spring",
    year: 2026,
    targetGpa: 3.7,
    currentGpa: 3.58,
    credits: 15
  },
  {
    id: "fall-2025",
    title: "Fall 2025",
    term: "Fall",
    year: 2025,
    targetGpa: 3.6,
    currentGpa: 3.44,
    credits: 14
  }
];

export const courses: Course[] = [
  {
    id: "calc-201",
    code: "MATH 201",
    title: "Calculus II",
    credits: 4,
    semesterId: "spring-2026",
    status: "active",
    currentGrade: 91,
    targetGrade: 88,
    syllabusStatus: "parsed",
    assessments: [
      { id: "calc-quiz", title: "Quizzes", weight: 15, score: 93 },
      { id: "calc-midterm", title: "Midterm", weight: 25, score: 88 },
      { id: "calc-final", title: "Final", weight: 35, score: null },
      { id: "calc-homework", title: "Homework", weight: 25, score: 95 }
    ]
  },
  {
    id: "cs-230",
    code: "CS 230",
    title: "Data Structures",
    credits: 3,
    semesterId: "spring-2026",
    status: "active",
    currentGrade: 87,
    targetGrade: 90,
    syllabusStatus: "uploaded",
    assessments: [
      { id: "cs-projects", title: "Projects", weight: 40, score: 90 },
      { id: "cs-exams", title: "Exams", weight: 45, score: 84 },
      { id: "cs-labs", title: "Labs", weight: 15, score: 92 }
    ]
  },
  {
    id: "bio-120",
    code: "BIO 120",
    title: "Human Biology",
    credits: 3,
    semesterId: "spring-2026",
    status: "planned",
    currentGrade: 0,
    targetGrade: 86,
    syllabusStatus: "missing",
    assessments: []
  }
];

export const dashboardMetrics: DashboardMetric[] = [
  {
    label: "Current GPA",
    value: "3.58",
    hint: "+0.14 vs last term"
  },
  {
    label: "Tracked Credits",
    value: "15",
    hint: "Across active semester"
  },
  {
    label: "Courses",
    value: "3",
    hint: "2 ready for grade tracking"
  },
  {
    label: "Syllabi",
    value: "2/3",
    hint: "Upload queue ready"
  }
];
