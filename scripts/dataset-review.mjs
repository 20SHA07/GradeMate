import fs from "node:fs/promises";
import path from "node:path";
import {
  extractedTextDir,
  htmlEscape,
  proposedJsonDir,
  readJsonFiles,
  reviewReportPath
} from "./dataset-utils.mjs";

const proposals = await readJsonFiles(proposedJsonDir);

if (proposals.length === 0) {
  console.error("No proposed JSON files found. Run npm run dataset:propose first.");
  process.exit(1);
}

const cards = await Promise.all(
  proposals.map(async ({ fileName, value }) => {
    const textPreview = await readTextPreview(value.sourceTextFileName);
    const weightStatus =
      Math.abs(value.totalWeight - 100) <= 0.5
        ? "100% ready"
        : value.totalWeight < 100
          ? `Missing ${(100 - value.totalWeight).toFixed(1)}%`
          : `Over by ${(value.totalWeight - 100).toFixed(1)}%`;

    return `
      <article class="card ${value.needsHumanReview ? "review" : "ready"}">
        <div class="card-header">
          <div>
            <p class="eyebrow">${htmlEscape(fileName)}</p>
            <h2>${htmlEscape(value.courseCode ?? "Unknown course")} ${htmlEscape(value.courseName ?? "")}</h2>
            <p class="muted">${htmlEscape(value.sourceFileName)}</p>
          </div>
          <span class="badge">${htmlEscape(weightStatus)}</span>
        </div>
        <dl class="meta">
          <div><dt>Credits</dt><dd>${htmlEscape(value.creditHours ?? "Not found")}</dd></div>
          <div><dt>Semester</dt><dd>${htmlEscape(value.semester ?? "Not found")}</dd></div>
          <div><dt>Instructor</dt><dd>${htmlEscape(value.instructor ?? "Not found")}</dd></div>
          <div><dt>Confidence</dt><dd>${htmlEscape(value.confidence)}</dd></div>
        </dl>
        <table>
          <thead>
            <tr>
              <th>Assessment</th>
              <th>Weight</th>
              <th>Confidence</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            ${value.assessments
              .map(
                (assessment) => `
                  <tr>
                    <td>${htmlEscape(assessment.name)}</td>
                    <td>${htmlEscape(assessment.weight_percentage)}%</td>
                    <td>${htmlEscape(assessment.confidence)}</td>
                    <td>${htmlEscape(assessment.source_text_snippet)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
        ${
          value.warnings.length > 0
            ? `<div class="warnings"><strong>Warnings</strong><ul>${value.warnings
                .map((warning) => `<li>${htmlEscape(warning)}</li>`)
                .join("")}</ul></div>`
            : ""
        }
        <details>
          <summary>Extracted text preview</summary>
          <pre>${htmlEscape(textPreview)}</pre>
        </details>
      </article>
    `;
  })
);

const readyCount = proposals.filter(
  ({ value }) => Math.abs(value.totalWeight - 100) <= 0.5 && !value.needsHumanReview
).length;
const reviewCount = proposals.length - readyCount;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GradeMate Dataset Review</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111f;
      --panel: #0f1c2e;
      --panel-strong: #13243a;
      --text: #ecfdf5;
      --muted: #9fb3c8;
      --border: rgba(148, 163, 184, 0.22);
      --teal: #2dd4bf;
      --amber: #fbbf24;
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 15px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 24px clamp(18px, 4vw, 48px);
      background: rgba(7, 17, 31, 0.9);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(16px);
    }
    h1, h2, p { margin: 0; }
    h1 { font-size: clamp(28px, 4vw, 42px); }
    main {
      display: grid;
      gap: 18px;
      padding: 24px clamp(18px, 4vw, 48px) 56px;
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 14px;
    }
    .pill, .badge {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 7px 12px;
      color: var(--muted);
      background: rgba(255,255,255,0.03);
    }
    .badge {
      color: var(--teal);
      border-color: rgba(45, 212, 191, 0.35);
      white-space: nowrap;
    }
    .card {
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--panel);
      padding: 20px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
    }
    .card.review {
      border-color: rgba(251, 191, 36, 0.36);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
      margin-bottom: 16px;
    }
    .eyebrow {
      color: var(--teal);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
    }
    .muted, dt {
      color: var(--muted);
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px;
      margin: 0 0 16px;
    }
    .meta div {
      padding: 12px;
      border-radius: 12px;
      background: var(--panel-strong);
    }
    dt { font-size: 12px; }
    dd { margin: 4px 0 0; font-weight: 700; }
    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 12px;
      margin: 12px 0;
    }
    th, td {
      border-bottom: 1px solid var(--border);
      padding: 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .warnings {
      margin-top: 12px;
      border-radius: 12px;
      background: rgba(251, 191, 36, 0.08);
      border: 1px solid rgba(251, 191, 36, 0.25);
      padding: 12px;
    }
    details {
      margin-top: 12px;
      color: var(--muted);
    }
    pre {
      white-space: pre-wrap;
      max-height: 360px;
      overflow: auto;
      border-radius: 12px;
      background: #06101d;
      border: 1px solid var(--border);
      padding: 12px;
    }
    @media (max-width: 720px) {
      .card-header { flex-direction: column; }
      table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <header>
    <h1>GradeMate Dataset Review</h1>
    <p class="muted">Review proposed syllabus extraction results before adding expected JSON corrections.</p>
    <div class="summary">
      <span class="pill">${proposals.length} syllabuses</span>
      <span class="pill">${readyCount} ready</span>
      <span class="pill">${reviewCount} need review</span>
    </div>
  </header>
  <main>
    ${cards.join("\n")}
  </main>
</body>
</html>`;

await fs.writeFile(reviewReportPath, html, "utf8");
console.log(`Review report created: ${reviewReportPath}`);

async function readTextPreview(textFileName) {
  if (!textFileName) {
    return "No extracted text file recorded.";
  }

  try {
    const value = await fs.readFile(path.join(extractedTextDir, textFileName), "utf8");
    return value.slice(0, 8000);
  } catch {
    return "Could not read extracted text preview.";
  }
}
