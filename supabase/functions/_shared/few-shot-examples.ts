type ExtractedSyllabus = {
  courseCode: string | null;
  courseName: string | null;
  creditHours: number | null;
  instructor: string | null;
  assessments: Array<{
    name: string;
    weight_percentage: number;
    max_score: number;
    confidence: number;
    source_text_snippet: string;
  }>;
  warnings: string[];
  confidence: number;
};

type SyllabusFewShotExample = {
  id: string;
  department: string;
  group: "engineering-science" | "math" | "humanities-business";
  sourceText: string;
  result: ExtractedSyllabus;
};

const fewShotExamples: SyllabusFewShotExample[] = [
  {
    id: "cosc101-golden",
    department: "COSC",
    group: "engineering-science",
    sourceText: `COSC 101 Foundations of Computer Science
Assessment Methodology
Coursework:
Quiz 1 5%
Quiz 2 5%
Quiz 3 5%
Quiz 4 5%
Mid Term Exam 25%
Final Exam 35%
Laboratory 15%
Lab Final Exam 5%`,
    result: {
      courseCode: "COSC 101",
      courseName: "Foundations of Computer Science",
      creditHours: 3,
      instructor: "Menatalla Abououf",
      assessments: [
        assessment("Quiz 1", 5),
        assessment("Quiz 2", 5),
        assessment("Quiz 3", 5),
        assessment("Quiz 4", 5),
        assessment("Mid Term Exam", 25),
        assessment("Final Exam", 35),
        assessment("Laboratory", 15),
        assessment("Lab Final Exam", 5)
      ],
      warnings: [],
      confidence: 0.96
    }
  },
  {
    id: "math101-golden",
    department: "MATH",
    group: "math",
    sourceText: `MATH 101 Fundamentals of Mathematical Reasoning
Evaluation Scheme
Quiz 2 20%
Project 10%
Presentation 10%
Mid Term Exam 25%
Final Exam 35%`,
    result: {
      courseCode: "MATH 101",
      courseName: "Fundamentals of Mathematical Reasoning",
      creditHours: 3,
      instructor: "Ahmed Ameur",
      assessments: [
        assessment("Quiz 2", 20),
        assessment("Project 10", 10),
        assessment("Presentation", 10),
        assessment("Mid Term Exam", 25),
        assessment("Final Exam", 35)
      ],
      warnings: [],
      confidence: 0.94
    }
  },
  {
    id: "huma106-golden",
    department: "HUMA",
    group: "humanities-business",
    sourceText: `HUMA 106 Emirates Society
Assessment Methodology
Quiz 1 15%
Quiz 2 15%
Mid Term Exam 20%
Assignments 10%
Final Project 30%
Presentation 10%`,
    result: {
      courseCode: "HUMA 106",
      courseName: "Emirates Society",
      creditHours: 3,
      instructor: null,
      assessments: [
        assessment("Quiz 1", 15),
        assessment("Quiz 2", 15),
        assessment("Mid Term Exam", 20),
        assessment("Assignments", 10),
        assessment("Final Project", 30),
        assessment("Presentation", 10)
      ],
      warnings: [],
      confidence: 0.94
    }
  },
  {
    id: "buss322-golden",
    department: "BUSS",
    group: "humanities-business",
    sourceText: `BUSS 322 Fundamentals of Innovation & Entrepreneurship
Course Evaluation
Coursework 20%
Project 1 20%
Project 2 20%
Final Project 40%`,
    result: {
      courseCode: "BUSS 322",
      courseName: "Fundamentals of Innovation & Entrepreneurship",
      creditHours: 3,
      instructor: null,
      assessments: [
        assessment("Coursework", 20),
        assessment("Project 1", 20),
        assessment("Project 2", 20),
        assessment("Final Project", 40)
      ],
      warnings: [],
      confidence: 0.93
    }
  }
];

export function formatFewShotExamplesForPrompt(inputText: string) {
  const department = getDepartment(inputText);
  const selected: SyllabusFewShotExample[] = [];

  if (department) {
    const departmentMatch = fewShotExamples.find(
      (example) => example.department === department
    );

    if (departmentMatch) {
      selected.push(departmentMatch);
    }
  }

  for (const group of ["engineering-science", "math", "humanities-business"] as const) {
    if (selected.length >= 3) {
      break;
    }

    const groupMatch = fewShotExamples.find(
      (example) =>
        example.group === group &&
        !selected.some((selectedExample) => selectedExample.id === example.id)
    );

    if (groupMatch) {
      selected.push(groupMatch);
    }
  }

  return selected
    .slice(0, 3)
    .map(
      (example, index) => `Example ${index + 1}
Input:
${example.sourceText}

Output:
${JSON.stringify(example.result, null, 2)}`
    )
    .join("\n\n");
}

function assessment(name: string, weightPercentage: number) {
  return {
    name,
    weight_percentage: weightPercentage,
    max_score: 100,
    confidence: 0.95,
    source_text_snippet: `${name} ${weightPercentage}%`
  };
}

function getDepartment(value: string) {
  const match = value.match(/\b([A-Z]{2,5})\s*-?\s*\d{3,4}\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}
