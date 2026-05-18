import { promises as fs } from "node:fs";
import path from "node:path";

const inputDir = path.join("training-data", "verified-json");
const outputPath = path.join("training-data", "verified-review-report.html");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function totalWeight(example) {
  return Math.round(
    (example.assessments ?? []).reduce(
      (sum, assessment) => sum + Number(assessment.weight_percentage ?? 0),
      0
    ) * 100
  ) / 100;
}

async function readJsonFiles() {
  try {
    const files = (await fs.readdir(inputDir))
      .filter((file) => file.endsWith(".json"))
      .sort();

    return Promise.all(
      files.map(async (file) => {
        const filePath = path.join(inputDir, file);
        const raw = await fs.readFile(filePath, "utf8");
        return {
          file,
          json: JSON.parse(raw)
        };
      })
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

const examples = await readJsonFiles();
const counts = examples.reduce(
  (summary, item) => {
    const feedback = item.json.source?.userFeedback ?? "unknown";
    summary.total += 1;
    summary[feedback] = (summary[feedback] ?? 0) + 1;
    return summary;
  },
  { total: 0, correct: 0, corrected: 0, incorrect: 0, unknown: 0 }
);

const rows = examples
  .map(({ file, json }) => {
    const feedback = json.source?.userFeedback ?? "unknown";
    const assessmentCount = Array.isArray(json.assessments)
      ? json.assessments.length
      : 0;
    const original = json.source?.originalExtraction;
    const originalAssessments = Array.isArray(original?.assessments)
      ? original.assessments.length
      : "n/a";

    return `
      <tr>
        <td>${escapeHtml(file)}</td>
        <td>${escapeHtml(json.courseCode ?? "")}</td>
        <td>${escapeHtml(json.courseName ?? "")}</td>
        <td>${assessmentCount}</td>
        <td>${totalWeight(json)}%</td>
        <td>${escapeHtml(feedback)}</td>
        <td>${escapeHtml(originalAssessments)}</td>
      </tr>
    `;
  })
  .join("");

const correctedDetails = examples
  .filter(({ json }) => json.source?.userFeedback === "corrected")
  .map(({ file, json }) => {
    const original = json.source?.originalExtraction ?? {};

    return `
      <details>
        <summary>${escapeHtml(file)}</summary>
        <div class="compare">
          <section>
            <h3>Original extraction</h3>
            <pre>${escapeHtml(JSON.stringify(original, null, 2))}</pre>
          </section>
          <section>
            <h3>Confirmed extraction</h3>
            <pre>${escapeHtml(JSON.stringify({ ...json, source: undefined }, null, 2))}</pre>
          </section>
        </div>
      </details>
    `;
  })
  .join("");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GradeMate Verified Extraction Review</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }
      body { margin: 0; background: #07111f; color: #e5edf8; }
      main { max-width: 1180px; margin: 0 auto; padding: 32px 20px; }
      .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 24px 0; }
      .card, details { border: 1px solid #22324a; border-radius: 16px; background: #0d1b2e; padding: 16px; }
      .card strong { display: block; font-size: 28px; color: #5eead4; }
      table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 16px; }
      th, td { border-bottom: 1px solid #22324a; padding: 10px; text-align: left; vertical-align: top; }
      th { color: #93a4bd; font-size: 12px; text-transform: uppercase; }
      pre { max-height: 420px; overflow: auto; white-space: pre-wrap; background: #050b14; padding: 12px; border-radius: 12px; }
      .compare { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      details { margin-top: 12px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Verified Extraction Review</h1>
      <p>Use this report to review user-confirmed extraction examples before promoting them into the benchmark dataset.</p>
      <section class="cards">
        <div class="card"><span>Total</span><strong>${counts.total}</strong></div>
        <div class="card"><span>Correct</span><strong>${counts.correct}</strong></div>
        <div class="card"><span>Corrected</span><strong>${counts.corrected}</strong></div>
        <div class="card"><span>Incorrect</span><strong>${counts.incorrect}</strong></div>
      </section>
      <h2>Examples</h2>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Course code</th>
            <th>Course name</th>
            <th>Assessments</th>
            <th>Total weight</th>
            <th>Feedback</th>
            <th>Original rows</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <h2>Corrected before/after</h2>
      ${correctedDetails || "<p>No corrected examples found.</p>"}
    </main>
  </body>
</html>`;

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, html);

console.log(`Verified examples: ${counts.total}`);
console.log(`Correct: ${counts.correct}`);
console.log(`Corrected: ${counts.corrected}`);
console.log(`Incorrect: ${counts.incorrect}`);
console.log(`Wrote ${outputPath}`);
