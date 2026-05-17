"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Edit3,
  FileText,
  Layers3,
  Percent,
  PlusCircle,
  Save,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  formatPercent,
  getAssessmentMaxScore,
  getAssessmentName,
  getAssessmentStatus,
  getAssessmentWeight,
  getCourseGradeSummary,
  getLetterGrade,
  getWeightedContribution,
  isCompletedAssessment
} from "@/lib/grades";
import {
  getGradeInfo,
  gradeScale,
  type LetterGrade
} from "@/lib/grading";
import {
  createGuestId,
  readGuestData,
  writeGuestData
} from "@/lib/guest-session";
import type {
  AssessmentRecord,
  CourseRecord,
  SyllabusUploadRecord,
  SemesterRecord
} from "@/types/database";
import type { SyllabusExtraction } from "@/lib/ai/syllabus-schema";

type AssessmentForm = {
  name: string;
  weightPercentage: string;
  score: string;
  maxScore: string;
  category: string;
};

const assessmentStatuses = ["Planned", "Completed", "Dropped"];
const assessmentNames = [
  "Midterm",
  "Final",
  "Quizzes",
  "Assignments",
  "Projects",
  "Labs",
  "Participation"
];

const defaultAssessmentForm: AssessmentForm = {
  name: "",
  weightPercentage: "",
  score: "",
  maxScore: "100",
  category: "Planned"
};

const quickTargets = [
  { label: "A", value: 93 },
  { label: "A-", value: 90 },
  { label: "B+", value: 87 },
  { label: "B", value: 83 },
  { label: "C+", value: 77 },
  { label: "C", value: 73 },
  { label: "Pass", value: 60 }
];

const inputStyles =
  "mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";
const syllabusBucketName = "course-syllabi";

function parseOptionalNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function toFormValue(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(Number(value));
}

function getStatusTone(status: string) {
  if (status === "Completed") {
    return "green" as const;
  }

  if (status === "Dropped") {
    return "rose" as const;
  }

  return "gold" as const;
}

function buildAssessmentPayload(form: AssessmentForm) {
  const name = form.name.trim();
  const weight = Number(form.weightPercentage) || 0;
  const score = parseOptionalNumber(form.score);
  const maxScore = parseOptionalNumber(form.maxScore);
  const isScored = score !== null && maxScore !== null && maxScore > 0;
  const category =
    form.category === "Dropped" ? "Dropped" : isScored ? "Completed" : "Planned";

  return {
    name,
    weight_percentage: weight,
    score,
    max_score: maxScore,
    category,
    title: name,
    weight
  };
}

