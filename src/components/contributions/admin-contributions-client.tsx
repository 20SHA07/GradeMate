"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, X } from "lucide-react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getSupabaseErrorMessage } from "@/lib/supabase/config";
import type {
  ContributionAssessmentRecord,
  CourseTemplateRecord,
  ProfileRecord,
  SyllabusContributionRecord
} from "@/types/database";

type StatusFilter = "pending_review" | "needs_changes" | "approved" | "rejected";

type ContributionWithRows = SyllabusContributionRecord & {
  assessments: ContributionAssessmentRecord[];
};

const statusFilters: StatusFilter[] = [
  "pending_review",
  "needs_changes",
  "approved",
  "rejected"
];

const statusTone: Record<string, "green" | "gold" | "rose" | "teal" | "ink"> = {
  approved: "green",
  needs_changes: "gold",
  pending_review: "teal",
  rejected: "rose"
};

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function totalWeight(assessments: ContributionAssessmentRecord[]) {
  return (
    Math.round(
      assessments.reduce(
        (sum, assessment) => sum + Number(assessment.weight_percentage || 0),
        0
      ) * 100
    ) / 100
  );
}

function departmentFromCode(courseCode: string | null) {
  return courseCode?.match(/^[A-Z]{2,5}/i)?.[0]?.toUpperCase() ?? null;
}

function extractedTextPreview(contribution: SyllabusContributionRecord) {
  const json = contribution.extracted_json as Record<string, unknown> | null;
  const description =
    json &&
    typeof json === "object" &&
    typeof json.courseDescription === "string"
      ? json.courseDescription
      : "";

  return description || "No extracted text preview stored for this contribution.";
}

