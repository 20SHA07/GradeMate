import { pathToFileURL } from "node:url";
import { promises as fs } from "node:fs";
import path from "node:path";
import ts from "typescript";

const sourcePath = path.resolve("src/lib/grading.ts");
const tempPath = path.resolve(".next/validate-grading.mjs");
const source = await fs.readFile(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

await fs.mkdir(path.dirname(tempPath), { recursive: true });
await fs.writeFile(tempPath, transpiled);

const {
  getGradeInfo,
  gradeScaleValidationCases
} = await import(pathToFileURL(tempPath).href);

const failures = gradeScaleValidationCases.filter((testCase) => {
  const result = getGradeInfo(testCase.percentage);

  return (
    result.letter !== testCase.letter ||
    result.roundedPercentage !== testCase.roundedPercentage
  );
});

if (failures.length > 0) {
  console.error("Grade scale validation failed:");

  for (const failure of failures) {
    const result = getGradeInfo(failure.percentage);
    console.error(
      `${failure.percentage}: expected ${failure.letter} after rounding to ${failure.roundedPercentage}, got ${result.letter} after rounding to ${result.roundedPercentage}`
    );
  }

  process.exit(1);
}

console.log(`Grade scale validation passed (${gradeScaleValidationCases.length} cases).`);
