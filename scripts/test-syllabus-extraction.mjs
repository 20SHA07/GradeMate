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

const engl102DocxStyle = extractSyllabusFromText(`Course Code and Title:
ENGL 102 Academic English II
Semester:
Spring 2026
Instructor:
Joud Jabri-Pickett
Contact Email:
joud.pickett@ku.ac.ae
Office Room Number:
Building 1, Room 1023A
Assessment Methodology
Tentative Dates
Weight
Coursework:
Individual Writing: Technical report Part 1
Week 3
15%
Individual Writing: Technical report Part 2
Week 6
25%
Individual Digital presentation
Week 7
20%
Group Oral Presentation of Proposal
Week 13 & 14
10%
Group (</= 3 students) proposal in response to a Request for Proposals (RFP)
Week 14
30%
Instructor Policy`);
assert.equal(engl102DocxStyle.courseCode, "ENGL 102");
assert.equal(engl102DocxStyle.courseName, "Academic English II");
assert.equal(engl102DocxStyle.semester, "Spring 2026");
assert.equal(engl102DocxStyle.instructor, "Joud Jabri-Pickett");
assert.equal(engl102DocxStyle.instructorEmail, "joud.pickett@ku.ac.ae");
assert.equal(engl102DocxStyle.officeRoom, "Building 1, Room 1023A");
expectAssessmentNames(engl102DocxStyle, [
  "Individual Writing: Technical report Part 1",
  "Individual Writing: Technical report Part 2",
  "Individual Digital presentation",
  "Group Oral Presentation of Proposal",
  "Group proposal in response to a Request for Proposals (RFP)"
]);
expectAssessment(engl102DocxStyle, "Individual Writing: Technical report Part 1", 15);
expectAssessment(engl102DocxStyle, "Individual Writing: Technical report Part 2", 25);
expectAssessment(engl102DocxStyle, "Individual Digital presentation", 20);
expectAssessment(engl102DocxStyle, "Group Oral Presentation of Proposal", 10);
expectAssessment(
  engl102DocxStyle,
  "Group proposal in response to a Request for Proposals (RFP)",
  30
);

const gens300Detailed = extractSyllabusFromText(`Course Code and Title: GENS 300 - Career Preparation
Assessment
Assessment Instruments Contribution to Course Grade (%)
CV Submission 15% 5-7
Documented evidence of career
40% 7-14
planning and industry exploration
Mock Interview 15% 12
Attendance of Professional Development workshops (5) 20% 1-13
Final Quiz 10% 14
Assessment Methodology:
Assessment Instruments Tentative Dates Weight (%)
CV Submission
-Initial submission weighted (5%) week 5 5-7 15%
- Final CV version weighed (10%) week 7
Documented evidence of career planning and industry exploration
- Career development plan (10%) Week 10
- Complete two experiences and submit valid evidence in Week 13 (20%) 7-14 40%
- LinkedIn courses completion (5%) Week 14
- Weekly online quizzes (5%) Week 1-14
Mock Interview 12-14 15%
Attendance of Professional Development workshops (5 workshops) 1-14 20%
Final Quiz 14 10%
Teaching Plan`);
expectAssessmentNames(gens300Detailed, [
  "Initial CV submission",
  "Final CV version",
  "Career development plan",
  "Complete two experiences and submit valid evidence",
  "LinkedIn courses completion",
  "Weekly online quizzes",
  "Mock Interview",
  "Attendance of Professional Development workshops (5 workshops)",
  "Final Quiz"
]);
expectAssessment(gens300Detailed, "Initial CV submission", 5);
expectAssessment(gens300Detailed, "Final CV version", 10);
expectAssessment(gens300Detailed, "Career development plan", 10);
expectAssessment(
  gens300Detailed,
  "Complete two experiences and submit valid evidence",
  20
);
expectAssessment(gens300Detailed, "LinkedIn courses completion", 5);
expectAssessment(gens300Detailed, "Weekly online quizzes", 5);
assert.ok(
  gens300Detailed.warnings.some((warning) =>
    /Using detailed assessment methodology instead of summary table/i.test(warning)
  ),
  "Expected GENS 300 detailed override warning"
);

