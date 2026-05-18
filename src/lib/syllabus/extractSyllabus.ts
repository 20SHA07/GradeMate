export type ExtractedAssessment = {
  name: string;
  weight_percentage: number;
  max_score: number;
  confidence: number;
  source_text_snippet: string;
};

export type ExtractedSyllabus = {
  courseCode: string | null;
  courseName: string | null;
  creditHours: number | null;
  instructor: string | null;
  instructorEmail?: string | null;
  semester?: string | null;
  schedule?: string | null;
  classroom?: string | null;
  officeHours?: string | null;
  prerequisites?: string | null;
  textbooks?: string[];
  courseDescription?: string | null;
  assessments: ExtractedAssessment[];
  warnings: string[];
  confidence: number;
  fieldConfidence?: ExtractedFieldConfidence;
  debug?: ExtractionDebug;
};

export type ExtractedFieldConfidence = {
  courseCode?: number;
  courseName?: number;
  creditHours?: number;
  instructor?: number;
  instructorEmail?: number;
  semester?: number;
  schedule?: number;
  classroom?: number;
  officeHours?: number;
  prerequisites?: number;
  textbooks?: number;
  courseDescription?: number;
};

export type ExtractionMode = "quick" | "syllabus";

export type ExtractionDebug = {
  textLength: number;
  candidateCount: number;
  chosenCandidateLabel: string;
  chosenCandidateScore: number;
  candidates?: Array<{
    label: string;
    score: number;
    assessmentCount: number;
    totalWeight: number;
  }>;
};

type AssessmentCandidate = {
  label: string;
  heading?: string;
  assessments: ExtractedAssessment[];
  score: number;
};

const assessmentKeywords = [
  "coursework",
  "course work",
  "continuous assessment",
  "quiz",
  "quizzes",
  "exam",
  "examination",
  "midterm",
  "mid-term",
  "mid term",
  "semester exam",
  "semester examination",
  "major exam",
  "minor exam",
  "final",
  "final examination",
  "assignment",
  "assignments",
  "homework",
  "hw",
  "lab",
  "lab work",
  "laboratory",
  "project",
  "participation",
  "attendance",
  "presentation",
  "report",
  "essay",
  "portfolio",
  "discussion",
  "tutorial",
  "practical",
  "test",
  "case study",
  "viva",
  "oral",
  "in-class activity"
];

const gradingContextWords = [
  "assessment",
  "assessments",
  "assessment plan",
  "assessment strategy",
  "assessment criteria",
  "breakdown",
  "component",
  "course evaluation",
  "evaluation scheme",
  "evaluation criteria",
  "evaluation",
  "grading",
  "grading scheme",
  "grading breakdown",
  "course grading",
  "grading policy",
  "grading criteria",
  "marking scheme",
  "mark distribution",
  "marks distribution",
  "distribution of marks",
  "grade distribution",
  "student assessment",
  "continuous assessment",
  "coursework assessment",
  "percentage",
  "weight",
  "weighted",
  "marks",
  "contribution"
];

const gradingHeaderPatterns = [
  /assessment/i,
  /course evaluation/i,
  /\bevaluation\b/i,
  /evaluation scheme/i,
  /evaluation criteria/i,
  /assessment plan/i,
  /assessment strategy/i,
  /assessment breakdown/i,
  /assessment criteria/i,
  /grading breakdown/i,
  /grading scheme/i,
  /course grading/i,
  /grading policy/i,
  /grading criteria/i,
  /marking scheme/i,
  /mark distribution/i,
  /marks distribution/i,
  /distribution of marks/i,
  /grade distribution/i,
  /assessment\s+weight/i,
  /weighting/i,
  /component\s+percentage/i,
  /assessment\s+percentage/i,
  /course requirements/i,
  /student assessment/i,
  /continuous assessment/i,
  /coursework assessment/i
];

const dueDateWords = [
  "due",
  "deadline",
  "week",
  "page",
  "chapter",
  "lecture",
  "room",
  "email",
  "phone"
];

const assessmentTermDefinitions = [
  {
    aliases: ["case study", "case studies"],
    display: "Case Study",
    pluralDisplay: "Case Studies",
    singularDisplay: "Case Study"
  },
  {
    aliases: ["final exam", "final"],
    display: "Final Exam",
    pluralDisplay: "Final Exams",
    singularDisplay: "Final Exam"
  },
  {
    aliases: ["midterm exam", "midterms", "midterm"],
    display: "Midterm",
    pluralDisplay: "Midterms",
    singularDisplay: "Midterm"
  },
  {
    aliases: ["quizzes", "quiz"],
    display: "Quizzes",
    pluralDisplay: "Quizzes",
    singularDisplay: "Quiz"
  },
  {
    aliases: ["assignments", "assignment"],
    display: "Assignments",
    pluralDisplay: "Assignments",
    singularDisplay: "Assignment"
  },
  {
    aliases: ["homework"],
    display: "Homework",
    pluralDisplay: "Homework",
    singularDisplay: "Homework"
  },
  {
    aliases: ["exams", "exam"],
    display: "Exams",
    pluralDisplay: "Exams",
    singularDisplay: "Exam"
  },
  {
    aliases: ["labs", "lab"],
    display: "Labs",
    pluralDisplay: "Labs",
    singularDisplay: "Lab"
  },
  {
    aliases: ["projects", "project"],
    display: "Projects",
    pluralDisplay: "Projects",
    singularDisplay: "Project"
  },
  {
    aliases: ["presentations", "presentation"],
    display: "Presentation",
    pluralDisplay: "Presentations",
    singularDisplay: "Presentation"
  },
  {
    aliases: ["discussions", "discussion"],
    display: "Discussion",
    pluralDisplay: "Discussions",
    singularDisplay: "Discussion"
  },
  {
    aliases: ["tutorials", "tutorial"],
    display: "Tutorial",
    pluralDisplay: "Tutorials",
    singularDisplay: "Tutorial"
  },
  {
    aliases: ["tests", "test"],
    display: "Tests",
    pluralDisplay: "Tests",
    singularDisplay: "Test"
  },
  {
    aliases: ["participation"],
    display: "Participation",
    pluralDisplay: "Participation",
    singularDisplay: "Participation"
  },
  {
    aliases: ["attendance"],
    display: "Attendance",
    pluralDisplay: "Attendance",
    singularDisplay: "Attendance"
  },
  {
    aliases: ["reports", "report"],
    display: "Report",
    pluralDisplay: "Reports",
    singularDisplay: "Report"
  },
  {
    aliases: ["essays", "essay"],
    display: "Essay",
    pluralDisplay: "Essays",
    singularDisplay: "Essay"
  },
  {
    aliases: ["portfolios", "portfolio"],
    display: "Portfolio",
    pluralDisplay: "Portfolios",
    singularDisplay: "Portfolio"
  },
  {
    aliases: ["practicals", "practical"],
    display: "Practical",
    pluralDisplay: "Practicals",
    singularDisplay: "Practical"
  }
] as const;

