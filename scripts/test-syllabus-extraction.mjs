import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";

const sourcePath = "src/lib/syllabus/extractSyllabus.ts";
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;
const moduleShim = { exports: {} };

new Function("exports", "module", compiled)(moduleShim.exports, moduleShim);

const {
  extractGradeBreakdown,
  extractSyllabusFromText,
  parseGradeBreakdownMessage
} = moduleShim.exports;

function getAssessment(result, name) {
  return result.assessments.find(
    (assessment) => assessment.name.toLowerCase() === name.toLowerCase()
  );
}

function expectAssessment(result, name, weight) {
  const assessment = getAssessment(result, name);

  assert.ok(
    assessment,
    `Expected assessment "${name}" in ${JSON.stringify(result.assessments)}`
  );
  assert.equal(assessment.weight_percentage, weight);
}

const commaSeparated = parseGradeBreakdownMessage(
  "quizzes 15, assignments 20, midterm 25, final 40"
);
expectAssessment(commaSeparated, "Quizzes", 15);
expectAssessment(commaSeparated, "Assignments", 20);
expectAssessment(commaSeparated, "Midterm", 25);
expectAssessment(commaSeparated, "Final Exam", 40);

const percentSeparated = parseGradeBreakdownMessage(
  "quizzes 15%, assignments 20%, midterm 25%, final 40%"
);
expectAssessment(percentSeparated, "Quizzes", 15);
expectAssessment(percentSeparated, "Assignments", 20);
expectAssessment(percentSeparated, "Midterm", 25);
expectAssessment(percentSeparated, "Final Exam", 40);

const multipleAssessments = parseGradeBreakdownMessage(
  "2 midterms worth 20% each, final 35%, homework 15%, participation 10%"
);
expectAssessment(multipleAssessments, "Midterm 1", 20);
expectAssessment(multipleAssessments, "Midterm 2", 20);
expectAssessment(multipleAssessments, "Final Exam", 35);
expectAssessment(multipleAssessments, "Homework", 15);
expectAssessment(multipleAssessments, "Participation", 10);

const compactText = parseGradeBreakdownMessage(
  "midterm 25 final 40 labs 20 project 15"
);
expectAssessment(compactText, "Midterm", 25);
expectAssessment(compactText, "Final Exam", 40);
expectAssessment(compactText, "Labs", 20);
expectAssessment(compactText, "Projects", 15);

const repeatedAssessments = parseGradeBreakdownMessage(
  "3 quizzes worth 5% each, midterm 25%, final 60%"
);
expectAssessment(repeatedAssessments, "Quiz 1", 5);
expectAssessment(repeatedAssessments, "Quiz 2", 5);
expectAssessment(repeatedAssessments, "Quiz 3", 5);
expectAssessment(repeatedAssessments, "Midterm", 25);
expectAssessment(repeatedAssessments, "Final Exam", 60);

const numberedRows = extractSyllabusFromText(`Assessment Methodology
Quiz 1 5%
Quiz 2 5%
Quiz 3 5%
Quiz 4 5%
Assignments 20%
Final Exam 60%`);
expectAssessment(numberedRows, "Quiz 1", 5);
expectAssessment(numberedRows, "Quiz 2", 5);
expectAssessment(numberedRows, "Quiz 3", 5);
expectAssessment(numberedRows, "Quiz 4", 5);

const assignmentRows = extractSyllabusFromText(`Course Evaluation
Assignment 1 10%
Assignment 2 10%
Project 30%
Final 50%`);
expectAssessment(assignmentRows, "Assignment 1", 10);
expectAssessment(assignmentRows, "Assignment 2", 10);

const totalSplit = parseGradeBreakdownMessage(
  "4 quizzes total 20%, midterm 30%, final 50%"
);
expectAssessment(totalSplit, "Quiz 1", 5);
expectAssessment(totalSplit, "Quiz 2", 5);
expectAssessment(totalSplit, "Quiz 3", 5);
expectAssessment(totalSplit, "Quiz 4", 5);
assert.ok(
  totalSplit.warnings.some((warning) => /Split 4 quizzes evenly/i.test(warning)),
  "Expected total split warning"
);

const groupedOnly = parseGradeBreakdownMessage(
  "quizzes total 20%, assignments 15%, midterm 25%, final 40%"
);
expectAssessment(groupedOnly, "Quizzes", 20);

const unclearSplit = parseGradeBreakdownMessage(
  "exams 50 split between midterm and final, assignments 30, quizzes 20"
);
expectAssessment(unclearSplit, "Exams", 50);
expectAssessment(unclearSplit, "Assignments", 30);
expectAssessment(unclearSplit, "Quizzes", 20);
assert.ok(
  unclearSplit.warnings.some((warning) =>
    /split between midterm and final is unclear/i.test(warning)
  ),
  "Expected unclear split warning"
);

