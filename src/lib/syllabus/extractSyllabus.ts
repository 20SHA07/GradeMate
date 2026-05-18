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
  assessments: ExtractedAssessment[];
  warnings: string[];
  confidence: number;
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
    new RegExp(`\\b${keyword.replace(" ", "\\s+")}s?\\b`, "i").test(
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
  const titleLine = lines.find((line) =>
    /^(course\s*(name|title)|title)\s*[:\-]/i.test(line)
  );

  if (titleLine) {
    return (
      titleLine.split(/[:\-]/).slice(1).join("-").trim() ||
      null
    );
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
  const line = lines.find((item) =>
    /^(instructor|professor|lecturer|faculty)\s*[:\-]/i.test(item)
  );

  if (!line) {
    return null;
  }

  return line.split(/[:\-]/).slice(1).join("-").trim() || null;
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
      assessments: [],
      warnings: [
        "I couldn't find a grading breakdown. Try something like: midterm 25, final 40, assignments 35."
      ],
      confidence: 0
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

    const count = /\beach\b/i.test(snippet)
      ? getCountBeforeTerm(previousText)
      : 1;
    const clearPhrase =
      /%|percent|worth|counts?\s+for|accounts?\s+for|weighted\s+at|is|are|=|:|-/i.test(
        snippet
      );
    const confidence = clearPhrase ? 0.95 : 0.8;

    if (count > 1) {
      for (let item = 1; item <= count; item += 1) {
        addQuickAssessment(assessments, {
          name: `${termMatch.definition.singularDisplay} ${item}`,
          weight_percentage: weight,
          max_score: 100,
          confidence: 0.95,
          source_text_snippet: snippet
        });
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
    assessments: bestAssessments,
    warnings: validationWarnings,
    confidence
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
  const { assessments, duplicateCount } = parseAssessments(lines);
  const warnings: string[] = [];
  const totalWeight = assessments.reduce(
    (sum, assessment) => sum + assessment.weight_percentage,
    0
  );
  const averageAssessmentConfidence =
    assessments.length > 0
      ? assessments.reduce((sum, assessment) => sum + assessment.confidence, 0) /
        assessments.length
      : 0;

  if (assessments.length === 0) {
    warnings.push("No assessments found");
  }

  if (assessments.length > 0 && totalWeight < 99.5) {
    warnings.push(`Total weight is below 100 (${formatWeight(totalWeight)}%)`);
  }

  if (assessments.length > 0 && totalWeight > 100.5) {
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

  const infoScore = [courseCode, courseName, creditHours, instructor].filter(
    Boolean
  ).length;
  const confidence = Math.min(
    0.98,
    Math.max(
      0,
      averageAssessmentConfidence * 0.75 + (infoScore / 4) * 0.2
    )
  );

  return {
    courseCode,
    courseName,
    creditHours,
    instructor,
    assessments,
    warnings,
    confidence: Math.round(confidence * 100) / 100
  };
}

function formatWeight(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
