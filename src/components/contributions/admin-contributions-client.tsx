"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, X } from "lucide-react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { buildCourseTemplateUniqueKey } from "@/lib/course-template-key";
import { getSupabaseErrorMessage } from "@/lib/supabase/config";
import type {
  ContributionAssessmentRecord,
  CourseTemplateAssessmentRecord,
  CourseTemplateMaterialRecord,
  CourseTemplateRecord,
  Json,
  ProfileRecord,
  SyllabusContributionRecord,
  VerifiedExtractionRecord
} from "@/types/database";

type StatusFilter = "pending_review" | "needs_changes" | "approved" | "rejected";

type ContributionWithRows = SyllabusContributionRecord & {
  assessments: ContributionAssessmentRecord[];
};

type TemplateWithRows = CourseTemplateRecord & {
  assessments: CourseTemplateAssessmentRecord[];
  materials: CourseTemplateMaterialRecord[];
};

type PublishAction =
  | "replace_existing"
  | "create_new"
  | "marked_latest"
  | "feedback_only";

type TemplateMatch = {
  template: TemplateWithRows;
  reason: string;
  priority: number;
};

type VerifiedFeedbackSummary = Pick<
  VerifiedExtractionRecord,
  | "id"
  | "course_code"
  | "course_name"
  | "created_at"
  | "source_type"
  | "total_weight"
  | "user_feedback"
>;

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

