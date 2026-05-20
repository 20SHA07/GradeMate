"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  Plus,
  Trash2,
  UploadCloud
} from "lucide-react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  extractGradeBreakdown,
  type ExtractedAssessment,
  type ExtractedSyllabus
} from "@/lib/syllabus/extractSyllabus";
import { extractTextFromPdfFile } from "@/lib/syllabus/pdfText";
import type { ProfileRecord, SyllabusContributionRecord } from "@/types/database";

type SourceType = "pdf" | "pasted_text";

type AssessmentDraft = ExtractedAssessment & {
  id: string;
};

type SubmissionSuccess = {
  id: string;
  courseCode: string | null;
  courseName: string | null;
  createdAt: string;
  status: string;
};

type ContributorCreditDraft = {
  username: string;
  contributorName: string;
};

type CourseInfoKey =
  | "courseCode"
  | "courseName"
  | "creditHours"
  | "instructor"
  | "instructorEmail"
  | "semester"
  | "schedule"
  | "classroom"
  | "officeHours"
  | "prerequisites"
  | "textbooks"
  | "courseDescription";

type CourseInfoDraft = Record<CourseInfoKey, string>;

const guestContributionDraftsKey = "grademate_guest_syllabus_contribution_drafts";

const inputStyles =
  "gm-input";

const courseInfoFields: Array<{
  key: CourseInfoKey;
  label: string;
  multiline?: boolean;
}> = [
  { key: "courseCode", label: "Course code" },
  { key: "courseName", label: "Course name" },
  { key: "creditHours", label: "Credit hours" },
  { key: "instructor", label: "Instructor" },
  { key: "instructorEmail", label: "Instructor email" },
  { key: "semester", label: "Semester" },
  { key: "schedule", label: "Schedule" },
  { key: "classroom", label: "Classroom" },
  { key: "officeHours", label: "Office hours" },
  { key: "prerequisites", label: "Prerequisites" },
  { key: "textbooks", label: "Textbooks", multiline: true },
  { key: "courseDescription", label: "Course description", multiline: true }
];

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatWeight(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getTotalWeight(rows: AssessmentDraft[]) {
  return (
    Math.round(
      rows.reduce((sum, row) => sum + Number(row.weight_percentage || 0), 0) *
        100
    ) / 100
  );
}

function confidenceLabel(value: number) {
  if (value >= 0.8) {
    return "High";
  }

  if (value >= 0.6) {
    return "Medium";
  }

  return "Low";
}

function departmentFromCode(courseCode: string | null) {
  return courseCode?.match(/^[A-Z]{2,5}/i)?.[0]?.toUpperCase() ?? null;
}

function hashText(text: string) {
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }

  return `local-${Math.abs(hash)}`;
}

function emptyInfoDraft(): CourseInfoDraft {
  return {
    classroom: "",
    courseCode: "",
    courseDescription: "",
    courseName: "",
    creditHours: "",
    instructor: "",
    instructorEmail: "",
    officeHours: "",
    prerequisites: "",
    schedule: "",
    semester: "",
    textbooks: ""
  };
}

function infoDraftFromExtraction(extraction: ExtractedSyllabus): CourseInfoDraft {
  return {
    classroom: extraction.classroom ?? "",
    courseCode: extraction.courseCode ?? "",
    courseDescription: extraction.courseDescription ?? "",
    courseName: extraction.courseName ?? "",
    creditHours: extraction.creditHours ? String(extraction.creditHours) : "",
    instructor: extraction.instructor ?? "",
    instructorEmail: extraction.instructorEmail ?? "",
    officeHours: extraction.officeHours ?? "",
    prerequisites: extraction.prerequisites ?? "",
    schedule: extraction.schedule ?? "",
    semester: extraction.semester ?? "",
    textbooks: extraction.textbooks?.join("\n") ?? ""
  };
}

function assessmentDraftsFromExtraction(extraction: ExtractedSyllabus) {
  return extraction.assessments.map((assessment) => ({
    ...assessment,
    id: createLocalId("assessment")
  }));
}

