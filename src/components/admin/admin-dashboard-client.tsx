"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  Database,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getSupabaseErrorMessage } from "@/lib/supabase/config";
import type {
  CourseTemplateAssessmentRecord,
  CourseTemplateMaterialRecord,
  CourseTemplateRecord,
  CourseTemplateVersionRecord,
  ProfileRecord,
  SyllabusContributionRecord,
  VerifiedExtractionRecord
} from "@/types/database";

type TemplateWithRows = CourseTemplateRecord & {
  assessments: CourseTemplateAssessmentRecord[];
  materials: CourseTemplateMaterialRecord[];
};

type DashboardData = {
  templates: TemplateWithRows[];
  contributions: SyllabusContributionRecord[];
  feedback: VerifiedExtractionRecord[];
  versions: CourseTemplateVersionRecord[];
};

function templateStatus(template: CourseTemplateRecord) {
  return String(template.template_status ?? "ready").toLowerCase();
}

function contributionStatus(contribution: SyllabusContributionRecord) {
  return String(contribution.status ?? "pending_review").toLowerCase();
}

function totalWeight(assessments: CourseTemplateAssessmentRecord[]) {
  return (
    Math.round(
      assessments.reduce(
        (sum, assessment) => sum + Number(assessment.weight_percentage || 0),
        0
      ) * 100
    ) / 100
  );
}