export function AdminContributionsClient() {
  const { isGuest, supabase, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("pending_review");
  const [contributions, setContributions] = useState<ContributionWithRows[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRecord>>({});
  const [selected, setSelected] = useState<ContributionWithRows | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAdminData() {
    if (isGuest || !supabase) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setError(
        getSupabaseErrorMessage(
          profileError,
          "Could not check admin access. Run the contribution SQL setup first."
        )
      );
      setIsLoading(false);
      return;
    }

    if ((profile as ProfileRecord | null)?.role !== "admin") {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    setIsAdmin(true);

    const [
      contributionsResponse,
      assessmentsResponse,
      profilesResponse
    ] = await Promise.all([
      supabase
        .from("syllabus_contributions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("contribution_assessments")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase.from("profiles").select("*")
    ]);

    if (contributionsResponse.error || assessmentsResponse.error) {
      setError(
        getSupabaseErrorMessage(
          contributionsResponse.error ?? assessmentsResponse.error,
          "Could not load contribution review data."
        )
      );
      setIsLoading(false);
      return;
    }

    const assessmentRows =
      (assessmentsResponse.data ?? []) as ContributionAssessmentRecord[];
    const profileRows = (profilesResponse.data ?? []) as ProfileRecord[];

    setProfiles(
      Object.fromEntries(profileRows.map((profileRow) => [profileRow.id, profileRow]))
    );
    setContributions(
      ((contributionsResponse.data ?? []) as SyllabusContributionRecord[]).map(
        (contribution) => ({
          ...contribution,
          assessments: assessmentRows.filter(
            (assessment) => assessment.contribution_id === contribution.id
          )
        })
      )
    );
    setIsLoading(false);
  }

  useEffect(() => {
    void loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, supabase, user.id]);

  const visibleContributions = useMemo(
    () =>
      contributions.filter(
        (contribution) => contribution.status === activeStatus
      ),
    [activeStatus, contributions]
  );

  function openReview(contribution: ContributionWithRows) {
    setSelected(contribution);
    setReviewNotes(contribution.review_notes ?? "");
    setError("");
    setMessage("");
  }

  async function approveContribution(contribution: ContributionWithRows) {
    if (!supabase) {
      return;
    }

    const courseCode = contribution.course_code?.trim();
    const courseName = contribution.course_name?.trim();

    if (!courseCode || !courseName) {
      setError("A contribution needs a course code and course name before approval.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const extractedJson =
        (contribution.extracted_json as Record<string, unknown> | null) ?? {};
      const description =
        typeof extractedJson.courseDescription === "string"
          ? extractedJson.courseDescription
          : null;

      const { data: existingTemplate, error: lookupError } = await supabase
        .from("course_templates")
        .select("*")
        .eq("course_code", courseCode)
        .eq("course_name", courseName)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      let template: CourseTemplateRecord | null =
        (existingTemplate as CourseTemplateRecord | null) ?? null;

      if (template) {
        const { data, error: updateError } = await supabase
          .from("course_templates")
          .update({
            credit_hours: contribution.credit_hours ?? template.credit_hours,
            department:
              contribution.department ??
              template.department ??
              departmentFromCode(courseCode),
            description: description ?? template.description,
            extraction_confidence:
              contribution.extraction_confidence ?? template.extraction_confidence,
            instructor: contribution.instructor ?? template.instructor,
            source_syllabus_file_name:
              contribution.syllabus_file_name ?? template.source_syllabus_file_name,
            source_syllabus_path:
              contribution.syllabus_file_path ?? template.source_syllabus_path,
            term: contribution.term ?? template.term,
            updated_at: new Date().toISOString()
          })
          .eq("id", template.id)
          .select()
          .single();

        if (updateError || !data) {
          throw updateError ?? new Error("Could not update course template.");
        }

        template = data as CourseTemplateRecord;

        const { error: deleteError } = await supabase
          .from("course_template_assessments")
          .delete()
          .eq("course_template_id", template.id);

        if (deleteError) {
          throw deleteError;
        }
      } else {
        const { data, error: insertError } = await supabase
          .from("course_templates")
          .insert({
            course_code: courseCode,
            course_name: courseName,
            credit_hours: contribution.credit_hours ?? 3,
            department:
              contribution.department ?? departmentFromCode(courseCode),
            description,
            extraction_confidence: contribution.extraction_confidence ?? 0.7,
            instructor: contribution.instructor,
            source_syllabus_file_name: contribution.syllabus_file_name,
            source_syllabus_path: contribution.syllabus_file_path,
            term: contribution.term
          })
          .select()
          .single();

        if (insertError || !data) {
          throw insertError ?? new Error("Could not create course template.");
        }

        template = data as CourseTemplateRecord;
      }

      if (contribution.assessments.length > 0) {
        const { error: copyError } = await supabase
          .from("course_template_assessments")
          .insert(
            contribution.assessments.map((assessment) => ({
              confidence: assessment.confidence ?? 0.7,
              course_template_id: template.id,
              max_score: Number(assessment.max_score) || 100,
              name: assessment.name,
              source_text_snippet: assessment.source_text_snippet,
              weight_percentage: Number(assessment.weight_percentage) || 0
            }))
          );

        if (copyError) {
          throw copyError;
        }
      }

      const { error: contributionUpdateError } = await supabase
        .from("syllabus_contributions")
        .update({
          approved_course_template_id: template.id,
          review_notes: reviewNotes || null,
          reviewer_user_id: user.id,
          status: "approved",
          updated_at: new Date().toISOString()
        })
        .eq("id", contribution.id);

      if (contributionUpdateError) {
        throw contributionUpdateError;
      }

      setSelected(null);
      setMessage("Contribution approved and added to Course Library.");
      await loadAdminData();
    } catch (actionError) {
      setError(
        getSupabaseErrorMessage(
          actionError,
          "Could not approve this contribution. Check admin RLS policies."
        )
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function updateContributionStatus(
    contribution: ContributionWithRows,
    status: "rejected" | "needs_changes"
  ) {
    if (!supabase) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase
      .from("syllabus_contributions")
      .update({
        review_notes: reviewNotes || null,
        reviewer_user_id: user.id,
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", contribution.id);

    if (updateError) {
      setError(getSupabaseErrorMessage(updateError, "Could not save review."));
    } else {
      setSelected(null);
      setMessage(`Contribution marked ${statusLabel(status)}.`);
      await loadAdminData();
    }

    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <Card className="p-5 text-sm text-ink-500">
        Loading admin review...
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          description="Only GradeMate admins can review shared syllabus submissions."
          title="Contribution review"
        />
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-ink-900">
            Not authorized
          </h2>
          <p className="mt-2 text-sm text-ink-500">
            Ask an admin to set your profile role to admin in Supabase.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review syllabus submissions and publish approved courses to the shared library."
        title="Contribution review"
      />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((status) => (
          <Button
            key={status}
            onClick={() => setActiveStatus(status)}
            variant={activeStatus === status ? "primary" : "secondary"}
          >
            {statusLabel(status)}
          </Button>
        ))}
      </div>

      {visibleContributions.length === 0 ? (
        <EmptyState
          description="No contributions are in this status."
          icon={<FileText aria-hidden="true" className="h-5 w-5" />}
          title="Nothing to review"
        />
      ) : (
        <div className="grid gap-3">
          {visibleContributions.map((contribution) => {
            const submitter =
              profiles[contribution.submitted_by_user_id]?.email ??
              contribution.submitted_by_user_id.slice(0, 8);

            return (
              <Card className="p-4" key={contribution.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {contribution.course_code ? (
                        <Badge tone="teal">{contribution.course_code}</Badge>
                      ) : null}
                      <Badge tone={statusTone[contribution.status] ?? "ink"}>
                        {statusLabel(contribution.status)}
                      </Badge>
                      <Badge tone={totalWeight(contribution.assessments) >= 99 && totalWeight(contribution.assessments) <= 101 ? "green" : "gold"}>
                        {totalWeight(contribution.assessments)}%
                      </Badge>
                    </div>
                    <h2 className="mt-3 font-semibold text-ink-900">
                      {contribution.course_name ?? "Untitled syllabus"}
                    </h2>
                    <p className="mt-1 text-sm text-ink-500">
                      Submitted by {submitter} on{" "}
                      {new Date(contribution.created_at).toLocaleDateString()} -{" "}
                      {contribution.assessments.length} assessments
                    </p>
                  </div>
                  <Button onClick={() => openReview(contribution)}>
                    Review
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <Card className="max-h-[90vh] w-full max-w-5xl overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-teal-700">
                  Admin review
                </p>
                <h2 className="mt-1 text-xl font-semibold text-ink-900">
                  {selected.course_code ?? "No code"}{" "}
                  {selected.course_name ?? "Untitled syllabus"}
                </h2>
                <p className="mt-2 text-sm text-ink-500">
                  Total weight {totalWeight(selected.assessments)}% - confidence{" "}
                  {Math.round(Number(selected.extraction_confidence ?? 0) * 100)}%
                </p>
              </div>
              <Button
                aria-label="Close review"
                onClick={() => setSelected(null)}
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-4">
                <div className="rounded-xl border border-ink-200 p-4">
                  <h3 className="font-semibold text-ink-900">Course info</h3>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Course code", selected.course_code],
                      ["Course name", selected.course_name],
                      ["Credits", selected.credit_hours],
                      ["Instructor", selected.instructor],
                      ["Instructor email", selected.instructor_email],
                      ["Term", selected.term],
                      ["Source file", selected.syllabus_file_name]
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <dt className="text-xs font-medium uppercase text-ink-400">
                          {label}
                        </dt>
                        <dd className="mt-1 text-sm text-ink-800">
                          {value ? String(value) : "Not provided"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="overflow-x-auto rounded-xl border border-ink-200">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="bg-ink-50 text-xs uppercase text-ink-500">
                      <tr>
                        <th className="px-3 py-2">Assessment</th>
                        <th className="px-3 py-2">Weight</th>
                        <th className="px-3 py-2">Max</th>
                        <th className="px-3 py-2">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {selected.assessments.map((assessment) => (
                        <tr key={assessment.id}>
                          <td className="px-3 py-2 font-medium text-ink-900">
                            {assessment.name}
                          </td>
                          <td className="px-3 py-2 text-ink-700">
                            {Number(assessment.weight_percentage)}%
                          </td>
                          <td className="px-3 py-2 text-ink-700">
                            {Number(assessment.max_score)}
                          </td>
                          <td className="px-3 py-2 text-ink-700">
                            {Math.round(Number(assessment.confidence ?? 0) * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <details className="rounded-xl bg-ink-100 p-4">
                  <summary className="cursor-pointer font-semibold text-ink-900">
                    Extracted text preview
                  </summary>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-600">
                    {extractedTextPreview(selected)}
                  </p>
                </details>
              </div>

              <aside className="space-y-4">
                {totalWeight(selected.assessments) < 99 ||
                totalWeight(selected.assessments) > 101 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <div className="flex gap-2 font-medium">
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4"
                      />
                      Weight total needs review
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-lime-200 bg-lime-50 p-3 text-sm text-lime-800">
                    <div className="flex gap-2 font-medium">
                      <CheckCircle2
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4"
                      />
                      Ready to approve
                    </div>
                  </div>
                )}

                <label className="block">
                  <span className="text-sm font-medium text-ink-700">
                    Review notes
                  </span>
                  <textarea
                    className="mt-1 min-h-32 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    onChange={(event) => setReviewNotes(event.target.value)}
                    value={reviewNotes}
                  />
                </label>

                <div className="grid gap-2">
                  <Button
                    disabled={isSaving}
                    onClick={() => void approveContribution(selected)}
                  >
                    Approve
                  </Button>
                  <Button
                    disabled={isSaving}
                    onClick={() =>
                      void updateContributionStatus(selected, "needs_changes")
                    }
                    variant="secondary"
                  >
                    Request changes
                  </Button>
                  <Button
                    disabled={isSaving}
                    onClick={() =>
                      void updateContributionStatus(selected, "rejected")
                    }
                    variant="danger"
                  >
                    Reject
                  </Button>
                </div>
              </aside>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
