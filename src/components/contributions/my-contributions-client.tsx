"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getSupabaseErrorMessage } from "@/lib/supabase/config";
import type { SyllabusContributionRecord } from "@/types/database";

const statusTone: Record<string, "green" | "gold" | "rose" | "ink" | "teal"> = {
  approved: "green",
  draft: "ink",
  needs_changes: "gold",
  pending_review: "teal",
  rejected: "rose"
};

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function readGuestDraftCount() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const raw = window.localStorage.getItem(
      "grademate_guest_syllabus_contribution_drafts"
    );
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function MyContributionsClient() {
  const { isGuest, supabase, user } = useAuth();
  const [contributions, setContributions] = useState<SyllabusContributionRecord[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [guestDraftCount, setGuestDraftCount] = useState(0);

  useEffect(() => {
    if (isGuest || !supabase) {
      setGuestDraftCount(readGuestDraftCount());
      setIsLoading(false);
      return;
    }

    const client = supabase;

    async function loadContributions() {
      setIsLoading(true);
      setError("");

      const { data, error: loadError } = await client
        .from("syllabus_contributions")
        .select("*")
        .eq("submitted_by_user_id", user.id)
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(
          getSupabaseErrorMessage(
            loadError,
            "Could not load your contributions. Run the contribution SQL setup if needed."
          )
        );
      } else {
        setContributions((data ?? []) as SyllabusContributionRecord[]);
      }

      setIsLoading(false);
    }

    void loadContributions();
  }, [isGuest, supabase, user.id]);

  const grouped = useMemo(() => {
    return contributions.reduce<Record<string, SyllabusContributionRecord[]>>(
      (groups, contribution) => {
        const key = contribution.status ?? "pending_review";
        groups[key] = [...(groups[key] ?? []), contribution];
        return groups;
      },
      {}
    );
  }, [contributions]);

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link className={buttonStyles()} href="/contribute-syllabus">
            Contribute syllabus
          </Link>
        }
        description="Track syllabuses you submitted to the shared Course Library."
        title="My contributions"
      />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {isGuest ? (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-ink-900">
            Guest contribution drafts
          </h2>
          <p className="mt-2 text-sm text-ink-500">
            {guestDraftCount === 0
              ? "No local drafts yet."
              : `${guestDraftCount} local draft${guestDraftCount === 1 ? "" : "s"} saved on this device.`}
          </p>
          <p className="mt-2 text-sm text-ink-500">
            Sign in to submit drafts to the shared library.
          </p>
        </Card>
      ) : isLoading ? (
        <Card className="p-5 text-sm text-ink-500">Loading contributions...</Card>
      ) : contributions.length === 0 ? (
        <EmptyState
          description="Submit a syllabus to help build the shared course library."
          icon={<FileText aria-hidden="true" className="h-5 w-5" />}
          title="No contributions yet"
        />
      ) : (
        <div className="space-y-5">
          {["pending_review", "needs_changes", "approved", "rejected", "draft"].map(
            (status) =>
              grouped[status]?.length ? (
                <section className="space-y-3" key={status}>
                  <h2 className="text-sm font-semibold uppercase tracking-normal text-ink-500">
                    {statusLabel(status)}
                  </h2>
                  {grouped[status].map((contribution) => (
                    <Card className="p-4" key={contribution.id}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            {contribution.course_code ? (
                              <Badge tone="teal">{contribution.course_code}</Badge>
                            ) : null}
                            <Badge tone={statusTone[contribution.status] ?? "ink"}>
                              {statusLabel(contribution.status)}
                            </Badge>
                          </div>
                          <h3 className="mt-3 font-semibold text-ink-900">
                            {contribution.course_name ?? "Untitled syllabus"}
                          </h3>
                          <p className="mt-1 text-sm text-ink-500">
                            Submitted{" "}
                            {new Date(contribution.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-sm text-ink-500">
                          Confidence{" "}
                          {Math.round(
                            Number(contribution.extraction_confidence ?? 0) * 100
                          )}
                          %
                        </p>
                      </div>
                      {contribution.review_notes ? (
                        <p className="mt-3 rounded-xl bg-ink-100 p-3 text-sm text-ink-600">
                          {contribution.review_notes}
                        </p>
                      ) : null}
                    </Card>
                  ))}
                </section>
              ) : null
          )}
        </div>
      )}
    </div>
  );
}