const gens300Fallback = extractSyllabusFromText(`GENS 300 Career Preparation
Assessment Instruments Contribution to Course Grade (%)
CV Submission 15% 5-7
Documented evidence of career planning and industry exploration 40% 7-14
Mock Interview 15% 12
Attendance of Professional Development workshops (5) 20% 1-13
Final Quiz 10% 14
Assessment Methodology:
CV Submission - Initial submission weighted (5%) week 5
Documented evidence of career planning and industry exploration - Career development plan (10%) Week 10
Mock Interview 15%
Teaching Plan`);
expectAssessmentNames(gens300Fallback, [
  "CV Submission",
  "Documented evidence of career planning and industry exploration",
  "Mock Interview",
  "Attendance of Professional Development workshops (5)",
  "Final Quiz"
]);
expectAssessment(gens300Fallback, "CV Submission", 15);
expectAssessment(
  gens300Fallback,
  "Documented evidence of career planning and industry exploration",
  40
);

const cosc312Grouped = extractSyllabusFromText(`Course Code and Title COSC 312 Design and Analysis of Algorithms
Spring 2026
Assessment Methodology
Tentative Dates Weight (%)
Coursework: Every 2-3 weeks 30%
Projects Every 3-4 weeks 20
Semester Examination Week 8 20
Final Examination Week 16 30
Teaching Plan
Week 3 Quiz 1`);
expectAssessmentNames(cosc312Grouped, [
  "Coursework",
  "Projects",
  "Semester Examination",
  "Final Examination"
]);
expectAssessment(cosc312Grouped, "Coursework", 30);
expectAssessment(cosc312Grouped, "Projects", 20);
expectAssessment(cosc312Grouped, "Semester Examination", 20);
expectAssessment(cosc312Grouped, "Final Examination", 30);

const phys121DocxStyle = extractSyllabusFromText(`Course Code and Title:
PHYS 121 _ University Physics I
Semester:
Spring 2026 (Section 2)
Instructor:
Mr. Nabee Hasheem
Contact Email:
nabee.hasheem@ku.ac.ae
Assessment Methodology
Coursework
Tentative Dates
Weight
Quizzes:
4 descriptive questions /30 min
Quiz 1
Quiz + WAs = 24% + 6% = 30%
Quiz 2
Quiz 3
Quiz 4
Web assign
Laboratory
1-lab report per each experiment
During lab time
20%
Semester Examination (s)
Midterm test
Oct 24, 2025
20%
Final test
TBA (registrar office)
30%
Teaching Plan
Week 3 Quiz 1`);
assert.equal(phys121DocxStyle.courseCode, "PHYS 121");
assert.equal(phys121DocxStyle.courseName, "University Physics I");
assert.equal(phys121DocxStyle.instructor, "Mr. Nabee Hasheem");
assert.equal(phys121DocxStyle.instructorEmail, "nabee.hasheem@ku.ac.ae");
expectAssessmentNames(phys121DocxStyle, [
  "Quiz 1",
  "Quiz 2",
  "Quiz 3",
  "Quiz 4",
  "Web assign",
  "Laboratory",
  "Midterm test",
  "Final test"
]);
expectAssessment(phys121DocxStyle, "Quiz 1", 6);
expectAssessment(phys121DocxStyle, "Quiz 4", 6);
expectAssessment(phys121DocxStyle, "Web assign", 6);
assert.ok(
  phys121DocxStyle.warnings.some((warning) =>
    /Split quiz total 24% evenly across 4 quizzes/i.test(warning)
  ),
  "Expected PHYS121 DOCX quiz formula split warning"
);

const cosc354Grouped = extractSyllabusFromText(`Course Code and Title COSC 354 Operating Systems
Semester:
Fall 2025
Instructor Name Azzam Mourad
Contact Email/ Office Ext. No. azzam.mourad@ku.ac.ae
Assessment Methodology
Tentative Dates Weight
Quizzes and assignments 2-3 quizzes + Assignments 20%
Laboratory Weekly Tasks 20%
Semester Examination (s) Week 8 25%
Final Examination Week 16 35%
Teaching Plan
Week 3 Quiz 1
Week 9 Midterm Exam`);
expectAssessmentNames(cosc354Grouped, [
  "Quizzes and assignments",
  "Laboratory",
  "Semester Examination (s)",
  "Final Examination"
]);
expectAssessment(cosc354Grouped, "Quizzes and assignments", 20);
expectAssessment(cosc354Grouped, "Laboratory", 20);
expectAssessment(cosc354Grouped, "Semester Examination (s)", 25);
expectAssessment(cosc354Grouped, "Final Examination", 35);
assert.equal(
  cosc354Grouped.assessments.some((assessment) => /quiz\s+\d/i.test(assessment.name)),
  false
);