const courseCode = parseGradeBreakdownMessage(
  "CS101 grading: final 40, homework 60"
);
expectAssessment(courseCode, "Final Exam", 40);
expectAssessment(courseCode, "Homework", 60);
assert.ok(
  courseCode.assessments.every(
    (assessment) => assessment.weight_percentage !== 101
  ),
  "Course code CS101 should not be treated as 101%"
);

const evaluationScheme = extractSyllabusFromText(`Evaluation Scheme
Midterm 30%
Final 40%
Assignments 20%
Participation 10%`);
expectAssessment(evaluationScheme, "Midterm", 30);
expectAssessment(evaluationScheme, "Final Exam", 40);
expectAssessment(evaluationScheme, "Assignments", 20);
expectAssessment(evaluationScheme, "Participation", 10);

const marksDistribution = extractSyllabusFromText(`Marks Distribution
Quiz 10 marks
Assignment 20 marks
Midterm 30 marks
Final 40 marks`);
expectAssessment(marksDistribution, "Quiz", 10);
expectAssessment(marksDistribution, "Assignment", 20);
expectAssessment(marksDistribution, "Midterm", 30);
expectAssessment(marksDistribution, "Final Exam", 40);

const courseworkAssessment = extractSyllabusFromText(`Coursework Assessment
Coursework Assessment 40%
Final Examination 60%`);
expectAssessment(courseworkAssessment, "Coursework Assessment", 40);
expectAssessment(courseworkAssessment, "Final Exam", 60);

const continuousAssessment = extractSyllabusFromText(`Continuous Assessment
Labs 20%
Project 20%
Final Exam 60%`);
expectAssessment(continuousAssessment, "Labs", 20);
expectAssessment(continuousAssessment, "Project", 20);
expectAssessment(continuousAssessment, "Final Exam", 60);

const gradeDistribution = extractSyllabusFromText(`Grade Distribution
Homework 15 percent
Quizzes 15 percent
Midterm 30 percent
Final 40 percent`);
expectAssessment(gradeDistribution, "Homework", 15);
expectAssessment(gradeDistribution, "Quizzes", 15);
expectAssessment(gradeDistribution, "Midterm", 30);
expectAssessment(gradeDistribution, "Final Exam", 40);

const compactSyllabusLine = extractGradeBreakdown(
  "Evaluation Scheme: Midterm 30%, Final 40%, Assignments 20%, Participation 10%",
  { mode: "syllabus" }
);
expectAssessment(compactSyllabusLine, "Midterm", 30);
expectAssessment(compactSyllabusLine, "Final Exam", 40);
expectAssessment(compactSyllabusLine, "Assignments", 20);
expectAssessment(compactSyllabusLine, "Participation", 10);

const metadata = extractSyllabusFromText(`Course Code and Title: (COSC 101) Foundations of Computer Science
Credit Hours: 3 Credits
Instructor: Menatalla Abououf
Email: menatalla.abououf@ku.ac.ae
Semester: Fall 2025
Schedule: Mondays and Wednesday: 14:00 - 14:50
Classroom: C04050
Office Hours: Mondays & Wednesdays: 12:00 - 2:00
Prerequisites: COSC 114
Textbooks:
- Foundations of Computer Science by Behrouz Forouzan
- C Programming Absolute Beginner's Guide by Dean Miller and Greg Perry
Course Catalog Description:
An introduction to foundations of computer science.
Assessment Methodology
Quiz 1 5%
Quiz 2 5%
Quiz 3 5%
Quiz 4 5%
Mid Term Exam 25%
Final Exam 35%
Laboratory 15%
Lab Final Exam 5%`);
assert.equal(metadata.courseCode, "COSC 101");
assert.equal(metadata.courseName, "Foundations of Computer Science");
assert.equal(metadata.creditHours, 3);
assert.equal(metadata.instructor, "Menatalla Abououf");
assert.equal(metadata.instructorEmail, "menatalla.abououf@ku.ac.ae");
assert.equal(metadata.semester, "Fall 2025");
assert.equal(metadata.classroom, "C04050");
assert.equal(metadata.prerequisites, "COSC 114");
assert.ok(metadata.textbooks.length >= 2, "Expected textbook extraction");
expectAssessment(metadata, "Quiz 1", 5);
expectAssessment(metadata, "Quiz 2", 5);
expectAssessment(metadata, "Quiz 3", 5);
expectAssessment(metadata, "Quiz 4", 5);

const cosc101Text = fs.readFileSync(
  "training-data/extracted-text/COSC101_Syllabus_and_Syllabus_Supplement.txt",
  "utf8"
);
const cosc101 = extractSyllabusFromText(cosc101Text);
["Quiz 1", "Quiz 2", "Quiz 3", "Quiz 4"].forEach((name) =>
  expectAssessment(cosc101, name, 5)
);

console.log("Syllabus extraction tests passed.");
