"use client";

import { Clipboard, Download, FileText, UploadCloud, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { extractGradeBreakdown, type ExtractedSyllabus } from "@/lib/syllabus/extractSyllabus";
import { extractTextFromPdfFile } from "@/lib/syllabus/pdfText";

const textareaStyles =
  "w-full rounded-xl border border-ink-200 bg-white px-3 py-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

function formatWeight(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getTotalWeight(result: ExtractedSyllabus | null) {
  return (
    Math.round(
      (result?.assessments ?? []).reduce(
        (sum, assessment) => sum + Number(assessment.weight_percentage ?? 0),
        0
      ) * 100
    ) / 100
  );
}

function confidenceLabel(value?: number) {
  const confidence = Number(value ?? 0);

  if (confidence >= 0.8) return "High";
  if (confidence >= 0.55) return "Medium";
  return "Low";
}

function buildExpectedJson(result: ExtractedSyllabus | null) {
  if (!result) {
    return "";
  }

  return JSON.stringify(
    {
      courseCode: result.courseCode,
      courseName: result.courseName,
      creditHours: result.creditHours,
      instructor: result.instructor,
      instructorEmail: result.instructorEmail,
      semester: result.semester,
      schedule: result.schedule,
      classroom: result.classroom,
      officeHours: result.officeHours,
      prerequisites: result.prerequisites,
      textbooks: result.textbooks ?? [],
      courseDescription: result.courseDescription,
      assessments: result.assessments
    },
    null,
    2
  );
}

export function ExtractorLabClient() {
  const [sourceText, setSourceText] = useState("");
  const [pdfPreview, setPdfPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ExtractedSyllabus | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const totalWeight = getTotalWeight(result);
  const outputJson = useMemo(() => buildExpectedJson(result), [result]);

  async function runExtraction(text: string) {
    const trimmed = text.trim();

    if (trimmed.length < 20) {
      setError("Paste or upload more syllabus text first.");
      return;
    }

    const nextResult = extractGradeBreakdown(trimmed, { mode: "syllabus" });
    setResult(nextResult);
    setError("");
    setMessage("Extraction complete. Review the fields and JSON below.");
  }

  async function readPdf(file: File | null) {
    if (!file) {
      return;
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF syllabus file.");
      return;
    }

    setIsReadingPdf(true);
    setError("");
    setMessage("");

    try {
      const text = await extractTextFromPdfFile(file);
      setFileName(file.name);
      setPdfPreview(text.slice(0, 10000));
      setSourceText(text);
      await runExtraction(text);
    } catch {
      setError("PDF text extraction failed. Paste the grading section instead.");
    } finally {
      setIsReadingPdf(false);
    }
  }

  async function copyJson() {
    if (!outputJson) return;
    await navigator.clipboard.writeText(outputJson);
    setMessage("Copied JSON.");
  }

  function downloadExpectedJson() {
    if (!outputJson) return;

    const blob = new Blob([outputJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const safeName =
      fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "_") ||
      result?.courseCode?.replace(/\s+/g, "_") ||
      "expected-extraction";
    anchor.href = url;
    anchor.download = `${safeName}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-ink-50 px-4 py-6 text-ink-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-ink-200 bg-white/90 p-6 shadow-soft shadow-black/10">
          <Badge tone="teal">Development tool</Badge>
          <h1 className="mt-3 text-3xl font-semibold">Extractor Lab</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
            Upload any syllabus PDF or paste text to inspect the same extractor
            used by GradeMate Simple and Workspace.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex items-center gap-2 font-semibold text-ink-900">
                <UploadCloud aria-hidden="true" className="h-5 w-5 text-teal-700" />
                Upload PDF
              </div>
              <input
                accept="application/pdf"
                className="mt-4 block w-full rounded-xl border border-dashed border-ink-300 bg-ink-50 px-3 py-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-teal-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                disabled={isReadingPdf}
                onChange={(event) => void readPdf(event.target.files?.[0] ?? null)}
                type="file"
              />
              <p className="mt-3 text-xs text-ink-500">
                Text is extracted locally in the browser from all pages.
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 font-semibold text-ink-900">
                <FileText aria-hidden="true" className="h-5 w-5 text-teal-700" />
                Paste syllabus text
              </div>
              <textarea
                className={`${textareaStyles} mt-4 min-h-64`}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Paste a syllabus or grading section here..."
                value={sourceText}
              />
              <Button
                className="mt-3 w-full"
                disabled={isReadingPdf}
                onClick={() => void runExtraction(sourceText)}
              >
                <Wand2 aria-hidden="true" className="h-4 w-4" />
                Run extractor
              </Button>
            </Card>
          </div>

          <div className="space-y-6">
            {(message || error) && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  error
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-lime-200 bg-lime-50 text-lime-800"
                }`}
              >
                {error || message}
              </div>
            )}

            {pdfPreview ? (
              <Card className="p-5">
                <details open>
                  <summary className="cursor-pointer font-semibold text-ink-900">
                    Extracted text preview
                  </summary>
                  <p className="mt-2 text-xs text-ink-500">{fileName}</p>
                  <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-100 p-3 text-xs leading-5 text-ink-600">
                    {pdfPreview}
                  </pre>
                </details>
              </Card>
            ) : null}

            {result ? (
              <>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={totalWeight === 100 ? "green" : "gold"}>
                      Weight total: {formatWeight(totalWeight)}%
                    </Badge>
                    <Badge tone="ink">
                      {Math.round(result.confidence * 100)}% confidence
                    </Badge>
                    <Badge tone="teal">
                      {result.debug?.candidateCount ?? 0} candidates
                    </Badge>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {[
                      ["Course code", result.courseCode],
                      ["Course name", result.courseName],
                      ["Credits", result.creditHours],
                      ["Instructor", result.instructor],
                      ["Email", result.instructorEmail],
                      ["Semester", result.semester],
                      ["Schedule", result.schedule],
                      ["Classroom", result.classroom],
                      ["Office hours", result.officeHours],
                      ["Prerequisites", result.prerequisites]
                    ].map(([label, value]) => (
                      <div className="rounded-xl bg-ink-100/70 p-3 text-sm" key={String(label)}>
                        <p className="text-ink-500">{label}</p>
                        <p className="mt-1 font-medium text-ink-900">
                          {value === null || value === undefined || value === ""
                            ? "Not found"
                            : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                  {(result.textbooks ?? []).length > 0 ? (
                    <div className="mt-4 rounded-xl bg-ink-100/70 p-3 text-sm">
                      <p className="text-ink-500">Textbooks</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {(result.textbooks ?? []).map((textbook) => (
                          <li key={textbook}>{textbook}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {result.courseDescription ? (
                    <div className="mt-4 rounded-xl bg-ink-100/70 p-3 text-sm">
                      <p className="text-ink-500">Course description</p>
                      <p className="mt-2 leading-6">{result.courseDescription}</p>
                    </div>
                  ) : null}
                </Card>

                <Card className="overflow-hidden">
                  <div className="border-b border-ink-200 p-5">
                    <h2 className="font-semibold text-ink-900">Assessments</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-ink-100 text-xs uppercase text-ink-500">
                        <tr>
                          <th className="px-4 py-3">Assessment</th>
                          <th className="px-4 py-3">Weight</th>
                          <th className="px-4 py-3">Confidence</th>
                          <th className="px-4 py-3">Snippet</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {result.assessments.map((assessment) => (
                          <tr key={`${assessment.name}-${assessment.weight_percentage}`}>
                            <td className="px-4 py-3 font-medium">{assessment.name}</td>
                            <td className="px-4 py-3">{assessment.weight_percentage}%</td>
                            <td className="px-4 py-3">
                              {confidenceLabel(assessment.confidence)}
                            </td>
                            <td className="px-4 py-3 text-xs text-ink-500">
                              {assessment.source_text_snippet}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {result.warnings.length > 0 ? (
                  <Card className="p-5">
                    <h2 className="font-semibold text-ink-900">Warnings</h2>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-700">
                      {result.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </Card>
                ) : null}

                {result.debug?.candidates?.length ? (
                  <Card className="p-5">
                    <h2 className="font-semibold text-ink-900">Candidate breakdowns</h2>
                    <div className="mt-3 space-y-2">
                      {result.debug.candidates.map((candidate) => (
                        <div className="rounded-xl bg-ink-100 p-3 text-sm" key={candidate.label}>
                          <p className="font-medium">{candidate.label}</p>
                          <p className="mt-1 text-ink-500">
                            {candidate.assessmentCount} rows · {candidate.totalWeight}%
                            total · score {candidate.score}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                <Card className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-semibold text-ink-900">Final JSON</h2>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => void copyJson()} size="sm" variant="secondary">
                        <Clipboard aria-hidden="true" className="h-4 w-4" />
                        Copy JSON
                      </Button>
                      <Button onClick={downloadExpectedJson} size="sm">
                        <Download aria-hidden="true" className="h-4 w-4" />
                        Download expected JSON
                      </Button>
                    </div>
                  </div>
                  <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-ink-950 p-4 text-xs leading-5 text-ink-50">
                    {outputJson}
                  </pre>
                </Card>
              </>
            ) : (
              <Card className="p-8 text-center text-sm text-ink-500">
                Upload a PDF or paste syllabus text to inspect extraction output.
              </Card>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