const cosc301Detailed = extractSyllabusFromText(`COSC 301
Automata, Computability, and Complexity
Fall 2025
Semester:
MW 11:00-11:50
Schedule:
C02004
Classroom:
Instructor: Dr. Khaled Elbassioni
Contact Email: Khaled.elbassioni@ku.ac.ae
Office Room Number: D04200
Office Hours:
MW 15:00-16:00
Assessment
Coursework (quizzes, homework) 30%
Semester Examination 30%
Final Examination 40%
Assessment Methodology
Tentative Weight Dates
Coursework: HW 1 Week 3 5%
Quiz 1 Week 5 7.5%
HW 2 Week 9 5%
Quiz 2 Week 11 7.5%
HW 3 Week 12 5%
Mid Term Exam Week 8 30%
Final Exam Week 16 40%
Instructor Policy`);
assert.equal(cosc301Detailed.courseCode, "COSC 301");
assert.equal(cosc301Detailed.courseName, "Automata, Computability, and Complexity");
assert.equal(cosc301Detailed.semester, "Fall 2025");
assert.equal(cosc301Detailed.instructor, "Dr. Khaled Elbassioni");
assert.equal(cosc301Detailed.instructorEmail, "Khaled.elbassioni@ku.ac.ae");
assert.equal(cosc301Detailed.schedule, "MW 11:00-11:50");
assert.equal(cosc301Detailed.classroom, "C02004");
assert.equal(cosc301Detailed.officeRoom, "D04200");
assert.equal(cosc301Detailed.officeHours, "MW 15:00-16:00");
expectAssessmentNames(cosc301Detailed, [
  "HW 1",
  "Quiz 1",
  "HW 2",
  "Quiz 2",
  "HW 3",
  "Mid Term Exam",
  "Final Exam"
]);
expectAssessment(cosc301Detailed, "HW 1", 5);
expectAssessment(cosc301Detailed, "Quiz 1", 7.5);
expectAssessment(cosc301Detailed, "HW 3", 5);

const cosc201Summary = extractSyllabusFromText(`COSC 201 Computer Systems Organization
Assessment:
All course learning outcomes are assessed using the following assessment tools:
Coursework (quizzes, homework) 15%
Lab Work 15%
Project 20%
Semester Examination 20%
Final Examination 30%
Contribution to B.Sc. in Computer Science Program Learning Outcomes`);
expectAssessmentNames(cosc201Summary, [
  "Coursework (quizzes, homework)",
  "Lab Work",
  "Project",
  "Semester Examination",
  "Final Examination"
]);
expectAssessment(cosc201Summary, "Coursework (quizzes, homework)", 15);

const cosc310OldSummary = extractSyllabusFromText(`COSC 310 Data Structures
Assessment:
All course learning outcomes are assessed using the following assessment tools.
Coursework (Quizzes, homework) 20%
Laboratory Assignments 25%
Semester Examination 20%
Final Examination 35%
Contribution to B.Sc. in Computer Science Program Learning Outcomes`);
expectAssessmentNames(cosc310OldSummary, [
  "Coursework (Quizzes, homework)",
  "Laboratory Assignments",
  "Semester Examination",
  "Final Examination"
]);
expectAssessment(cosc310OldSummary, "Laboratory Assignments", 25);

