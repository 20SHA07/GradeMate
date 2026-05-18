import fs from "node:fs/promises";
import path from "node:path";
import {
  buildDatasetSummary,
  buildExpectedJson,
  extractedTextDir,
  formatWeight,
  htmlEscape,
  proposedJsonDir,
  readDatasetIndex,
  readJsonFiles,
  reviewReportPath
} from "./dataset-utils.mjs";

const proposals = await readJsonFiles(proposedJsonDir);

if (proposals.length === 0) {
  console.error("No proposed JSON files found. Run npm run dataset:propose first.");
  process.exit(1);
}

const datasetIndex = await readDatasetIndex();
const summary = buildDatasetSummary(proposals, datasetIndex);
const sections = {
  ready: summary.analyses.filter((file) => file.analysis.status === "ready"),
  needsReview: summary.analyses.filter(
    (file) => file.analysis.status === "needs-review"
  ),
  failed: summary.analyses.filter((file) => file.analysis.status === "failed")
};

const detailCards = await Promise.all(
  summary.analyses.map(async ({ fileName, value, analysis }) => {
    const textPreview = await readTextPreview(value.sourceTextFileName);
    const expectedJson = JSON.stringify(buildExpectedJson(value), null, 2);
    const detailId = getDetailId(fileName);

    return `
      <article class="card ${analysis.status}" id="${detailId}">
        <div class="card-header">
          <div>
            <p class="eyebrow">${htmlEscape(fileName)}</p>
            <h2>${htmlEscape(value.courseCode ?? "Unknown course")} ${htmlEscape(value.courseName ?? "")}</h2>
            <p class="muted">${htmlEscape(value.sourceFileName)}</p>
          </div>
          <span class="status ${analysis.status}">${htmlEscape(getStatusIcon(analysis.status))} ${htmlEscape(analysis.statusLabel)}</span>
        </div>
        <dl class="meta">
          <div><dt>Credits</dt><dd>${htmlEscape(value.creditHours ?? "Not found")}</dd></div>
          <div><dt>Semester</dt><dd>${htmlEscape(value.semester ?? "Not found")}</dd></div>
          <div><dt>Instructor</dt><dd>${htmlEscape(value.instructor ?? "Not found")}</dd></div>
          <div><dt>Total weight</dt><dd>${htmlEscape(formatWeight(analysis.totalWeight))}%</dd></div>
          <div><dt>Confidence</dt><dd>${htmlEscape(analysis.confidence)}</dd></div>
          <div><dt>Reason</dt><dd>${htmlEscape(formatReasons(analysis.reasons))}</dd></div>
        </dl>
        ${renderAssessmentTable(value.assessments ?? [])}
        ${
          value.warnings?.length > 0
            ? `<div class="warnings"><strong>Warnings</strong><ul>${value.warnings
                .map((warning) => `<li>${htmlEscape(warning)}</li>`)
                .join("")}</ul></div>`
            : ""
        }
        <details>
          <summary>Expected JSON helper</summary>
          <button class="copy-button" data-target="json-${htmlEscape(detailId)}" type="button">Copy expected JSON</button>
          <pre id="json-${htmlEscape(detailId)}">${htmlEscape(expectedJson)}</pre>
        </details>
        <details>
          <summary>Extracted text preview</summary>
          <pre>${htmlEscape(textPreview)}</pre>
        </details>
      </article>
    `;
  })
);

