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

function expectAssessmentNames(result, names) {
  assert.deepEqual(
    result.assessments.map((assessment) => assessment.name),
    names
  );
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
expectAssessment(courseworkAssessment, "Final Examination", 60);

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

const groupedCourseworkTable = extractSyllabusFromText(`Assessment Instruments Contribution to course grade (%)
Coursework (quizzes, homework/project) 25%
Laboratory Work 15%
Semester Examination 25%
Final Examination 35%`);
expectAssessmentNames(groupedCourseworkTable, [
  "Coursework (quizzes, homework/project)",
  "Laboratory Work",
  "Semester Examination",
  "Final Examination"
]);
expectAssessment(groupedCourseworkTable, "Coursework (quizzes, homework/project)", 25);
expectAssessment(groupedCourseworkTable, "Laboratory Work", 15);
expectAssessment(groupedCourseworkTable, "Semester Examination", 25);
expectAssessment(groupedCourseworkTable, "Final Examination", 35);

const parentheticalOnly = parseGradeBreakdownMessage(
  "Coursework (quizzes, homework/project) 25%"
);
expectAssessmentNames(parentheticalOnly, [
  "Coursework (quizzes, homework/project)"
]);
expectAssessment(parentheticalOnly, "Coursework (quizzes, homework/project)", 25);

const explicitQuizRows = extractSyllabusFromText(`Assessment Methodology
Quiz 1 5%
Quiz 2 5%
Quiz 3 5%
Quiz 4 5%`);
expectAssessmentNames(explicitQuizRows, ["Quiz 1", "Quiz 2", "Quiz 3", "Quiz 4"]);
expectAssessment(explicitQuizRows, "Quiz 1", 5);
expectAssessment(explicitQuizRows, "Quiz 2", 5);
expectAssessment(explicitQuizRows, "Quiz 3", 5);
expectAssessment(explicitQuizRows, "Quiz 4", 5);

const childGroupedCoursework = extractSyllabusFromText(`Assessment Methodology
Coursework (quizzes, homework/project) Quiz 1 Week 5 Quiz 2 Week 10 Quiz 3 Week 12 Quiz 4 Week 14 15% Project (demo) Week 14 10% Midterm Examination(s) Week 8 25% Final Examination Week 16 35% Laboratory Work Weeks 14 15%`);
expectAssessment(childGroupedCoursework, "Quiz 1", 3.75);
expectAssessment(childGroupedCoursework, "Quiz 2", 3.75);
expectAssessment(childGroupedCoursework, "Quiz 3", 3.75);
expectAssessment(childGroupedCoursework, "Quiz 4", 3.75);
expectAssessment(childGroupedCoursework, "Project (demo)", 10);
expectAssessment(childGroupedCoursework, "Midterm Examination(s)", 25);
expectAssessment(childGroupedCoursework, "Final Examination", 35);
expectAssessment(childGroupedCoursework, "Laboratory Work", 15);
assert.equal(
  childGroupedCoursework.assessments.reduce(
    (sum, assessment) => sum + assessment.weight_percentage,
    0
  ),
  100
);
assert.ok(
  childGroupedCoursework.warnings.some((warning) =>
    /Split (?:Coursework quiz|quiz group) weight 15% evenly across Quiz 1-Quiz 4/i.test(warning)
  ),
  "Expected grouped quiz split warning"
);

const cosc202KuDetailed = extractSyllabusFromText(`COSC 202 Data Science and Artificial Intelligence
(2 Lecture 3 Laboratory - 3 Credits)
Assessment
Assessment Instruments Contribution to course grade (%)
Coursework (quizzes, homework/project) 25%
Laboratory Work 15%
Semester Examination 25%
Final Examination 35%
Assessment Methodology
Tentative Dates Weight (%)
Quiz 1 Week 5
Quiz 2 Week 10
15%
Coursework (quizzes, homework/project) Quiz 3 Week 12
Quiz 4 Week 14
Project (demo) Week 14 10%
Midterm Examination (s) Week 8 25%
Final Examination Week 16 35%
Laboratory Work Weeks 14 15%`);
expectAssessmentNames(cosc202KuDetailed, [
  "Quiz 1",
  "Quiz 2",
  "Quiz 3",
  "Quiz 4",
  "Project (demo)",
  "Laboratory Work",
  "Midterm Examination(s)",
  "Final Examination"
]);
expectAssessment(cosc202KuDetailed, "Quiz 1", 3.75);
expectAssessment(cosc202KuDetailed, "Quiz 4", 3.75);
expectAssessment(cosc202KuDetailed, "Project (demo)", 10);
expectAssessment(cosc202KuDetailed, "Laboratory Work", 15);
assert.equal(
  cosc202KuDetailed.assessments.reduce(
    (sum, assessment) => sum + assessment.weight_percentage,
    0
  ),
  100
);
assert.ok(
  cosc202KuDetailed.warnings.some((warning) =>
    /Split quiz group weight 15% evenly across Quiz 1-Quiz 4/i.test(warning)
  ),
  "Expected COSC202 quiz group split warning"
);
assert.ok(
  cosc202KuDetailed.warnings.some((warning) =>
    /Using detailed assessment methodology instead of summary table/i.test(warning)
  ),
  "Expected detailed methodology warning"
);

const phys121KuDetailed = extractSyllabusFromText(`Course Code and Title: PHYS 121 _ University Physics I
Spring 2026
Assessment Methodology
Coursework Tentative Dates Weight
Quizzes: Quiz 1 Quiz + WAs =
4 descriptive questions /30 Quiz 2 24% + 6% = 30%
min Quiz 3
Quiz 4
Web assign
Laboratory 1-lab report per each During lab time 20%
Semester Examination (s) Midterm test Feb 27, 2026 20%
Final test TBA (registrar office) 30%
Teaching Plan (Lectures):
Week 3 Quiz 1
Week 6 Quiz 2`);
expectAssessmentNames(phys121KuDetailed, [
  "Quiz 1",
  "Quiz 2",
  "Quiz 3",
  "Quiz 4",
  "Web assign",
  "Laboratory",
  "Midterm test",
  "Final test"
]);
expectAssessment(phys121KuDetailed, "Quiz 1", 6);
expectAssessment(phys121KuDetailed, "Web assign", 6);
expectAssessment(phys121KuDetailed, "Laboratory", 20);
expectAssessment(phys121KuDetailed, "Midterm test", 20);
expectAssessment(phys121KuDetailed, "Final test", 30);
assert.equal(
  phys121KuDetailed.assessments.reduce(
    (sum, assessment) => sum + assessment.weight_percentage,
    0
  ),
  100
);
assert.ok(
  phys121KuDetailed.warnings.some((warning) =>
    /Split quiz total 24% evenly across 4 quizzes/i.test(warning)
  ),
  "Expected PHYS121 quiz formula split warning"
);

const ccen210KuDetailed = extractSyllabusFromText(`CCEN 210 Digital Logic Design
(3 Lecture hours, 3 Laboratory/Studio hours, 4 Credits)
Assessment
Assessment Instruments Contribution to Course Grade (%) Week # CLO(s)
Coursework (Quizzes, homework) 20% 1, 2, 4
Laboratory 20% 1, 2, 3, 4
Semester Examination 20% 1, 4
Final Examination 40% 1, 2, 4
Assessment Methodology
Tentative Dates Weight
Coursework: Quiz 1 Around week 3 (Tentative) 20%
Quiz 2 Around week 5 (Tentative)
Quiz 3 Around week 11 (Tentative)
Quiz 4 Around week 13 (Tentative)
Project Project is part of the lab with 20% Last week of semester
of the lab grade
Laboratory There are 7-labs and mini project Weekly starting third week of 20%
Semester Examination (s) Midterm Exam Week 9 (Tentative) 20%
Final Examination Final Examination 40%`);
expectAssessmentNames(ccen210KuDetailed, [
  "Quiz 1",
  "Quiz 2",
  "Quiz 3",
  "Quiz 4",
  "Laboratory",
  "Midterm Exam",
  "Final Examination"
]);
expectAssessment(ccen210KuDetailed, "Quiz 1", 5);
expectAssessment(ccen210KuDetailed, "Quiz 4", 5);
expectAssessment(ccen210KuDetailed, "Laboratory", 20);
expectAssessment(ccen210KuDetailed, "Midterm Exam", 20);
expectAssessment(ccen210KuDetailed, "Final Examination", 40);
assert.ok(
  ccen210KuDetailed.warnings.some((warning) =>
    /Split coursework quiz weight 20% evenly across Quiz 1-Quiz 4/i.test(warning)
  ),
  "Expected CCEN210 coursework split warning"
);
assert.ok(
  ccen210KuDetailed.warnings.some((warning) =>
    /Project appears to be part of the laboratory grade/i.test(warning)
  ),
  "Expected lab-internal project warning"
);

const cheg312Detailed = extractSyllabusFromText(`Course Code and Title CHEG 312 Numerical Methods for Chemical Engineers
Semester: Spring 2026
Dr. Khalid Al Ali
Instructor Name Associate Professor
khalid.alali@ku.ac.ae
Office Room No. SAN Arzanah Bldg. 2F, Room # 8-271
Assessment Methodology
Tentative Dates Weight
Coursework: Homework Weekly 10%
Faculty Discretion, attendance,
- 5%
participation
Quiz 1 (Solving system of linear equations) Week 4 2%
Quiz 2 (Solving non-linear equations) Week 6 2%
Quiz 3 (Polynomial Interpolation) Week 5 2%
Quiz 4 (Numerical Integration + Differentiation) Week 6 2%
Quiz 5 (ODE-IVP & ODE-BVP) Week 9 2%
Projects Project Presentation and Report Week 16: April 28, 2026 15%
Semester Midterm 1 Week 7: Feb 26, 2026 15%
Examination (s)
Midterm 2 Week 13: April 16, 2026 15%
Final Examination Final Exam TBA 30%
Instructor Policy on late submission of assignments:`);
assert.equal(cheg312Detailed.instructor, "Dr. Khalid Al Ali");
assert.equal(cheg312Detailed.officeRoom, "SAN Arzanah Bldg. 2F, Room # 8-271");
expectAssessmentNames(cheg312Detailed, [
  "Homework",
  "Faculty Discretion, attendance, participation",
  "Quiz 1",
  "Quiz 2",
  "Quiz 3",
  "Quiz 4",
  "Quiz 5",
  "Project Presentation and Report",
  "Midterm 1",
  "Midterm 2",
  "Final Exam"
]);
expectAssessment(cheg312Detailed, "Homework", 10);
expectAssessment(cheg312Detailed, "Faculty Discretion, attendance, participation", 5);
expectAssessment(cheg312Detailed, "Quiz 5", 2);
expectAssessment(cheg312Detailed, "Project Presentation and Report", 15);
expectAssessment(cheg312Detailed, "Midterm 1", 15);
expectAssessment(cheg312Detailed, "Midterm 2", 15);

const cheg232Detailed = extractSyllabusFromText(`Course Code and Title CHEG 232 Fluid Mechanics
Spring 2025
Semester:
Instructor Name Dr. Haitem Hassan-Beck
Contact Email/ Office Ext. No. haitem.hassanbeck@ku.ac.ae/ 5817
Assessment Methodology
Tentative Dates Weight
Coursework: Quiz 1 Week 3 2%
Quiz 2 Week 5 2%
Quiz 3 Week 9 2%
Quiz 4 Week 11 2%
Quiz 5 Week 15 2%
Assignments, project & field trip Week 12 10%
Semester Examination (s) Midterm Week 7 20%
Laboratory - - 20%
Final Examination TBA 40%
Instructor Policy on late submission of assignments:
Teaching Plan
Week 3 Test 1
Week 6 Test 2`);
assert.equal(cheg232Detailed.semester, "Spring 2025");
expectAssessmentNames(cheg232Detailed, [
  "Quiz 1",
  "Quiz 2",
  "Quiz 3",
  "Quiz 4",
  "Quiz 5",
  "Assignments, project & field trip",
  "Midterm",
  "Laboratory",
  "Final Examination"
]);
expectAssessment(cheg232Detailed, "Quiz 1", 2);
expectAssessment(cheg232Detailed, "Assignments, project & field trip", 10);
expectAssessment(cheg232Detailed, "Midterm", 20);
assert.equal(
  cheg232Detailed.assessments.some((assessment) => /test\s+[12]/i.test(assessment.name)),
  false
);

const cheg350DocxStyle = extractSyllabusFromText(`Course Code and Title
CHEG 350 Materials Science & Engineering
Semester:
Spring 2026
Instructor Name
Akram Alfantazi
Contact Email/ Office Ext. No.
akram.alfantazi@ku.ac.ae
Office Room No.
Arzanah 311
Assessment Methodology
Tentative Dates
Weight
Coursework:
Homework 1
Week 3
2.5%
Quiz 1
Week 4
8.33%
Homework 2
Week 8
2.5 %
Quiz 2
Week 9
8.33%
Quiz 3
Week 13
8.33%
Projects
Term project
Final week
10%
Laboratory (if applicable)
Semester Examination (s)
Midterm Exam
Week 10
25%
Final Examination
Week 16
35%
Instructor Policy on late submission of assignments:`);
assert.equal(cheg350DocxStyle.officeRoom, "Arzanah 311");
expectAssessmentNames(cheg350DocxStyle, [
  "Homework 1",
  "Quiz 1",
  "Homework 2",
  "Quiz 2",
  "Quiz 3",
  "Term project",
  "Midterm Exam",
  "Final Examination"
]);
expectAssessment(cheg350DocxStyle, "Homework 1", 2.5);
expectAssessment(cheg350DocxStyle, "Quiz 1", 8.33);
expectAssessment(cheg350DocxStyle, "Homework 2", 2.5);
assert.equal(
  Math.round(
    cheg350DocxStyle.assessments.reduce(
      (sum, assessment) => sum + assessment.weight_percentage,
      0
    ) * 100
  ) / 100,
  99.99
);
assert.equal(
  cheg350DocxStyle.warnings.some((warning) => /Total weight/i.test(warning)),
  false
);

const cheg230Detailed = extractSyllabusFromText(`Course Code and Title CHEG230 Chemical Engineering Thermodynamics I
Semester:
Spring 2026
Instructor Name Dr. Hanifa Taher AlBlooshi
Contact Email/ Office Ext. No. hanifa.alblooshi@ku.ac.ae / 02-312 3524
Assessment Methodology
Tentative Dates Weight
Coursework: Homework 10%
Pre-Assigned Quizzes 10%
Projects (if applicable) Mini-Design Project 5%
Laboratory (if applicable) NA
Midterm Examination (s) Written examination (Closed Book) 8 Week of the semester 30 %
Final Examination Written examination (Closed Book) Assigned by Registrar 40 %
Participation Contact based 5%
Instructor Policy on Exams, Assignments, and Quizzes:`);
expectAssessmentNames(cheg230Detailed, [
  "Homework",
  "Pre-Assigned Quizzes",
  "Mini-Design Project",
  "Midterm Examination",
  "Final Examination",
  "Participation"
]);
expectAssessment(cheg230Detailed, "Homework", 10);
expectAssessment(cheg230Detailed, "Pre-Assigned Quizzes", 10);
expectAssessment(cheg230Detailed, "Mini-Design Project", 5);
expectAssessment(cheg230Detailed, "Midterm Examination", 30);
assert.equal(
  cheg230Detailed.assessments.some((assessment) => /quiz\s+\d/i.test(assessment.name)),
  false
);

const gradeScaleOnly = extractSyllabusFromText(`Grading Scheme
Letter Grade Grade Point Grade Range Description
A 4.00 From 92.5% to 100% Excellent
B+ 3.30 From 86.5% to less than 89.5%
F 0.00 Less than 59.5% Fail`);
assert.equal(gradeScaleOnly.assessments.length, 0);

const teachingPlanOnly = extractSyllabusFromText(`Teaching Plan (Lectures)
Week 3 Motion in 2D Quiz 1
Week 6 Energy Quiz 2
Week 10 Momentum Quiz 3`);
assert.equal(teachingPlanOnly.assessments.length, 0);

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