const cosc310Fall2025 = extractSyllabusFromText(`Course Code and Title COSC 310: Data Structures
Semester: Fall 2025
Instructor Name Dr. Khaled Elbassioni
Contact Email/ Office Ext. No. khaled. elbassioni@ku.ac.ae
Office Room: D04200
Assessment Methodology
Tentative Dates Weight
Coursework: Quiz 1 Week 5 3.33%
Quiz 2 Week 8 3.33%
Quiz 3 Week 13 3.34%
Projects / Assignment Project/Assignment Week 10 - Week 14 10%
Laboratory Lab Assignments Weekly (W2 - W13) 10%
Lab Quizzes Consult with Lab TA 10%
Lab Test (or a Quiz) Week 14 5%
Semester Examination (on-campus) Week 9 (Mar 13) 20%
Final Examination (on-campus) Week 16 (May 5-15) 35%
Teaching Plan
Week 5 Quiz 1
Week 6 Lab Quiz 1`);
assert.equal(cosc310Fall2025.instructorEmail, "khaled.elbassioni@ku.ac.ae");
expectAssessmentNames(cosc310Fall2025, [
  "Quiz 1",
  "Quiz 2",
  "Quiz 3",
  "Project/Assignment",
  "Lab Assignments",
  "Lab Quizzes",
  "Lab Test (or a Quiz)",
  "Semester Examination",
  "Final Examination"
]);
expectAssessment(cosc310Fall2025, "Quiz 1", 3.33);
expectAssessment(cosc310Fall2025, "Quiz 3", 3.34);
expectAssessment(cosc310Fall2025, "Lab Quizzes", 10);

const math232Summary = extractSyllabusFromText(`MATH 232 - Engineering Mathematics
Assessment:
All course learning outcomes are assessed using the following assessment tools.
Coursework (Quizzes and HomeWorks) 40%
Semester Examination(s) 25%
Final Examination 35%
Assessment Methodology
Quizzes
Weeks 2, 3, 4, 5 & 6 respectively
1, 2, 3, 4 & 5
Coursework 40%
Quizzes
Weeks 7, 8, 9, 10 & 11 respectively
6, 7, 8, 9 & 10
Semester Examination Week 7 25%
Final Examination Week 15 or 16 35%
Teaching Plan
Week 2 Quiz 1`);
expectAssessmentNames(math232Summary, [
  "Coursework",
  "Semester Examination",
  "Final Examination"
]);
expectAssessment(math232Summary, "Coursework", 40);

const cosc330DocxStyle = extractSyllabusFromText(`Course Code and Title
COSC 330 Introduction to Artificial Intelligence
Semester:
Fall 2025
Instructor Name
Naoufel Werghi
Contact Email/ Office Ext. No.
Naoufel.werghi@ku.ac.ae
Assessment Methodology
Tentative Dates
Weight(%)
Coursework:
Quizzes
Quiz-1
Week-3
7.5
Quiz-2
Week-6
Quiz-3
Week-10
Quiz-4
Week-13
Labs
TBA
7.5
Mini-project
TBA
15
Semester examination
WEEK-8
30
Final examination
TBA
40
Instructor Policy`);
assert.equal(cosc330DocxStyle.courseCode, "COSC 330");
assert.equal(cosc330DocxStyle.courseName, "Introduction to Artificial Intelligence");
assert.equal(cosc330DocxStyle.instructor, "Naoufel Werghi");
assert.equal(cosc330DocxStyle.instructorEmail, "Naoufel.werghi@ku.ac.ae");
expectAssessmentNames(cosc330DocxStyle, [
  "Quiz 1",
  "Quiz 2",
  "Quiz 3",
  "Quiz 4",
  "Labs",
  "Mini-project",
  "Semester examination",
  "Final examination"
]);
expectAssessment(cosc330DocxStyle, "Quiz 1", 1.875);
expectAssessment(cosc330DocxStyle, "Quiz 4", 1.875);
expectAssessment(cosc330DocxStyle, "Labs", 7.5);
assert.ok(
  cosc330DocxStyle.warnings.some((warning) =>
    /Split quiz weight 7.5% evenly across Quiz 1-Quiz 4/i.test(warning)
  ),
  "Expected COSC330 quiz split warning"
);