function isHealthyTotal(value: number) {
  return value >= 99.5 && value <= 100.5;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function latestTimestamp(values: Array<string | null | undefined>) {
  const latest = values
    .map((value) => (value ? new Date(value).getTime() : 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((first, second) => second - first)[0];

  return latest ? new Date(latest).toISOString() : null;
}

function shortCourseLabel(item: {
  course_code: string | null;
  course_name: string | null;
}) {
  return `${item.course_code ?? "Course"} ${item.course_name ?? ""}`.trim();
}

export function AdminDashboardClient() {
  const { isGuest, supabase, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<DashboardData>({
    templates: [],
    contributions: [],
    feedback: [],
    versions: []
  });

  const summary = useMemo(() => {
    const templateCounts = countBy(data.templates, templateStatus);
    const contributionCounts = countBy(data.contributions, contributionStatus);
    const readyTemplates = data.templates.filter(
      (template) => templateStatus(template) === "ready"
    );
    const noAssessmentTemplates = readyTemplates.filter(
      (template) => template.assessments.length === 0
    );
    const badTotalTemplates = readyTemplates.filter(
      (template) =>
        template.assessments.length > 0 && !isHealthyTotal(totalWeight(template.assessments))
    );
    const lowConfidenceTemplates = readyTemplates.filter(
      (template) => Number(template.extraction_confidence ?? 0) < 0.75
    );
    const pendingContributions = data.contributions
      .filter((contribution) => contributionStatus(contribution) === "pending_review")
      .sort(
        (first, second) =>
          new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
      );

    return {
      ready: templateCounts.ready ?? 0,
      needsReview: templateCounts.needs_review ?? 0,
      conflicts: templateCounts.conflict ?? 0,
      archived: templateCounts.archived ?? 0,
      pending: contributionCounts.pending_review ?? 0,
      needsChanges: contributionCounts.needs_changes ?? 0,
      approved: contributionCounts.approved ?? 0,
      rejected: contributionCounts.rejected ?? 0,
      noAssessments: noAssessmentTemplates.length,
      badTotals: badTotalTemplates.length,
      lowConfidence: lowConfidenceTemplates.length,
      attention:
        noAssessmentTemplates.length +
        badTotalTemplates.length +
        lowConfidenceTemplates.length +
        (templateCounts.needs_review ?? 0) +
        (templateCounts.conflict ?? 0) +
        (contributionCounts.pending_review ?? 0),
      pendingContributions: pendingContributions.slice(0, 5),
      latest:
        latestTimestamp([
          ...data.templates.map((template) => template.updated_at ?? template.created_at),
          ...data.contributions.map(
            (contribution) => contribution.updated_at ?? contribution.created_at
          ),
          ...data.feedback.map((feedback) => feedback.updated_at ?? feedback.created_at),
          ...data.versions.map((version) => version.created_at)
        ]) ?? null
    };
  }, [data]);

  const loadDashboard = useCallback(async () => {
    setError("");

    if (!supabase) {
      setError("Admin tools need Supabase to be configured.");
      setIsLoading(false);
      return;
    }

    if (isGuest) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    setIsRefreshing(true);

    try {
      const profileResponse = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileResponse.error) throw profileResponse.error;

      const profile = profileResponse.data as ProfileRecord | null;

      if (profile?.role !== "admin") {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      setIsAdmin(true);

      const [
        templateResponse,
        assessmentResponse,
        materialResponse,
        contributionResponse,
        feedbackResponse,
        versionResponse
      ] = await Promise.all([
        supabase.from("course_templates").select("*"),
        supabase.from("course_template_assessments").select("*"),
        supabase.from("course_template_materials").select("*"),
        supabase
          .from("syllabus_contributions")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("verified_extractions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("course_template_versions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50)
      ]);

      const firstError =
        templateResponse.error ??
        assessmentResponse.error ??
        materialResponse.error ??
        contributionResponse.error ??
        feedbackResponse.error ??
        versionResponse.error;

      if (firstError) throw firstError;

      const assessments =
        (assessmentResponse.data ?? []) as CourseTemplateAssessmentRecord[];
      const materials =
        (materialResponse.data ?? []) as CourseTemplateMaterialRecord[];
      const assessmentMap = new Map<string, CourseTemplateAssessmentRecord[]>();
      const materialMap = new Map<string, CourseTemplateMaterialRecord[]>();

      for (const assessment of assessments) {
        const rows = assessmentMap.get(assessment.course_template_id) ?? [];
        rows.push(assessment);
        assessmentMap.set(assessment.course_template_id, rows);
      }

      for (const material of materials) {
        const rows = materialMap.get(material.course_template_id) ?? [];
        rows.push(material);
        materialMap.set(material.course_template_id, rows);
      }

      const templates = ((templateResponse.data ?? []) as CourseTemplateRecord[]).map(
        (template) => ({
          ...template,
          assessments: assessmentMap.get(template.id) ?? [],
          materials: materialMap.get(template.id) ?? []
        })
      );

      setData({
        templates,
        contributions: (contributionResponse.data ?? []) as SyllabusContributionRecord[],
        feedback: (feedbackResponse.data ?? []) as VerifiedExtractionRecord[],
        versions: (versionResponse.data ?? []) as CourseTemplateVersionRecord[]
      });
    } catch (loadError) {
      setError(
        getSupabaseErrorMessage(
          loadError,
          "Could not load the admin dashboard. Check admin RLS policies and try again."
        )
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isGuest, supabase, user.id]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (isLoading) {
    return (
      <Card className="p-5 text-sm font-medium text-ink-600">
        Loading admin command center...
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <EmptyState
        action={
          <Link className={buttonStyles()} href="/dashboard">
            Back to dashboard
          </Link>
        }
        description="This area is only for admin accounts that review shared Course Library data."
        icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}
        title="Admin access required"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button
              disabled={isRefreshing}
              onClick={() => void loadDashboard()}
              variant="secondary"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Link className={buttonStyles()} href="/admin/course-library">
              <BookMarked aria-hidden="true" className="h-4 w-4" />
              Manage library
            </Link>
          </>
        }
        description="Review contributions, watch template health, and maintain the shared Course Library for future imports."
        eyebrow="Admin"
        title="Command center"
      />

      {error ? (
        <div className="flex items-center gap-2 rounded-[3px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<BookMarked aria-hidden="true" className="h-4 w-4" />}
          label="Ready templates"
          meta={`${summary.needsReview} needs review, ${summary.conflicts} conflicts`}
          value={summary.ready}
        />
        <MetricCard
          icon={<FileText aria-hidden="true" className="h-4 w-4" />}
          label="Pending review"
          meta={`${summary.approved} approved, ${summary.needsChanges} needs changes`}
          tone={summary.pending > 0 ? "teal" : "green"}
          value={summary.pending}
        />
        <MetricCard
          icon={<AlertTriangle aria-hidden="true" className="h-4 w-4" />}
          label="Needs attention"
          meta="Bad totals, low confidence, conflicts, pending work"
          tone={summary.attention > 0 ? "gold" : "green"}
          value={summary.attention}
        />
        <MetricCard
          icon={<Activity aria-hidden="true" className="h-4 w-4" />}
          label="Latest admin change"
          meta={`${data.versions.length} recent version snapshots`}
          value={formatDate(summary.latest)}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-4 py-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">
                Review queue
              </h2>
              <p className="text-[13px] text-ink-500">
                Syllabuses waiting for a publish decision.
              </p>
            </div>
            <Link className={buttonStyles({ size: "sm", variant: "secondary" })} href="/admin/contributions">
              Open review
            </Link>
          </div>
          {summary.pendingContributions.length === 0 ? (
            <div className="flex items-center gap-3 p-4 text-sm text-ink-600">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-lime-700" />
              No pending syllabus submissions.
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {summary.pendingContributions.map((contribution) => (
                <div
                  className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  key={contribution.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {shortCourseLabel(contribution)}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-500">
                      Submitted {formatDate(contribution.created_at)}
                    </p>
                  </div>
                  <Badge tone="teal">Pending review</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-ink-200 px-4 py-3">
            <h2 className="text-[15px] font-semibold text-ink-900">
              Library health
            </h2>
            <p className="text-[13px] text-ink-500">
              Keep public templates clean before friends import them.
            </p>
          </div>
          <div className="grid gap-2 p-4">
            <HealthRow
              label="Ready templates without assessments"
              tone={summary.noAssessments > 0 ? "rose" : "green"}
              value={summary.noAssessments}
            />
            <HealthRow
              label="Ready templates with bad totals"
              tone={summary.badTotals > 0 ? "gold" : "green"}
              value={summary.badTotals}
            />
            <HealthRow
              label="Low-confidence ready templates"
              tone={summary.lowConfidence > 0 ? "gold" : "green"}
              value={summary.lowConfidence}
            />
            <HealthRow
              label="Archived templates hidden from users"
              tone="ink"
              value={summary.archived}
            />
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ActionCard
          description="Create, edit, archive, or permanently remove shared templates."
          href="/admin/course-library"
          icon={<Database aria-hidden="true" className="h-4 w-4" />}
          title="Course Library manager"
        />
        <ActionCard
          description="Approve submissions, publish template updates, or request changes."
          href="/admin/contributions"
          icon={<FileText aria-hidden="true" className="h-4 w-4" />}
          title="Contribution review"
        />
        <ActionCard
          description="Check the public library exactly as students see it."
          href="/course-library"
          icon={<Sparkles aria-hidden="true" className="h-4 w-4" />}
          title="Student library view"
        />
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  meta,
  tone = "teal",
  value
}: {
  icon: ReactNode;
  label: string;
  meta: string;
  tone?: "teal" | "gold" | "green";
  value: string | number;
}) {
  const toneClass =
    tone === "gold"
      ? "bg-amber-50 text-amber-800"
      : tone === "green"
        ? "bg-lime-50 text-lime-800"
        : "bg-teal-50 text-teal-800";

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-teal-300">
          {label}
        </p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-[3px] ${toneClass}`}>
          {icon}
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold leading-none text-ink-900">{value}</p>
      <p className="mt-2 text-[12px] leading-5 text-ink-500">{meta}</p>
    </Card>
  );
}

function HealthRow({
  label,
  tone,
  value
}: {
  label: string;
  tone: "green" | "gold" | "rose" | "ink";
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[3px] border border-ink-200 bg-ink-50 px-3 py-2">
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

function ActionCard({
  description,
  href,
  icon,
  title
}: {
  description: string;
  href: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <Link className="block h-full" href={href}>
      <Card className="h-full p-4 transition-colors hover:border-teal-200 hover:bg-teal-50/20">
        <div className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-teal-50 text-teal-800">
          {icon}
        </div>
        <h2 className="mt-4 text-[15px] font-semibold text-ink-900">{title}</h2>
        <p className="mt-1 text-[13px] leading-5 text-ink-500">{description}</p>
      </Card>
    </Link>
  );
}