const detailByFileName = new Map(
  summary.analyses.map((file, index) => [file.fileName, detailCards[index]])
);

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
      --green: #34d399;
      --amber: #fbbf24;
      --rose: #fb7185;
      --slate: #64748b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 15px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header {
      padding: 28px clamp(18px, 4vw, 48px);
      background: rgba(7, 17, 31, 0.94);
      border-bottom: 1px solid var(--border);
    }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: clamp(28px, 4vw, 42px); }
    h2 { font-size: 22px; }
    h3 { font-size: 18px; }
    a { color: inherit; }
    main {
      display: grid;
      gap: 24px;
      padding: 24px clamp(18px, 4vw, 48px) 56px;
    }
    .muted, dt {
      color: var(--muted);
    }
    .dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .metric {
      border: 1px solid var(--border);
      border-radius: 16px;
      background: rgba(255,255,255,0.035);
      padding: 14px;
    }
    .metric span {
      display: block;
      color: var(--muted);
      font-size: 12px;
    }
    .metric strong {
      display: block;
      margin-top: 4px;
      font-size: 24px;
    }
    .golden {
      margin-top: 14px;
      border-radius: 16px;
      border: 1px solid ${summary.cosc101Ready ? "rgba(52, 211, 153, 0.4)" : "rgba(251, 113, 133, 0.45)"};
      background: ${summary.cosc101Ready ? "rgba(52, 211, 153, 0.08)" : "rgba(251, 113, 133, 0.1)"};
      padding: 12px 14px;
      color: ${summary.cosc101Ready ? "var(--green)" : "var(--rose)"};
      font-weight: 700;
    }
    .panel, .card {
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--panel);
      padding: 20px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
    }
    .section-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 12px;
    }
    .quick-links {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
    }
    .quick-links a, .copy-button {
      border: 1px solid var(--border);
      border-radius: 999px;
      background: rgba(255,255,255,0.04);
      color: var(--text);
      cursor: pointer;
      display: inline-flex;
      font: inherit;
      font-size: 13px;
      gap: 8px;
      padding: 8px 12px;
      text-decoration: none;
    }
    .quick-links a:hover, .copy-button:hover {
      border-color: rgba(45, 212, 191, 0.5);
      color: var(--teal);
    }
    .compact-table {
      max-height: 560px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border-bottom: 1px solid var(--border);
      padding: 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: rgba(6, 16, 29, 0.96);
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.06em;
      position: sticky;
      text-transform: uppercase;
      top: 0;
      z-index: 1;
    }
    td {
      color: var(--text);
    }
    .status {
      border: 1px solid var(--border);
      border-radius: 999px;
      display: inline-flex;
      font-size: 13px;
      font-weight: 700;
      padding: 6px 10px;
      white-space: nowrap;
    }
    .status.ready { border-color: rgba(52, 211, 153, 0.4); color: var(--green); }
    .status.needs-review { border-color: rgba(251, 191, 36, 0.45); color: var(--amber); }
    .status.failed { border-color: rgba(251, 113, 133, 0.45); color: var(--rose); }
    .status.skipped { border-color: rgba(100, 116, 139, 0.45); color: var(--slate); }
    .card.needs-review { border-color: rgba(251, 191, 36, 0.36); }
    .card.failed { border-color: rgba(251, 113, 133, 0.38); }
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
    summary {
      cursor: pointer;
      font-weight: 700;
      color: var(--text);
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
    .empty {
      color: var(--muted);
      padding: 16px;
    }
    @media (max-width: 860px) {
      .card-header { flex-direction: column; }
      .compact-table, table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <header>
    <h1>GradeMate Dataset Review</h1>
    <p class="muted">Triage proposed syllabus extraction results before creating or correcting expected JSON files.</p>
    <div class="dashboard">
      ${renderMetric("Total files scanned", summary.totalFilesScanned ?? "n/a")}
      ${renderMetric("Likely syllabi found", summary.likelySyllabiFound)}
      ${renderMetric("Proposed JSON", summary.proposedJsonFilesCreated)}
      ${renderMetric("Weight exactly 100%", summary.totalWeightExactly100)}
      ${renderMetric("Weight below 100%", summary.totalWeightBelow100)}
      ${renderMetric("Weight above 100%", summary.totalWeightAbove100)}
      ${renderMetric("No assessments", summary.noAssessmentsFound)}
      ${renderMetric("Low confidence", summary.lowConfidence)}
      ${renderMetric("Needs review", summary.needsReview)}
      ${renderMetric("Skipped materials", summary.skipped)}
    </div>
    <div class="golden">
      ${summary.cosc101Ready ? "COSC101 golden test ready" : "COSC101 golden test failed"}
    </div>
    <nav class="quick-links" aria-label="Review sections">
      <a href="#compact-table">Compact table</a>
      <a href="#ready">Ready (${summary.ready})</a>
      <a href="#needs-review">Needs review (${summary.needsReview})</a>
      <a href="#failed">Failed (${summary.failed})</a>
      <a href="#skipped">Skipped (${summary.skipped})</a>
    </nav>
  </header>
  <main>
    <section class="panel" id="compact-table">
      <div class="section-header">
        <div>
          <h2>Compact Triage Table</h2>
          <p class="muted">Use this first. Jump into details only where the reason needs attention.</p>
        </div>
      </div>
      <div class="compact-table">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Course code</th>
              <th>Course name</th>
              <th>Assessments</th>
              <th>Total weight</th>
              <th>Confidence</th>
              <th>Status</th>
              <th>Reason</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${summary.analyses.map(renderCompactRow).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Error Reasons</h2>
      ${
        summary.errorReasonCounts.length > 0
          ? `<table><thead><tr><th>Reason</th><th>Count</th></tr></thead><tbody>${summary.errorReasonCounts
              .slice(0, 12)
              .map(
                (item) =>
                  `<tr><td>${htmlEscape(item.reason)}</td><td>${htmlEscape(item.count)}</td></tr>`
              )
              .join("")}</tbody></table>`
          : `<p class="empty">No error reasons found.</p>`
      }
    </section>

    ${renderSection("ready", "✅ Ready: total weight 100%, confidence high", sections.ready, detailByFileName)}
    ${renderSection("needs-review", "⚠️ Needs review: total not 100 or confidence medium/low", sections.needsReview, detailByFileName)}
    ${renderSection("failed", "❌ Failed: no assessments found", sections.failed, detailByFileName)}
    <section class="panel" id="skipped">
      <h2>🚫 Skipped: not a syllabus</h2>
      <p class="muted">${htmlEscape(summary.skipped)} files were skipped because they looked like lectures, labs, assignments, notes, exams, practice files, or other materials. Re-run <code>dataset:scan</code> to refresh this count.</p>
    </section>
  </main>
  <script>
    document.querySelectorAll(".copy-button").forEach((button) => {
      button.addEventListener("click", async () => {
        const target = document.getElementById(button.dataset.target);
        if (!target) return;
        try {
          await navigator.clipboard.writeText(target.textContent || "");
          button.textContent = "Copied";
          setTimeout(() => {
            button.textContent = "Copy expected JSON";
          }, 1400);
        } catch {
          button.textContent = "Copy failed";
          setTimeout(() => {
            button.textContent = "Copy expected JSON";
          }, 1400);
        }
      });
    });
  </script>
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

function renderMetric(label, value) {
  return `<div class="metric"><span>${htmlEscape(label)}</span><strong>${htmlEscape(value)}</strong></div>`;
}

function renderCompactRow({ fileName, value, analysis }) {
  const detailId = getDetailId(fileName);

  return `
    <tr>
      <td>${htmlEscape(value.sourceFileName ?? fileName)}</td>
      <td>${htmlEscape(value.courseCode ?? "—")}</td>
      <td>${htmlEscape(value.courseName ?? "—")}</td>
      <td>${htmlEscape(analysis.assessmentCount)}</td>
      <td>${htmlEscape(formatWeight(analysis.totalWeight))}%</td>
      <td>${htmlEscape(analysis.confidence)}</td>
      <td><span class="status ${analysis.status}">${htmlEscape(getStatusIcon(analysis.status))} ${htmlEscape(analysis.statusLabel)}</span></td>
      <td>${htmlEscape(formatReasons(analysis.reasons))}</td>
      <td><a href="#${htmlEscape(detailId)}">Details</a></td>
    </tr>
  `;
}

function renderAssessmentTable(assessments) {
  if (assessments.length === 0) {
    return `<p class="empty">No assessments found.</p>`;
  }

  return `
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
        ${assessments
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
  `;
}

function renderSection(id, title, files, detailByFileName) {
  return `
    <section class="panel" id="${id}">
      <div class="section-header">
        <h2>${title}</h2>
        <span class="status ${id === "needs-review" ? "needs-review" : id}">${files.length}</span>
      </div>
      ${files.length > 0 ? files.map((file) => detailByFileName.get(file.fileName)).join("") : `<p class="empty">Nothing in this group.</p>`}
    </section>
  `;
}

function formatReasons(reasons) {
  return reasons.length > 0 ? reasons.join("; ") : "ready";
}

function getStatusIcon(status) {
  if (status === "ready") return "✅";
  if (status === "failed") return "❌";
  if (status === "skipped") return "🚫";
  return "⚠️";
}

function getDetailId(fileName) {
  return `detail-${fileName.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}