const cosc336ParentheticalSplit = extractSyllabusFromText(`COSC 336 Introduction to Software Engineering
Assessment:
Coursework (Quizzes - 10%, Assignments - 10%) 20%
Group project 20%
Semester Examination 20%
Final Examination 40%
Contribution to Computer Engineering Program Learning Outcomes`);
expectAssessmentNames(cosc336ParentheticalSplit, [
  "Quizzes",
  "Assignments",
  "Group project",
  "Semester Examination",
  "Final Examination"
]);
expectAssessment(cosc336ParentheticalSplit, "Quizzes", 10);
expectAssessment(cosc336ParentheticalSplit, "Assignments", 10);

const huma221Fallback = extractSyllabusFromText(`HUMA 221 Intercultural Communication
Assessment:
Coursework
40%
Seminar participation
10%
Semester examination
20%
Final project
30%
Assessment Methodology
Coursework:
Quiz 1
Week Four
10%
Quiz 3
Week Fourteen
10%
10%
10%
Project
Cross-cultural analysis paper
Week 15
30%
Semester Examination:
Week 8
20%
Teaching Plan
Mid Semester assessment (20%) Exam/analytical paper`);
expectAssessmentNames(huma221Fallback, [
  "Coursework",
  "Seminar participation",
  "Semester Examination",
  "Final project"
]);
expectAssessment(huma221Fallback, "Coursework", 40);
expectAssessment(huma221Fallback, "Final project", 30);

const ltcm221Fallback = extractSyllabusFromText(`LTCM 221 Intercultural Communication
Assessment:
Coursework
40%
Seminar participation
10%
Mid-term assessment
20%
Final project
30%
Assessment Methodology
Quiz 1
Week 6
10%
Quiz 3
Week 15
10%
10%
10%
Project
Cross-Cultural project
5%
5%
20%
Semester Examination:
Quiz 2
20%
Teaching Plan
Quiz 3 20%`);
expectAssessmentNames(ltcm221Fallback, [
  "Coursework",
  "Seminar participation",
  "Mid-term assessment",
  "Final project"
]);
expectAssessment(ltcm221Fallback, "Mid-term assessment", 20);

const huma140Description = extractSyllabusFromText(`Course Code and Title: HUMA 140 - Introduction to Psychology
Summer 2025
Instructor: Dr. Michael Babula
Contact Email: michael.babula@ku.ac.ae
Assessment:
Coursework (Assignments, quizzes) 40%
Semester Examination(s) 30%
Final Project 30%
Description of the Assessments
Quizzes - (10% each)
Three quizzes worth 10% each are required for this course.
Research Assignment (10%)
Midterm Exam (30%)
Final Project (30%)
Assessment Methodology
Quiz # 1 (Week 2) 10%
Assignment (Week 4) 10%
Quiz # 2 (Week 4) 10%
Quiz # 3 (Week 5) 10%
Quiz & Assignment Weight 40%
Midterm Examination: (Week 3) 30%
Final Project (Weeks 5/6) 30%
Teaching Plan
Week 3 Quiz 1`);
assert.equal(huma140Description.courseCode, "HUMA 140");
assert.equal(huma140Description.courseName, "Introduction to Psychology");
assert.equal(huma140Description.instructorEmail, "michael.babula@ku.ac.ae");
expectAssessmentNames(huma140Description, [
  "Quiz 1",
  "Quiz 2",
  "Quiz 3",
  "Research Assignment",
  "Midterm Examination",
  "Final Project"
]);
expectAssessment(huma140Description, "Quiz 1", 10);
expectAssessment(huma140Description, "Research Assignment", 10);

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

const bmed221ModelingProject = extractSyllabusFromText(`Course Code and Title BMED 221 Anatomy and Physiological Modeling for Engineers
Instructor Name Ali A. Khraibi and Okobi Ekpo
Assessment Methodology
2 Quizzes Week 4 20%
Problem Sets Homework Week 7 10%
Student Modeling Project
Modeling Topic Proposal 5%
Working Model Due 5%
Complete Model White Paper 20%
And Presentations
Final Examination Week 16 40%`);
expectAssessmentNames(bmed221ModelingProject, [
  "2 Quizzes",
  "Problem Sets Homework",
  "Modeling Topic Proposal",
  "Working Model Due",
  "Complete Model White Paper and Presentations",
  "Final Examination"
]);
expectAssessment(bmed221ModelingProject, "2 Quizzes", 20);
assert.equal(
  bmed221ModelingProject.assessments.some((assessment) => /^Quiz\s+\d/i.test(assessment.name)),
  false,
  "Grouped 2 Quizzes should not be split without explicit equal weights"
);

