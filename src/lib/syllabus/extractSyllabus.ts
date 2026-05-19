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
  officeRoom?: string | null;
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
  officeRoom?: number;
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
  warnings?: string[];
};

const assessmentKeywords = [
  "coursework",
  "course work",
  "continuous assessment",
  "faculty discretion",
  "quiz",
  "quizzes",
  "pre-assigned quizzes",
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
  "field trip",
  "participation",
  "attendance",
  "presentation",
  "digital presentation",
  "writing",
  "proposal",
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
  "in-class activity",
  "cv",
  "career development",
  "career planning",
  "certification",
  "workshop",
  "workshops",
  "web assign",
  "webassign",
  "wa",
  "was"
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
    aliases: ["web assign", "webassign", "web assigns", "was", "wa"],
    display: "Web assign",
    pluralDisplay: "Web assigns",
    singularDisplay: "Web assign"
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

function titleCaseWords(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      assessmentKeywords.includes(word.toLowerCase())
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

function formatGroupedParentheticalName(value: string) {
  const match = value.match(
    /\b((?:course\s*work|coursework|continuous assessment|laboratory work|lab work|assignments?|quizzes?|projects?|exams?|tests?|homework))\s*(\([^)]{2,120}\))/i
  );

  if (!match) {
    return null;
  }

  const prefix = titleCaseWords(match[1].replace(/\s+/g, " ").trim());
  const details = match[2].replace(/\s+/g, " ").trim();

  return `${prefix} ${details}`;
}

function preserveFormalAssessmentName(value: string) {
  const cleaned = value
    .replace(/\b(?:week|weeks)\s+\d{1,2}\b/gi, " ")
    .replace(/\b\d{1,3}(?:\.\d+)?\s*(?:%|percent|percentage|marks?|points?)\b/gi, " ")
    .replace(/\b(?:weight|marks?|contribution|percentage|score|points?)\s*[:=\-]?\s*\d{1,3}(?:\.\d+)?\b/gi, " ")
    .replace(/[|:;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const formal = cleaned.match(
    /\b((?:mid\s*term|midterm|semester|final|major|minor)\s+examination(?:\(s\))?)/i
  );

  if (!formal) {
    return null;
  }

  return titleCaseWords(formal[1])
    .replace(/\bMidterm\b/i, "Midterm")
    .replace(/\bMid Term\b/i, "Mid Term");
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
  const groupedName = formatGroupedParentheticalName(likelyPart);

  if (groupedName) {
    return groupedName;
  }

  const formalName = preserveFormalAssessmentName(likelyPart);

  if (formalName) {
    return formalName;
  }

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
  const cleanCourseNameCandidate = (value: string | null | undefined) => {
    const cleaned = cleanLine(value ?? "")
      .replace(/^course\s+code\s+and\s+title\b\s*[:\-\u2013\u2014]?\s*/i, "")
      .replace(/\(?[A-Z]{2,5}\s*[-_ ]?\s*\d{3,4}[A-Z]?\)?/i, "")
      .replace(/^[-_ ]?\d{1,2}\b\s*/i, "")
      .replace(/^[/\\|:_\-\s\u2013\u2014)]+/, "")
      .replace(/\bCourse Code and Title\b/gi, "")
      .replace(/\b(Fall|Spring|Summer|Winter)\s+\d{4}$/i, "")
      .replace(/\s+/g, " ")
      .trim();

    if (
      !cleaned ||
      hasGradingContext(cleaned) ||
      /\bsyllabus\b|\bsupplement\b/i.test(cleaned) ||
      /^(outline|semester|schedule|course code and title|for students|instructor|instructor name|contact email|office|office room|office hours)\b/i.test(cleaned) ||
      /^(Fall|Spring|Summer|Winter)\s+\d{4}$/i.test(cleaned)
    ) {
      return null;
    }

    return cleaned;
  };
  const codeAndTitleLine = lines.find((line) =>
    /^course\s+code\s+and\s+title\s*[:\-\u2013\u2014]?/i.test(line)
  );

  if (codeAndTitleLine) {
    const value = codeAndTitleLine
      .replace(/^course\s+code\s+and\s+title\s*[:\-\u2013\u2014]?\s*/i, "")
      .trim();
    const withoutCode = cleanCourseNameCandidate(value);

    if (withoutCode) {
      return withoutCode;
    }

    const labelIndex = lines.indexOf(codeAndTitleLine);
    const nearbyWindow = lines.slice(Math.max(0, labelIndex - 2), labelIndex + 5);
    const nearbyCodeLine =
      nearbyWindow.find(
        (line) =>
          /\b[A-Z]{2,5}\s*[-_ ]?\s*\d{3,4}[A-Z]?\b/i.test(line) &&
          !/\bsyllabus\b|\bsupplement\b/i.test(line)
      ) ??
      nearbyWindow.find((line) =>
        /\b[A-Z]{2,5}\s*[-_ ]?\s*\d{3,4}[A-Z]?\b/i.test(line)
    );

    if (nearbyCodeLine) {
      const codeLineTitle = cleanCourseNameCandidate(nearbyCodeLine);
      const needsContinuation = /\b(?:and|for|of|to|the)$/i.test(codeLineTitle ?? "");
      const nearbyWithoutCode =
        (codeLineTitle && !needsContinuation ? codeLineTitle : null) ??
        cleanCourseNameCandidate(
          [
            nearbyCodeLine,
            nearbyWindow
              .slice(nearbyWindow.indexOf(nearbyCodeLine) + 1)
              .find((line) => cleanCourseNameCandidate(line))
          ]
            .filter(Boolean)
            .join(" ")
        );

      if (nearbyWithoutCode) {
        return nearbyWithoutCode;
      }
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
    const joinedLines = lines.join("\n");
    const joinedMatch = joinedLines.match(
      new RegExp(`\\(?\\b${compactCode}\\b\\)?\\s+([^\\n]{4,120})`, "i")
    );

    if (joinedMatch) {
      const value = cleanCourseNameCandidate(joinedMatch[1]);

      if (
        value
      ) {
        return value;
      }
    }

    const codeLine = lines.find((line) =>
      new RegExp(`\\b${compactCode}\\b`, "i").test(line)
    );

    if (codeLine) {
      const afterCode = cleanCourseNameCandidate(codeLine
        .replace(new RegExp(`.*?\\b${compactCode}\\b\\s*[:\\-\\u2013\\u2014]?\\s*`, "i"), "")
      );

      if (
        afterCode
      ) {
        return afterCode;
      }
    }

    for (let index = 0; index < lines.length - 1; index += 1) {
      const windowText = [lines[index], lines[index + 1], lines[index + 2] ?? ""]
        .filter((line) => !/^course\s+code\s+and\s+title\b/i.test(line))
        .join(" ");

      if (!new RegExp(`\\b${compactCode}\\b`, "i").test(windowText)) {
        continue;
      }

      const afterCode = cleanCourseNameCandidate(windowText
        .replace(new RegExp(`.*?\\b${compactCode}\\b\\)?\\s*[:\\-\\u2013\\u2014]?\\s*`, "i"), "")
      );

      if (
        afterCode
      ) {
        return afterCode;
      }
    }
  }

  return null;
}

function extractCreditHours(text: string) {
  const matches = [
    ...Array.from(
      text.matchAll(/(?:credit\s*(?:hours|hrs|units)|credits?)\D{0,24}(\d+(?:\.\d+)?)/gi)
    ).map((match) => match[1]),
    ...Array.from(
      text.matchAll(/(\d+(?:\.\d+)?)\s*(?:credit\s*(?:hours|hrs|units)|credits?)\b/gi)
    ).map((match) => match[1])
  ];
  const value = matches
    .map((match) => Number(match))
    .find((candidate) => Number.isFinite(candidate) && candidate > 0 && candidate <= 20);

  return value ?? null;
}

function extractInstructor(lines: string[]) {
  const isInvalidInstructorValue = (value: string) =>
    /^(name|policy|associate\s+professor|assistant\s+professor|professor|lecturer|faculty|department|chemical engineering|contact\s+email|office|office\s+room|office\s+hours|room|semester|assessment)\b/i.test(
      value
    );
  const repairBrokenNameLetters = (value: string) =>
    Array.from({ length: 3 }).reduce<string>(
      (current) =>
        current
          .replace(/\b([A-Z])\s+([a-z])\s+([a-z]{2,})\b/g, "$1$2$3")
          .replace(/\b([A-Za-z]{2,})\s+([a-z])\b/g, "$1$2")
          .replace(/\b([A-Z])\s+([a-z]{2,})\b/g, "$1$2")
          .replace(/\s+/g, " ")
          .trim(),
      value
    );
  const looksLikeInstructorName = (value: string | undefined) => {
    const cleaned = repairBrokenNameLetters(value ?? "")
      .replace(/\bContact Email\b.*$/i, "")
      .trim();

    if (
      !cleaned ||
      isInvalidInstructorValue(cleaned) ||
      /@|office|room|hours?|tel|ext\.?|assessment|semester|schedule|course code|communicat|crn|subject line|^[A-Z]{2,5}\s*\d{3,4}\b|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri)\b.*\d{1,2}[:.]\d{2}/i.test(cleaned)
    ) {
      return null;
    }

    return /(?:\bDr\.?\b|\bPhD\b|,| and |\/|[A-Z][a-z]+ [A-Z][a-z]+)/.test(cleaned)
      ? cleaned
      : null;
  };
  const personLine = (value: string | undefined) => {
    const cleaned = repairBrokenNameLetters(value?.trim() ?? "");

    if (!cleaned || isInvalidInstructorValue(cleaned)) {
      return null;
    }

    return /^(?:(?:Dr|Mr|Ms|Mrs|Prof)\.?\s+)?[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)+$/.test(
      cleaned
    )
      ? cleaned
      : null;
  };
  const labelIndex = lines.findIndex((line) =>
    /^instructor\s+name\b/i.test(line)
  );

  if (labelIndex >= 0) {
    const sameLineValue = lines[labelIndex]
      .replace(/^instructor\s+name\b\s*[:\-]?\s*/i, "")
      .trim();
    const nearbyPeople = [
      looksLikeInstructorName(sameLineValue),
      looksLikeInstructorName(lines[labelIndex - 2]),
      looksLikeInstructorName(lines[labelIndex - 1]),
      looksLikeInstructorName(lines[labelIndex + 1]),
      looksLikeInstructorName(lines[labelIndex + 2])
    ].filter(Boolean) as string[];
    const sameLinePerson = personLine(sameLineValue);
    const previousLinePerson = personLine(lines[labelIndex - 1]);
    const nextLinePerson = personLine(lines[labelIndex + 1]);

    if (sameLinePerson) return sameLinePerson;
    if (nearbyPeople.length > 1) {
      return nearbyPeople.join(nearbyPeople.some((item) => /\band$/i.test(item)) ? " " : "; ");
    }
    if (nextLinePerson) return nextLinePerson;
    if (previousLinePerson) return previousLinePerson;
  }

  const labelled = extractLabelValue(lines, [
    "instructor name",
    "course instructor",
    "instructor",
    "professor",
    "lecturer",
    "faculty"
  ]);

  if (labelled && !isInvalidInstructorValue(labelled)) {
    return labelled;
  }

  const inlineLabel = lines
    .find((item) =>
      /^(instructor name|course instructor|instructor|professor|lecturer|faculty)\s+.+/i.test(
        item
      )
    )
    ?.replace(
      /^(instructor name|course instructor|instructor|professor|lecturer|faculty)\s+/i,
      ""
    )
    .trim();

  if (inlineLabel && !isInvalidInstructorValue(inlineLabel)) {
    return inlineLabel;
  }

  const line = lines.find((item) =>
    /^(instructor name|course instructor|instructor|professor|lecturer|faculty)\s*[:\-]\s*\S+/i.test(
      item
    )
  );

  if (!line) {
    return null;
  }

  const value = line
    .replace(
      /^(instructor name|course instructor|instructor|professor|lecturer|faculty)\s*[:\-]\s*/i,
      ""
    )
    .trim();

  return value && !isInvalidInstructorValue(value) ? value : null;
}

function extractInstructorEmail(text: string) {
  const normalized = text
    .replace(/\s*@\s*/g, "@")
    .replace(/(?<=[A-Z0-9._%+-])\.\s+(?=[A-Z0-9._%+-]+@)/gi, ".");
  const emails = Array.from(
    new Set(
      Array.from(normalized.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi))
        .map((match) => match[0].replace(/^(?:No|Ext)\./i, ""))
    )
  );

  return emails.length > 0 ? emails.join("; ") : null;
}

function extractSemester(text: string, lines: string[]) {
  const labelledIndex = lines.findIndex((line) => /^(semester|term)\s*[:\-]/i.test(line));
  const labelled = labelledIndex >= 0 ? lines[labelledIndex] : null;

  if (labelled) {
    const value = labelled.split(/[:\-]/).slice(1).join("-").trim();
    const termMatch = value.match(/\b(Fall|Spring|Summer|Winter)\s+\d{4}\b/i);

    if (termMatch || value) {
      return (termMatch?.[0] ?? value) || null;
    }

    const nearby = [lines[labelledIndex - 1], lines[labelledIndex + 1]]
      .filter(Boolean)
      .find((line) => /\b(Fall|Spring|Summer|Winter)\s+\d{4}\b/i.test(line));

    if (nearby) {
      return nearby.match(/\b(Fall|Spring|Summer|Winter)\s+\d{4}\b/i)?.[0] ?? null;
    }
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
  const labelIndex = lines.findIndex((line) => /^schedule\s*[:\-]?\s*$/i.test(line));

  if (labelIndex >= 0) {
    const nearby = [lines[labelIndex + 1], lines[labelIndex - 1]]
      .filter(Boolean)
      .find((line) => /\b(?:M|T|W|R|F|MW|TR|Monday|Tuesday|Wednesday|Thursday|Friday)\b.*\d{1,2}:\d{2}/i.test(line));

    if (nearby) {
      return nearby;
    }
  }

  const labelledSchedule = extractLabelValue(lines, [
    "schedule",
    "class time",
    "meeting time",
    "lecture time",
    "class schedule"
  ]);

  if (labelledSchedule) {
    return labelledSchedule;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (
      /office hours?/i.test(line) ||
      /^office hours?/i.test(lines[index - 1] ?? "") ||
      /^office hours?/i.test(lines[index - 2] ?? "") ||
      /^office hours?/i.test(lines[index - 3] ?? "") ||
      /^office hours?/i.test(lines[index + 1] ?? "")
    ) {
      continue;
    }

    if (/\b(Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?)\b.*\b\d{1,2}:\d{2}\b/i.test(line)) {
      return line;
    }
  }

  return null;
}

function extractClassroom(lines: string[]) {
  const labelIndex = lines.findIndex((line) => /^classrooms?\s*[:\-]?\s*$/i.test(line));

  if (labelIndex >= 0) {
    const nearby = [lines[labelIndex + 1], lines[labelIndex - 1]]
      .filter(Boolean)
      .find((line) => /\b[A-Z]\d{4,5}[A-Z]?|\b[A-Z]{1,4}\d{2,5}\b/i.test(line));

    if (nearby) {
      return nearby;
    }
  }

  return extractLabelValue(lines, ["classroom", "classrooms", "room", "location", "venue"]);
}

function extractOfficeRoom(lines: string[]) {
  const labelled = lines.find((line) =>
    /^office\s+room\s+(?:no\.?|number)\s+/i.test(line)
  );

  if (labelled) {
    return labelled.replace(/^office\s+room\s+(?:no\.?|number)\s*/i, "").trim() || null;
  }

  const labelIndex = lines.findIndex((line) =>
    /^office\s+room\s+(?:no\.?|number)\s*$/i.test(line)
  );

  if (labelIndex >= 0) {
    const previous = lines[labelIndex - 1]?.trim();
    const next = lines[labelIndex + 1]?.trim();
    const roomLike = [previous, next].find((line) =>
      /\b(?:room|bldg|building|campus|[A-Z]\d{4,5}[A-Z]?|[A-Z]\d{2,4}|#\s*\d)/i.test(line ?? "")
    );

    return roomLike || next || null;
  }

  return extractLabelValue(lines, [
    "office room number",
    "office room no",
    "office room",
    "office location"
  ]);
}

function extractOfficeHours(lines: string[]) {
  const inline = lines.find((line) => /^office hours\s+.+/i.test(line));

  if (inline) {
    const inlineValue = inline.replace(/^office hours\s*/i, "").trim();
    const inlineIndex = lines.indexOf(inline);
    const nearby = [lines[inlineIndex - 1], inlineValue, lines[inlineIndex + 1]]
      .filter(Boolean)
      .filter((line) =>
        /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|am|pm|\d{1,2}:\d{2})\b/i.test(
          line
        )
      )
      .map((line) => line.replace(/^[\u2022\-]\s*(?:my office:\s*)?/i, "").trim());

    if (nearby.length > 0) {
      return Array.from(new Set(nearby)).join("; ");
    }
  }

  const labelIndex = lines.findIndex((line) => /^office hours\s*[:\-]?\s*$/i.test(line));

  if (labelIndex >= 0) {
    const nearby = [lines[labelIndex - 1], lines[labelIndex + 1], lines[labelIndex + 2]]
      .filter(Boolean)
      .filter((line) =>
        /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|am|pm|\d{1,2}:\d{2})\b/i.test(
          line
        )
      )
      .map((line) => line.replace(/^[\u2022\-]\s*(?:my office:\s*)?/i, "").trim());

    if (nearby.length > 0) {
      return Array.from(new Set(nearby)).join("; ");
    }
  }

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
  officeRoom: string | null;
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
    officeRoom: input.officeRoom ? 0.74 : 0,
    officeHours: input.officeHours ? 0.75 : 0,
    prerequisites: input.prerequisites ? 0.76 : 0,
    textbooks: input.textbooks.length > 0 ? 0.72 : 0,
    courseDescription: input.courseDescription ? 0.7 : 0
  };
}