function buildConfirmedJson(info: CourseInfoDraft, rows: AssessmentDraft[]) {
  return {
    assessments: rows.map(({ id, ...row }) => {
      void id;
      return row;
    }),
    classroom: info.classroom || null,
    courseCode: info.courseCode || null,
    courseDescription: info.courseDescription || null,
    courseName: info.courseName || null,
    creditHours: info.creditHours ? Number(info.creditHours) : null,
    instructor: info.instructor || null,
    instructorEmail: info.instructorEmail || null,
    officeHours: info.officeHours || null,
    prerequisites: info.prerequisites || null,
    schedule: info.schedule || null,
    semester: info.semester || null,
    textbooks: info.textbooks
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
  };
}

function saveGuestContributionDraft(payload: Record<string, unknown>) {
  const currentRaw = window.localStorage.getItem(guestContributionDraftsKey);
  const current = currentRaw ? JSON.parse(currentRaw) : [];
  const drafts = Array.isArray(current) ? current : [];

  window.localStorage.setItem(
    guestContributionDraftsKey,
    JSON.stringify([payload, ...drafts].slice(0, 25))
  );
}

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "");
}

function isValidUsername(value: string) {
  return value.length === 0 || /^[a-z0-9_]{3,24}$/.test(value);
}

function fallbackContributorName({
  email,
  fullName
}: {
  email?: string | null;
  fullName?: string | null;
}) {
  if (fullName?.trim()) {
    return fullName.trim();
  }

  return email?.split("@")[0]?.trim() || "GradeMate contributor";
}