const bmed322ExplicitRows = extractSyllabusFromText(`Assessment Methodology
Tentative Dates Weight
Coursework: Quizzes 1 Week 3 7.5%
Quizzes 2 Week 5 7.5%
Projects /Assignements Week 9 to15 20%
Laboratory (if applicable)
Midterm Examination Week 7 30%
Final Examination End of course 35%`);
expectAssessmentNames(bmed322ExplicitRows, [
  "Quiz 1",
  "Quiz 2",
  "Projects / Assignements",
  "Midterm Examination",
  "Final Examination"
]);
expectAssessment(bmed322ExplicitRows, "Quiz 1", 7.5);
expectAssessment(bmed322ExplicitRows, "Projects / Assignements", 20);
assert.equal(
  bmed322ExplicitRows.assessments.some((assessment) => /laboratory/i.test(assessment.name)),
  false,
  "Laboratory without a weight should be ignored"
);

const cheg230GroupedQuizzes = extractSyllabusFromText(`Assessment Methodology
Pre-Assigned Quizzes 30%
Projects (if applicable) NA
Laboratory (if applicable) NA
Midterm Examination (s) Written examination 30%
Final Examination Written examination 40%
Instructor Policy
Five quizzes will be given and the best four count.`);
expectAssessmentNames(cheg230GroupedQuizzes, [
  "Pre-Assigned Quizzes",
  "Midterm Examination",
  "Final Examination"
]);
expectAssessment(cheg230GroupedQuizzes, "Pre-Assigned Quizzes", 30);

const cheg232ExplicitRows = extractSyllabusFromText(`Assessment Methodology
Coursework:
Quiz 1 Week 8 Feb 4%
Quiz 2 Week 6 22 Feb 4%
Quiz 3 Week 10 21 March 4%
Quiz 4 Week 13 11 April 4%
Quiz 5 Week 15 25 April 4%
Laboratory (if applicable) 20%
Midterm
Semester Examination (s) Week 8 05 March 25%
Attendance 5%
Final Examination 30%`);
expectAssessmentNames(cheg232ExplicitRows, [
  "Quiz 1",
  "Quiz 2",
  "Quiz 3",
  "Quiz 4",
  "Quiz 5",
  "Laboratory",
  "Semester Examination (s)",
  "Attendance",
  "Final Examination"
]);
expectAssessment(cheg232ExplicitRows, "Quiz 5", 4);
expectAssessment(cheg232ExplicitRows, "Attendance", 5);

const cheg205DecimalRows = extractSyllabusFromText(`Assessment Methodology
Homework 1 3.6%
Homework 2 3.6%
Homework 3 3.6%
Homework 4 3.6%
Homework 5 3.6%
Homework 6 3.6%
Homework 7 3.6%
Quiz 1 4%
Quiz 2 4%
Quiz 3 4%
Quiz 4 4%
Quiz 5 4%
Midterm Examination 20%
Final Examination 30%
Attendance 5%`);
expectAssessment(cheg205DecimalRows, "Homework 1", 3.6);
expectAssessment(cheg205DecimalRows, "Quiz 5", 4);
assert.equal(
  Math.round(
    cheg205DecimalRows.assessments.reduce(
      (sum, assessment) => sum + assessment.weight_percentage,
      0
    ) * 10
  ) / 10,
  100.2
);

const policyParagraphPercentages = extractSyllabusFromText(`Assessment Methodology
Pre-Assigned Quizzes 30%
Midterm Examination 30%
Final Examination 40%
Instructor Policy
Late penalty 10% per day.
Attendance absence 7% policy.`);
expectAssessmentNames(policyParagraphPercentages, [
  "Pre-Assigned Quizzes",
  "Midterm Examination",
  "Final Examination"
]);