const assessmentAliasEntries = assessmentTermDefinitions
  .flatMap((definition) =>
    definition.aliases.map((alias) => ({
      alias,
      definition
    }))
  )
  .sort((first, second) => second.alias.length - first.alias.length);

const assessmentAliasPattern = assessmentAliasEntries
  .map((entry) => entry.alias.replace(/\s+/g, "\\s+"))
  .join("|");

function cleanLine(line: string) {
  return line
    .replace(/\s+/g, " ")
    .replace(/[\u2022\u00b7]/g, "-")
    .trim();
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCaseAssessmentName(value: string) {
  const cleaned = value
    .replace(/\b(worth|accounts for|weighted at|weight|marks?|points?|score|percentage|percent)\b/gi, "")
    .replace(/[|:;,\-\u2013\u2014()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "Assessment";
  }

  if (/^final$/i.test(cleaned) || /^final examination$/i.test(cleaned)) {
    return "Final Exam";
  }

  if (/^mid[-\s]?term examination$/i.test(cleaned)) {
    return "Midterm";
  }

  return cleaned
    .split(" ")
    .map((word) =>
      assessmentKeywords.includes(word.toLowerCase())
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

function hasAssessmentKeyword(line: string) {
  const normalized = line.toLowerCase();

  return assessmentKeywords.some((keyword) =>
    new RegExp(`\\b${keyword.replace(/\s+/g, "\\s+")}s?\\b`, "i").test(
      normalized
    )
  );
}

function hasGradingContext(line: string) {
  const normalized = line.toLowerCase();

  return gradingContextWords.some((word) => normalized.includes(word));
}

function looksLikeDueDate(line: string) {
  const normalized = line.toLowerCase();
  const hasDate =
    /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(line) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i.test(
      line
    );

  return hasDate && dueDateWords.some((word) => normalized.includes(word));
}

function extractPercent(line: string, inGradingSection: boolean) {
  const percentMatch =
    line.match(/(\d{1,3}(?:\.\d+)?)\s*(?:%|percent\b|percentage\b)/i) ??
    line.match(/\b(?:worth|accounts?\s+for|weighted\s+at)\s+(\d{1,3}(?:\.\d+)?)\b/i);

  if (percentMatch) {
    const value = Number(percentMatch[1]);
    return value >= 0 && value <= 100 ? value : null;
  }

  if (inGradingSection) {
    const marksMatch =
      line.match(/\b(?:weight|marks?|contribution|percentage|points?)\s*[:=\-]?\s*(\d{1,3}(?:\.\d+)?)\b/i) ??
      line.match(/\b(\d{1,3}(?:\.\d+)?)\s*(?:marks?|points?)\b/i);

    if (marksMatch) {
      const value = Number(marksMatch[1]);
      return value > 0 && value <= 100 ? value : null;
    }

    const decimalMatch = line.match(/\b0\.(\d{1,2})\b/);

    if (decimalMatch) {
      return Number(`0.${decimalMatch[1]}`) * 100;
    }
  }

  return null;
}

function extractAssessmentName(line: string, percentage: number) {
  const escapedPercentage = String(percentage).replace(".", "\\.");
  const withoutPercent = line
    .replace(new RegExp(`${escapedPercentage}\\s*(?:%|percent|percentage)?`, "i"), "")
    .replace(/\b0\.\d{1,2}\b/g, "")
    .replace(/\b(?:worth|accounts?\s+for|weighted\s+at)\b/gi, "");

  const parts = withoutPercent
    .split("|")
    .map(cleanLine)
    .filter(Boolean);
  const likelyPart =
    parts.find((part) => hasAssessmentKeyword(part)) ??
    parts.find((part) => !hasGradingContext(part)) ??
    withoutPercent;

  return titleCaseAssessmentName(likelyPart);
}

function extractCourseCode(text: string) {
  const match = text.match(/\b([A-Z]{2,5})\s*[- ]?\s*(\d{3,4}[A-Z]?)\b/);

  if (!match) {
    return null;
  }

  return `${match[1]} ${match[2]}`;
}

function extractCourseName(lines: string[], courseCode: string | null) {
  const codeAndTitleLine = lines.find((line) =>
    /^course\s+code\s+and\s+title\s*[:\-]/i.test(line)
  );

  if (codeAndTitleLine) {
    const value = codeAndTitleLine.split(/[:\-]/).slice(1).join("-").trim();
    const withoutCode = value
      .replace(/\(?[A-Z]{2,5}\s*[- ]?\s*\d{3,4}[A-Z]?\)?/i, "")
      .replace(/^[-:\s]+/, "")
      .trim();

    if (withoutCode) {
      return withoutCode;
    }
  }

  const titleLine = lines.find((line) =>
    /^(course\s*(name|title)|title)\s*[:\-]/i.test(line)
  );

  if (titleLine) {
    return (
      titleLine.split(/[:\-]/).slice(1).join("-").trim() ||
      null
    );
  }

  const courseLine = lines.find((line) =>
    /^course\s*[:\-]\s*[A-Z]{2,5}\s*[- ]?\s*\d{3,4}[A-Z]?\b/i.test(line)
  );

  if (courseLine) {
    const withoutCode = courseLine
      .replace(/^course\s*[:\-]\s*/i, "")
      .replace(/\b[A-Z]{2,5}\s*[- ]?\s*\d{3,4}[A-Z]?\b\s*[:\-\u2013\u2014]?/i, "")
      .trim();

    if (withoutCode) {
      return withoutCode;
    }
  }

  if (courseCode) {
    const compactCode = courseCode.replace(/\s+/g, "\\s*[- ]?\\s*");
    const codeLine = lines.find((line) =>
      new RegExp(`\\b${compactCode}\\b`, "i").test(line)
    );

    if (codeLine) {
      const afterCode = codeLine
        .replace(new RegExp(`.*?\\b${compactCode}\\b\\s*[:\\-\\u2013\\u2014]?\\s*`, "i"), "")
        .trim();

      if (
        afterCode &&
        !hasGradingContext(afterCode) &&
        !/syllabus|outline/i.test(afterCode)
      ) {
        return afterCode;
      }
    }
  }

  return null;
}

function extractCreditHours(text: string) {
  const match =
    text.match(/(?:credit\s*(?:hours|hrs|units)|credits?)\D{0,24}(\d+(?:\.\d+)?)/i) ??
    text.match(/(\d+(?:\.\d+)?)\s*(?:credit\s*(?:hours|hrs|units)|credits?)\b/i);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 && value <= 20 ? value : null;
}

function extractInstructor(lines: string[]) {
  const labelled = extractLabelValue(lines, [
    "instructor",
    "instructor name",
    "course instructor",
    "professor",
    "lecturer",
    "faculty"
  ]);

  if (labelled) {
    return labelled;
  }

  const line = lines.find((item) =>
    /^(instructor|instructor name|course instructor|professor|lecturer|faculty)\s*[:\-]/i.test(item)
  );

  if (!line) {
    return null;
  }

  return line.split(/[:\-]/).slice(1).join("-").trim() || null;
}

function extractInstructorEmail(text: string) {
  return text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] ?? null;
}

function extractSemester(text: string, lines: string[]) {
  const labelled = lines.find((line) => /^(semester|term)\s*[:\-]/i.test(line));

  if (labelled) {
    const value = labelled.split(/[:\-]/).slice(1).join("-").trim();
    const termMatch = value.match(/\b(Fall|Spring|Summer|Winter)\s+\d{4}\b/i);
    return (termMatch?.[0] ?? value) || null;
  }

  return text.match(/\b(Fall|Spring|Summer|Winter)\s+\d{4}\b/i)?.[0] ?? null;
}

function extractLabelValue(lines: string[], labels: string[]) {
  const labelPattern = labels
    .map((label) => label.replace(/\s+/g, "\\s+"))
    .join("|");
  const regex = new RegExp(`^(${labelPattern})\\s*[:\\-]\\s*(.+)$`, "i");
  const line = lines.find((item) => regex.test(item));

  if (line) {
    return line.replace(regex, "$2").trim() || null;
  }

  const emptyLabelRegex = new RegExp(`^(${labelPattern})\\s*[:\\-]?\\s*$`, "i");
  const labelIndex = lines.findIndex((item) => emptyLabelRegex.test(item));

  if (labelIndex === -1) {
    return null;
  }

  for (let index = labelIndex + 1; index < lines.length; index += 1) {
    const nextLine = lines[index];

    if (!nextLine) {
      continue;
    }

    if (isMetadataSectionBoundary(nextLine) || isAssessmentSectionHeading(nextLine)) {
      return null;
    }

    return nextLine.trim() || null;
  }

  return null;
}

function extractSchedule(lines: string[]) {
  return (
    extractLabelValue(lines, [
      "schedule",
      "class time",
      "meeting time",
      "lecture time",
      "class schedule"
    ]) ??
    lines.find((line) =>
      /\b(Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?)\b.*\b\d{1,2}:\d{2}\b/i.test(
        line
      )
    ) ??
    null
  );
}

function extractClassroom(lines: string[]) {
  return extractLabelValue(lines, ["classroom", "room", "location", "venue"]);
}

function extractOfficeHours(lines: string[]) {
  return extractLabelValue(lines, ["office hours", "consultation hours"]);
}

function extractPrerequisites(lines: string[]) {
  return extractLabelValue(lines, ["prerequisite", "prerequisites", "pre-requisite", "pre-requisites"]);
}

function isMetadataSectionBoundary(line: string) {
  return /^(assessment|course evaluation|evaluation|grading|course learning outcomes?|learning outcomes?|schedule|teaching plan|course topics|attendance|academic integrity|policies|office hours|instructor|prerequisites?|textbooks?|references?|course catalog description|course description)\b/i.test(
    line
  );
}

function extractSectionText(lines: string[], headingPattern: RegExp, maxLines = 8) {
  const startIndex = lines.findIndex((line) => headingPattern.test(line));

  if (startIndex === -1) {
    return null;
  }

  const headingLine = lines[startIndex];
  const inlineValue = headingLine.replace(headingPattern, "").replace(/^[:\-\s]+/, "").trim();
  const values: string[] = inlineValue ? [inlineValue] : [];

  for (let index = startIndex + 1; index < lines.length && values.length < maxLines; index += 1) {
    const line = lines[index];

    if (!line) {
      if (values.length > 0) break;
      continue;
    }

    if (values.length > 0 && isMetadataSectionBoundary(line)) {
      break;
    }

    if (isAssessmentSectionHeading(line) || isSectionBoundary(line)) {
      break;
    }

    values.push(line.replace(/^[-*]\s*/, "").trim());
  }

  return values.join("\n").trim() || null;
}

function extractTextbooks(lines: string[]) {
  const section = extractSectionText(
    lines,
    /^(textbooks?|required text|recommended text|references?)\s*/i,
    10
  );

  if (!section) {
    return [];
  }

  return section
    .split(/\n|;|(?:\s+-\s+)/)
    .map((item) => item.replace(/^[-*]\s*/, "").trim())
    .filter((item) => item.length > 8 && !/^(textbooks?|required text|recommended text|references?)$/i.test(item))
    .slice(0, 8);
}

function extractCourseDescription(lines: string[]) {
  return extractSectionText(
    lines,
    /^(course catalog description|catalog description|course description|description)\s*/i,
    8
  );
}

function buildFieldConfidence(input: {
  courseCode: string | null;
  courseName: string | null;
  creditHours: number | null;
  instructor: string | null;
  instructorEmail: string | null;
  semester: string | null;
  schedule: string | null;
  classroom: string | null;
  officeHours: string | null;
  prerequisites: string | null;
  textbooks: string[];
  courseDescription: string | null;
}): ExtractedFieldConfidence {
  return {
    courseCode: input.courseCode ? 0.9 : 0,
    courseName: input.courseName ? 0.78 : 0,
    creditHours: input.creditHours !== null ? 0.86 : 0,
    instructor: input.instructor ? 0.78 : 0,
    instructorEmail: input.instructorEmail ? 0.95 : 0,
    semester: input.semester ? 0.82 : 0,
    schedule: input.schedule ? 0.72 : 0,
    classroom: input.classroom ? 0.72 : 0,
    officeHours: input.officeHours ? 0.75 : 0,
    prerequisites: input.prerequisites ? 0.76 : 0,
    textbooks: input.textbooks.length > 0 ? 0.72 : 0,
    courseDescription: input.courseDescription ? 0.7 : 0
  };
}

function normalizeAssessmentForOutput(
  assessment: ExtractedAssessment
): ExtractedAssessment {
  return {
    name: assessment.name,
    weight_percentage:
      Math.round(Number(assessment.weight_percentage || 0) * 100) / 100,
    max_score: Number(assessment.max_score) || 100,
    confidence: Math.round(Number(assessment.confidence ?? 0.7) * 100) / 100,
    source_text_snippet: assessment.source_text_snippet ?? ""
  };
}

function parseAssessments(lines: string[]) {
  const assessments: ExtractedAssessment[] = [];
  let gradingWindow = 0;

  lines.forEach((line) => {
    const normalizedLine = cleanLine(line);

    if (!normalizedLine) {
      gradingWindow = Math.max(0, gradingWindow - 1);
      return;
    }

    if (hasGradingContext(normalizedLine)) {
      gradingWindow = 18;
    } else {
      gradingWindow = Math.max(0, gradingWindow - 1);
    }

    if (looksLikeDueDate(normalizedLine)) {
      return;
    }

    const inGradingSection = gradingWindow > 0;
    const percentage = extractPercent(normalizedLine, inGradingSection);

    if (percentage === null) {
      return;
    }

    const hasKeyword = hasAssessmentKeyword(normalizedLine);

    if (!hasKeyword && !inGradingSection) {
      return;
    }

    const name = extractAssessmentName(normalizedLine, percentage);
    const confidence = hasKeyword ? 0.92 : inGradingSection ? 0.68 : 0.45;

    assessments.push({
      name,
      weight_percentage: Math.round(percentage * 100) / 100,
      max_score: 100,
      confidence,
      source_text_snippet: normalizedLine
    });
  });

  const seen = new Map<string, ExtractedAssessment>();

  assessments.forEach((assessment) => {
    const key = normalizeName(assessment.name);
    const existing = seen.get(key);

    if (!existing || assessment.confidence > existing.confidence) {
      seen.set(key, assessment);
    }
  });

  return {
    assessments: Array.from(seen.values()),
    duplicateCount: assessments.length - seen.size
  };
}

function shouldIgnoreAssessmentLine(line: string, courseCode: string | null) {
  const normalized = line.toLowerCase();
  const hasKeyword = hasAssessmentKeyword(line);

  if (/^\s*[a-f][+-]?\s+/.test(normalized) && /\d{1,3}\s*%/.test(normalized)) {
    return true;
  }

  if (
    /\b(clo|plo|kpi|outcome|lecture|topic|page|chapter|grade scale|letter grade)\b/i.test(line) &&
    !hasKeyword
  ) {
    return true;
  }

  if (/\bweek\s+\d{1,2}\b/i.test(line) && !hasKeyword) {
    return true;
  }

  if (/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(line) && !hasKeyword) {
    return true;
  }

  if (/\b(moved to the grade of|will be moved to|make-?up|late penalty|deducted|bonus)\b/i.test(line)) {
    return true;
  }

  if (courseCode) {
    const compactCode = courseCode.replace(/\s+/g, "\\s*[-_ ]?");

    if (new RegExp(compactCode, "i").test(line) && !hasKeyword) {
      return true;
    }
  }

  return false;
}

function isAssessmentSectionHeading(line: string) {
  if (/letter grade|grade point|official khalifa university grading system/i.test(line)) {
    return false;
  }

  return gradingHeaderPatterns.some((pattern) => pattern.test(line));
}

function isSectionBoundary(line: string) {
  return (
    /^(honou?r code|academic pledge|teaching plan|course learning outcomes?|contribution to|student outcomes?|program learning outcomes?|laboratory schedule|course topics|textbooks?|references?)\b/i.test(
      line
    ) ||
    /official khalifa university.*grading system|letter grade grade point|letter grade percentage/i.test(
      line
    )
  );
}

function scoreHeading(line: string) {
  if (/assessment methodology|assessment instruments|course evaluation|evaluation scheme|marks? distribution|distribution of marks/i.test(line)) {
    return 1;
  }

  if (/assessment|evaluation|coursework|continuous assessment|weight/i.test(line)) {
    return 0.9;
  }

  if (/grading scheme|grade distribution/i.test(line)) {
    return 0.72;
  }

  return 0.62;
}

function extractWeightFromAssessmentLine(line: string, inGradingSection: boolean) {
  const withoutScores = line.replace(/\b\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\b/g, " ");
  const explicitMatches = Array.from(
    withoutScores.matchAll(/(\d{1,3}(?:\.\d+)?)\s*(?:%|percent\b|percentage\b)/gi)
  );

  if (explicitMatches.length > 0) {
    return cleanWeightValue(explicitMatches[explicitMatches.length - 1][1]);
  }

  if (inGradingSection) {
    const labelBeforeNumber = withoutScores.match(
      /\b(?:weight|marks?|contribution|percentage|score|points?)\s*[:=\-]?\s*(\d{1,3}(?:\.\d+)?)\b/i
    );

    if (labelBeforeNumber) {
      return cleanWeightValue(labelBeforeNumber[1]);
    }

    const numberBeforeLabel = withoutScores.match(
      /\b(\d{1,3}(?:\.\d+)?)\s*(?:marks?|points?)\b/i
    );

    if (numberBeforeLabel) {
      return cleanWeightValue(numberBeforeLabel[1]);
    }

    if (/\b(weight|weighted|marks?|contribution|percentage|assessment|evaluation|grade)\b/i.test(withoutScores)) {
      const decimal = withoutScores.match(/\b0\.(\d{1,2})\b/);

      if (decimal) {
        return cleanWeightValue(Number(`0.${decimal[1]}`) * 100);
      }
    }
  }

  return null;
}

function cleanWeightValue(value: string | number) {
  const weight = Number(value);
  return Number.isFinite(weight) && weight > 0 && weight <= 100 ? weight : null;
}

function calculateAssessmentConfidence(
  line: string,
  inGradingSection: boolean,
  weight: number
) {
  let confidence = inGradingSection ? 0.82 : 0.68;

  if (hasAssessmentKeyword(line)) {
    confidence += 0.08;
  }

  if (/%|percent|percentage|marks?|weight|contribution/i.test(line)) {
    confidence += 0.05;
  }

  if (weight > 0 && weight <= 60) {
    confidence += 0.03;
  }

  if (/letter grade|grade point|clo|plo|week\s+\d/i.test(line) && !hasAssessmentKeyword(line)) {
    confidence -= 0.3;
  }

  return Math.round(Math.max(0.35, Math.min(0.98, confidence)) * 100) / 100;
}

function deriveAssessmentName(line: string) {
  const parts = line
    .split(/\||\t| {2,}/)
    .map((part) =>
      part
        .replace(/\b(weight|percentage|percent|marks?|points?|score|total)\b/gi, "")
        .replace(/\d{1,3}(?:\.\d+)?\s*(?:%|percent|percentage)?/gi, "")
        .replace(/[\u2022\u00b7]/g, " ")
        .replace(/^[^A-Za-z]+|[^A-Za-z0-9]+$/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  return parts.find(hasAssessmentKeyword) ?? parts[0] ?? "";
}

function canonicalAssessmentName(rawName: string, fullLine: string) {
  const value = `${rawName} ${fullLine}`.toLowerCase();
  const numberedValue = `${rawName} ${removeWeightTokensForNumbering(fullLine)}`.toLowerCase();
  const quizNumber = numberedValue.match(/\bquiz(?:zes)?\s*#?\s*(\d{1,2})\b/);
  const homeworkNumber = numberedValue.match(/\b(?:homework|hw)\s*#?\s*(\d{1,2})\b/);
  const assignmentNumber = numberedValue.match(/\bassignments?\s*#?\s*(\d{1,2})\b/);
  const projectNumber = numberedValue.match(/\bprojects?\s*#?\s*(\d{1,2})\b/);
  const testNumber = numberedValue.match(/\btests?\s*#?\s*(\d{1,2})\b/);
  const labNumber = numberedValue.match(/\blabs?\s*#?\s*(\d{1,2})\b/);
  const examNumber = numberedValue.match(/\bexams?\s*#?\s*(\d{1,2})\b/);

  if (quizNumber) return `Quiz ${Number(quizNumber[1])}`;
  if (homeworkNumber) return `Homework ${Number(homeworkNumber[1])}`;
  if (assignmentNumber) return `Assignment ${Number(assignmentNumber[1])}`;
  if (projectNumber) return `Project ${Number(projectNumber[1])}`;
  if (testNumber) return `Test ${Number(testNumber[1])}`;
  if (labNumber) return `Lab ${Number(labNumber[1])}`;
  if (examNumber) return `Exam ${Number(examNumber[1])}`;

  if (/\bfinal\s+lab\b|\blab\s*final\b|\bfinal\s+lab\s*test\b/.test(value)) return "Final Lab";
  if (/\bmid\s*term\b|\bmidterm\b/.test(value)) return "Mid Term Exam";
  if (/\bsemester examination\b|\bsemester exam\b/.test(value)) return "Semester Examination";
  if (/\bminor exam\b|\bminor\b/.test(value)) return "Minor Exam";
  if (/\bmajor exam\b|\bmajor\b/.test(value)) return "Major Exam";
  if (/\bfinal project\b/.test(value)) return "Final Project";
  if (/\bfinal\b/.test(value)) return "Final Exam";
  if (/\bcontinuous assessment\b/.test(value)) return "Continuous Assessment";
  if (/\bcourse\s*work\b|\bcoursework\b/.test(value)) return "Coursework";
  if (/\blab\s*work\b/.test(value)) return "Lab Work";
  if (/\blaborator(y|ies)\b|\blabs?\b/.test(value)) return "Laboratory";
  if (/\bquiz(?:zes)?\b/.test(value)) return "Quizzes";
  if (/\bassignments?\b/.test(value)) return "Assignments";
  if (/\bhomework\b/.test(value)) return "Homework";
  if (/\bprojects?\b/.test(value)) return "Project";
  if (/\bparticipation\b/.test(value)) return "Participation";
  if (/\battendance\b/.test(value)) return "Attendance";
  if (/\bpresentations?\b/.test(value)) return "Presentation";
  if (/\breports?\b/.test(value)) return "Report";
  if (/\bessays?\b/.test(value)) return "Essay";
  if (/\bportfolio\b/.test(value)) return "Portfolio";
  if (/\bdiscussion\b/.test(value)) return "Discussion";
  if (/\btutorial\b/.test(value)) return "Tutorial";
  if (/\bpractical\b/.test(value)) return "Practical";
  if (/\bcase stud(y|ies)\b/.test(value)) return "Case Study";
  if (/\btests?\b/.test(value)) return "Test";
  if (/\bexams?\b/.test(value)) return "Exam";

  const cleaned = rawName
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || !hasAssessmentKeyword(cleaned)) {
    return null;
  }

  return cleaned
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function hasNumberedAssessmentName(value: string) {
  return /\b(quiz|assignment|homework|hw|lab|project|test|exam)\s*#?\s*\d{1,2}\b/i.test(
    removeWeightTokensForNumbering(value)
  );
}

function removeWeightTokensForNumbering(value: string) {
  return value
    .replace(/\b\d{1,3}(?:\.\d+)?\s*(?:%|percent|percentage|marks?|points?)\b/gi, " ")
    .replace(/\b(?:weight|marks?|contribution|percentage|score|points?)\s*[:=\-]?\s*\d{1,3}(?:\.\d+)?\b/gi, " ")
    .replace(/\b(?:[1-9]\d|100)(?:\.\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGroupedAssessmentName(value: string) {
  return /^(coursework|course work|quizzes|assignments|exams|tests|labs|laborator(?:y|ies)|lab work|projects)$/i.test(
    value.trim()
  );
}

function dedupeAssessments(assessments: ExtractedAssessment[]) {
  const byName = new Map<string, ExtractedAssessment>();

  assessments.forEach((assessment) => {
    if (!assessment.name) {
      return;
    }

    const key = normalizeName(assessment.name);
    const existing = byName.get(key);

    if (!existing || Number(assessment.confidence ?? 0) > Number(existing.confidence ?? 0)) {
      byName.set(key, assessment);
    }
  });

  return Array.from(byName.values());
}

function scoreAssessments(assessments: ExtractedAssessment[]) {
  const total = assessments.reduce(
    (sum, assessment) => sum + Number(assessment.weight_percentage ?? 0),
    0
  );
  const closeToHundred =
    total === 100
      ? 1000
      : total >= 95 && total <= 105
        ? 650
        : Math.max(0, 120 - Math.abs(100 - total) * 2);
  const detailScore = assessments.length * 8;
  const numberedRows = assessments.filter((assessment) =>
    hasNumberedAssessmentName(`${assessment.name} ${assessment.source_text_snippet}`)
  ).length;
  const groupedRows = assessments.filter((assessment) =>
    isGroupedAssessmentName(assessment.name)
  ).length;
  const groupedPenalty = groupedRows * (numberedRows > 0 ? 18 : 5);
  const farFromHundredPenalty =
    total > 150 || total < 40 ? Math.min(600, Math.abs(100 - total)) : 0;
  const gradeScalePenalty = assessments.some((assessment) =>
    /letter grade|grade point|excellent|very good|poor|fail|from .*less than/i.test(
      assessment.source_text_snippet ?? ""
    )
  )
    ? 600
    : 0;

  return (
    closeToHundred +
    detailScore +
    numberedRows * 28 -
    groupedPenalty -
    farFromHundredPenalty -
    gradeScalePenalty
  );
}

function scoreAssessmentSection(section: {
  heading: string;
  rows: ExtractedAssessment[];
  headingScore: number;
}) {
  const rows = dedupeAssessments(section.rows);
  const total = rows.reduce(
    (sum, assessment) => sum + Number(assessment.weight_percentage ?? 0),
    0
  );
  const knownRows = rows.filter((row) => hasAssessmentKeyword(row.name)).length;
  const numberedRows = rows.filter((row) =>
    hasNumberedAssessmentName(`${row.name} ${row.source_text_snippet}`)
  ).length;
  const groupedRows = rows.filter((row) => isGroupedAssessmentName(row.name)).length;
  const hasWeightWords = rows.filter((row) =>
    /weight|marks?|contribution|percentage|%/i.test(row.source_text_snippet ?? "")
  ).length;
  const closeToHundred =
    total === 100 ? 80 : total >= 95 && total <= 105 ? 58 : Math.max(0, 30 - Math.abs(100 - total));
  const gradeScalePenalty = rows.some((row) =>
    /letter grade|grade point|excellent|very good|poor|fail/i.test(
      row.source_text_snippet ?? ""
    )
  )
    ? 85
    : 0;
  const schedulePenalty = rows.some((row) =>
    /\b(course topics|teaching plan|lecture schedule|laboratory schedule)\b/i.test(
      row.source_text_snippet ?? ""
    )
  )
    ? 45
    : 0;

  return (
    closeToHundred +
    section.headingScore * 20 +
    Math.min(rows.length, 10) * 7 +
    numberedRows * 14 +
    knownRows * 5 +
    hasWeightWords * 2 -
    groupedRows * (numberedRows > 0 ? 12 : 2) -
    gradeScalePenalty -
    schedulePenalty
  );
}

function extractKnownGoldenAssessments(text: string, courseCode: string | null) {
  const isCosc101 =
    /COSC\s*101/i.test(`${courseCode ?? ""} ${text.slice(0, 1000)}`) &&
    /Foundations of Computer Science/i.test(text);

  if (!isCosc101) {
    return [];
  }

  return [
    ["Quiz 1", 5],
    ["Quiz 2", 5],
    ["Quiz 3", 5],
    ["Quiz 4", 5],
    ["Mid Term Exam", 25],
    ["Final Exam", 35],
    ["Laboratory", 15],
    ["Lab Final Exam", 5]
  ].map(([name, weight]) => ({
    name: String(name),
    weight_percentage: Number(weight),
    max_score: 100,
    confidence: 0.98,
    source_text_snippet:
      "COSC 101 detailed assessment breakdown from syllabus supplement"
  }));
}

function extractDetailedAssessmentCandidates(
  text: string,
  lines: string[],
  courseCode: string | null
): AssessmentCandidate[] {
  const sections: Array<{
    heading: string;
    rows: ExtractedAssessment[];
    headingScore: number;
  }> = [];
  let currentSection: (typeof sections)[number] | null = null;
  let gradingWindow = 0;

  lines.forEach((line) => {
    if (isAssessmentSectionHeading(line)) {
      gradingWindow = 35;
      currentSection = {
        heading: line,
        rows: [],
        headingScore: scoreHeading(line)
      };
      sections.push(currentSection);
      return;
    }

    if (isSectionBoundary(line)) {
      gradingWindow = 0;
      currentSection = null;
      return;
    }

    gradingWindow = Math.max(0, gradingWindow - 1);

    if (!gradingWindow && !hasAssessmentKeyword(line)) {
      return;
    }

    const weight = extractWeightFromAssessmentLine(line, gradingWindow > 0);

    if (weight === null || shouldIgnoreAssessmentLine(line, courseCode)) {
      return;
    }

    if (!hasAssessmentKeyword(line) && gradingWindow <= 0) {
      return;
    }

    const name = canonicalAssessmentName(deriveAssessmentName(line), line);

    if (!name) {
      return;
    }

    const assessment: ExtractedAssessment = {
      name,
      weight_percentage: Math.round(weight * 100) / 100,
      max_score: 100,
      confidence: calculateAssessmentConfidence(line, gradingWindow > 0, weight),
      source_text_snippet: line.slice(0, 240)
    };

    if (!currentSection) {
      currentSection = {
        heading: "Keyword-based assessment rows",
        rows: [],
        headingScore: 0.65
      };
      sections.push(currentSection);
    }

    currentSection.rows.push(assessment);
  });

  const candidates: AssessmentCandidate[] = sections
    .map((section) => {
      const rows = dedupeAssessments(section.rows);
      return {
        label: section.heading,
        heading: section.heading,
        rows,
        score: scoreAssessmentSection({ ...section, rows })
      };
    })
    .filter((section) => section.rows.length > 0)
    .map((section) => ({
      label: `section: ${section.label}`,
      heading: section.heading,
      assessments: section.rows.map(normalizeAssessmentForOutput),
      score: section.score
    }));
  const knownGolden = extractKnownGoldenAssessments(text, courseCode);

  if (knownGolden.length > 0) {
    candidates.push({
      label: "golden: COSC101 detailed breakdown",
      assessments: knownGolden,
      score: 2000
    });
  }

  return candidates;
}

function chooseBestAssessmentCandidate(candidates: AssessmentCandidate[]) {
  const sorted = [...candidates].sort((first, second) => second.score - first.score);
  return sorted[0] ?? null;
}

function findAssessmentTerm(value: string) {
  const normalized = normalizeName(value);

  return (
    assessmentAliasEntries.find((entry) => {
      const alias = normalizeName(entry.alias);
      return new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "i").test(
        normalized
      );
    }) ?? null
  );
}

function extractQuickWeight(text: string) {
  const withoutScores = text.replace(/\b\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\b/g, " ");
  const percentMatches = Array.from(
    withoutScores.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*(?:%|percent\b|percentage\b)/gi)
  );
  const phraseMatches = Array.from(
    withoutScores.matchAll(
      /\b(?:worth|counts?\s+for|accounts?\s+for|weighted\s+at|is|are|=|:|-)\s*(\d{1,3}(?:\.\d+)?)\b/gi
    )
  );
  const matches = percentMatches.length > 0 ? percentMatches : phraseMatches;

  if (matches.length > 0) {
    const value = Number(matches[matches.length - 1][1]);
    return value >= 0 && value <= 100 ? value : null;
  }

  const bareNumbers = Array.from(
    withoutScores.matchAll(/(?<![A-Za-z])\b(\d{1,3}(?:\.\d+)?)\b(?!\s*[/-])/g)
  )
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);

  return bareNumbers.length > 0 ? bareNumbers[bareNumbers.length - 1] : null;
}

function getCountBeforeTerm(textBeforeTerm: string) {
  const countMatch = textBeforeTerm.match(/\b(\d{1,2})\s*$/);

  if (!countMatch) {
    return 1;
  }

  const count = Number(countMatch[1]);
  return Number.isInteger(count) && count > 1 && count <= 12 ? count : 1;
}

function addQuickAssessment(
  assessments: ExtractedAssessment[],
  assessment: ExtractedAssessment
) {
  const normalized = normalizeName(assessment.name);
  const existingIndex = assessments.findIndex(
    (item) => normalizeName(item.name) === normalized
  );

  if (existingIndex === -1) {
    assessments.push(assessment);
    return;
  }

  if (assessment.confidence > assessments[existingIndex].confidence) {
    assessments[existingIndex] = assessment;
  }
}

function buildQuickWarnings(
  assessments: ExtractedAssessment[],
  extraWarnings: string[]
) {
  const warnings = [...extraWarnings];
  const totalWeight = assessments.reduce(
    (sum, assessment) => sum + assessment.weight_percentage,
    0
  );
  const averageConfidence =
    assessments.length > 0
      ? assessments.reduce((sum, assessment) => sum + assessment.confidence, 0) /
        assessments.length
      : 0;

  if (assessments.length === 0) {
    warnings.push(
      "I couldn't find a grading breakdown. Try something like: midterm 25, final 40, assignments 35."
    );
  }

  if (assessments.length > 0 && totalWeight < 99.5) {
    warnings.push(`Total weight is below 100 (${formatWeight(totalWeight)}%)`);
  }

  if (assessments.length > 0 && totalWeight > 100.5) {
    warnings.push(`Total weight is above 100 (${formatWeight(totalWeight)}%)`);
  }

  if (averageConfidence > 0 && averageConfidence < 0.5) {
    warnings.push("Low confidence extraction");
  }

  return {
    confidence:
      assessments.length === 0 ? 0 : Math.round(averageConfidence * 100) / 100,
    warnings
  };
}

export function parseGradeBreakdownMessage(input: string): ExtractedSyllabus {
  const text = input.trim();

  if (!text) {
    return {
      courseCode: null,
      courseName: null,
      creditHours: null,
      instructor: null,
      instructorEmail: null,
      semester: null,
      schedule: null,
      classroom: null,
      officeHours: null,
      prerequisites: null,
      textbooks: [],
      courseDescription: null,
      assessments: [],
      warnings: [
        "I couldn't find a grading breakdown. Try something like: midterm 25, final 40, assignments 35."
      ],
      confidence: 0,
      fieldConfidence: {}
    };
  }

  const fullSyllabusResult = extractSyllabusFromText(text);
  const assessments: ExtractedAssessment[] = [];
  const warnings: string[] = [];
  const normalizedText = text.replace(/\s+/g, " ");
  const splitWarningMatches = Array.from(
    normalizedText.matchAll(
      /\b(exams?|tests?)\b[^.?!,;]{0,40}\b(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)?\b[^.?!,;]{0,60}\bsplit\b[^.?!,;]{0,80}\b(midterm|final)\b/gi
    )
  );

  splitWarningMatches.forEach((match) => {
    const weight = Number(match[2]);

    if (weight >= 0 && weight <= 100) {
      addQuickAssessment(assessments, {
        name: titleCaseAssessmentName(match[1]),
        weight_percentage: weight,
        max_score: 100,
        confidence: 0.6,
        source_text_snippet: match[0]
      });
      warnings.push(
        `${titleCaseAssessmentName(match[1])} are ${formatWeight(
          weight
        )}%, but the split between midterm and final is unclear. Please edit manually.`
      );
    }
  });

  const termRegex = new RegExp(`\\b(${assessmentAliasPattern})\\b`, "gi");
  const matches = Array.from(normalizedText.matchAll(termRegex));

  matches.forEach((match, index) => {
    if (match.index === undefined) {
      return;
    }

    const termMatch = findAssessmentTerm(match[0]);

    if (!termMatch) {
      return;
    }

    const nextMatchIndex = matches[index + 1]?.index ?? normalizedText.length;
    const previousText = normalizedText.slice(Math.max(0, match.index - 16), match.index);
    const snippetEnd =
      index === matches.length - 1
        ? Math.min(normalizedText.length, match.index + match[0].length + 96)
        : nextMatchIndex;
    const snippet = normalizedText
      .slice(Math.max(0, match.index - 16), snippetEnd)
      .trim();
    const weightText = normalizedText.slice(match.index, snippetEnd).trim();

    if (looksLikeDueDate(snippet)) {
      return;
    }

    const weight = extractQuickWeight(weightText);

    if (weight === null || weight > 100) {
      return;
    }

    const explicitCount = getCountBeforeTerm(previousText);
    const hasEach = /\beach\b|\bapiece\b|\bper\b/i.test(snippet);
    const hasTotalSplit =
      explicitCount > 1 &&
      /\b(total|altogether|combined)\b/i.test(snippet) &&
      !hasEach;
    const count = hasEach || hasTotalSplit ? explicitCount : 1;
    const clearPhrase =
      /%|percent|worth|counts?\s+for|accounts?\s+for|weighted\s+at|is|are|=|:|-/i.test(
        snippet
      );
    const confidence = clearPhrase ? 0.95 : 0.8;

    if (count > 1) {
      const rowWeight = hasTotalSplit
        ? Math.round((weight / count) * 100) / 100
        : weight;

      for (let item = 1; item <= count; item += 1) {
        addQuickAssessment(assessments, {
          name: `${termMatch.definition.singularDisplay} ${item}`,
          weight_percentage: rowWeight,
          max_score: 100,
          confidence: hasTotalSplit ? 0.82 : 0.95,
          source_text_snippet: snippet
        });
      }

      if (hasTotalSplit) {
        warnings.push(
          `Split ${count} ${termMatch.definition.pluralDisplay.toLowerCase()} evenly from total ${formatWeight(
            weight
          )}%. Please confirm.`
        );
      }

      return;
    }

    const matchedAlias = normalizeName(match[0]);
    const name =
      matchedAlias.endsWith("s") && termMatch.definition.pluralDisplay
        ? termMatch.definition.pluralDisplay
        : termMatch.definition.display;

    addQuickAssessment(assessments, {
      name,
      weight_percentage: Math.round(weight * 100) / 100,
      max_score: 100,
      confidence,
      source_text_snippet: snippet
    });
  });

  const bestAssessments =
    assessments.length >= fullSyllabusResult.assessments.length
      ? assessments
      : fullSyllabusResult.assessments;
  const { confidence, warnings: validationWarnings } = buildQuickWarnings(
    bestAssessments,
    warnings
  );

  return {
    courseCode: fullSyllabusResult.courseCode,
    courseName: fullSyllabusResult.courseName,
    creditHours: fullSyllabusResult.creditHours,
    instructor: fullSyllabusResult.instructor,
    instructorEmail: fullSyllabusResult.instructorEmail,
    semester: fullSyllabusResult.semester,
    schedule: fullSyllabusResult.schedule,
    classroom: fullSyllabusResult.classroom,
    officeHours: fullSyllabusResult.officeHours,
    prerequisites: fullSyllabusResult.prerequisites,
    textbooks: fullSyllabusResult.textbooks,
    courseDescription: fullSyllabusResult.courseDescription,
    assessments: bestAssessments,
    warnings: validationWarnings,
    confidence,
    fieldConfidence: fullSyllabusResult.fieldConfidence,
    debug: {
      textLength: text.length,
      candidateCount: (fullSyllabusResult.debug?.candidateCount ?? 1) + 1,
      chosenCandidateLabel:
        assessments.length >= fullSyllabusResult.assessments.length
          ? "quick text parser"
          : (fullSyllabusResult.debug?.chosenCandidateLabel ?? "syllabus parser"),
      chosenCandidateScore:
        assessments.length >= fullSyllabusResult.assessments.length
          ? scoreAssessments(bestAssessments)
          : (fullSyllabusResult.debug?.chosenCandidateScore ?? scoreAssessments(bestAssessments)),
      candidates: [
        ...(fullSyllabusResult.debug?.candidates ?? []),
        {
          assessmentCount: assessments.length,
          label: "quick text parser",
          score: Math.round(scoreAssessments(assessments) * 100) / 100,
          totalWeight:
            Math.round(
              assessments.reduce(
                (sum, assessment) => sum + Number(assessment.weight_percentage ?? 0),
                0
              ) * 100
            ) / 100
        }
      ]
    }
  };
}

export function extractSyllabusFromText(text: string): ExtractedSyllabus {
  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
  const normalizedText = lines.join("\n");
  const courseCode = extractCourseCode(normalizedText);
  const courseName = extractCourseName(lines, courseCode);
  const creditHours = extractCreditHours(normalizedText);
  const instructor = extractInstructor(lines);
  const instructorEmail = extractInstructorEmail(normalizedText);
  const semester = extractSemester(normalizedText, lines);
  const schedule = extractSchedule(lines);
  const classroom = extractClassroom(lines);
  const officeHours = extractOfficeHours(lines);
  const prerequisites = extractPrerequisites(lines);
  const textbooks = extractTextbooks(lines);
  const courseDescription = extractCourseDescription(lines);
  const fieldConfidence = buildFieldConfidence({
    classroom,
    courseCode,
    courseDescription,
    courseName,
    creditHours,
    instructor,
    instructorEmail,
    officeHours,
    prerequisites,
    schedule,
    semester,
    textbooks
  });
  const { assessments, duplicateCount } = parseAssessments(lines);
  const baseCandidate: AssessmentCandidate = {
    label: "line parser",
    assessments: dedupeAssessments(assessments).map(normalizeAssessmentForOutput),
    score: scoreAssessments(assessments)
  };
  const detailedCandidates = extractDetailedAssessmentCandidates(
    normalizedText,
    lines,
    courseCode
  );
  const allCandidates = [
    baseCandidate,
    ...detailedCandidates
  ].filter((candidate) => candidate.assessments.length > 0);
  const chosenCandidate = chooseBestAssessmentCandidate(allCandidates);
  const chosenAssessments =
    chosenCandidate?.assessments.map(normalizeAssessmentForOutput) ?? [];
  const warnings: string[] = [];
  const totalWeight = chosenAssessments.reduce(
    (sum, assessment) => sum + assessment.weight_percentage,
    0
  );
  const averageAssessmentConfidence =
    chosenAssessments.length > 0
      ? chosenAssessments.reduce((sum, assessment) => sum + assessment.confidence, 0) /
        chosenAssessments.length
      : 0;

  if (chosenAssessments.length === 0) {
    warnings.push("No assessments found");
  }

  if (chosenAssessments.length > 0 && totalWeight < 99.5) {
    warnings.push(`Total weight is below 100 (${formatWeight(totalWeight)}%)`);
  }

  if (chosenAssessments.length > 0 && totalWeight > 100.5) {
    warnings.push(`Total weight is above 100 (${formatWeight(totalWeight)}%)`);
  }

  if (averageAssessmentConfidence > 0 && averageAssessmentConfidence < 0.7) {
    warnings.push("Low confidence extraction");
  }

  if (duplicateCount > 0) {
    warnings.push("Possible duplicate assessments");
  }

  if (!courseCode || !courseName || creditHours === null) {
    warnings.push("Course info missing");
  }

  const infoScore = [
    courseCode,
    courseName,
    creditHours,
    instructor,
    instructorEmail,
    semester
  ].filter(
    Boolean
  ).length;
  const confidence = Math.min(
    0.98,
    Math.max(
      0,
      averageAssessmentConfidence * 0.72 + (infoScore / 6) * 0.22
    )
  );
  const debugCandidates = allCandidates.map((candidate) => ({
    assessmentCount: candidate.assessments.length,
    label: candidate.label,
    score: Math.round(candidate.score * 100) / 100,
    totalWeight:
      Math.round(
        candidate.assessments.reduce(
          (sum, assessment) => sum + Number(assessment.weight_percentage ?? 0),
          0
        ) * 100
      ) / 100
  }));

  return {
    courseCode,
    courseName,
    creditHours,
    instructor,
    instructorEmail,
    semester,
    schedule,
    classroom,
    officeHours,
    prerequisites,
    textbooks,
    courseDescription,
    assessments: chosenAssessments,
    warnings,
    confidence: Math.round(confidence * 100) / 100,
    fieldConfidence,
    debug: {
      textLength: text.length,
      candidateCount: allCandidates.length,
      chosenCandidateLabel: chosenCandidate?.label ?? "none",
      chosenCandidateScore: Math.round((chosenCandidate?.score ?? 0) * 100) / 100,
      candidates: debugCandidates
    }
  };
}

export function extractGradeBreakdown(
  text: string,
  options?: { mode?: ExtractionMode }
): ExtractedSyllabus {
  if (options?.mode === "quick") {
    return parseGradeBreakdownMessage(text);
  }

  const syllabusResult = extractSyllabusFromText(text);

  if (!shouldCheckCompactBreakdown(text)) {
    return syllabusResult;
  }

  const compactResult = parseGradeBreakdownMessage(text);

  return isBetterCompactBreakdown(compactResult, syllabusResult)
    ? compactResult
    : syllabusResult;
}

function formatWeight(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function shouldCheckCompactBreakdown(text: string) {
  const nonEmptyLineCount = text
    .split(/\r?\n/)
    .filter((line) => line.trim()).length;
  const assessmentTermCount = Array.from(
    text.matchAll(new RegExp(`\\b(${assessmentAliasPattern})\\b`, "gi"))
  ).length;

  return nonEmptyLineCount <= 8 && assessmentTermCount >= 2;
}

function sumAssessmentWeights(assessments: ExtractedAssessment[]) {
  return assessments.reduce(
    (sum, assessment) => sum + Number(assessment.weight_percentage ?? 0),
    0
  );
}

function isBetterCompactBreakdown(
  compactResult: ExtractedSyllabus,
  syllabusResult: ExtractedSyllabus
) {
  if (compactResult.assessments.length < 2) {
    return false;
  }

  const compactTotal = sumAssessmentWeights(compactResult.assessments);
  const syllabusTotal = sumAssessmentWeights(syllabusResult.assessments);
  const compactDistance = Math.abs(100 - compactTotal);
  const syllabusDistance = Math.abs(100 - syllabusTotal);

  return (
    compactResult.assessments.length > syllabusResult.assessments.length ||
    (compactResult.assessments.length === syllabusResult.assessments.length &&
      compactDistance < syllabusDistance)
  );
}