function formatWeightDelta(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getWeightReadiness(totalWeight: number) {
  if (totalWeight === 100) {
    return { label: "Ready", tone: "green" as const };
  }

  if (totalWeight < 100) {
    return {
      label: `Missing ${formatWeightDelta(100 - totalWeight)}%`,
      tone: "gold" as const
    };
  }

  return {
    label: `Over by ${formatWeightDelta(totalWeight - 100)}%`,
    tone: "rose" as const
  };
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function getUploadErrorMessage(message: string) {
  if (/bucket not found|not found/i.test(message) && /bucket/i.test(message)) {
    return "Storage bucket course-syllabi is missing. Run the Supabase storage migration.";
  }

  return message;
}

function SyllabusUploadCard({
  course,
  isGuest,
  onExtracted
}: {
  course: CourseRecord;
  isGuest: boolean;
  onExtracted: (result: {
    course?: CourseRecord;
    assessments?: AssessmentRecord[];
    extraction?: SyllabusExtraction;
  }) => void;
}) {
  const { supabase, user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "uploaded" | "extracting" | "extracted" | "failed"
  >("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [extraction, setExtraction] = useState<SyllabusExtraction | null>(null);

  async function uploadAndExtract() {
    setError("");
    setMessage("");
    setUploadStatus("idle");

    if (isGuest) {
      setError("Log in to upload and extract a syllabus PDF.");
      setUploadStatus("failed");
      return;
    }

    if (!supabase || !file) {
      setError("Choose a PDF syllabus first.");
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setError("Only PDF syllabus files are supported.");
      setUploadStatus("failed");
      return;
    }

    setIsExtracting(true);
    setUploadStatus("uploading");
    let uploadRecordId = "";

    try {
      const fileName = sanitizeFileName(file.name);
      const filePath = `${user.id}/${course.id}/${fileName}`;
      const publicUrl = supabase.storage
        .from(syllabusBucketName)
        .getPublicUrl(filePath).data.publicUrl;

      const { data: uploadRecord, error: recordError } = await supabase
        .from("syllabus_uploads")
        .insert({
          user_id: user.id,
          course_id: course.id,
          file_name: fileName,
          file_path: filePath,
          file_url: publicUrl,
          extraction_status: "uploading",
          extraction_error: null
        })
        .select()
        .single();

      const savedUpload = uploadRecord as SyllabusUploadRecord | null;

      if (recordError || !savedUpload) {
        throw new Error(recordError?.message ?? "Could not save upload record.");
      }

      uploadRecordId = savedUpload.id;

      const { error: uploadError } = await supabase.storage
        .from(syllabusBucketName)
        .upload(filePath, file, {
          contentType: "application/pdf",
          upsert: true
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { error: uploadedStatusError } = await supabase
        .from("syllabus_uploads")
        .update({
          extraction_status: "uploaded",
          extraction_error: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", uploadRecordId)
        .eq("user_id", user.id);

      if (uploadedStatusError) {
        throw new Error(uploadedStatusError.message);
      }

      setUploadStatus("uploaded");
      setMessage("Uploaded");

      await supabase
        .from("syllabus_uploads")
        .update({
          extraction_status: "extracting",
          extraction_error: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", uploadRecordId)
        .eq("user_id", user.id);

      setUploadStatus("extracting");
      setMessage("Extracting...");

      const { data, error: functionError } = await supabase.functions.invoke(
        "extract-syllabus",
        {
          body: {
            uploadId: uploadRecordId,
            courseId: course.id,
            filePath
          }
        }
      );

      if (functionError || data?.error) {
        throw new Error(functionError?.message ?? data.error);
      }

      const result = data as {
        course?: CourseRecord;
        assessments?: AssessmentRecord[];
        extraction?: SyllabusExtraction;
      };
      const createdCount = result.assessments?.length ?? 0;

      setExtraction(result.extraction ?? null);
      setUploadStatus("extracted");
      setMessage(
        `Extracted. Added ${createdCount} assessment${
          createdCount === 1 ? "" : "s"
        }.`
      );
      setFile(null);
      onExtracted(result);
    } catch (extractError) {
      const message =
        extractError instanceof Error
          ? getUploadErrorMessage(extractError.message)
          : "Could not extract this syllabus.";

      if (uploadRecordId && supabase) {
        await supabase
          .from("syllabus_uploads")
          .update({
            extraction_status: "failed",
            extraction_error: message,
            updated_at: new Date().toISOString()
          })
          .eq("id", uploadRecordId)
          .eq("user_id", user.id);
      }

      setUploadStatus("failed");
      setError(message);
    } finally {
      setIsExtracting(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
            <FileText aria-hidden="true" className="h-4 w-4" />
            Syllabus PDF
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink-900">
            Upload and extract assessments
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-500">
            Upload a PDF syllabus for this course. GradeMate stores it privately
            in Supabase, then asks the extraction function to create weighted
            assessment rows.
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <Wand2 aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>

      {isGuest ? (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Guest mode can track grades manually. Log in to upload PDFs and run AI
          extraction.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block">
            <span className="text-sm font-medium text-ink-700">
              PDF syllabus
            </span>
            <input
              accept="application/pdf"
              className="mt-1 block w-full rounded-lg border border-dashed border-ink-300 bg-ink-50 px-3 py-3 text-sm text-ink-700 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              disabled={isExtracting}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <Button
            className="w-full md:w-auto"
            disabled={!file || isExtracting}
            onClick={() => void uploadAndExtract()}
          >
            <UploadCloud aria-hidden="true" className="h-4 w-4" />
            {uploadStatus === "uploading"
              ? "Uploading..."
              : uploadStatus === "extracting"
                ? "Extracting..."
                : "Upload and extract"}
          </Button>
        </div>
      )}

      {uploadStatus !== "idle" ? (
        <p className="mt-4 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-700">
          {uploadStatus === "uploading"
            ? "Uploading..."
            : uploadStatus === "uploaded"
              ? "Uploaded"
              : uploadStatus === "extracting"
                ? "Extracting..."
                : uploadStatus === "extracted"
                  ? "Extracted"
                  : `Failed${error ? `: ${error}` : ""}`}
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-lg border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-800">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {extraction ? (
        <div className="mt-4 rounded-lg border border-ink-200 bg-ink-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="teal">
              {extraction.course.code || course.code || "Course"}
            </Badge>
            <Badge tone="ink">
              {extraction.course.credit_hours ?? Number(course.credit_hours)}{" "}
              credits
            </Badge>
          </div>
          <p className="mt-3 font-semibold text-ink-900">
            {extraction.course.name}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {extraction.assessments.slice(0, 6).map((assessment) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm"
                key={`${assessment.name}-${assessment.weight_percentage}`}
              >
                <span className="font-medium text-ink-800">
                  {assessment.name}
                </span>
                <span className="text-ink-500">
                  {assessment.weight_percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function AutoGradePredictorCard({
  assessments,
  gradeSummary
}: {
  assessments: AssessmentRecord[];
  gradeSummary: ReturnType<typeof getCourseGradeSummary>;
}) {
  const [targetGrade, setTargetGrade] = useState("90");
  const [targetLetter, setTargetLetter] = useState<LetterGrade>("A-");
  const [mode, setMode] = useState<"spread" | "single">("spread");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [assumedScores, setAssumedScores] = useState<Record<string, string>>({});

  const activeAssessments = useMemo(
    () =>
      assessments.filter(
        (assessment) => getAssessmentStatus(assessment) !== "Dropped"
      ),
    [assessments]
  );
  const remainingAssessments = useMemo(
    () =>
      activeAssessments.filter((assessment) => !isCompletedAssessment(assessment)),
    [activeAssessments]
  );
  const remainingWeight = remainingAssessments.reduce(
    (sum, assessment) => sum + getAssessmentWeight(assessment),
    0
  );
  const selectedAssessment =
    remainingAssessments.find(
      (assessment) => assessment.id === selectedAssessmentId
    ) ??
    remainingAssessments[0] ??
    null;
  const target = targetGrade.trim() === "" ? Number.NaN : Number(targetGrade);
  const targetInfo = getGradeInfo(Number.isFinite(target) ? target : 0);
  const projectedFinalGrade = gradeSummary.completedContribution;
  const bestPossibleGrade = gradeSummary.completedContribution + remainingWeight;
  const neededRemainingAverage =
    remainingWeight > 0
      ? ((target - gradeSummary.completedContribution) / remainingWeight) * 100
      : null;
  const otherRemainingAssumedPoints = remainingAssessments.reduce(
    (sum, assessment) => {
      if (!selectedAssessment || assessment.id === selectedAssessment.id) {
        return sum;
      }

      const assumedScore = Number(assumedScores[assessment.id]);

      if (!Number.isFinite(assumedScore)) {
        return sum;
      }

      return sum + (assumedScore / 100) * getAssessmentWeight(assessment);
    },
    0
  );
  const neededSelectedScore =
    selectedAssessment && getAssessmentWeight(selectedAssessment) > 0
      ? ((target -
          gradeSummary.completedContribution -
          otherRemainingAssumedPoints) /
          getAssessmentWeight(selectedAssessment)) *
        100
      : null;

  const status = (() => {
    if (!Number.isFinite(target)) {
      return { label: "At risk", tone: "gold" as const };
    }

    if (gradeSummary.completedContribution >= target) {
      return { label: "Already secured", tone: "green" as const };
    }

    if (mode === "single" && neededSelectedScore !== null && neededSelectedScore < 0) {
      return { label: "Already secured", tone: "green" as const };
    }

    if (
      remainingWeight <= 0 ||
      bestPossibleGrade < target ||
      (mode === "single" && neededSelectedScore !== null && neededSelectedScore > 100)
    ) {
      return { label: "Impossible", tone: "rose" as const };
    }

    if (
      (neededRemainingAverage !== null && neededRemainingAverage >= 90) ||
      (mode === "single" && neededSelectedScore !== null && neededSelectedScore >= 90)
    ) {
      return { label: "At risk", tone: "gold" as const };
    }

    return { label: "Possible", tone: "teal" as const };
  })();

  function updateTargetFromLetter(letter: LetterGrade) {
    const grade = gradeScale.find((item) => item.letter === letter);

    setTargetLetter(letter);
    setTargetGrade(String(grade?.min ?? 0));
  }

  function updateTargetFromButton(value: number) {
    setTargetGrade(String(value));
    setTargetLetter(getGradeInfo(value).letter);
  }

  function updateTargetFromInput(value: string) {
    setTargetGrade(value);
    setTargetLetter(getGradeInfo(Number(value)).letter);
  }

  function updateAssumedScore(assessmentId: string, value: string) {
    setAssumedScores((current) => ({
      ...current,
      [assessmentId]: value
    }));
  }

  function resultMessage() {
    if (!Number.isFinite(target)) {
      return "Enter a valid target percentage to calculate what you need.";
    }

    if (gradeSummary.completedContribution >= target) {
      return "You have already earned enough weighted points to reach this target, assuming incomplete work is not required.";
    }

    if (remainingWeight <= 0) {
      return "There are no remaining weighted assessments, so your projected final grade is fixed by completed scores.";
    }

    if (neededRemainingAverage !== null && neededRemainingAverage > 100) {
      return `To reach ${formatPercent(target)}, you would need ${formatPercent(
        neededRemainingAverage
      )} average on remaining work, so this target is not possible with the current weights.`;
    }

    if (mode === "single" && neededSelectedScore !== null) {
      if (neededSelectedScore > 100) {
        return `To reach ${formatPercent(target)}, you would need ${formatPercent(
          neededSelectedScore
        )} on ${selectedAssessment ? getAssessmentName(selectedAssessment) : "this assessment"}, so this target is not possible on that item alone.`;
      }

      if (neededSelectedScore < 0) {
        return "You have already earned enough weighted points for this target after the assumed remaining scores.";
      }

      return `You need ${formatPercent(neededSelectedScore)} on ${
        selectedAssessment ? getAssessmentName(selectedAssessment) : "the selected assessment"
      } to finish with ${formatPercent(target)}.`;
    }

    return `You need an average of ${formatPercent(
      neededRemainingAverage
    )} across your remaining assessments to finish with ${formatPercent(target)}.`;
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            What do I need?
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink-900">
            Choose a target and GradeMate will calculate the path.
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-500">
            These predictions are temporary. They do not change your saved
            scores.
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {gradeSummary.totalWeight !== 100 ? (
        <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your assessment weights total {formatWeightDelta(gradeSummary.totalWeight)}%,
          so predictions may be inaccurate.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[12rem_12rem_minmax(0,1fr)]">
        <label className="block">
          <span className="text-sm font-medium text-ink-700">
            Target grade
          </span>
          <input
            className={inputStyles}
            min="0"
            onChange={(event) => updateTargetFromInput(event.target.value)}
            step="0.1"
            type="number"
            value={targetGrade}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink-700">
            Target letter
          </span>
          <select
            className={inputStyles}
            onChange={(event) =>
              updateTargetFromLetter(event.target.value as LetterGrade)
            }
            value={targetLetter}
          >
            {gradeScale.map((grade) => (
              <option key={grade.letter} value={grade.letter}>
                {grade.letter} ({grade.min}%)
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="text-sm font-medium text-ink-700">
            Quick targets
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {quickTargets.map((targetOption) => (
              <Button
                key={`${targetOption.label}-${targetOption.value}`}
                onClick={() => updateTargetFromButton(targetOption.value)}
                size="sm"
                variant={
                  Number(targetGrade) === targetOption.value
                    ? "primary"
                    : "secondary"
                }
              >
                {targetOption.label} {targetOption.value}%
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
          <p className="text-sm font-medium text-ink-500">Current grade so far</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">
            {gradeSummary.currentGrade === null
              ? "No scores yet"
              : formatPercent(gradeSummary.currentGrade)}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {gradeSummary.completedWeight}% completed weight
          </p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
          <p className="text-sm font-medium text-ink-500">Projected final</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">
            {formatPercent(projectedFinalGrade)}
          </p>
          <p className="mt-1 text-xs text-ink-500">Remaining work counts as 0</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
          <p className="text-sm font-medium text-ink-500">Best possible</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">
            {formatPercent(bestPossibleGrade)}
          </p>
          <p className="mt-1 text-xs text-ink-500">100% on remaining work</p>
        </div>
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
          <p className="text-sm font-medium text-ink-500">Target letter</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">
            {targetInfo.letter}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Rounded target {targetInfo.roundedPercentage}%
          </p>
        </div>
      </div>

      {remainingAssessments.length === 0 ? (
        <p className="mt-5 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
          No remaining assessments. Your projected final grade is{" "}
          {formatPercent(projectedFinalGrade)}.
        </p>
      ) : (
        <>
          <div className="mt-5 rounded-lg border border-ink-200 bg-ink-50 p-4">
            <p className="text-sm font-semibold text-ink-900">
              Remaining assessments
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {remainingAssessments.map((assessment) => (
                <div
                  className="rounded-lg bg-white px-3 py-2 text-sm"
                  key={assessment.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-ink-800">
                      {getAssessmentName(assessment)}
                    </span>
                    <span className="text-ink-500">
                      {getAssessmentWeight(assessment)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-200 bg-white p-4">
              <input
                checked={mode === "spread"}
                className="mt-1 h-4 w-4 accent-teal-700"
                onChange={() => setMode("spread")}
                type="radio"
              />
              <span>
                <span className="block font-semibold text-ink-900">
                  Spread evenly across remaining assessments
                </span>
                <span className="mt-1 block text-sm text-ink-500">
                  Calculate the average score needed across all remaining work.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-200 bg-white p-4">
              <input
                checked={mode === "single"}
                className="mt-1 h-4 w-4 accent-teal-700"
                onChange={() => setMode("single")}
                type="radio"
              />
              <span>
                <span className="block font-semibold text-ink-900">
                  Calculate for one assessment
                </span>
                <span className="mt-1 block text-sm text-ink-500">
                  Assume scores on other remaining work, then solve one item.
                </span>
              </span>
            </label>
          </div>

          {mode === "single" ? (
            <div className="mt-5 rounded-lg border border-ink-200 bg-ink-50 p-4">
              <label className="block">
                <span className="text-sm font-medium text-ink-700">
                  Selected assessment
                </span>
                <select
                  className={inputStyles}
                  onChange={(event) =>
                    setSelectedAssessmentId(event.target.value)
                  }
                  value={selectedAssessment?.id ?? ""}
                >
                  {remainingAssessments.map((assessment) => (
                    <option key={assessment.id} value={assessment.id}>
                      {getAssessmentName(assessment)} -{" "}
                      {getAssessmentWeight(assessment)}%
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {remainingAssessments
                  .filter((assessment) => assessment.id !== selectedAssessment?.id)
                  .map((assessment) => (
                    <label className="block" key={assessment.id}>
                      <span className="text-sm font-medium text-ink-700">
                        Assumed score for {getAssessmentName(assessment)}
                      </span>
                      <input
                        className={inputStyles}
                        max="100"
                        min="0"
                        onChange={(event) =>
                          updateAssumedScore(assessment.id, event.target.value)
                        }
                        placeholder="0"
                        step="0.1"
                        type="number"
                        value={assumedScores[assessment.id] ?? ""}
                      />
                    </label>
                  ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <p className="rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm leading-6 text-ink-700">
          {resultMessage()}
        </p>
        <div className="rounded-lg border border-ink-200 bg-teal-50 p-4">
          <p className="text-sm font-medium text-teal-800">
            {mode === "single" ? "Needed selected score" : "Needed average"}
          </p>
          <p className="mt-2 text-3xl font-semibold text-teal-800">
            {mode === "single"
              ? neededSelectedScore === null
                ? "N/A"
                : formatPercent(neededSelectedScore)
              : neededRemainingAverage === null
                ? "N/A"
                : formatPercent(neededRemainingAverage)}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function CourseDetailClient({
  courseIdOverride
}: {
  courseIdOverride?: string;
} = {}) {
  const params = useParams();
  const routeCourseId = Array.isArray(params.courseId)
    ? params.courseId[0]
    : params.courseId;
  const courseId = courseIdOverride ?? routeCourseId ?? "";
  const { isGuest, supabase, user } = useAuth();
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [semester, setSemester] = useState<SemesterRecord | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [assessmentForm, setAssessmentForm] =
    useState<AssessmentForm>(defaultAssessmentForm);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("imported") === "1") {
      setImportMessage("Course imported successfully. You can edit the course and assessments here.");
    }
  }, []);

  useEffect(() => {
    async function loadCourse() {
      setIsLoading(true);
      setError("");

      if (!courseId) {
        setError("Course not found.");
        setIsLoading(false);
        return;
      }

      if (isGuest) {
        const guestData = readGuestData();
        const selectedCourse =
          guestData.courses.find((item) => item.id === courseId) ?? null;
        const selectedSemester = selectedCourse
          ? guestData.semesters.find(
              (item) => item.id === selectedCourse.semester_id
            ) ?? null
          : null;

        setCourse(selectedCourse);
        setSemester(selectedSemester);
        setAssessments(
          guestData.assessments.filter((item) => item.course_id === courseId)
        );
        setError(selectedCourse ? "" : "Course not found.");
        setIsLoading(false);
        return;
      }

      if (!supabase) {
        setError("Log in to load this course.");
        setIsLoading(false);
        return;
      }

      const [courseResponse, assessmentResponse] = await Promise.all([
        supabase
          .from("courses")
          .select("*")
          .eq("id", courseId)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("assessments")
          .select("*")
          .eq("course_id", courseId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
      ]);

      const selectedCourse = courseResponse.data as CourseRecord | null;

      if (courseResponse.error || !selectedCourse) {
        setCourse(null);
        setSemester(null);
        setAssessments([]);
        setError(courseResponse.error?.message ?? "Course not found.");
        setIsLoading(false);
        return;
      }

      if (assessmentResponse.error) {
        setError(assessmentResponse.error.message);
      }

      const semesterResponse = await supabase
        .from("semesters")
        .select("*")
        .eq("id", selectedCourse.semester_id)
        .eq("user_id", user.id)
        .single();

      setCourse(selectedCourse);
      setSemester((semesterResponse.data as SemesterRecord | null) ?? null);
      setAssessments((assessmentResponse.data ?? []) as AssessmentRecord[]);
      setIsLoading(false);
    }

    void loadCourse();
  }, [courseId, isGuest, supabase, user.id]);

  const gradeSummary = useMemo(
    () => getCourseGradeSummary(assessments),
    [assessments]
  );
  const weightReadiness = getWeightReadiness(gradeSummary.totalWeight);
  const currentLetterGrade = getLetterGrade(gradeSummary.currentGrade);
  const sortedAssessments = useMemo(
    () =>
      [...assessments].sort(
        (first, second) =>
          new Date(first.created_at).getTime() -
          new Date(second.created_at).getTime()
      ),
    [assessments]
  );

  function updateAssessmentForm(field: keyof AssessmentForm, value: string) {
    setAssessmentForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function resetAssessmentForm() {
    setAssessmentForm(defaultAssessmentForm);
    setEditingAssessmentId(null);
  }

  async function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!course) {
      return;
    }

    setError("");
    setIsSaving(true);
    const payload = buildAssessmentPayload(assessmentForm);

    if (isGuest) {
      const guestData = readGuestData();
      const nextAssessments = editingAssessmentId
        ? guestData.assessments.map((assessment) =>
            assessment.id === editingAssessmentId
              ? {
                  ...assessment,
                  ...payload
                }
              : assessment
          )
        : [
            ...guestData.assessments,
            {
              id: createGuestId("assessment"),
              user_id: user.id,
              course_id: course.id,
              ...payload,
              created_at: new Date().toISOString()
            }
          ];

      writeGuestData({ ...guestData, assessments: nextAssessments });
      setAssessments(
        nextAssessments.filter((assessment) => assessment.course_id === course.id)
      );
      resetAssessmentForm();
      setIsSaving(false);
      return;
    }

    if (!supabase) {
      setError("Log in to save assessments.");
      setIsSaving(false);
      return;
    }

    const response = editingAssessmentId
      ? await supabase
          .from("assessments")
          .update(payload)
          .eq("id", editingAssessmentId)
          .eq("user_id", user.id)
          .select()
          .single()
      : await supabase
          .from("assessments")
          .insert({
            ...payload,
            user_id: user.id,
            course_id: course.id
          })
          .select()
          .single();

    setIsSaving(false);

    const savedAssessment = response.data as AssessmentRecord | null;

    if (response.error || !savedAssessment) {
      setError(response.error?.message ?? "Could not save assessment.");
      return;
    }

    setAssessments((current) =>
      editingAssessmentId
        ? current.map((assessment) =>
            assessment.id === savedAssessment.id ? savedAssessment : assessment
          )
        : [...current, savedAssessment]
    );
    resetAssessmentForm();
  }

  function startEditing(assessment: AssessmentRecord) {
    setEditingAssessmentId(assessment.id);
    setAssessmentForm({
      name: getAssessmentName(assessment),
      weightPercentage: String(getAssessmentWeight(assessment)),
      score: toFormValue(assessment.score),
      maxScore: toFormValue(getAssessmentMaxScore(assessment)),
      category: getAssessmentStatus(assessment)
    });
  }

  async function deleteAssessment(assessmentId: string) {
    if (!course) {
      return;
    }

    setError("");

    if (isGuest) {
      const guestData = readGuestData();
      const nextAssessments = guestData.assessments.filter(
        (assessment) => assessment.id !== assessmentId
      );

      writeGuestData({ ...guestData, assessments: nextAssessments });
      setAssessments(
        nextAssessments.filter((assessment) => assessment.course_id === course.id)
      );

      if (editingAssessmentId === assessmentId) {
        resetAssessmentForm();
      }

      return;
    }

    if (!supabase) {
      setError("Log in to delete assessments.");
      return;
    }

    const { error: deleteError } = await supabase
      .from("assessments")
      .delete()
      .eq("id", assessmentId)
      .eq("user_id", user.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setAssessments((current) =>
      current.filter((assessment) => assessment.id !== assessmentId)
    );

    if (editingAssessmentId === assessmentId) {
      resetAssessmentForm();
    }
  }

  function handleSyllabusExtracted(result: {
    course?: CourseRecord;
    assessments?: AssessmentRecord[];
  }) {
    if (result.course) {
      setCourse(result.course);
    }

    const createdAssessments = result.assessments ?? [];

    if (createdAssessments.length > 0) {
      setAssessments((current) => [...current, ...createdAssessments]);
    }
  }

  if (isLoading) {
    return <Card className="p-5 text-sm text-ink-500">Loading course...</Card>;
  }

  if (!course) {
    return (
      <EmptyState
        action={
          <Link className={buttonStyles()} href="/courses">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to courses
          </Link>
        }
        description={error || "This course could not be found."}
        icon={<BookOpen aria-hidden="true" className="h-5 w-5" />}
        title="Course not found"
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <>
            <Link className={buttonStyles({ variant: "secondary" })} href="/semesters">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back to semester
            </Link>
            <a className={buttonStyles()} href="#assessment-form">
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Add assessment
            </a>
          </>
        }
        description={
          semester
            ? `${semester.name} - ${Number(course.credit_hours)} credit hours`
            : `${Number(course.credit_hours)} credit hours`
        }
        eyebrow={course.code || "Course"}
        title={course.name}
      />

      {importMessage ? (
        <p className="rounded-lg border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-800">
          {importMessage}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4">
          <p className="text-sm font-medium text-ink-500">Credit hours</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {Number(course.credit_hours)}
          </p>
          <p className="mt-1 text-sm text-ink-500">Course workload</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-ink-500">Current grade</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {formatPercent(gradeSummary.currentGrade)}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {gradeSummary.completedWeight}% completed weight
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-ink-500">Letter grade</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {currentLetterGrade}
          </p>
          <p className="mt-1 text-sm text-ink-500">Based on current grade</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-ink-500">Total weight</p>
            <Badge tone={weightReadiness.tone}>{weightReadiness.label}</Badge>
          </div>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {gradeSummary.totalWeight}%
          </p>
          <p className="mt-1 text-sm text-ink-500">Target total is 100%</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm font-medium text-ink-500">Remaining weight</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {gradeSummary.remainingWeight}%
          </p>
          <p className="mt-1 text-sm text-ink-500">Still unassigned</p>
        </Card>
      </section>

      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="teal">{course.code || "Course code"}</Badge>
              <Badge tone="ink">{Number(course.credit_hours)} credits</Badge>
              {semester ? <Badge tone="gold">{semester.name}</Badge> : null}
            </div>
            <h2 className="mt-4 text-xl font-semibold text-ink-900">
              Grade Summary
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
              Your grade is based on completed work. The projection below counts
              incomplete assessments as 0 until you enter scores.
            </p>
          </div>
          <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
            <p className="text-sm font-medium text-ink-500">
              Projected final grade
            </p>
            <p className="mt-2 text-3xl font-semibold text-ink-900">
              {formatPercent(gradeSummary.finalProjectedGrade)}
            </p>
            <p className="mt-1 text-sm text-ink-500">
              Incomplete assessments count as 0 for now
            </p>
          </div>
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-200 p-5">
            <h2 className="text-lg font-semibold text-ink-900">
              Assessments
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Track each item that affects your final grade.
            </p>
          </div>

          {sortedAssessments.length === 0 ? (
            <div className="p-5">
              <EmptyState
                description="Add your first assessment to start calculating this course grade."
                icon={<Layers3 aria-hidden="true" className="h-5 w-5" />}
                title="No assessments yet"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase text-ink-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Assessment</th>
                    <th className="px-5 py-3 font-semibold">Weight</th>
                    <th className="px-5 py-3 font-semibold">Score</th>
                    <th className="px-5 py-3 font-semibold">Contribution</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {sortedAssessments.map((assessment) => {
                    const status = getAssessmentStatus(assessment);
                    const contribution = getWeightedContribution(assessment);
                    const maxScore = getAssessmentMaxScore(assessment);

                    return (
                      <tr key={assessment.id}>
                        <td className="px-5 py-4">
                          <div className="font-medium text-ink-900">
                            {getAssessmentName(assessment)}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-ink-700">
                          {getAssessmentWeight(assessment)}%
                        </td>
                        <td className="px-5 py-4 text-ink-700">
                          {assessment.score === null ||
                          assessment.score === undefined
                            ? "Not scored"
                            : `${Number(assessment.score)} / ${
                                maxScore === null ? "?" : Number(maxScore)
                              }`}
                        </td>
                        <td className="px-5 py-4 font-medium text-ink-900">
                          {formatPercent(contribution)}
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={getStatusTone(status)}>{status}</Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              aria-label={`Edit ${getAssessmentName(assessment)}`}
                              onClick={() => startEditing(assessment)}
                              size="icon"
                              variant="secondary"
                            >
                              <Edit3 aria-hidden="true" className="h-4 w-4" />
                            </Button>
                            <Button
                              aria-label={`Delete ${getAssessmentName(assessment)}`}
                              onClick={() => void deleteAssessment(assessment.id)}
                              size="icon"
                              variant="danger"
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5" id="assessment-form">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-900">
                {editingAssessmentId ? "Edit assessment" : "Add assessment"}
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Track weights and scores as the course unfolds.
              </p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              {editingAssessmentId ? (
                <Save aria-hidden="true" className="h-5 w-5" />
              ) : (
                <PlusCircle aria-hidden="true" className="h-5 w-5" />
              )}
            </span>
          </div>

          <form className="mt-5 space-y-4" onSubmit={saveAssessment}>
            <label className="block">
              <span className="text-sm font-medium text-ink-700">Name</span>
              <input
                className={inputStyles}
                list="course-assessment-names"
                onChange={(event) =>
                  updateAssessmentForm("name", event.target.value)
                }
                placeholder="Midterm"
                required
                value={assessmentForm.name}
              />
              <datalist id="course-assessment-names">
                {assessmentNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </datalist>
            </label>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="block">
                <span className="text-sm font-medium text-ink-700">
                  Weight percentage
                </span>
                <input
                  className={inputStyles}
                  min="0"
                  onChange={(event) =>
                    updateAssessmentForm("weightPercentage", event.target.value)
                  }
                  placeholder="25"
                  required
                  step="0.01"
                  type="number"
                  value={assessmentForm.weightPercentage}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink-700">Status</span>
                <select
                  className={inputStyles}
                  onChange={(event) =>
                    updateAssessmentForm("category", event.target.value)
                  }
                  value={assessmentForm.category}
                >
                  {assessmentStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-ink-700">Score</span>
                <input
                  className={inputStyles}
                  min="0"
                  onChange={(event) =>
                    updateAssessmentForm("score", event.target.value)
                  }
                  placeholder="88"
                  step="0.01"
                  type="number"
                  value={assessmentForm.score}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink-700">
                  Max score
                </span>
                <input
                  className={inputStyles}
                  min="0"
                  onChange={(event) =>
                    updateAssessmentForm("maxScore", event.target.value)
                  }
                  placeholder="100"
                  step="0.01"
                  type="number"
                  value={assessmentForm.maxScore}
                />
              </label>
            </div>

            <div className="rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
              <div className="flex items-center gap-2 font-medium text-ink-900">
                <Percent aria-hidden="true" className="h-4 w-4 text-teal-700" />
                Weighted contribution
              </div>
              <p className="mt-1">
                {assessmentForm.score && assessmentForm.maxScore
                  ? `${formatPercent(
                      (Number(assessmentForm.score) /
                        Number(assessmentForm.maxScore)) *
                        (Number(assessmentForm.weightPercentage) || 0)
                    )} toward the final grade`
                  : "Enter score and max score to preview contribution."}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="w-full" disabled={isSaving} type="submit">
                {editingAssessmentId ? (
                  <Save aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <PlusCircle aria-hidden="true" className="h-4 w-4" />
                )}
                {isSaving
                  ? "Saving..."
                  : editingAssessmentId
                    ? "Save changes"
                    : "Add assessment"}
              </Button>
              {editingAssessmentId ? (
                <Button
                  className="w-full sm:w-auto"
                  onClick={resetAssessmentForm}
                  variant="secondary"
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </section>

      <AutoGradePredictorCard
        assessments={assessments}
        gradeSummary={gradeSummary}
      />

      <SyllabusUploadCard
        course={course}
        isGuest={isGuest}
        onExtracted={handleSyllabusExtracted}
      />

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-700">
            <FileText aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink-900">
              Course materials
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-500">
              Materials from imported templates stay as references for now.
              Upload a syllabus above to auto-fill assessments.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