export function ContributeSyllabusClient() {
  const { isGuest, openSaveProgress, supabase, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const submitLockRef = useRef(false);
  const [sourceType, setSourceType] = useState<SourceType>("pasted_text");
  const [syllabusText, setSyllabusText] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [allowAdminReviewStorage, setAllowAdminReviewStorage] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [info, setInfo] = useState<CourseInfoDraft>(() => emptyInfoDraft());
  const [rows, setRows] = useState<AssessmentDraft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confidence, setConfidence] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submission, setSubmission] = useState<SubmissionSuccess | null>(null);
  const [credit, setCredit] = useState<ContributorCreditDraft>({
    contributorName: "",
    username: ""
  });
  const [creditMessage, setCreditMessage] = useState("");
  const [creditError, setCreditError] = useState("");
  const [isCreditLoading, setIsCreditLoading] = useState(false);
  const [isCreditSaving, setIsCreditSaving] = useState(false);

  const totalWeight = useMemo(() => getTotalWeight(rows), [rows]);
  const weightMessage =
    totalWeight >= 99 && totalWeight <= 101
      ? "Weight total: 100% ready"
      : totalWeight > 101
        ? `Over by ${formatWeight(totalWeight - 100)}%`
      : `Missing ${formatWeight(100 - totalWeight)}%`;

  useEffect(() => {
    if (isGuest || !supabase) {
      setCredit({
        contributorName: "",
        username: ""
      });
      setIsCreditLoading(false);
      return;
    }

    const client = supabase;
    let isMounted = true;

    async function loadContributorCredit() {
      setIsCreditLoading(true);
      setCreditError("");

      const { data, error: loadError } = await client
        .from("profiles")
        .select("email,full_name,username,contributor_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (loadError) {
        setCreditError("Could not load contributor credit right now.");
      } else {
        const profile = data as Pick<
          ProfileRecord,
          "contributor_name" | "email" | "full_name" | "username"
        > | null;

        setCredit({
          contributorName:
            profile?.contributor_name?.trim() ||
            fallbackContributorName({
              email: profile?.email ?? user.email,
              fullName: profile?.full_name
            }),
          username: profile?.username ?? ""
        });
      }

      setIsCreditLoading(false);
    }

    void loadContributorCredit();

    return () => {
      isMounted = false;
    };
  }, [isGuest, supabase, user.email, user.id]);

  function loadExtraction(extraction: ExtractedSyllabus, source: string) {
    setSubmission(null);
    setInfo(infoDraftFromExtraction(extraction));
    setRows(assessmentDraftsFromExtraction(extraction));
    setWarnings(extraction.warnings);
    setConfidence(extraction.confidence);
    setError("");
    setMessage(
      extraction.assessments.length > 0
        ? `${source}. Review and edit before submitting.`
        : "I could not find a grading breakdown. You can edit the rows manually."
    );
  }

  function runExtraction(text: string, source: string) {
    const extraction = extractGradeBreakdown(text, { mode: "syllabus" });
    loadExtraction(extraction, source);
  }

  async function extractFromText() {
    const text = syllabusText.trim();

    if (!text) {
      setError("Paste syllabus text first.");
      return;
    }

    setSourceType("pasted_text");
    setExtractedText(text);
    runExtraction(text, "Detected from pasted text");
  }

  async function extractFromPdf(file: File) {
    setIsExtracting(true);
    setError("");
    setMessage("");
    setSourceType("pdf");
    setSourceFileName(file.name);

    try {
      const text = await extractTextFromPdfFile(file);
      setExtractedText(text);

      if (text.trim().length < 80) {
        setError(
          "This PDF may be scanned or image-based. Try pasting the grading section instead."
        );
      }

      runExtraction(text, "Extracted from PDF");
    } catch {
      setError("PDF text extraction failed. Paste the grading section instead.");
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function updateInfo(key: CourseInfoKey, value: string) {
    setInfo((current) => ({ ...current, [key]: value }));
  }

  function updateRow(
    rowId: string,
    field: keyof Pick<
      AssessmentDraft,
      "name" | "weight_percentage" | "max_score" | "confidence"
    >,
    value: string
  ) {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]:
                field === "name"
                  ? value
                  : Number.isFinite(Number(value))
                    ? Number(value)
                    : 0
            }
          : row
      )
    );
  }

  function addRow() {
    setSubmission(null);
    setRows((current) => [
      ...current,
      {
        confidence: 0.6,
        id: createLocalId("assessment"),
        max_score: 100,
        name: "Assessment",
        source_text_snippet: "",
        weight_percentage: 0
      }
    ]);
  }

  function deleteRow(rowId: string) {
    setSubmission(null);
    setRows((current) => current.filter((row) => row.id !== rowId));
  }

  async function saveContributorCredit() {
    if (isGuest || !supabase) {
      setCreditMessage("Sign in to save contributor credit.");
      return;
    }

    const username = normalizeUsername(credit.username);
    const contributorName = credit.contributorName.trim();

    if (!isValidUsername(username)) {
      setCreditError("Use 3-24 lowercase letters, numbers, or underscores.");
      return;
    }

    if (contributorName.length > 40) {
      setCreditError("Keep your display name under 40 characters.");
      return;
    }

    setIsCreditSaving(true);
    setCreditError("");
    setCreditMessage("");

    try {
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update({
          contributor_name: contributorName || null,
          username: username || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      if (!updatedProfile) {
        const { error: insertError } = await supabase.from("profiles").insert({
          contributor_name: contributorName || null,
          email: user.email ?? null,
          full_name:
            typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : null,
          id: user.id,
          role: "user",
          username: username || null
        });

        if (insertError) {
          throw insertError;
        }
      }

      setCredit({
        contributorName:
          contributorName ||
          fallbackContributorName({
            email: user.email,
            fullName:
              typeof user.user_metadata?.full_name === "string"
                ? user.user_metadata.full_name
                : null
          }),
        username
      });
      setCreditMessage("Contributor credit saved.");
    } catch (saveError) {
      console.error("Contributor credit save failed", saveError);
      const message =
        saveError instanceof Error ? saveError.message : String(saveError);
      setCreditError(
        /duplicate|unique|profiles_username_unique/i.test(message)
          ? "That username is already taken."
          : "Could not save contributor credit right now."
      );
    } finally {
      setIsCreditSaving(false);
    }
  }

  function resetContributionForm() {
    setSourceType("pasted_text");
    setSyllabusText("");
    setSourceFileName("");
    setAllowAdminReviewStorage(false);
    setExtractedText("");
    setIsExtracting(false);
    setIsSubmitting(false);
    setInfo(emptyInfoDraft());
    setRows([]);
    setWarnings([]);
    setConfidence(0);
    setMessage("");
    setError("");
    setSubmission(null);
    submitLockRef.current = false;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function submitContribution() {
    if (submitLockRef.current || isSubmitting) {
      return;
    }

    const isPdfContribution =
      sourceType === "pdf" || sourceFileName.toLowerCase().endsWith(".pdf");

    if (rows.length === 0) {
      setError("Add at least one assessment before submitting.");
      return;
    }

    if (isPdfContribution && !allowAdminReviewStorage) {
      setError(
        "Please confirm that this syllabus may be stored privately for admin review before submitting."
      );
      return;
    }

    const confirmedJson = buildConfirmedJson(info, rows);
    const sourceText = extractedText || syllabusText;
    const contributorUsername = normalizeUsername(credit.username);
    const contributorName =
      credit.contributorName.trim() ||
      fallbackContributorName({
        email: user.email,
        fullName:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : null
      });

    if (!isValidUsername(contributorUsername)) {
      setError("Contributor username must use 3-24 lowercase letters, numbers, or underscores.");
      return;
    }

    const payload = {
      campus: null,
      contributor_name: contributorName,
      contributor_username: contributorUsername || null,
      course_code: info.courseCode || null,
      course_name: info.courseName || null,
      credit_hours: info.creditHours ? Number(info.creditHours) : null,
      department: departmentFromCode(info.courseCode || null),
      extracted_json: confirmedJson,
      extraction_confidence: confidence,
      instructor: info.instructor || null,
      instructor_email: info.instructorEmail || null,
      status: "pending_review",
      submitted_by_user_id: user.id,
      syllabus_file_name: sourceFileName || null,
      syllabus_file_path: null,
      term: info.semester || null,
      university: null
    };

    setError("");
    setMessage("");
    setSubmission(null);

    if (isGuest || !supabase) {
      saveGuestContributionDraft({
        ...payload,
        created_at: new Date().toISOString(),
        source_text_hash: hashText(sourceText),
        status: "draft"
      });
      setMessage("Saved as a local draft. Sign in to submit for review.");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const { data, error: contributionError } = await supabase
        .from("syllabus_contributions")
        .insert(payload)
        .select()
        .single();

      if (contributionError || !data) {
        throw contributionError ?? new Error("Could not save contribution.");
      }

      if (rows.length > 0) {
        const { error: assessmentError } = await supabase
          .from("contribution_assessments")
          .insert(
            rows.map((row) => ({
              confidence: row.confidence,
              contribution_id: data.id,
              max_score: Number(row.max_score) || 100,
              name: row.name,
              source_text_snippet: row.source_text_snippet || null,
              weight_percentage: Number(row.weight_percentage) || 0
            }))
          );

        if (assessmentError) {
          throw assessmentError;
        }
      }

      const savedContribution = data as SyllabusContributionRecord;
      setSubmission({
        courseCode: savedContribution.course_code,
        courseName: savedContribution.course_name,
        createdAt: savedContribution.created_at,
        id: savedContribution.id,
        status: savedContribution.status ?? "pending_review"
      });
      setMessage("Syllabus submitted for review.");
    } catch (submitError) {
      console.error("Syllabus contribution submission failed", submitError);
      setError("We couldn't submit this right now. Please try again.");
    } finally {
      setIsSubmitting(false);
      submitLockRef.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link className={buttonStyles({ variant: "secondary" })} href="/my-contributions">
            My contributions
          </Link>
        }
        description="Upload or paste a syllabus, review the detected course info, then submit it for admin review."
        title="Contribute syllabus"
      />

      {isGuest ? (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-ink-900">Guest draft mode</p>
            <p className="mt-1 text-sm text-ink-500">
              Please sign in to submit a syllabus for review. You can keep
              editing locally and save this as a draft on this device.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonStyles()} href="/login">
              Sign in
            </Link>
            <Button
              onClick={() => {
                setError("");
                setMessage("Keep editing locally. Use Save draft locally when you are ready.");
              }}
              variant="secondary"
            >
              Continue editing locally
            </Button>
          </div>
        </Card>
      ) : null}

      {!isGuest ? (
        <Card className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl">
              <h2 className="font-semibold text-ink-900">Contributor credit</h2>
              <p className="mt-1 text-sm text-ink-500">
                Choose how your approved contributions should be credited in the
                Course Library. Your email is never shown publicly.
              </p>
              {credit.username ? (
                <p className="mt-2 text-sm text-teal-700">
                  Public credit preview: @{normalizeUsername(credit.username)}
                  {credit.contributorName.trim()
                    ? ` - ${credit.contributorName.trim()}`
                    : ""}
                </p>
              ) : null}
            </div>
            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:max-w-2xl">
              <label>
                <span className="text-sm font-medium text-ink-700">
                  Username
                </span>
                <input
                  className={`${inputStyles} mt-1`}
                  disabled={isCreditLoading}
                  onChange={(event) =>
                    setCredit((current) => ({
                      ...current,
                      username: normalizeUsername(event.target.value)
                    }))
                  }
                  placeholder="shahad"
                  value={credit.username}
                />
              </label>
              <label>
                <span className="text-sm font-medium text-ink-700">
                  Display name
                </span>
                <input
                  className={`${inputStyles} mt-1`}
                  disabled={isCreditLoading}
                  onChange={(event) =>
                    setCredit((current) => ({
                      ...current,
                      contributorName: event.target.value
                    }))
                  }
                  placeholder="Your name"
                  value={credit.contributorName}
                />
              </label>
              <Button
                className="self-end"
                disabled={isCreditLoading || isCreditSaving}
                onClick={() => void saveContributorCredit()}
                variant="secondary"
              >
                {isCreditSaving ? "Saving..." : "Save credit"}
              </Button>
            </div>
          </div>
          {creditError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {creditError}
            </p>
          ) : null}
          {creditMessage ? (
            <p className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
              {creditMessage}
            </p>
          ) : null}
        </Card>
      ) : null}

      {error ? (
        <div className="flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          {!isGuest && rows.length > 0 ? (
            <Button
              disabled={isSubmitting}
              onClick={() => void submitContribution()}
              size="sm"
              variant="secondary"
            >
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          {message}
        </p>
      ) : null}

      {submission ? (
        <Card className="border-teal-200 bg-teal-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-teal-800">
                <CheckCircle aria-hidden="true" className="h-5 w-5" />
                <Badge tone="teal">Pending review</Badge>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-ink-900">
                Submission received
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-700">
                Thanks &mdash; your syllabus was submitted for review. It will not
                appear in the Course Library until it is approved.
              </p>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-[3px] border border-teal-200 bg-white/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                    Course
                  </p>
                  <p className="mt-1 font-semibold text-ink-900">
                    {[submission.courseCode, submission.courseName]
                      .filter(Boolean)
                      .join(" - ") || "Untitled syllabus"}
                  </p>
                </div>
                <div className="rounded-[3px] border border-teal-200 bg-white/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                    What happens next
                  </p>
                  <p className="mt-1 font-semibold text-ink-900">
                    I&apos;ll review it before publishing it to the shared Course Library.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:min-w-48">
              <Link className={buttonStyles()} href="/my-contributions">
                View my submissions
              </Link>
              <Button onClick={resetContributionForm} variant="secondary">
                Submit another syllabus
              </Button>
              <Link
                className={buttonStyles({ variant: "ghost" })}
                href="/course-library"
              >
                Back to Course Library
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      {!submission ? (
        <>
      <Card className="p-5">
          <h2 className="text-lg font-semibold text-ink-900">
            Before you submit
          </h2>
          <div className="mt-3 grid gap-3 text-sm text-ink-600 md:grid-cols-3">
            <p className="rounded-[3px] border border-ink-200 bg-ink-50 p-3">
              Review the detected course info and assessment weights.
            </p>
            <p className="rounded-[3px] border border-ink-200 bg-ink-50 p-3">
              Your submission is saved as pending review, not published instantly.
            </p>
            <p className="rounded-[3px] border border-ink-200 bg-ink-50 p-3">
              Normal extraction PDFs are not stored. Contribution PDFs require
              your review permission.
            </p>
          </div>
        </Card>

        <Card className="p-5">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setSourceType("pasted_text");
              setAllowAdminReviewStorage(false);
            }}
            variant={sourceType === "pasted_text" ? "primary" : "secondary"}
          >
            Paste text
          </Button>
          <Button
            onClick={() => setSourceType("pdf")}
            variant={sourceType === "pdf" ? "primary" : "secondary"}
          >
            Upload PDF
          </Button>
        </div>

        {sourceType === "pasted_text" ? (
          <div className="mt-4">
            <label className="text-sm font-medium text-ink-800">
              Syllabus text
            </label>
            <textarea
              className="gm-textarea mt-2 min-h-44"
              onChange={(event) => setSyllabusText(event.target.value)}
              placeholder="Paste the grading section or full syllabus here..."
              value={syllabusText}
            />
            <Button className="mt-3" onClick={() => void extractFromText()}>
              <FileText aria-hidden="true" className="h-4 w-4" />
              Extract suggestions
            </Button>
          </div>
        ) : (
          <div className="mt-4 rounded-[3px] border border-dashed border-ink-300 bg-ink-50 p-5">
            <input
              accept="application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void extractFromPdf(file);
                }
              }}
              ref={fileInputRef}
              type="file"
            />
            <Button
              disabled={isExtracting}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud aria-hidden="true" className="h-4 w-4" />
              {isExtracting ? "Extracting..." : "Choose PDF"}
            </Button>
            <p className="mt-2 text-sm text-ink-500">
              PDF text is extracted in your browser first. You will review everything before submitting.
            </p>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">
                Contribution uploads may be stored privately for admin review.
              </p>
              <p className="mt-1 text-amber-800">
                This is different from normal GradeMate extraction, where PDFs are not stored.
                Only admins can review contribution source files.
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input
                  checked={allowAdminReviewStorage}
                  className="mt-1 h-4 w-4 rounded border-amber-300 text-teal-700"
                  onChange={(event) =>
                    setAllowAdminReviewStorage(event.target.checked)
                  }
                  type="checkbox"
                />
                <span>
                  I understand this syllabus may be stored privately for admin review.
                </span>
              </label>
            </div>
          </div>
        )}

        {extractedText ? (
          <details className="mt-4 rounded-lg bg-ink-100 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink-800">
              Extracted text preview
            </summary>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-ink-600">
              {extractedText.slice(0, 6000)}
            </pre>
          </details>
        ) : null}
        </Card>

        <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">
              Course info suggestions
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Edit anything that looks wrong before submitting.
            </p>
          </div>
          <Badge tone={confidence >= 0.8 ? "green" : confidence >= 0.6 ? "teal" : "gold"}>
            {confidenceLabel(confidence)} confidence
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {courseInfoFields.map((field) => (
            <label
              className={field.multiline ? "md:col-span-2" : undefined}
              key={field.key}
            >
              <span className="text-sm font-medium text-ink-700">
                {field.label}
              </span>
              {field.multiline ? (
                <textarea
                  className="gm-textarea mt-1 min-h-24"
                  onChange={(event) => updateInfo(field.key, event.target.value)}
                  value={info[field.key]}
                />
              ) : (
                <input
                  className={`${inputStyles} mt-1`}
                  onChange={(event) => updateInfo(field.key, event.target.value)}
                  value={info[field.key]}
                />
              )}
            </label>
          ))}
        </div>
        </Card>

        <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">
              Assessment suggestions
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              {weightMessage}
            </p>
          </div>
          <Button onClick={addRow} variant="secondary">
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add row
          </Button>
        </div>

        {warnings.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex gap-2 font-medium">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4" />
              Review notes
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-[3px] border border-ink-200">
          <table className="gm-table min-w-[760px]">
            <thead>
              <tr>
                <th className="px-3 py-2">Assessment</th>
                <th className="px-3 py-2">Weight</th>
                <th className="px-3 py-2">Max</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-ink-500" colSpan={5}>
                    No assessment rows yet. Extract from text/PDF or add rows manually.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">
                      <input
                        className={inputStyles}
                        onChange={(event) =>
                          updateRow(row.id, "name", event.target.value)
                        }
                        value={row.name}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputStyles}
                        onChange={(event) =>
                          updateRow(row.id, "weight_percentage", event.target.value)
                        }
                        type="number"
                        value={row.weight_percentage}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputStyles}
                        onChange={(event) =>
                          updateRow(row.id, "max_score", event.target.value)
                        }
                        type="number"
                        value={row.max_score}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={row.confidence >= 0.8 ? "green" : row.confidence >= 0.6 ? "teal" : "gold"}>
                        {confidenceLabel(row.confidence)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        aria-label={`Delete ${row.name}`}
                        onClick={() => deleteRow(row.id)}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {isGuest ? (
            <Button onClick={openSaveProgress} variant="secondary">
              Sign in to submit
            </Button>
          ) : null}
          <Button disabled={isSubmitting} onClick={() => void submitContribution()}>
            {isGuest
              ? "Save draft locally"
              : isSubmitting
                ? "Submitting..."
                : "Submit for review"}
          </Button>
        </div>
        </Card>
        </>
      ) : null}
    </div>
  );
}