function totalWeight(
  assessments: Array<{ weight_percentage: number | null | undefined }>
) {
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

function profileCreditLabel(profile: ProfileRecord | undefined, fallback: string) {
  if (profile?.username) {
    return `@${profile.username}`;
  }

  if (profile?.contributor_name) {
    return profile.contributor_name;
  }

  if (profile?.full_name) {
    return profile.full_name;
  }

  return profile?.email ?? fallback;
}

function normalizeMatchValue(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function contributionDescription(contribution: SyllabusContributionRecord) {
  const json = contribution.extracted_json as Record<string, unknown> | null;

  return json && typeof json.courseDescription === "string"
    ? json.courseDescription
    : null;
}

function contributionTextbooks(contribution: SyllabusContributionRecord): Json {
  const json = contribution.extracted_json as Record<string, unknown> | null;

  return json && Array.isArray(json.textbooks)
    ? (json.textbooks.filter((item): item is string => typeof item === "string") as Json)
    : [];
}

function contributionWarnings(contribution: SyllabusContributionRecord): Json {
  const json = contribution.extracted_json as Record<string, unknown> | null;

  return json && Array.isArray(json.warnings) ? (json.warnings as Json) : [];
}

function contributionUniqueKey(contribution: SyllabusContributionRecord) {
  return buildCourseTemplateUniqueKey({
    courseCode: contribution.course_code,
    courseName: contribution.course_name,
    fallbackId: contribution.id,
    semester: contribution.term,
    sourceName:
      contribution.syllabus_file_name ??
      contribution.syllabus_file_path ??
      contribution.id
  });
}

function findTemplateMatches(
  contribution: SyllabusContributionRecord,
  templates: TemplateWithRows[]
): TemplateMatch[] {
  const uniqueKey = contributionUniqueKey(contribution);
  const code = normalizeMatchValue(contribution.course_code);
  const name = normalizeMatchValue(contribution.course_name);
  const semester = normalizeMatchValue(contribution.term);
  const matches: TemplateMatch[] = [];

  for (const template of templates) {
    const templateCode = normalizeMatchValue(template.course_code);
    const templateName = normalizeMatchValue(template.course_name);
    const templateSemester = normalizeMatchValue(template.semester ?? template.term);

    if (template.unique_key && template.unique_key === uniqueKey) {
      matches.push({ priority: 1, reason: "Exact unique key", template });
      continue;
    }

    if (
      code &&
      name &&
      semester &&
      templateCode === code &&
      templateName === name &&
      templateSemester === semester
    ) {
      matches.push({ priority: 2, reason: "Course, name, and semester", template });
      continue;
    }

    if (code && name && templateCode === code && templateName === name) {
      matches.push({ priority: 3, reason: "Course code and name", template });
    }
  }

  const codeOnlyMatches =
    code && matches.length === 0
      ? templates.filter(
          (template) => normalizeMatchValue(template.course_code) === code
        )
      : [];

  if (codeOnlyMatches.length === 1) {
    matches.push({
      priority: 4,
      reason: "Only course-code match",
      template: codeOnlyMatches[0]
    });
  }

  return matches.sort((left, right) => left.priority - right.priority);
}

function makeTemplatePayload({
  contribution,
  contributorProfile,
  uniqueKey
}: {
  contribution: ContributionWithRows;
  contributorProfile?: ProfileRecord | null;
  uniqueKey: string;
}) {
  const courseCode = contribution.course_code?.trim() ?? "";
  const courseName = contribution.course_name?.trim() ?? "";
  const description = contributionDescription(contribution);
  const contributorUsername =
    contribution.contributor_username ?? contributorProfile?.username ?? null;
  const contributorName =
    contribution.contributor_name ??
    contributorProfile?.contributor_name ??
    contributorProfile?.full_name ??
    null;

  return {
    course_code: courseCode,
    course_name: courseName,
    course_description: description,
    credit_hours: contribution.credit_hours ?? 3,
    contributor_name: contributorName,
    contributor_user_id: contribution.submitted_by_user_id,
    contributor_username: contributorUsername,
    department:
      contribution.department ?? departmentFromCode(contribution.course_code),
    description,
    extraction_confidence: 1,
    extraction_warnings: contributionWarnings(contribution),
    extractor_version: "admin_approved_contribution",
    instructor: contribution.instructor,
    instructor_email: contribution.instructor_email,
    semester: contribution.term,
    source_hash: `contribution:${contribution.id}`,
    source_syllabus_file_name: contribution.syllabus_file_name,
    source_syllabus_path: contribution.syllabus_file_path,
    template_status: "ready",
    term: contribution.term,
    textbooks: contributionTextbooks(contribution),
    unique_key: uniqueKey,
    updated_at: new Date().toISOString()
  };
}

function makeTemplateAssessmentRows(
  contribution: ContributionWithRows,
  templateId: string
) {
  return contribution.assessments.map((assessment) => ({
    confidence: assessment.confidence ?? 1,
    course_template_id: templateId,
    max_score: Number(assessment.max_score) || 100,
    name: assessment.name,
    source: "admin_approved_contribution",
    source_text_snippet: assessment.source_text_snippet,
    weight_percentage: Number(assessment.weight_percentage) || 0
  }));
}

const allowedPublishTables = [
  "course_templates",
  "course_template_assessments",
  "course_template_materials",
  "course_template_versions",
  "syllabus_contributions"
];

function assertAllowedPublishTables(tables: string[]) {
  const disallowed = tables.filter((table) => !allowedPublishTables.includes(table));

  if (disallowed.length > 0) {
    throw new Error(`Refusing publish with disallowed table(s): ${disallowed.join(", ")}`);
  }
}

export function AdminContributionsClient() {
  const { isGuest, supabase, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("pending_review");
  const [contributions, setContributions] = useState<ContributionWithRows[]>([]);
  const [templates, setTemplates] = useState<TemplateWithRows[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRecord>>({});
  const [verifiedFeedback, setVerifiedFeedback] = useState<VerifiedFeedbackSummary[]>([]);
  const [verifiedFeedbackMessage, setVerifiedFeedbackMessage] = useState("");
  const [selected, setSelected] = useState<ContributionWithRows | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [publishAction, setPublishAction] = useState<PublishAction>("create_new");
  const [pendingPublishAction, setPendingPublishAction] =
    useState<PublishAction | null>(null);
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
          "Could not check admin access right now."
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
      templatesResponse,
      templateAssessmentsResponse,
      templateMaterialsResponse,
      profilesResponse,
      verifiedFeedbackResponse
    ] = await Promise.all([
      supabase
        .from("syllabus_contributions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("contribution_assessments")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("course_templates")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("course_template_assessments")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("course_template_materials")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase.from("profiles").select("*"),
      supabase
        .from("verified_extractions")
        .select("id,course_code,course_name,created_at,source_type,total_weight,user_feedback")
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

    if (
      contributionsResponse.error ||
      assessmentsResponse.error ||
      templatesResponse.error ||
      templateAssessmentsResponse.error ||
      templateMaterialsResponse.error
    ) {
      setError(
        getSupabaseErrorMessage(
          contributionsResponse.error ??
            assessmentsResponse.error ??
            templatesResponse.error ??
            templateAssessmentsResponse.error ??
            templateMaterialsResponse.error,
          "Could not load contribution review data."
        )
      );
      setIsLoading(false);
      return;
    }

    const assessmentRows =
      (assessmentsResponse.data ?? []) as ContributionAssessmentRecord[];
    const templateRows = (templatesResponse.data ?? []) as CourseTemplateRecord[];
    const templateAssessmentRows =
      (templateAssessmentsResponse.data ?? []) as CourseTemplateAssessmentRecord[];
    const templateMaterialRows =
      (templateMaterialsResponse.data ?? []) as CourseTemplateMaterialRecord[];
    const profileRows = (profilesResponse.data ?? []) as ProfileRecord[];
    if (verifiedFeedbackResponse.error) {
      setVerifiedFeedback([]);
      setVerifiedFeedbackMessage(
        getSupabaseErrorMessage(
          verifiedFeedbackResponse.error,
          "Verified extraction feedback is not available yet."
        )
      );
    } else {
      setVerifiedFeedback(
        (verifiedFeedbackResponse.data ?? []) as VerifiedFeedbackSummary[]
      );
      setVerifiedFeedbackMessage("");
    }

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
    setTemplates(
      templateRows.map((template) => ({
        ...template,
        assessments: templateAssessmentRows.filter(
          (assessment) => assessment.course_template_id === template.id
        ),
        materials: templateMaterialRows.filter(
          (material) => material.course_template_id === template.id
        )
      }))
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
  const verifiedFeedbackCounts = useMemo(
    () =>
      verifiedFeedback.reduce(
        (counts, row) => {
          counts[row.user_feedback as keyof typeof counts] =
            (counts[row.user_feedback as keyof typeof counts] ?? 0) + 1;
          return counts;
        },
        { correct: 0, corrected: 0, incorrect: 0 }
      ),
    [verifiedFeedback]
  );

  function openReview(contribution: ContributionWithRows) {
    const matches = findTemplateMatches(contribution, templates);
    const firstMatch = matches[0]?.template ?? null;

    setSelected(contribution);
    setSelectedTemplateId(firstMatch?.id ?? "");
    setPublishAction(firstMatch ? "replace_existing" : "create_new");
    setPendingPublishAction(null);
    setReviewNotes(contribution.review_notes ?? "");
    setError("");
    setMessage("");
  }

  async function saveTemplateVersion(template: TemplateWithRows, contributionId: string) {
    if (!supabase) {
      return;
    }

    assertAllowedPublishTables(["course_template_versions"]);

    const { assessments, materials, ...templateRecord } = template;
    const { error: versionError } = await supabase
      .from("course_template_versions")
      .insert({
        previous_assessments_json: assessments as unknown as Json,
        previous_materials_json: materials as unknown as Json,
        previous_template_json: templateRecord as unknown as Json,
        replaced_by_admin_id: user.id,
        replaced_by_contribution_id: contributionId,
        template_id: template.id
      });

    if (versionError) {
      throw versionError;
    }
  }

  async function updateContributionReview({
    action,
    contribution,
    templateId
  }: {
    action: "created_new" | "feedback_only" | "marked_latest" | "replaced_existing";
    contribution: ContributionWithRows;
    templateId: string | null;
  }) {
    if (!supabase) {
      return;
    }

    assertAllowedPublishTables(["syllabus_contributions"]);

    const now = new Date().toISOString();
    const { error: contributionUpdateError } = await supabase
      .from("syllabus_contributions")
      .update({
        approved_course_template_id: templateId,
        published_template_id: templateId,
        publish_action: action,
        review_notes: reviewNotes || null,
        reviewed_at: now,
        reviewer_user_id: user.id,
        status: "approved",
        updated_at: now
      })
      .eq("id", contribution.id);

    if (contributionUpdateError) {
      throw contributionUpdateError;
    }
  }

  async function approveContribution(
    contribution: ContributionWithRows,
    action: PublishAction
  ) {
    if (!supabase) {
      return;
    }

    const courseCode = contribution.course_code?.trim();
    const courseName = contribution.course_name?.trim();

    if (action !== "feedback_only" && (!courseCode || !courseName)) {
      setError("A contribution needs a course code and course name before approval.");
      return;
    }

    if (
      (action === "replace_existing" || action === "marked_latest") &&
      !selectedTemplateId
    ) {
      setError("Choose the Course Library template to update before publishing.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      if (action === "feedback_only") {
        await updateContributionReview({
          action,
          contribution,
          templateId: null
        });
        setSelected(null);
        setPendingPublishAction(null);
        setMessage("Contribution approved as feedback only.");
        await loadAdminData();
        return;
      }

      assertAllowedPublishTables([
        "course_templates",
        "course_template_assessments",
        "course_template_versions",
        "syllabus_contributions"
      ]);

      let template: CourseTemplateRecord | null = null;
      const selectedTemplate =
        templates.find((item) => item.id === selectedTemplateId) ?? null;
      const contributorProfile = profiles[contribution.submitted_by_user_id] ?? null;

      if (action === "replace_existing" || action === "marked_latest") {
        if (!selectedTemplate) {
          throw new Error("Selected template could not be found.");
        }

        await saveTemplateVersion(selectedTemplate, contribution.id);

        const templatePayload = makeTemplatePayload({
          contribution,
          contributorProfile,
          uniqueKey: selectedTemplate.unique_key ?? contributionUniqueKey(contribution)
        });

        const { data, error: updateError } = await supabase
          .from("course_templates")
          .update(templatePayload)
          .eq("id", selectedTemplate.id)
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
        const baseUniqueKey = contributionUniqueKey(contribution);
        const uniqueKey = templates.some((item) => item.unique_key === baseUniqueKey)
          ? `${baseUniqueKey}::contribution-${contribution.id.slice(0, 8)}`
          : baseUniqueKey;
        const templatePayload = makeTemplatePayload({
          contribution,
          contributorProfile,
          uniqueKey
        });
        const { data, error: insertError } = await supabase
          .from("course_templates")
          .insert(templatePayload)
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
          .insert(makeTemplateAssessmentRows(contribution, template.id));

        if (copyError) {
          throw copyError;
        }
      }

      if (action === "marked_latest") {
        const code = normalizeMatchValue(contribution.course_code);
        const name = normalizeMatchValue(contribution.course_name);
        const siblingIds = templates
          .filter(
            (item) =>
              item.id !== template?.id &&
              normalizeMatchValue(item.course_code) === code &&
              normalizeMatchValue(item.course_name) === name
          )
          .map((item) => item.id);

        if (siblingIds.length > 0) {
          const { error: archiveError } = await supabase
            .from("course_templates")
            .update({
              template_status: "archived",
              updated_at: new Date().toISOString()
            })
            .in("id", siblingIds);

          if (archiveError) {
            throw archiveError;
          }
        }
      }

      await updateContributionReview({
        action:
          action === "replace_existing"
            ? "replaced_existing"
            : action === "create_new"
              ? "created_new"
              : action,
        contribution,
        templateId: template.id
      });

      setSelected(null);
      setPendingPublishAction(null);
      setMessage(
        action === "create_new"
          ? "Contribution approved and published as a new Course Library template."
          : action === "marked_latest"
            ? "Contribution approved and marked as the latest Course Library template."
            : "Contribution approved and replaced the selected Course Library template."
      );
      await loadAdminData();
    } catch (actionError) {
      console.error("Contribution publish failed", actionError);
      const actionMessage =
        actionError instanceof Error
          ? actionError.message
          : typeof actionError === "object" &&
              actionError !== null &&
              "message" in actionError &&
              typeof actionError.message === "string"
            ? actionError.message
            : "";

      setError(
        /course_template_versions|published_template_id|publish_action|reviewed_at|schema cache/i.test(
          actionMessage
        )
          ? "Contribution publishing needs the latest SQL migration. Run supabase/course-template-versions.sql in Supabase SQL Editor, then retry."
          : getSupabaseErrorMessage(
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
        approved_course_template_id: null,
        published_template_id: null,
        publish_action: status === "rejected" ? "rejected" : "needs_changes",
        review_notes: reviewNotes || null,
        reviewed_at: new Date().toISOString(),
        reviewer_user_id: user.id,
        status,
        updated_at: new Date().toISOString()
      })
      .eq("id", contribution.id);

    if (updateError) {
      setError(getSupabaseErrorMessage(updateError, "Could not save review."));
    } else {
      setSelected(null);
      setPendingPublishAction(null);
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
            Ask an existing admin to grant review access for your account.
          </p>
        </Card>
      </div>
    );
  }

  const selectedMatches = selected ? findTemplateMatches(selected, templates) : [];
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ??
    selectedMatches[0]?.template ??
    null;
  const selectedTemplateWeight = selectedTemplate
    ? totalWeight(selectedTemplate.assessments)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review syllabus submissions and publish approved courses to the shared library."
        title="Contribution review"
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
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

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-semibold text-ink-900">
              Verified extraction feedback
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Recent user-confirmed extraction results for improving the
              deterministic benchmark.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">{verifiedFeedbackCounts.correct} correct</Badge>
            <Badge tone="teal">{verifiedFeedbackCounts.corrected} corrected</Badge>
            <Badge tone="gold">{verifiedFeedbackCounts.incorrect} needs work</Badge>
          </div>
        </div>
        {verifiedFeedbackMessage ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {verifiedFeedbackMessage}
          </p>
        ) : verifiedFeedback.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">
            No verified extraction feedback has been submitted yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="gm-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Feedback</th>
                  <th>Source</th>
                  <th>Total</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {verifiedFeedback.slice(0, 8).map((row) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2 font-medium text-ink-900">
                      {row.course_code || "No code"}{" "}
                      <span className="font-normal text-ink-500">
                        {row.course_name || "Untitled"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-ink-700">
                      {statusLabel(row.user_feedback)}
                    </td>
                    <td className="px-2 py-2 text-ink-700">
                      {statusLabel(row.source_type)}
                    </td>
                    <td className="px-2 py-2 text-ink-700">
                      {row.total_weight == null ? "n/a" : `${row.total_weight}%`}
                    </td>
                    <td className="px-2 py-2 text-ink-500">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {visibleContributions.length === 0 ? (
        <EmptyState
          description="No contributions are in this status."
          icon={<FileText aria-hidden="true" className="h-5 w-5" />}
          title="Nothing to review"
        />
      ) : (
        <div className="grid gap-3">
          {visibleContributions.map((contribution) => {
            const profile = profiles[contribution.submitted_by_user_id];
            const submitter =
              contribution.contributor_username
                ? `@${contribution.contributor_username}`
                : contribution.contributor_name ??
                  profileCreditLabel(profile, contribution.submitted_by_user_id.slice(0, 8));

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
                    {profile?.email ? (
                      <p className="mt-1 text-xs text-ink-500">
                        Account: {profile.email}
                      </p>
                    ) : null}
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
                onClick={() => {
                  setPendingPublishAction(null);
                  setSelected(null);
                }}
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-4">
                <div className="rounded-[3px] border border-ink-200 bg-white/80 p-4">
                  <h3 className="font-semibold text-ink-900">Course info</h3>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Course code", selected.course_code],
                      ["Course name", selected.course_name],
                      ["Credits", selected.credit_hours],
                      ["Instructor", selected.instructor],
                      ["Instructor email", selected.instructor_email],
                      [
                        "Contributor credit",
                        selected.contributor_username
                          ? `@${selected.contributor_username}`
                          : selected.contributor_name ??
                            profileCreditLabel(
                              profiles[selected.submitted_by_user_id],
                              "Not set"
                            )
                      ],
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

                <div className="rounded-[3px] border border-ink-200 bg-white/80 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-ink-900">
                        Publish to Course Library
                      </h3>
                      <p className="mt-1 text-sm text-ink-500">
                        Approved contributions update future imports only. Existing
                        user workspaces are never changed.
                      </p>
                    </div>
                    <Badge tone={selectedMatches.length > 0 ? "teal" : "gold"}>
                      {selectedMatches.length > 0
                        ? `${selectedMatches.length} match${selectedMatches.length === 1 ? "" : "es"}`
                        : "No match found"}
                    </Badge>
                  </div>

                  {selectedMatches.length > 0 ? (
                    <label className="mt-4 block">
                      <span className="text-sm font-medium text-ink-700">
                        Matching template
                      </span>
                      <select
                        className="gm-input mt-1"
                        onChange={(event) => setSelectedTemplateId(event.target.value)}
                        value={selectedTemplateId}
                      >
                        {selectedMatches.map((match) => (
                          <option key={match.template.id} value={match.template.id}>
                            {match.template.course_code} - {match.template.course_name}
                            {match.template.semester || match.template.term
                              ? ` (${match.template.semester ?? match.template.term})`
                              : ""}{" "}
                            - {match.reason}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      No safe existing match was found. Create a new template unless
                      you intentionally want to choose a template after checking the
                      Course Library.
                    </p>
                  )}

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-[3px] border border-ink-200 bg-ink-50 p-3">
                      <p className="text-xs font-semibold uppercase text-ink-400">
                        Current template
                      </p>
                      {selectedTemplate ? (
                        <dl className="mt-3 space-y-2 text-sm">
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-500">Title</dt>
                            <dd className="text-right font-medium text-ink-900">
                              {selectedTemplate.course_name}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-500">Credits</dt>
                            <dd className="font-medium text-ink-900">
                              {selectedTemplate.credit_hours}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-500">Semester</dt>
                            <dd className="font-medium text-ink-900">
                              {selectedTemplate.semester ?? selectedTemplate.term ?? "n/a"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-ink-500">Assessments</dt>
                            <dd className="font-medium text-ink-900">
                              {selectedTemplate.assessments.length} rows /{" "}
                              {selectedTemplateWeight}%
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="mt-3 text-sm text-ink-500">
                          A new Course Library template will be created.
                        </p>
                      )}
                    </div>

                    <div className="rounded-[3px] border border-teal-200 bg-teal-50 p-3">
                      <p className="text-xs font-semibold uppercase text-teal-700">
                        Contributed template
                      </p>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-500">Title</dt>
                          <dd className="text-right font-medium text-ink-900">
                            {selected.course_name ?? "Untitled"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-500">Credits</dt>
                          <dd className="font-medium text-ink-900">
                            {selected.credit_hours ?? "n/a"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-500">Semester</dt>
                          <dd className="font-medium text-ink-900">
                            {selected.term ?? "n/a"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-ink-500">Assessments</dt>
                          <dd className="font-medium text-ink-900">
                            {selected.assessments.length} rows /{" "}
                            {totalWeight(selected.assessments)}%
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-[3px] border border-ink-200">
                  <table className="gm-table min-w-[620px]">
                    <thead>
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

                <details className="rounded-lg bg-ink-100 p-4">
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
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <div className="flex gap-2 font-medium">
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4"
                      />
                      Weight total needs review
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-lime-200 bg-lime-50 p-3 text-sm text-lime-800">
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
                    className="gm-textarea mt-1 min-h-32"
                    onChange={(event) => setReviewNotes(event.target.value)}
                    value={reviewNotes}
                  />
                </label>

                <div className="rounded-[3px] border border-ink-200 bg-white/80 p-3">
                  <p className="text-sm font-semibold text-ink-900">
                    Publish action
                  </p>
                  <div className="mt-3 grid gap-2">
                    {[
                      {
                        action: "replace_existing" as const,
                        disabled: !selectedTemplate,
                        label: "Replace existing template"
                      },
                      {
                        action: "create_new" as const,
                        disabled: false,
                        label: "Create new template version"
                      },
                      {
                        action: "marked_latest" as const,
                        disabled: !selectedTemplate,
                        label: "Mark as latest/canonical"
                      },
                      {
                        action: "feedback_only" as const,
                        disabled: false,
                        label: "Approve feedback only"
                      }
                    ].map((option) => (
                      <label
                        className="flex items-start gap-2 rounded-[3px] border border-ink-200 bg-ink-50 p-2 text-sm"
                        key={option.action}
                      >
                        <input
                          checked={publishAction === option.action}
                          className="mt-1"
                          disabled={option.disabled}
                          onChange={() => setPublishAction(option.action)}
                          type="radio"
                        />
                        <span className="font-medium text-ink-800">
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button
                    disabled={isSaving}
                    onClick={() => setPendingPublishAction(publishAction)}
                  >
                    Publish / approve
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

      {selected && pendingPublishAction ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6">
          <Card className="w-full max-w-lg p-5">
            <h2 className="text-lg font-semibold text-ink-900">
              Confirm Course Library publish
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-600">
              This will update the shared Course Library template for future
              users. It will not change any existing user workspaces or courses
              students already imported.
            </p>
            <div className="mt-4 rounded-[3px] border border-ink-200 bg-ink-50 p-3 text-sm text-ink-700">
              Action:{" "}
              <span className="font-semibold text-ink-900">
                {pendingPublishAction === "replace_existing"
                  ? "Replace existing template"
                  : pendingPublishAction === "create_new"
                    ? "Create new template version"
                    : pendingPublishAction === "marked_latest"
                      ? "Mark as latest/canonical"
                      : "Approve feedback only"}
              </span>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button
                disabled={isSaving}
                onClick={() => void approveContribution(selected, pendingPublishAction)}
              >
                {isSaving ? "Publishing..." : "Confirm"}
              </Button>
              <Button
                disabled={isSaving}
                onClick={() => setPendingPublishAction(null)}
                variant="secondary"
              >
                Back
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
