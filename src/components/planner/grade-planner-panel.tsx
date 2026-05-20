"use client";

import { AlertTriangle, CheckCircle2, Target } from "lucide-react";
import { useMemo, useRef } from "react";
import {
  buildGradePlanner,
  type PlannerAssessmentInput,
  type PlannerAssessmentNeed,
  type PlannerStatus
} from "@/lib/grade-planner";
import { targetGradeOptions } from "@/lib/grade-targets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type GradePlannerPanelProps = {
  assessments: PlannerAssessmentInput[];
  courseName?: string;
  targetGrade: string;
  onTargetGradeChange: (value: string) => void;
  onAddAssessments?: () => void;
  onScanSyllabus?: () => void;
};

function formatPercent(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value.toFixed(digits)}%`;
}

function formatScore(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getTargetLabel(value: number) {
  const option = targetGradeOptions.find((target) => target.value === value);

  return option ? option.label : `${formatPercent(value)}`;
}

function getBadgeTone(status: PlannerStatus) {
  switch (status) {
    case "secured":
    case "complete_achieved":
      return "green" as const;
    case "not_reachable":
    case "complete_missed":
      return "rose" as const;
    case "hard":
      return "gold" as const;
    case "empty":
      return "ink" as const;
    case "achievable":
    default:
      return "teal" as const;
  }
}

function sanitizeTargetInput(value: string) {
  if (!value.trim()) {
    return "";
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return value;
  }

  return String(Math.min(100, Math.max(0, numeric)));
}

function getNeededScoreText(row: PlannerAssessmentNeed) {
  if (row.cappedNeededScore === null || row.neededScore === null) {
    return "N/A";
  }

  const base = `${formatScore(row.cappedNeededScore)} / ${formatScore(row.maxScore)}`;

  if (row.neededScore > row.maxScore) {
    return `${base} (${formatScore(row.neededScore)} required)`;
  }

  return base;
}

export function GradePlannerPanel({
  assessments,
  courseName,
  targetGrade,
  onTargetGradeChange,
  onAddAssessments,
  onScanSyllabus
}: GradePlannerPanelProps) {
  const customInputRef = useRef<HTMLInputElement>(null);
  const targetPercent = Number(targetGrade);
  const normalizedTarget =
    Number.isFinite(targetPercent) ? Math.min(100, Math.max(0, targetPercent)) : 90;
  const selectedCommonTarget = targetGradeOptions.find(
    (target) => target.value === normalizedTarget
  );
  const planner = useMemo(
    () =>
      buildGradePlanner({
        assessments,
        targetLabel: getTargetLabel(normalizedTarget),
        targetPercent: normalizedTarget
      }),
    [assessments, normalizedTarget]
  );

  if (!planner.hasAssessments) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-[26px] font-bold leading-tight text-ink-900">
            Grade Planner
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-ink-700">
            Choose a target and see what you need on the work you have left.
          </p>
        </div>
        <EmptyState
          action={
            onAddAssessments || onScanSyllabus ? (
              <div className="flex flex-wrap justify-center gap-2">
                {onAddAssessments ? (
                  <Button onClick={onAddAssessments} variant="secondary">
                    Add assessments
                  </Button>
                ) : null}
                {onScanSyllabus ? (
                  <Button onClick={onScanSyllabus}>Scan syllabus</Button>
                ) : null}
              </div>
            ) : undefined
          }
          description="Add assessments or scan your syllabus to unlock target planning."
          icon={<Target aria-hidden="true" className="h-5 w-5" />}
          title="Planner is waiting for coursework"
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-[26px] font-bold leading-tight text-ink-900">
            Grade Planner
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-5 text-ink-700">
            Choose a target and see what you need on the work you have left.
            {courseName ? ` Planning for ${courseName}.` : ""}
          </p>
        </div>
        <Badge tone={getBadgeTone(planner.status)}>{planner.statusLabel}</Badge>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-700">
              Target grade
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {targetGradeOptions.map((target) => {
                const selected = selectedCommonTarget?.value === target.value;

                return (
                  <Button
                    key={target.label}
                    onClick={() => onTargetGradeChange(String(target.value))}
                    size="sm"
                    variant={selected ? "primary" : "secondary"}
                  >
                    {target.label} {target.value}%
                  </Button>
                );
              })}
              <Button
                onClick={() => customInputRef.current?.focus()}
                size="sm"
                variant={selectedCommonTarget ? "secondary" : "primary"}
              >
                Custom
              </Button>
            </div>
          </div>
          <label className="block min-w-40">
            <span className="text-[13px] font-semibold text-ink-700">
              Custom target
            </span>
            <input
              className="gm-input mt-1"
              max="100"
              min="0"
              onChange={(event) =>
                onTargetGradeChange(sanitizeTargetInput(event.target.value))
              }
              ref={customInputRef}
              step="0.1"
              type="number"
              value={targetGrade}
            />
          </label>
        </div>
      </Card>

      {planner.warnings.length > 0 ? (
        <div className="space-y-2">
          {planner.warnings.map((warning) => (
            <p
              className="flex gap-2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              key={warning}
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-col gap-3 border-b border-ink-200 pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal-300">
              Result
            </p>
            <p className="mt-2 text-base font-semibold text-ink-900">
              {planner.resultMessage}
            </p>
          </div>
          <Badge tone={getBadgeTone(planner.status)}>{planner.statusLabel}</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Needed average" value={formatPercent(planner.neededRemainingAverage)} />
          <Metric label="Current earned" value={formatPercent(planner.currentEarnedWeighted)} />
          <Metric label="Remaining weight" value={formatPercent(planner.remainingWeight)} />
          <Metric label="Best possible" value={formatPercent(planner.projectedFinalIfRemaining100)} />
          <Metric label="If remaining zero" value={formatPercent(planner.projectedFinalIfRemaining0)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-ink-200 p-4">
          <h3 className="text-[15px] font-semibold text-ink-900">
            Remaining assessment plan
          </h3>
          <p className="mt-1 text-[13px] text-ink-500">
            Needed scores assume the same average across the rest of your work.
          </p>
        </div>
        {planner.remainingAssessments.length === 0 ? (
          <p className="p-4 text-sm text-ink-500">
            No remaining assessments. The planner is using your completed grade.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="gm-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Weight</th>
                  <th>Max score</th>
                  <th>Needed score</th>
                  <th>Contribution impact</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {planner.remainingAssessments.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold text-ink-900">{row.name}</td>
                    <td>{formatPercent(row.weightPercentage)}</td>
                    <td>
                      {formatScore(row.maxScore)}
                      {row.isMaxScoreAssumed ? (
                        <span className="ml-1 text-ink-500">(assumed)</span>
                      ) : null}
                    </td>
                    <td>{getNeededScoreText(row)}</td>
                    <td>
                      Worth {formatPercent(row.weightPercentage)}. +10 score pts
                      adds {formatPercent(row.contributionImpact)} final pts.
                    </td>
                    <td>
                      <Badge tone={row.status === "Not reachable" ? "rose" : row.status === "Hard" ? "gold" : row.status === "Secured" ? "green" : "ink"}>
                        {row.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-teal-300" />
          <h3 className="text-[15px] font-semibold text-ink-900">
            What to focus on
          </h3>
        </div>
        {planner.focusSuggestions.length > 0 ? (
          <ul className="mt-3 grid gap-2 text-sm text-ink-700">
            {planner.focusSuggestions.map((suggestion) => (
              <li className="border border-ink-200 bg-ink-100 px-3 py-2" key={suggestion}>
                {suggestion}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-500">
            Add scores and remaining assessments to get specific suggestions.
          </p>
        )}
      </Card>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-ink-200 bg-ink-100 px-3 py-3">
      <p className="text-[11px] font-semibold text-ink-500">{label}</p>
      <p className="mt-2 text-[22px] font-bold leading-none text-ink-900">
        {value}
      </p>
    </div>
  );
}