const cheg380GroupedDrops = extractSyllabusFromText(`Course Code and Title CHEG380 Introduction to Polymer Science and Technology
Assessment Methodology
Tentative Dates Weight
Coursework Quizzes (6, drop 2 lowest) See schedule 15
Project Will be assigned 2 week 15
Exams (2) Week 7 and Week 15 40
Final Exam Finals week 30
Teaching Plan
Week Topics Assessments
Week 2 Quiz 1`);
expectAssessmentNames(cheg380GroupedDrops, [
  "Quizzes (6, drop 2 lowest)",
  "Project",
  "Exams (2)",
  "Final Exam"
]);
expectAssessment(cheg380GroupedDrops, "Quizzes (6, drop 2 lowest)", 15);
assert.equal(
  cheg380GroupedDrops.assessments.some((assessment) => /^Quiz\s+\d/i.test(assessment.name)),
  false,
  "Drop-lowest grouped quizzes should remain grouped"
);

const chem115SharedQuizGroup = extractSyllabusFromText(`Course Code and Title: CHEM 115 General Chemistry I
Assessment Methodology
Tentative Dates Weight
Coursework: Quiz # 1 06 Feb - 10 Feb
Quiz # 2 27 Feb - 03 Mar 20%
Quiz # 3 03 Apr - 07 Apr
Quiz # 4 17 Apr - 21 Apr
Aleks Objectives 10%
Laboratory: Lab Reports and Lab Assignments 15%
Semester Examination: Midterm Exam 20%
Final Examination 35%`);
expectAssessmentNames(chem115SharedQuizGroup, [
  "Quizzes",
  "Aleks Objectives",
  "Lab Reports and Lab Assignments",
  "Semester Examination",
  "Final Examination"
]);
expectAssessment(chem115SharedQuizGroup, "Quizzes", 20);

const chem211BestFourGroup = extractSyllabusFromText(`CHEM 211-04 Fundamentals of Organic Chemistry
Assessment Methodology
Tentative Dates Weight
Coursework (Best 4 out of 5 will count towards the grade)
Quiz 1
Week 3
20%
Quiz 2
Week 6
Quiz 3
Week 11
Quiz 4
Week 13
Quiz 5 (Homework based)
Week 15
Laboratory Week 14 25%
Midterm Exam Week 8 20%
Final Examination TBA 35%`);
expectAssessmentNames(chem211BestFourGroup, [
  "Coursework (Best 4 out of 5 quizzes)",
  "Laboratory",
  "Midterm Exam",
  "Final Examination"
]);
expectAssessment(chem211BestFourGroup, "Coursework (Best 4 out of 5 quizzes)", 20);

const cosc202DetailedSplit = extractSyllabusFromText(`COSC 202 Data Science and Artificial Intelligence
Assessment:
Assessment Instruments Contribution to course grade (%)
Coursework (quizzes, homework/project) 25%
Laboratory Work 15%
Semester Examination 25%
Final Examination 35%
Syllabus Supplement for Students
Assessment Methodology
Tentative Dates Weight (%)
Quiz 1 Week 5
Quiz 2 Week 10
15%
Coursework (quizzes, homework/project) Quiz 3 Week 12
Quiz 4 Week 14
Project (demo) Week 14 10%
Midterm Examination(s) Week 8 25%
Final Examination Week 16 35%
Laboratory Work Weeks 14 15%`);
expectAssessmentNames(cosc202DetailedSplit, [
  "Quiz 1",
  "Quiz 2",
  "Quiz 3",
  "Quiz 4",
  "Project (demo)",
  "Laboratory Work",
  "Midterm Examination(s)",
  "Final Examination"
]);
expectAssessment(cosc202DetailedSplit, "Quiz 1", 3.75);

const cosc201SafeSummary = extractSyllabusFromText(`COSC 201 Computer Systems Organization
Assessment:
Coursework (quizzes, homework) 15%
Lab Work 15%
Project 20%
Semester Examination 20%
Final Examination 30%
Syllabus Supplement for Students
Assessment Methodology
Tentative Dates Weight
Quizzes Quizzes 15%
Project Week 13 20%
Laboratory Lab reports/progress 15%
Semester Examination (s) 20%
Final Examination 30%`);
expectAssessmentNames(cosc201SafeSummary, [
  "Coursework (quizzes, homework)",
  "Lab Work",
  "Project",
  "Semester Examination",
  "Final Examination"
]);

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
