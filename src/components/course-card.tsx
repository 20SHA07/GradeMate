import { FileText, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getGradeInfo } from "@/lib/grading";
import type { Course, CourseStatus } from "@/types";

const statusTone: Record<CourseStatus, "teal" | "gold" | "green"> = {
  active: "teal",
  planned: "gold",
  completed: "green"
};

const syllabusTone: Record<Course["syllabusStatus"], "ink" | "gold" | "green"> = {
  missing: "ink",
  uploaded: "gold",
  parsed: "green"
};

const syllabusLabel: Record<Course["syllabusStatus"], string> = {
  missing: "No syllabus",
  uploaded: "Uploaded",
  parsed: "Parsed"
};

export function CourseCard({ course }: { course: Course }) {
  const gradeInfo = getGradeInfo(course.currentGrade || 0);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-teal-700">{course.code}</p>
            <CardTitle className="mt-1">{course.title}</CardTitle>
          </div>
          <Badge tone={statusTone[course.status]}>{course.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Badge tone="ink">{course.credits} credits</Badge>
          <Badge tone={syllabusTone[course.syllabusStatus]}>
            <FileText aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
            {syllabusLabel[course.syllabusStatus]}
          </Badge>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-ink-700">Current grade</span>
              <span className="text-ink-500">
                {gradeInfo.roundedPercentage}% · {gradeInfo.letter}
              </span>
            </div>
            <Progress value={course.currentGrade} tone="teal" />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2 font-medium text-ink-700">
              <Target aria-hidden="true" className="h-4 w-4 text-amber-600" />
              Target
            </span>
            <span className="text-ink-600">{course.targetGrade}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