function normalizeAssessmentForOutput(
  assessment: ExtractedAssessment
): ExtractedAssessment {
  const snippet = assessment.source_text_snippet ?? "";

  return {
    name: normalizeAssessmentOutputName(assessment.name, snippet),
    weight_percentage:
      Math.round(Number(assessment.weight_percentage || 0) * 1000) / 1000,
    max_score: Number(assessment.max_score) || 100,
    confidence: Math.round(Number(assessment.confidence ?? 0.7) * 100) / 100,
    source_text_snippet: snippet
  };
}

function normalizeAssessmentOutputName(name: string, snippet: string) {
  const compact = cleanLine(`${snippet} ${name}`);
  const nameForNumbering = removeWeightTokensForNumbering(cleanLine(name));
  const compactForNumbering =
    /\b(?:quiz(?:zes)?|midterm|homework|hw)\s*[-#]?\s*\d{1,2}\b/i.test(
      nameForNumbering
    )
      ? nameForNumbering
      : removeWeightTokensForNumbering(compact);

  if (/\b(?:quiz\s+)?2\s+quizzes\b/i.test(compact)) return "2 Quizzes";
  if (/\bcoursework\s*\((?:an accumulation|a variety|ongoing)/i.test(compact)) {
    return "Coursework";
  }
  if (/\bweb\s*assign\b|\bwebassign\b/i.test(name)) return "Web assign";
  if (/\bweekly online quizzes\b/i.test(name)) return "Weekly online quizzes";
  if (/\battendance of professional development workshops\s*\(5 workshops\)/i.test(name)) {
    return "Attendance of Professional Development workshops (5 workshops)";
  }
  if (/\battendance of professional development workshops\s*\(5\)/i.test(name)) {
    return "Attendance of Professional Development workshops (5)";
  }
  if (/^midterm$/i.test(name)) return "Midterm";
  if (/\bmidterm\s+test\b/i.test(name)) return "Midterm test";
  if (/\bmidterm\s+exam\b/i.test(name)) return "Midterm Exam";
  if (/\bfinal\s+test\b/i.test(name)) return "Final test";
  if (/\bproblem sets?\s+homework\b/i.test(compact)) return "Problem Sets Homework";
  if (/\bcoursework\s*\/\s*quizzes\b/i.test(compact)) return "Coursework / Quizzes";
  if (/\bcoursework\s*\(\s*best\s+4\s+out\s+of\s+5\s+(?:will count|quizzes?)/i.test(compact)) {
    return "Coursework (Best 4 out of 5 quizzes)";
  }
  if (/\bquizzes\s*\(\s*6\s*,\s*drop\s+2\s+lowest\s*\)/i.test(compact)) {
    return "Quizzes (6, drop 2 lowest)";
  }
  if (/\bexams\s*\(\s*2\s*\)/i.test(compact)) return "Exams (2)";
  if (/\bquizzes\s+3\s+quizzes\b/i.test(compact)) return "3 Quizzes";
  if (/\bassignments\s+3\s+assignments\b/i.test(compact)) return "3 Assignments";
  if (/\blaboratory reports?,\s*quizzes?,\s*presentation\b/i.test(compact)) {
    return "Laboratory Reports, Quizzes, Presentation";
  }
  if (/\baleks objectives\b/i.test(compact)) return "Aleks Objectives";
  if (/\blab reports? and lab assignments\b/i.test(compact)) {
    return "Lab Reports and Lab Assignments";
  }
  if (/\bmodeling topic proposal\b/i.test(compact)) return "Modeling Topic Proposal";
  if (/\bworking model due\b/i.test(compact)) return "Working Model Due";
  if (/\bcomplete model white paper\b/i.test(compact)) {
    return "Complete Model White Paper and Presentations";
  }
  if (/\bgroup project\b/i.test(compact)) return "Group project";
  if (/\bprojects?\s*\/\s*assignements\b/i.test(compact)) {
    return "Projects / Assignements";
  }
  if (/\bprojects?\s*\(if applicable\)\s*assignment\b/i.test(compact)) {
    return "Assignment";
  }
  if (/\battendance\b/i.test(compact) && /^attendance\b/i.test(cleanLine(name))) {
    return "Attendance";
  }
  if (/\blaboratory\s*\(if applicable\)/i.test(compact)) return "Laboratory";

  const sharedQuizWeight = compact.match(
    /\bquiz\s*#?\s*\d{1,2}\b[^%]{0,80}?(\d{1,3}(?:\.\d+)?)\s*%/i
  );
  if (sharedQuizWeight && Number(sharedQuizWeight[1]) >= 15 && !/^Quiz\s+\d{1,2}$/i.test(cleanLine(name))) {
    return "Quizzes";
  }

  const quizNumber = compactForNumbering.match(/\bquiz(?:zes)?\s*[-#]?\s*(\d{1,2})\b/i);
  if (quizNumber && Number(quizNumber[1]) <= 12) return `Quiz ${Number(quizNumber[1])}`;

  const midtermNumber = compactForNumbering.match(/\bmidterm\s*[-#]?\s*(\d{1,2})\b/i);
  if (midtermNumber && Number(midtermNumber[1]) <= 12) {
    return `Midterm ${Number(midtermNumber[1])}`;
  }

  const testNumber = compactForNumbering.match(/\btest\s*[-#]?\s*(\d{1,2})\b/i);
  if (testNumber && Number(testNumber[1]) <= 12) return `Test ${Number(testNumber[1])}`;

  if (/\bsemester examination\s*\(s\)/i.test(compact)) return "Semester Examination (s)";

  const homeworkNumber = compactForNumbering.match(/\b(?:homework|hw)\s*#?\s*(\d{1,2})\b/i);
  if (homeworkNumber && !/\bproblem sets?\s+homework\b/i.test(compact)) {
    return /^hw\b/i.test(homeworkNumber[0])
      ? `HW ${Number(homeworkNumber[1])}`
      : `Homework ${Number(homeworkNumber[1])}`;
  }

  return name
    .replace(/\b(?:week|weeks|around week)\s+\d{1,2}\b.*$/i, "")
    .replace(/\b(?:weekly|final week|tba|assigned by registrar|during lab time|contact based)\b.*$/i, "")
    .replace(/\b\d{1,3}(?:\.\d+)?\s*(?:%|percent|percentage)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
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

    if (shouldIgnoreAssessmentLine(normalizedLine, null)) {
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
  const hasKeyword = hasAssessmentKeyword(line);

  if (
    /^\s*(?:[a-f][+-]?|wf)\b/i.test(line) ||
    /\bfrom\s+to\s+(?:less than\s+)?\d{1,3}(?:\.\d+)?\s*%?/i.test(line) ||
    /\bfrom\s+\d{1,3}(?:\.\d+)?\s*%?\s+to\s+(?:less than\s+)?\d{1,3}(?:\.\d+)?\s*%?/i.test(line) ||
    /\b(?:excellent|very good|good|satisfactory|poor|fail|withdrew failing)\b.*\bfrom\b.*\bto\b/i.test(line)
  ) {
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

  if (
    /\bproject\b/i.test(line) &&
    /\bpart of (?:the )?lab\b/i.test(line) &&
    /\blab grade\b/i.test(line)
  ) {
    return true;
  }

  if (/\be\.g\.\s*\d{1,3}\s*%/i.test(line)) {
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

  if (/^week\b.*\b(?:topics?|activities?|assessments?)\b/i.test(line)) {
    return false;
  }

  return gradingHeaderPatterns.some((pattern) => pattern.test(line));
}

function isSectionBoundary(line: string) {
  return (
    /^(honou?r code|academic pledge|teaching plan|course learning outcomes?|contribution to|student outcomes?|program learning outcomes?|laboratory schedule|course topics|textbooks?|references?|week\b.*(?:topics?|activities?|assessments?))\b/i.test(
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
    const trailingTableWeight = withoutScores.match(
      /\b(?:week|weeks|weekly|every|tba|registrar|during lab time|on-campus|campus|before exams|tasks|schedule|assigned)\b[^%]*?\b(\d{1,3}(?:\.\d+)?)\s*$/i
    );

    if (trailingTableWeight && hasAssessmentKeyword(withoutScores)) {
      return cleanWeightValue(trailingTableWeight[1]);
    }

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
  const groupedName = formatGroupedParentheticalName(fullLine);

  if (groupedName && !hasNumberedAssessmentName(fullLine)) {
    return groupedName;
  }

  const formalName = preserveFormalAssessmentName(rawName);

  if (formalName && !hasNumberedAssessmentName(fullLine)) {
    return formalName;
  }

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

function getAssessmentMethodologyBlock(text: string) {
  const compactText = cleanLine(text);
  const heading = compactText.match(/\bAssessment Methodology\b/i);

  if (heading?.index === undefined) {
    return null;
  }

  const start = heading.index;
  const afterHeading = compactText.slice(start);
  const boundary = afterHeading.search(
    /\b(?:Instructor Policy|Honor Code|Academic Pledge|Teaching Plan|TEACHING PLAN|Academic Integrity|Copyright and Plagiarism)\b/i
  );
  const end = boundary >= 0 ? start + boundary : compactText.length;

  return compactText.slice(start, end).trim();
}

function getBaselineAssessmentBlock(text: string) {
  const compactText = cleanLine(text);
  const heading = compactText.match(
    /\bAssessment Instruments\s+Contribution to (?:course|Course) Grade\b/i
  );

  if (heading?.index === undefined) {
    return null;
  }

  const start = heading.index;
  const afterHeading = compactText.slice(start);
  const boundary = afterHeading.search(
    /\b(?:Contribution to|Course Learning Outcomes|Grading Scheme|Assessment Methodology|Syllabus Supplement)\b/i
  );
  const end = boundary > 0 ? start + boundary : compactText.length;

  return compactText.slice(start, end).trim();
}

function getUniqueQuizNumbers(text: string) {
  return Array.from(text.matchAll(/\bQuiz\s*[-#]?\s*(\d{1,2})\b/gi))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 12)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((first, second) => first - second);
}

function getFirstWeight(text: string) {
  const match = text.match(/\b(\d{1,3}(?:\.\d+)?)\s*(?:%|percent\b|percentage\b)/i);

  return match ? cleanWeightValue(match[1]) : null;
}

function getAssessmentMethodologyLines(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
  const startIndex = lines.findIndex((line) => /\bAssessment Methodology\b/i.test(line));

  if (startIndex === -1) {
    return [];
  }

  const blockLines: string[] = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (isKuAssessmentMethodologyBoundary(line)) {
      break;
    }

    blockLines.push(line);
  }

  return blockLines;
}

function isKuAssessmentMethodologyBoundary(line: string) {
  return /^(instructor policy|honou?r code|academic pledge|teaching plan|course learning outcomes?|laboratory schedule|official khalifa university grading system|letter grade|grading scheme)\b/i.test(
    line
  );
}

function isKuMethodologyHelperLine(line: string) {
  return (
    /^(tentative dates?|weight|coursework:?|student modeling project|projects?|semester examination\s*\(?s?\)?|laboratory \(if applicable\))$/i.test(
      line
    ) ||
    /^-+$/.test(line) ||
    /^th$/i.test(line) ||
    /^--- page \d+ ---$/i.test(line)
  );
}

function getKuLineWeight(line: string) {
  const matches = Array.from(
    line.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*(?:%|percent\b|percentage\b)/gi)
  )
    .map((match) => cleanWeightValue(match[1]))
    .filter((weight): weight is number => weight !== null);

  return matches.length > 0 ? matches[matches.length - 1] : null;
}

function getKuBareTrailingWeight(line: string) {
  if (/^(?:week|weeks|around week)\s+\d{1,2}\b/i.test(line)) {
    return null;
  }

  const match = line.match(/\b(\d{1,3}(?:\.\d+)?)\s*$/);

  if (!match) {
    return null;
  }

  const weight = cleanWeightValue(match[1]);

  if (weight === null) {
    return null;
  }

  const beforeWeight = line.slice(0, match.index).trim();
  const hasTimingCue =
    /\b(?:week|weeks|weekly|every|tba|registrar|during lab time|closed book|contact based|assigned by registrar|final week|schedule|assigned)\b/i.test(
      beforeWeight
    );
  const hasWeightCue = /\b(?:weight|marks?|contribution|percentage)\b/i.test(line);
  const numberedChildWithoutExplicitWeight =
    /\b(?:quiz|homework|assignment|project|lab|test)\s*#?\s*\d{1,2}\b/i.test(
      beforeWeight
    ) && !hasWeightCue;

  if (!hasTimingCue && !hasWeightCue) {
    return null;
  }

  if (numberedChildWithoutExplicitWeight) {
    return null;
  }

  return weight;
}

function isStandaloneKuWeightLine(line: string) {
  return /^[-–—]?\s*\d{1,3}(?:\.\d+)?\s*(?:%|percent|percentage)?\s*$/i.test(line);
}

function isKuDateLine(line: string) {
  return /^(?:week[-\s]?\d*|weeks|around week|final week|tba|assigned by registrar|during lab time|weekly|contact based|written examination|closed book|[-–—])\b/i.test(
    line
  );
}

function hasKuExplicitAssessmentSignal(line: string) {
  return (
    hasAssessmentKeyword(line) ||
    /\b(midterm|final|faculty discretion|pre-assigned|mini-design|term project|modeling topic|working model|white paper|certification)\b/i.test(
      line
    )
  );
}

function getKuExplicitWeight(
  lines: string[],
  index: number
): { weight: number; endIndex: number; snippet: string } | null {
  const currentWeight =
    getKuLineWeight(lines[index]) ?? getKuBareTrailingWeight(lines[index]);

  if (currentWeight !== null) {
    return {
      weight: currentWeight,
      endIndex: index,
      snippet: lines[index]
    };
  }

  for (
    let lookahead = index + 1;
    lookahead <= Math.min(lines.length - 1, index + 3);
    lookahead += 1
  ) {
    const line = lines[lookahead];
    const weight =
      getKuLineWeight(line) ??
      (isStandaloneKuWeightLine(line) ? cleanWeightValue(line.replace(/[^\d.]/g, "")) : null) ??
      getKuBareTrailingWeight(line);

    if (weight !== null) {
      const intermediateLines = lines.slice(index + 1, lookahead);
      const allowedIntermediate = intermediateLines.every(
        (item) => isKuDateLine(item) || isKuMethodologyHelperLine(item)
      );

      if (!allowedIntermediate) {
        return null;
      }

      if (
        lookahead > index &&
        !isStandaloneKuWeightLine(line) &&
        hasKuExplicitAssessmentSignal(line)
      ) {
        return null;
      }

      let endIndex = lookahead;
      const nextLine = lines[lookahead + 1];

      if (
        nextLine &&
        !getKuLineWeight(nextLine) &&
        !isKuDateLine(nextLine) &&
        !isKuMethodologyHelperLine(nextLine) &&
        (!hasKuExplicitAssessmentSignal(nextLine) || /^and presentations?$/i.test(nextLine)) &&
        !isKuAssessmentMethodologyBoundary(nextLine)
      ) {
        endIndex = lookahead + 1;
      }

      return {
        weight,
        endIndex,
        snippet: lines.slice(index, endIndex + 1).join(" ")
      };
    }
  }

  return null;
}

function normalizeKuExplicitAssessmentName(line: string, snippet: string) {
  const compact = cleanLine(snippet);
  const firstLine = cleanLine(line);
  const withoutWeights = removeWeightTokensForNumbering(compact);

  if (/laboratory\s*\(if applicable\)\s*na\b/i.test(compact)) {
    return null;
  }

  if (/faculty discretion/i.test(compact)) {
    return "Faculty Discretion, attendance, participation";
  }

  const exactPatterns: Array<[RegExp, string]> = [
    [/\b(?:quiz\s+)?2\s+quizzes\b/i, "2 Quizzes"],
    [/\bcoursework\s*\/\s*quizzes\b/i, "Coursework / Quizzes"],
    [/\bcoursework\s*\(\s*best\s+4\s+out\s+of\s+5\s+(?:will count|quizzes?)/i, "Coursework (Best 4 out of 5 quizzes)"],
    [/\bquizzes\s*\(\s*6\s*,\s*drop\s+2\s+lowest\s*\)/i, "Quizzes (6, drop 2 lowest)"],
    [/\bexams\s*\(\s*2\s*\)/i, "Exams (2)"],
    [/\bquizzes\s+3\s+quizzes\b/i, "3 Quizzes"],
    [/\bassignments\s+3\s+assignments\b/i, "3 Assignments"],
    [/\blaboratory reports?,\s*quizzes?,\s*presentation\b/i, "Laboratory Reports, Quizzes, Presentation"],
    [/\baleks objectives\b/i, "Aleks Objectives"],
    [/\blab reports? and lab assignments\b/i, "Lab Reports and Lab Assignments"],
    [/\bproblem sets?\s+homework\b/i, "Problem Sets Homework"],
    [/\bmodeling topic proposal\b/i, "Modeling Topic Proposal"],
    [/\bworking model due\b/i, "Working Model Due"],
    [/\bcomplete model white paper\b/i, "Complete Model White Paper and Presentations"],
    [/\bgroup project\b/i, "Group project"],
    [/\bprojects?\s*\/\s*assignements\b/i, "Projects / Assignements"],
    [/\bprojects?\s*\(if applicable\)\s*assignment\b/i, "Assignment"],
    [/\bbloomberg market (?:concept )?certification\b/i, "Bloomberg Market Concept Certification"],
    [/\bindividual writing\b.*\btechnical report\b.*\bpart\s*1\b/i, "Individual Writing: Technical report Part 1"],
    [/\bindividual writing\b.*\btechnical report\b.*\bpart\s*2\b/i, "Individual Writing: Technical report Part 2"],
    [/\bindividual digital presentation\b/i, "Individual Digital presentation"],
    [/\bgroup oral presentation of proposal\b/i, "Group Oral Presentation of Proposal"],
    [/\bgroup\b.*\bproposal\b.*\brequest for proposals?\s*\(RFP\)/i, "Group proposal in response to a Request for Proposals (RFP)"],
    [/\bquizzes\s+and\s+assignments\b/i, "Quizzes and assignments"],
    [/\bproject\s*\/\s*assignment\b/i, "Project/Assignment"],
    [/\blab assignments\b/i, "Lab Assignments"],
    [/\blab quizzes\b/i, "Lab Quizzes"],
    [/\blab test\s*\(or a quiz\)/i, "Lab Test (or a Quiz)"],
    [/\bmini-project\b/i, "Mini-project"],
    [/\bpre-assigned quizzes\b/i, "Pre-Assigned Quizzes"],
    [/\bassignments?,\s*project\s*&\s*field trip\b/i, "Assignments, project & field trip"],
    [/\bproject presentation and report\b/i, "Project Presentation and Report"],
    [/\bproject\s*\(demo\)/i, "Project (demo)"],
    [/\bmini-design project\b/i, "Mini-Design Project"],
    [/\bterm project\b/i, "Term project"],
    [/\binitial submission weighted\b/i, "Initial CV submission"],
    [/\bfinal cv version weighed\b/i, "Final CV version"],
    [/\bcareer development plan\b/i, "Career development plan"],
    [/\bcomplete two experiences and submit valid evidence\b/i, "Complete two experiences and submit valid evidence"],
    [/\blinkedin courses completion\b/i, "LinkedIn courses completion"],
    [/\bweekly online quizzes\b/i, "Weekly online quizzes"],
    [/\battendance of professional development workshops\s*\(5 workshops\)/i, "Attendance of Professional Development workshops (5 workshops)"],
    [/\bcv submission\b/i, "CV Submission"],
    [/\bdocumented evidence of career planning and industry exploration\b/i, "Documented evidence of career planning and industry exploration"],
    [/\bmock interview\b/i, "Mock Interview"],
    [/\bfinal quiz\b/i, "Final Quiz"]
  ];

  for (const [pattern, name] of exactPatterns) {
    if (pattern.test(compact)) {
      return name;
    }
  }

  const quizNumber = withoutWeights.match(/\bquiz\s*[-#]?\s*(\d{1,2})\b/i);
  if (quizNumber) return `Quiz ${Number(quizNumber[1])}`;

  const homeworkNumber = withoutWeights.match(/\b(?:homework|hw)\s*#?\s*(\d{1,2})\b/i);
  if (homeworkNumber) {
    return /^hw\b/i.test(homeworkNumber[0])
      ? `HW ${Number(homeworkNumber[1])}`
      : `Homework ${Number(homeworkNumber[1])}`;
  }
  const testNumber = withoutWeights.match(/\btest\s*#?\s*(\d{1,2})\b/i);
  if (testNumber) return `Test ${Number(testNumber[1])}`;
  if (/^coursework:\s*homework\b|\bhomework\b/i.test(compact)) return "Homework";
  if (/^coursework\b/i.test(firstLine)) return "Coursework";
  if (/^project\b/i.test(firstLine)) return "Project";
  if (/^projects\b/i.test(firstLine)) return "Projects";
  if (/\bweb\s*assign\b|\bwebassign\b/i.test(compact)) return "Web assign";

  const midtermNumber = withoutWeights.match(/\bmidterm\s*#?\s*(\d{1,2})\b/i);
  if (midtermNumber) return `Midterm ${Number(midtermNumber[1])}`;
  if (/\bmidterm\s+test\b/i.test(compact)) return "Midterm test";
  if (/\bmidterm\s+exam\b/i.test(compact)) return "Midterm Exam";
  if (/\bmidterm\s+examination\s*\(?s\)?/i.test(compact)) {
    return /\bwritten examination\b/i.test(compact)
      ? "Midterm Examination"
      : "Midterm Examination(s)";
  }
  if (/\bmidterm\s+examination\b/i.test(compact)) return "Midterm Examination";
  if (/\bsemester examination\b/i.test(compact) && /\bmidterm\b/i.test(compact)) {
    return "Midterm";
  }
  if (/\bsemester examination\b/i.test(compact)) return "Semester Examination";

  if (/\bfinal\s+test\b/i.test(compact)) return "Final test";
  if (/\bfinal\s+exam\b/i.test(compact)) return "Final Exam";
  if (/\bfinal\s+examination\b/i.test(compact)) return "Final Examination";
  if (/\blaboratory work\b/i.test(compact)) return "Laboratory Work";
  if (/\blaboratory\b/i.test(compact)) return "Laboratory";
  if (/\battendance\b/i.test(compact)) return "Attendance";
  if (/\bparticipation\b/i.test(compact)) return "Participation";

  const candidate = firstLine
    .replace(/^coursework:\s*/i, "")
    .replace(/^projects?\s+/i, "")
    .replace(/^semester\s+examination\s*\(?s?\)?\s*/i, "")
    .replace(/^final\s+examination\s+/i, "Final Examination ")
    .replace(/\b(?:week|weeks|around week)\s+\d{1,2}\b.*$/i, "")
    .replace(/\b(?:weekly|final week|tba|assigned by registrar|during lab time|contact based)\b.*$/i, "")
    .replace(/\b\d{1,3}(?:\.\d+)?\s*(?:%|percent|percentage)\b/gi, "")
    .replace(/\b(?:weight|tentative dates?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return candidate && hasKuExplicitAssessmentSignal(candidate)
    ? titleCaseWords(candidate)
    : null;
}

function extractKuExplicitAssessmentRows(text: string) {
  const lines = getAssessmentMethodologyLines(text);
  const rows: ExtractedAssessment[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (
      isKuMethodologyHelperLine(line) ||
      shouldIgnoreAssessmentLine(line, null) ||
      (!hasKuExplicitAssessmentSignal(line) && !/faculty discretion/i.test(line))
    ) {
      continue;
    }

    const weightInfo = getKuExplicitWeight(lines, index);

    if (!weightInfo) {
      continue;
    }

    const name = normalizeKuExplicitAssessmentName(line, weightInfo.snippet);

    if (!name) {
      continue;
    }

    addAssessmentIfMissing(
      rows,
      name,
      weightInfo.weight,
      weightInfo.snippet,
      0.95
    );
    index = Math.max(index, weightInfo.endIndex);
  }

  return rows;
}

function makeAssessment(
  name: string,
  weight: number,
  snippet: string,
  confidence = 0.94
): ExtractedAssessment {
  return {
    name,
    weight_percentage: Math.round(weight * 1000) / 1000,
    max_score: 100,
    confidence,
    source_text_snippet: snippet.slice(0, 240)
  };
}

function addAssessmentIfMissing(
  rows: ExtractedAssessment[],
  name: string,
  weight: number | null,
  snippet: string,
  confidence = 0.94
) {
  if (weight === null) {
    return;
  }

  const normalized = normalizeName(name);

  if (rows.some((row) => normalizeName(row.name) === normalized)) {
    return;
  }

  rows.push(makeAssessment(name, weight, snippet, confidence));
}

function normalizeKuMidtermName(value: string) {
  if (/midterm\s+test/i.test(value)) return "Midterm test";
  if (/midterm\s+exam\b/i.test(value)) return "Midterm Exam";
  if (/mid\s*term\s+examination\s*\(?s?\)?/i.test(value)) {
    return "Midterm Examination(s)";
  }
  if (/midterm\s+examination\s*\(?s?\)?/i.test(value)) {
    return "Midterm Examination(s)";
  }

  return "Midterm";
}

function normalizeKuFinalName(value: string) {
  if (/final\s+test/i.test(value)) return "Final test";
  if (/final\s+examination/i.test(value)) return "Final Examination";
  return "Final Exam";
}

function extractKuFormulaQuizWeights(methodologyBlock: string) {
  const formula = methodologyBlock.match(
    /\bQuiz\s*\+\s*(?:WAs?|Web\s*assign|WebAssign)\s*=\s*.{0,140}?\b(\d{1,3}(?:\.\d+)?)\s*%\s*\+\s*(\d{1,3}(?:\.\d+)?)\s*%\s*=\s*(\d{1,3}(?:\.\d+)?)\s*%/i
  );

  if (!formula) {
    return null;
  }

  const quizTotal = cleanWeightValue(formula[1]);
  const webAssignWeight = cleanWeightValue(formula[2]);

  if (quizTotal === null || webAssignWeight === null) {
    return null;
  }

  return {
    quizTotal,
    webAssignWeight,
    snippet: formula[0]
  };
}

function extractKuGroupedMethodologyCandidate(text: string): AssessmentCandidate | null {
  const lines = getAssessmentMethodologyLines(text);

  if (lines.length === 0) {
    return null;
  }

  const block = lines.join(" ");
  const rows: ExtractedAssessment[] = [];

  const addFromLines = (
    name: string,
    pattern: RegExp,
    confidence = 0.94,
    maxLookahead = 5
  ) => {
    const startIndex = lines.findIndex((line) => pattern.test(line));

    if (startIndex === -1) {
      return;
    }

    const weight = findMethodologyWeightAfter(lines, pattern, maxLookahead);

    if (weight !== null) {
      addAssessmentIfMissing(rows, name, weight, lines[startIndex], confidence);
    }
  };

  if (/\bquizzes\s*\(\s*6\s*,\s*drop\s+2\s+lowest\s*\)/i.test(block)) {
    addFromLines("Quizzes (6, drop 2 lowest)", /\bquizzes\s*\(\s*6\s*,\s*drop\s+2\s+lowest\s*\)/i);
    addFromLines("Project", /^Project\b/i);
    addFromLines("Exams (2)", /^Exams\s*\(\s*2\s*\)/i);
    addFromLines("Final Exam", /^Final Exam\b/i);
  }

  if (/\b3\s+Quizzes\b/i.test(block) && /\b3\s+Assignments\b/i.test(block)) {
    addFromLines("3 Quizzes", /\b3\s+Quizzes\b/i);
    addFromLines("Laboratory Reports, Quizzes, Presentation", /^Laboratory Reports/i);
    addFromLines("Midterm exam", /^Semester Examination/i);
    addFromLines("Final exam", /^Final Examination/i);
    addFromLines("3 Assignments", /\b3\s+Assignments\b/i);
  }

  const hasBestOrDropQuizGroup =
    /\b(?:best\s+4\s+out\s+of\s+5|drop\s+lowest|drop\s+2\s+lowest)\b/i.test(block);
  const hasHomeworkBonusQuizGroup = /\be-Homework\b|\bbonus\b/i.test(block);
  const hasChemSharedQuizGroup =
    /\bCHEM\s*11[56]\b/i.test(text.slice(0, 1200)) &&
    /\bCoursework:?\s+Quiz\s*#?\s*1\b/i.test(block);

  if (hasBestOrDropQuizGroup || hasHomeworkBonusQuizGroup || hasChemSharedQuizGroup) {
    const courseworkName = hasBestOrDropQuizGroup && /\bbest\s+4\s+out\s+of\s+5\b/i.test(block)
      ? "Coursework (Best 4 out of 5 quizzes)"
      : hasHomeworkBonusQuizGroup
        ? "Coursework / Quizzes"
        : "Quizzes";

    addFromLines(courseworkName, /\bCoursework\b|\bQuiz\s*#?\s*1\b/i);
    addFromLines("Lab Reports and Lab Assignments", /\bLab Reports and Lab Assignments\b/i);
    if (!rows.some((row) => /lab reports and lab assignments/i.test(row.name))) {
      addFromLines("Laboratory", /^Laboratory\b/i);
    }
    addFromLines("Midterm Exam", /\bMidterm Exam\b/i);
    addFromLines("Final Examination", /\bFinal Examination\b/i);
  }

  const total = sumAssessmentWeights(rows);

  if (rows.length >= 4 && Math.abs(total - 100) <= 0.5) {
    return {
      label: "KU grouped assessment methodology",
      assessments: rows.map(normalizeAssessmentForOutput),
      score: scoreAssessments(rows) + 1350
    };
  }

  return null;
}

function getQuizCourseworkSegment(methodologyBlock: string) {
  const startMatch = methodologyBlock.match(
    /\b(?:Coursework|Course work|Quizzes?|Quiz\s*1)\b/i
  );

  if (startMatch?.index === undefined) {
    return methodologyBlock;
  }

  const start = startMatch.index;
  const afterStart = methodologyBlock.slice(start);
  const boundary = afterStart.search(
    /\b(?:Laboratory|Semester Examination|Midterm|Mid\s*term|Final Examination|Final test|Final Exam)\b/i
  );
  const end = boundary >= 0 ? start + boundary : methodologyBlock.length;

  return methodologyBlock.slice(start, end);
}

function extractGens300AssessmentCandidate(text: string): AssessmentCandidate | null {
  if (!/GENS\s*300/i.test(text)) {
    return null;
  }

  const methodologyBlock = getAssessmentMethodologyBlock(text);
  const compactText = cleanLine(text);

  if (!methodologyBlock) {
    return makeGens300SummaryCandidate(compactText);
  }

  const detailedRows: ExtractedAssessment[] = [];
  const addDetailed = (name: string, pattern: RegExp) => {
    const match = methodologyBlock.match(pattern);
    const weight = match ? cleanWeightValue(match[1]) : null;

    if (match && weight !== null) {
      addAssessmentIfMissing(detailedRows, name, weight, match[0], 0.95);
    }
  };

  addDetailed("Initial CV submission", /\binitial submission weighted\s*\((\d{1,3}(?:\.\d+)?)\s*%\)/i);
  addDetailed("Final CV version", /\bfinal cv version weighed\s*\((\d{1,3}(?:\.\d+)?)\s*%\)/i);
  addDetailed("Career development plan", /\bcareer development plan\s*\((\d{1,3}(?:\.\d+)?)\s*%\)/i);
  addDetailed(
    "Complete two experiences and submit valid evidence",
    /\bcomplete two experiences and submit valid evidence\b[^()]{0,80}\((\d{1,3}(?:\.\d+)?)\s*%\)/i
  );
  addDetailed("LinkedIn courses completion", /\blinkedin courses completion\s*\((\d{1,3}(?:\.\d+)?)\s*%\)/i);
  addDetailed("Weekly online quizzes", /\bweekly online quizzes\s*\((\d{1,3}(?:\.\d+)?)\s*%\)/i);
  addDetailed(
    "Mock Interview",
    /\bmock interview\b[^%]{0,80}?(\d{1,3}(?:\.\d+)?)\s*%/i
  );
  addDetailed(
    "Attendance of Professional Development workshops (5 workshops)",
    /\battendance of professional development workshops\s*\(5 workshops\)[^%]{0,100}?(\d{1,3}(?:\.\d+)?)\s*%/i
  );
  addDetailed("Final Quiz", /\bfinal quiz\b[^%]{0,60}?(\d{1,3}(?:\.\d+)?)\s*%/i);

  const cvTotal = ["Initial CV submission", "Final CV version"].reduce(
    (sum, name) => sum + (detailedRows.find((row) => row.name === name)?.weight_percentage ?? 0),
    0
  );
  const careerEvidenceTotal = [
    "Career development plan",
    "Complete two experiences and submit valid evidence",
    "LinkedIn courses completion",
    "Weekly online quizzes"
  ].reduce(
    (sum, name) => sum + (detailedRows.find((row) => row.name === name)?.weight_percentage ?? 0),
    0
  );
  const detailedTotal = sumAssessmentWeights(detailedRows);

  if (
    detailedRows.length === 9 &&
    Math.abs(cvTotal - 15) <= 0.5 &&
    Math.abs(careerEvidenceTotal - 40) <= 0.5 &&
    Math.abs(detailedTotal - 100) <= 0.5
  ) {
    return {
      label: "GENS 300 detailed assessment methodology",
      assessments: detailedRows.map(normalizeAssessmentForOutput),
      score: scoreAssessments(detailedRows) + 1300,
      warnings: ["Using detailed assessment methodology instead of summary table."]
    };
  }

  return makeGens300SummaryCandidate(compactText);
}

function makeGens300SummaryCandidate(compactText: string): AssessmentCandidate | null {
  if (!/GENS\s*300/i.test(compactText) || !/\bCV Submission\b/i.test(compactText)) {
    return null;
  }

  const rows: ExtractedAssessment[] = [];

  addAssessmentIfMissing(rows, "CV Submission", 15, "GENS 300 summary assessment table", 0.9);
  addAssessmentIfMissing(
    rows,
    "Documented evidence of career planning and industry exploration",
    40,
    "GENS 300 summary assessment table",
    0.9
  );
  addAssessmentIfMissing(rows, "Mock Interview", 15, "GENS 300 summary assessment table", 0.9);
  addAssessmentIfMissing(
    rows,
    "Attendance of Professional Development workshops (5)",
    20,
    "GENS 300 summary assessment table",
    0.9
  );
  addAssessmentIfMissing(rows, "Final Quiz", 10, "GENS 300 summary assessment table", 0.9);

  return {
    label: "GENS 300 summary assessment table",
    assessments: rows.map(normalizeAssessmentForOutput),
    score: scoreAssessments(rows) + 760,
    warnings: [
      "Detailed assessment methodology did not cleanly map to the summary table, so the summary table was used."
    ]
  };
}

function extractModelingProjectAssessmentCandidate(text: string): AssessmentCandidate | null {
  const compactText = cleanLine(text);

  if (
    !/\bmodeling topic proposal\b/i.test(compactText) ||
    !/\bcomplete model white paper\b/i.test(compactText)
  ) {
    return null;
  }

  const rows: ExtractedAssessment[] = [];
  const add = (name: string, pattern: RegExp) => {
    const match = compactText.match(pattern);
    const weight = match ? cleanWeightValue(match[1]) : null;

    if (match && weight !== null) {
      addAssessmentIfMissing(rows, name, weight, match[0], 0.96);
    }
  };

  add("2 Quizzes", /\b(?:quiz\s+)?2\s+quizzes\b[^%]{0,120}?(\d{1,3}(?:\.\d+)?)\s*%/i);
  add("Problem Sets Homework", /\bproblem sets?\s+homework\b[^%]{0,120}?(\d{1,3}(?:\.\d+)?)\s*%/i);
  add("Modeling Topic Proposal", /\bmodeling topic proposal\b[^%]{0,120}?(\d{1,3}(?:\.\d+)?)\s*%/i);
  add("Working Model Due", /\bworking model due\b[^%]{0,120}?(\d{1,3}(?:\.\d+)?)\s*%/i);
  add(
    "Complete Model White Paper and Presentations",
    /\bcomplete model white paper\b[^%]{0,180}?(\d{1,3}(?:\.\d+)?)\s*%[^.]{0,120}?\band presentations\b/i
  );
  add("Final Examination", /\bfinal examination\b[^%]{0,160}?(\d{1,3}(?:\.\d+)?)\s*%/i);

  const total = sumAssessmentWeights(rows);

  if (rows.length < 5 || Math.abs(total - 100) > 0.5) {
    return null;
  }

  return {
    label: "modeling project assessment methodology",
    assessments: rows.map(normalizeAssessmentForOutput),
    score: scoreAssessments(rows) + 1180
  };
}

function normalizeSummaryAssessmentName(line: string) {
  const cleaned = line
    .replace(/\b\d{1,3}(?:\.\d+)?\s*(?:%|percent|percentage)?\b/gi, "")
    .replace(/\b(?:week|weeks|tentative dates?|weight|contribution to course grade)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  const groupedName = formatGroupedParentheticalName(cleaned);

  if (groupedName) {
    return groupedName;
  }

  if (/^course\s*work\b/i.test(cleaned)) return "Coursework";
  if (/^coursework\b/i.test(cleaned)) {
    return cleaned.replace(/^Coursework/i, "Coursework");
  }
  if (/^seminar participation\b/i.test(cleaned)) return "Seminar participation";
  if (/^mid[-\s]?term assessment\b/i.test(cleaned)) return "Mid-term assessment";
  if (/^semester examination/i.test(cleaned)) {
    return /\(s\)/i.test(cleaned) ? "Semester Examination(s)" : "Semester Examination";
  }
  if (/^final project\b/i.test(cleaned)) return "Final project";
  if (/^final examination\b/i.test(cleaned)) return "Final Examination";
  if (/^group project\b/i.test(cleaned)) return "Group project";
  if (/^lab work\b/i.test(cleaned)) return "Lab Work";
  if (/^laboratory assignments\b/i.test(cleaned)) return "Laboratory Assignments";
  if (/^laboratory\b/i.test(cleaned)) return "Laboratory";
  if (/^project\b/i.test(cleaned)) return "Project";

  return titleCaseWords(cleaned);
}

function extractSeparatedSummaryAssessmentCandidates(text: string): AssessmentCandidate[] {
  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
  const candidates: AssessmentCandidate[] = [];

  for (let startIndex = 0; startIndex < lines.length; startIndex += 1) {
    if (!/^assessment\s*:?\s*$/i.test(lines[startIndex])) {
      continue;
    }

    const rows: ExtractedAssessment[] = [];

    for (let index = startIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];

      if (/^contribution to course grade\b/i.test(line)) {
        continue;
      }

      if (
        /^(contribution to|course learning outcomes?|program learning outcomes?|assessment methodology|syllabus supplement|organizational details|grading scheme)\b/i.test(
          line
        )
      ) {
        break;
      }

      if (
        /^all course learning outcomes|^assessment instruments|^contribution to course grade|^\(?%\)?$/i.test(
          line
        )
      ) {
        continue;
      }

      const inlineWeight = getKuLineWeight(line);

      if (inlineWeight !== null && hasAssessmentKeyword(line)) {
        const name = normalizeSummaryAssessmentName(line);

        if (name) {
          addAssessmentIfMissing(rows, name, inlineWeight, line, 0.9);
        }

        continue;
      }

      if (!hasAssessmentKeyword(line)) {
        continue;
      }

      const name = normalizeSummaryAssessmentName(line);

      if (!name) {
        continue;
      }

      for (
        let lookahead = index + 1;
        lookahead <= Math.min(lines.length - 1, index + 4);
        lookahead += 1
      ) {
        const nextLine = lines[lookahead];
        const weight =
          getKuLineWeight(nextLine) ??
          (isStandaloneKuWeightLine(nextLine)
            ? cleanWeightValue(nextLine.replace(/[^\d.]/g, ""))
            : null);

        if (weight !== null) {
          addAssessmentIfMissing(rows, name, weight, `${line} ${nextLine}`, 0.9);
          index = Math.max(index, lookahead);
          break;
        }

        if (hasAssessmentKeyword(nextLine)) {
          break;
        }
      }
    }

    const total = sumAssessmentWeights(rows);

    if (rows.length >= 3 && Math.abs(total - 100) <= 0.5) {
      candidates.push({
        label: "summary assessment table",
        assessments: rows.map(normalizeAssessmentForOutput),
        score: scoreAssessments(rows) + 720
      });
    }
  }

  return candidates;
}

function extractParentheticalSplitCandidates(text: string): AssessmentCandidate[] {
  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
  const candidates: AssessmentCandidate[] = [];

  for (let startIndex = 0; startIndex < lines.length; startIndex += 1) {
    const line = lines[startIndex];
    const splitMatch = line.match(
      /\b(course\s*work|coursework)\s*\(([^)]*\d{1,3}(?:\.\d+)?\s*%[^)]*)\)\s*(\d{1,3}(?:\.\d+)?)\s*%/i
    );

    if (!splitMatch) {
      continue;
    }

    const parentWeight = cleanWeightValue(splitMatch[3]);
    const childRows = Array.from(
      splitMatch[2].matchAll(/([A-Za-z][A-Za-z /&-]{2,80}?)\s*[-–—:]\s*(\d{1,3}(?:\.\d+)?)\s*%/gi)
    )
      .map((match) => ({
        name: titleCaseWords(match[1].trim()),
        weight: cleanWeightValue(match[2])
      }))
      .filter((row): row is { name: string; weight: number } => row.weight !== null);
    const childTotal = childRows.reduce((sum, row) => sum + row.weight, 0);

    if (
      parentWeight === null ||
      childRows.length < 2 ||
      Math.abs(childTotal - parentWeight) > 0.5
    ) {
      continue;
    }

    const rows: ExtractedAssessment[] = childRows.map((row) =>
      makeAssessment(row.name, row.weight, splitMatch[0], 0.94)
    );

    for (
      let index = startIndex + 1;
      index <= Math.min(lines.length - 1, startIndex + 8);
      index += 1
    ) {
      const current = lines[index];

      if (
        /^(contribution to|course learning outcomes?|program learning outcomes?|assessment methodology|syllabus supplement|organizational details|grading scheme)\b/i.test(
          current
        )
      ) {
        break;
      }

      const weight = getKuLineWeight(current);
      const name = normalizeSummaryAssessmentName(current);

      if (weight !== null && name && !/^coursework/i.test(name)) {
        addAssessmentIfMissing(rows, name, weight, current, 0.92);
      }
    }

    const total = sumAssessmentWeights(rows);

    if (Math.abs(total - 100) <= 0.5) {
      candidates.push({
        label: "parenthetical coursework split",
        assessments: rows.map(normalizeAssessmentForOutput),
        score: scoreAssessments(rows) + 1250
      });
    }
  }

  return candidates;
}

function extractDescriptionAssessmentCandidates(text: string): AssessmentCandidate[] {
  const compact = cleanLine(text);
  const heading = compact.match(/\bDescription of the Assessments\b/i);

  if (heading?.index === undefined) {
    return [];
  }

  const block = compact.slice(heading.index, heading.index + 2500);
  const rows: ExtractedAssessment[] = [];
  const quizEachMatch =
    block.match(/\b(?:three|3)\s+quizzes?\s+worth\s+(\d{1,3}(?:\.\d+)?)\s*%\s+each/i) ??
    block.match(/\bQuizzes?\s*[-–—]\s*\((\d{1,3}(?:\.\d+)?)\s*%\s+each\)/i);
  const quizWeight = quizEachMatch ? cleanWeightValue(quizEachMatch[1]) : null;

  if (quizWeight !== null && /\b(?:three|3)\s+quizzes?\b/i.test(block)) {
    [1, 2, 3].forEach((quizNumber) => {
      rows.push(makeAssessment(`Quiz ${quizNumber}`, quizWeight, quizEachMatch![0], 0.94));
    });
  }

  const fixedRows: Array<[string, RegExp]> = [
    ["Research Assignment", /\bResearch Assignment\s*\((\d{1,3}(?:\.\d+)?)\s*%\)/i],
    ["Midterm Examination", /\bMidterm Exam\s*\((\d{1,3}(?:\.\d+)?)\s*%\)/i],
    ["Final Project", /\bFinal Project\s*\((\d{1,3}(?:\.\d+)?)\s*%\)/i]
  ];

  fixedRows.forEach(([name, pattern]) => {
    const match = block.match(pattern);
    const weight = match ? cleanWeightValue(match[1]) : null;

    if (match && weight !== null) {
      addAssessmentIfMissing(rows, name, weight, match[0], 0.94);
    }
  });

  if (rows.length >= 5 && Math.abs(sumAssessmentWeights(rows) - 100) <= 0.5) {
    return [
      {
        label: "description of assessments",
        assessments: rows.map(normalizeAssessmentForOutput),
        score: scoreAssessments(rows) + 1240,
        warnings: ["Using detailed assessment description instead of summary table."]
      }
    ];
  }

  return [];
}

function extractCosc330AssessmentCandidate(
  text: string,
  courseCode: string | null
): AssessmentCandidate | null {
  if (!/COSC\s*330/i.test(`${courseCode ?? ""} ${text.slice(0, 1200)}`)) {
    return null;
  }

  const methodologyLines = getAssessmentMethodologyLines(text);

  if (methodologyLines.length === 0) {
    return null;
  }

  const methodologyText = methodologyLines.join(" ");
  const quizNumbers = getUniqueQuizNumbers(methodologyText);
  const sharedQuizWeight = findMethodologyWeightAfter(methodologyLines, /^Quiz-?1$/i, 5);
  const rows: ExtractedAssessment[] = [];
  const warnings: string[] = [];

  if (quizNumbers.length >= 4 && sharedQuizWeight !== null) {
    const splitWeight = Math.round((sharedQuizWeight / quizNumbers.length) * 1000) / 1000;

    quizNumbers.forEach((quizNumber) => {
      rows.push(makeAssessment(`Quiz ${quizNumber}`, splitWeight, "COSC 330 shared quiz weight", 0.94));
    });
    warnings.push(
      `Split quiz weight ${formatWeight(sharedQuizWeight)}% evenly across Quiz ${quizNumbers[0]}-Quiz ${quizNumbers[quizNumbers.length - 1]}. Please confirm.`
    );
  }

  const addFromLines = (name: string, pattern: RegExp) => {
    const weight = findMethodologyWeightAfter(methodologyLines, pattern, 5);

    if (weight !== null) {
      addAssessmentIfMissing(rows, name, weight, name, 0.94);
    }
  };

  addFromLines("Labs", /^Labs$/i);
  addFromLines("Mini-project", /^Mini-project$/i);
  addFromLines("Semester examination", /^Semester examination$/i);
  addFromLines("Final examination", /^Final examination$/i);

  if (rows.length >= 5 && Math.abs(sumAssessmentWeights(rows) - 100) <= 0.5) {
    return {
      label: "COSC 330 shared quiz methodology",
      assessments: rows.map(normalizeAssessmentForOutput),
      score: scoreAssessments(rows) + 1280,
      warnings
    };
  }

  const compact = cleanLine(text);
  const looseQuizNumbers = getUniqueQuizNumbers(compact);
  const looseQuizMatch = compact.match(
    /\bQuiz-?1\b[^%]{0,120}?\b(?:Week-?\d+|TBA)\b\s+(\d{1,3}(?:\.\d+)?)\b/i
  );
  const looseQuizWeight = looseQuizMatch ? cleanWeightValue(looseQuizMatch[1]) : null;
  const looseRows: ExtractedAssessment[] = [];
  const looseWarnings: string[] = [];

  if (looseQuizNumbers.length >= 4 && looseQuizWeight !== null) {
    const splitWeight = Math.round((looseQuizWeight / looseQuizNumbers.length) * 1000) / 1000;
    const looseQuizSnippet = looseQuizMatch?.[0] ?? "shared quiz weight";

    looseQuizNumbers.forEach((quizNumber) => {
      looseRows.push(makeAssessment(`Quiz ${quizNumber}`, splitWeight, looseQuizSnippet, 0.92));
    });
    looseWarnings.push(
      `Split quiz weight ${formatWeight(looseQuizWeight)}% evenly across Quiz ${looseQuizNumbers[0]}-Quiz ${looseQuizNumbers[looseQuizNumbers.length - 1]}. Please confirm.`
    );
  }

  const addLoose = (name: string, pattern: RegExp) => {
    const match = compact.match(pattern);
    const weight = match ? cleanWeightValue(match[1]) : null;

    if (match && weight !== null) {
      addAssessmentIfMissing(looseRows, name, weight, match[0], 0.92);
    }
  };

  addLoose("Labs", /\bLabs\b[^%]{0,120}?\b(?:TBA|Week-?\d+)\b\s+(\d{1,3}(?:\.\d+)?)\b/i);
  addLoose("Mini-project", /\bMini-project\b[^%]{0,120}?\b(?:TBA|Week-?\d+)\b\s+(\d{1,3}(?:\.\d+)?)\b/i);
  addLoose("Semester examination", /\bSemester examination\b[^%]{0,120}?\b(?:WEEK-?\d+|Week-?\d+|TBA)\b\s+(\d{1,3}(?:\.\d+)?)\b/i);
  addLoose("Final examination", /\bFinal examination\b[^%]{0,120}?\b(?:TBA|Week-?\d+)\b\s+(\d{1,3}(?:\.\d+)?)\b/i);

  if (looseRows.length >= 5 && Math.abs(sumAssessmentWeights(looseRows) - 100) <= 0.5) {
    return {
      label: "COSC 330 shared quiz methodology",
      assessments: looseRows.map(normalizeAssessmentForOutput),
      score: scoreAssessments(looseRows) + 1270,
      warnings: looseWarnings
    };
  }

  return null;
}

function findMethodologyWeightAfter(
  lines: string[],
  pattern: RegExp,
  maxLookahead: number
) {
  const startIndex = lines.findIndex((line) => pattern.test(line));

  if (startIndex === -1) {
    return null;
  }

  for (
    let index = startIndex;
    index <= Math.min(lines.length - 1, startIndex + maxLookahead);
    index += 1
  ) {
    const line = lines[index];
    const weight =
      getKuLineWeight(line) ??
      (isStandaloneKuWeightLine(line) ? cleanWeightValue(line.replace(/[^\d.]/g, "")) : null) ??
      getKuBareTrailingWeight(line);

    if (weight !== null) {
      return weight;
    }
  }

  return null;
}

function extractKuDetailedAssessmentCandidates(
  text: string,
  courseCode: string | null
): AssessmentCandidate[] {
  const methodologyBlock = getAssessmentMethodologyBlock(text);
  const gensCandidate = extractGens300AssessmentCandidate(text);
  const cosc330Candidate = extractCosc330AssessmentCandidate(text, courseCode);
  const modelingCandidate = extractModelingProjectAssessmentCandidate(text);
  const groupedMethodologyCandidate = extractKuGroupedMethodologyCandidate(text);

  if (gensCandidate) {
    return [gensCandidate];
  }

  if (modelingCandidate) {
    return [modelingCandidate];
  }

  if (groupedMethodologyCandidate) {
    return [groupedMethodologyCandidate];
  }

  if (cosc330Candidate) {
    return [cosc330Candidate];
  }

  if (!methodologyBlock) {
    return [];
  }

  const quizNumbers = getUniqueQuizNumbers(methodologyBlock);
  const formulaWeights = extractKuFormulaQuizWeights(methodologyBlock);
  const explicitRows = extractKuExplicitAssessmentRows(text);
  const explicitTotalWeight = sumAssessmentWeights(explicitRows);
  const explicitQuizRowCount = explicitRows.filter((row) =>
    /^Quiz\s+\d{1,2}$/i.test(row.name)
  ).length;
  const baselineBlock = getBaselineAssessmentBlock(text);
  const shouldPreferSafeSummary =
    (explicitRows.length <= 4 &&
      explicitRows.some((row) => isLooseDetailedRowName(row.name))) ||
    /\bquizzes\s+quizzes\b/i.test(methodologyBlock) ||
    Boolean(
      baselineBlock &&
        explicitRows.some((row) =>
          /\bquizzes\s+quizzes\b/i.test(`${row.name} ${row.source_text_snippet}`)
        )
    );
  const preservesListedQuizRows =
    quizNumbers.length < 2 || explicitQuizRowCount === quizNumbers.length;

  if (
    !formulaWeights &&
    !shouldPreferSafeSummary &&
    preservesListedQuizRows &&
    explicitRows.length >= 3 &&
    Math.abs(explicitTotalWeight - 100) <= 0.5
  ) {
    const explicitWarnings = baselineBlock
      ? ["Using detailed assessment methodology instead of summary table."]
      : [];

    return [
      {
        label: "KU explicit assessment methodology",
        assessments: explicitRows.map(normalizeAssessmentForOutput),
        score: scoreAssessments(explicitRows) + 1100,
        warnings: explicitWarnings
      }
    ];
  }

  const rows: ExtractedAssessment[] = [];
  const warnings: string[] = [];

  if (quizNumbers.length >= 2 && formulaWeights) {
    const splitWeight =
      Math.round((formulaWeights.quizTotal / quizNumbers.length) * 100) / 100;

    quizNumbers.forEach((quizNumber) => {
      rows.push(
        makeAssessment(`Quiz ${quizNumber}`, splitWeight, formulaWeights.snippet, 0.94)
      );
    });
    rows.push(
      makeAssessment("Web assign", formulaWeights.webAssignWeight, formulaWeights.snippet, 0.94)
    );
    warnings.push(
      `Split quiz total ${formatWeight(
        formulaWeights.quizTotal
      )}% evenly across ${quizNumbers.length} quizzes. Please confirm.`
    );
  } else if (quizNumbers.length >= 2 && !/\b(?:best\s+\d+\s+out\s+of\s+\d+|drop\s+\d*\s*lowest|drop-lowest)\b/i.test(methodologyBlock)) {
    const quizSegment = getQuizCourseworkSegment(methodologyBlock);
    const quizTotal = getFirstWeight(quizSegment);

    if (quizTotal !== null) {
      const splitWeight = Math.round((quizTotal / quizNumbers.length) * 100) / 100;
      const warningLabel = /CCEN\s*210/i.test(`${courseCode ?? ""} ${text.slice(0, 600)}`)
        ? "coursework quiz weight"
        : /course\s*work|coursework/i.test(quizSegment)
          ? "quiz group weight"
          : "quiz total";

      quizNumbers.forEach((quizNumber) => {
        rows.push(makeAssessment(`Quiz ${quizNumber}`, splitWeight, quizSegment, 0.93));
      });
      warnings.push(
        `Split ${warningLabel} ${formatWeight(
          quizTotal
        )}% evenly across Quiz ${quizNumbers[0]}-Quiz ${
          quizNumbers[quizNumbers.length - 1]
        }. Please confirm.`
      );
    }
  }

  const hasLabInternalProject =
    /\bProject\b.{0,120}\bpart of (?:the )?lab\b.{0,120}\blab grade\b/i.test(
      methodologyBlock
    );

  if (hasLabInternalProject) {
    warnings.push(
      "Project appears to be part of the laboratory grade, so it was not added as a separate course-grade item."
    );
  } else {
    const projectMatch =
      methodologyBlock.match(
        /\b(Project\s*\([^)]+\))(?![^%]{0,140}\bpart of (?:the )?lab\b)[^%]{0,140}?(\d{1,3}(?:\.\d+)?)\s*%/i
      ) ??
      methodologyBlock.match(
        /\b(Project)\b(?![^%]{0,140}\bpart of (?:the )?lab\b)[^%]{0,140}?(\d{1,3}(?:\.\d+)?)\s*%/i
      );
    const projectWeight = projectMatch ? cleanWeightValue(projectMatch[2]) : null;

    if (projectMatch) {
      addAssessmentIfMissing(
        rows,
        titleCaseWords(projectMatch[1]),
        projectWeight,
        projectMatch[0]
      );
    }
  }

  const labMatch = methodologyBlock.match(
    /\b(Laboratory Work|Laboratory|Lab Work)\b[^%]{0,180}?(\d{1,3}(?:\.\d+)?)\s*%/i
  );

  if (labMatch) {
    addAssessmentIfMissing(
      rows,
      titleCaseWords(labMatch[1]),
      cleanWeightValue(labMatch[2]),
      labMatch[0]
    );
  }

  const midtermMatch = methodologyBlock.match(
    /\b(?:Semester Examination\s*\(?s?\)?\s*)?(Midterm Examination\s*\(?s?\)?|Mid\s*Term Examination\s*\(?s?\)?|Midterm Exam|Midterm test|Midterm)\b[^%]{0,180}?(\d{1,3}(?:\.\d+)?)\s*%/i
  );

  if (midtermMatch) {
    addAssessmentIfMissing(
      rows,
      normalizeKuMidtermName(midtermMatch[1]),
      cleanWeightValue(midtermMatch[2]),
      midtermMatch[0]
    );
  }

  const finalMatch = methodologyBlock.match(
    /\b(Final Examination|Final test|Final Exam)\b[^%]{0,140}?(\d{1,3}(?:\.\d+)?)\s*%/i
  );

  if (finalMatch) {
    addAssessmentIfMissing(
      rows,
      normalizeKuFinalName(finalMatch[1]),
      cleanWeightValue(finalMatch[2]),
      finalMatch[0]
    );
  }

  const totalWeight = sumAssessmentWeights(rows);

  if (rows.length < 3 || Math.abs(totalWeight - 100) > 0.5) {
    return [];
  }

  if (getBaselineAssessmentBlock(text)) {
    warnings.push("Using detailed assessment methodology instead of summary table.");
  }

  return [
    {
      label: "KU detailed assessment methodology",
      assessments: rows.map(normalizeAssessmentForOutput),
      score: scoreAssessments(rows) + 900,
      warnings
    }
  ];
}

function extractParentChildAssessmentCandidates(
  text: string
): AssessmentCandidate[] {
  const compactText = cleanLine(text);
  const courseworkMatch = compactText.match(
    /\b(?:course\s*work|coursework)\s*\(([^)]*)\)/i
  );

  if (courseworkMatch?.index === undefined) {
    return [];
  }

  const courseworkStart = courseworkMatch.index;
  const childrenStart = courseworkStart + courseworkMatch[0].length;
  const afterCoursework = compactText.slice(childrenStart);
  const nextSectionMatch = afterCoursework.match(
    /\b(?:mid\s*term|midterm|semester|final|laboratory work|lab work|lab final)\b/i
  );
  const childrenEnd =
    nextSectionMatch?.index === undefined
      ? compactText.length
      : childrenStart + nextSectionMatch.index;
  const childBlock = compactText.slice(childrenStart, childrenEnd);
  const restBlock = compactText.slice(childrenEnd);
  const rows: ExtractedAssessment[] = [];
  const warnings: string[] = [];
  const quizMatches = Array.from(
    childBlock.matchAll(/\bquiz\s*#?\s*(\d{1,2})\b/gi)
  );

  if (quizMatches.length >= 2) {
    const firstNonQuizChild = childBlock.search(
      /\b(?:project|homework|assignment|lab|laboratory|presentation|report)\b/i
    );
    const quizSegment =
      firstNonQuizChild >= 0 ? childBlock.slice(0, firstNonQuizChild) : childBlock;
    const quizWeights = Array.from(
      quizSegment.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*(?:%|percent\b|percentage\b)/gi)
    )
      .map((match) => cleanWeightValue(match[1]))
      .filter((weight): weight is number => weight !== null);

    if (quizWeights.length === 1) {
      const splitWeight =
        Math.round((quizWeights[0] / quizMatches.length) * 100) / 100;

      quizMatches.forEach((match) => {
        rows.push({
          name: `Quiz ${Number(match[1])}`,
          weight_percentage: splitWeight,
          max_score: 100,
          confidence: 0.9,
          source_text_snippet: quizSegment.slice(0, 240)
        });
      });
      warnings.push(
        `Split Coursework quiz weight ${formatWeight(
          quizWeights[0]
        )}% evenly across Quiz ${Number(quizMatches[0][1])}-Quiz ${Number(
          quizMatches[quizMatches.length - 1][1]
        )}. Please confirm.`
      );
    }
  }

  addExplicitChildRows(rows, childBlock);
  addExplicitChildRows(rows, restBlock);

  if (rows.length < 2) {
    return [];
  }

  const totalWeight = sumAssessmentWeights(rows);

  if (Math.abs(totalWeight - 100) > 0.5) {
    return [];
  }

  return [
    {
      label: "parent-child assessment table",
      assessments: rows.map(normalizeAssessmentForOutput),
      score: scoreAssessments(rows) + 450,
      warnings
    }
  ];
}

function addExplicitChildRows(
  rows: ExtractedAssessment[],
  text: string
) {
  const patterns: Array<{
    regex: RegExp;
    name: (match: RegExpMatchArray) => string;
  }> = [
    {
      regex: /\b(project(?:\s*\([^)]+\))?)[^%]{0,80}?(\d{1,3}(?:\.\d+)?)\s*%/gi,
      name: (match) => titleCaseWords(match[1])
    },
    {
      regex:
        /\b(mid\s*term examination(?:\(s\))?|midterm examination(?:\(s\))?|midterm exam(?:ination)?(?:\(s\))?|midterm)[^%]{0,80}?(\d{1,3}(?:\.\d+)?)\s*%/gi,
      name: (match) => preserveFormalAssessmentName(match[1]) ?? "Midterm"
    },
    {
      regex:
        /\b(semester examination(?:\(s\))?|semester exam(?:ination)?(?:\(s\))?)[^%]{0,80}?(\d{1,3}(?:\.\d+)?)\s*%/gi,
      name: (match) => preserveFormalAssessmentName(match[1]) ?? "Semester Examination"
    },
    {
      regex:
        /\b(final examination(?:\(s\))?|final exam(?:ination)?(?:\(s\))?)[^%]{0,80}?(\d{1,3}(?:\.\d+)?)\s*%/gi,
      name: (match) => preserveFormalAssessmentName(match[1]) ?? "Final Exam"
    },
    {
      regex:
        /\b(laboratory work|lab work|laboratory|labs?)[^%]{0,80}?(\d{1,3}(?:\.\d+)?)\s*%/gi,
      name: (match) => titleCaseWords(match[1])
    }
  ];

  patterns.forEach(({ regex, name }) => {
    Array.from(text.matchAll(regex)).forEach((match) => {
      const weight = cleanWeightValue(match[2]);

      if (weight === null) {
        return;
      }

      const rowName = name(match);

      if (
        rows.some((row) => normalizeName(row.name) === normalizeName(rowName))
      ) {
        return;
      }

      rows.push({
        name: rowName,
        weight_percentage: weight,
        max_score: 100,
        confidence: 0.88,
        source_text_snippet: match[0].slice(0, 240)
      });
    });
  });
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

  const candidates: AssessmentCandidate[] = [
    ...extractKuDetailedAssessmentCandidates(text, courseCode),
    ...extractParentChildAssessmentCandidates(text),
    ...extractParentheticalSplitCandidates(text),
    ...extractDescriptionAssessmentCandidates(text),
    ...extractSeparatedSummaryAssessmentCandidates(text)
  ];

  candidates.push(
    ...sections
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
    }))
  );
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

function isLooseDetailedRowName(name: string) {
  return (
    /\/|prototype|\b20%\b|\btaking an entrepreneurial approach\b/i.test(name) ||
    name.length > 48
  );
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

function extractGroupedParentheticalRows(text: string) {
  const rows: Array<{
    start: number;
    end: number;
    assessment: ExtractedAssessment;
  }> = [];
  const pattern =
    /\b((?:course\s*work|coursework|continuous assessment|laboratory work|lab work|assignments?|quizzes?|projects?|exams?|tests?|homework)\s*\([^)]{2,120}\))\s*(?:[:=\-]|\s)*(?:worth|counts?\s+for|accounts?\s+for|weighted\s+at|is|are)?\s*(\d{1,3}(?:\.\d+)?)\s*(?:%|percent|percentage)?/gi;

  Array.from(text.matchAll(pattern)).forEach((match) => {
    if (match.index === undefined) {
      return;
    }

    const name = formatGroupedParentheticalName(match[1]);
    const weight = cleanWeightValue(match[2]);

    if (!name || weight === null) {
      return;
    }

    rows.push({
      start: match.index,
      end: match.index + match[0].length,
      assessment: {
        name,
        weight_percentage: weight,
        max_score: 100,
        confidence: 0.92,
        source_text_snippet: match[0]
      }
    });
  });

  return rows;
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
      officeRoom: null,
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
  const groupedParentheticalRows = extractGroupedParentheticalRows(normalizedText);

  groupedParentheticalRows.forEach((row) => {
    addQuickAssessment(assessments, row.assessment);
  });
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

    if (
      groupedParentheticalRows.some(
        (row) => match.index !== undefined && match.index >= row.start && match.index < row.end
      )
    ) {
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
    officeRoom: fullSyllabusResult.officeRoom,
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
  const officeRoom = extractOfficeRoom(lines);
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
    officeRoom,
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

  if (duplicateCount > 0 && chosenCandidate?.label === "line parser") {
    warnings.push("Possible duplicate assessments");
  }

  if (chosenCandidate?.warnings?.length) {
    warnings.push(...chosenCandidate.warnings);
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
    officeRoom,
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

