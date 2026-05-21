"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  BookMarked,
  CheckCircle2,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { buildCourseTemplateUniqueKey } from "@/lib/course-template-key";
import { getSupabaseErrorMessage } from "@/lib/supabase/config";
import type {
  CourseTemplateAssessmentRecord,
  CourseTemplateMaterialRecord,
  CourseTemplateRecord,
  Json,
  ProfileRecord
} from "@/types/database";

type TemplateWithRows = CourseTemplateRecord & {
  assessments: CourseTemplateAssessmentRecord[];
  materials: CourseTemplateMaterialRecord[];
};

type AssessmentDraft = {
  id?: string;
  name: string;
  weightPercentage: string;
  maxScore: string;
  confidence: string;
  inferred: boolean;
  warning: string;
  source: string;
  sourceTextSnippet: string;
};

type MaterialDraft = {
  id?: string;
  fileName: string;
  filePath: string;
  fileType: string;
  materialType: string;
};

type TemplateForm = {
  id: string | null;
  uniqueKey: string;
  courseCode: string;
  courseName: string;
  department: string;
  creditHours: string;
  semester: string;
  term: string;
  templateStatus: string;
  extractionConfidence: string;
  instructor: string;
  instructorEmail: string;
  schedule: string;
  classroom: string;
  officeHours: string;
  prerequisites: string;
  description: string;
  sourceFileName: string;
  sourceFolderPath: string;
  sourceSyllabusFileName: string;
  sourceSyllabusPath: string;
  contributorUsername: string;
  contributorName: string;
  extractionWarningsText: string;
  textbooksText: string;
  assessments: AssessmentDraft[];
  materials: MaterialDraft[];
};

type StatusFilter = "all" | "ready" | "needs_review" | "archived";

const inputStyles = "gm-input h-9 px-2.5 text-[13px]";
const textareaStyles = "gm-input min-h-24 px-2.5 py-2 text-[13px] leading-5";
const statusOptions = ["ready", "needs_review", "archived", "conflict"];

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function asText(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function toNumber(value: string, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function totalWeight(assessments: AssessmentDraft[]) {
  return (
    Math.round(
      assessments.reduce((sum, row) => sum + toNumber(row.weightPercentage), 0) * 100
    ) / 100
  );
}

function jsonText(value: Json | null | undefined) {
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "")).filter(Boolean).join("\n");
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function parseListJson(value: string): Json {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as Json;
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean) as Json;
}

function getTemplateStatus(template: CourseTemplateRecord) {
  return template.template_status || "ready";
}

function statusTone(status: string): "green" | "gold" | "rose" | "ink" | "teal" {
  if (status === "ready") return "green";
  if (status === "needs_review") return "gold";
  if (status === "archived") return "ink";
  if (status === "conflict") return "rose";
  return "teal";
}

function blankAssessment(): AssessmentDraft {
  return {
    name: "",
    weightPercentage: "",
    maxScore: "100",
    confidence: "1",
    inferred: false,
    warning: "",
    source: "admin_edit",
    sourceTextSnippet: ""
  };
}

function blankMaterial(): MaterialDraft {
  return {
    fileName: "",
    filePath: "",
    fileType: "",
    materialType: ""
  };
}

function assessmentToDraft(row: CourseTemplateAssessmentRecord): AssessmentDraft {
  return {
    id: row.id,
    name: row.name ?? "",
    weightPercentage: asText(row.weight_percentage),
    maxScore: asText(row.max_score || 100),
    confidence: asText(row.confidence || 1),
    inferred: Boolean(row.inferred),
    warning: row.warning ?? "",
    source: row.source ?? "",
    sourceTextSnippet: row.source_text_snippet ?? ""
  };
}

function materialToDraft(row: CourseTemplateMaterialRecord): MaterialDraft {
  return {
    id: row.id,
    fileName: row.file_name ?? "",
    filePath: row.file_path ?? "",
    fileType: row.file_type ?? "",
    materialType: row.material_type ?? ""
  };
}

function emptyForm(): TemplateForm {
  return {
    id: null,
    uniqueKey: "",
    courseCode: "",
    courseName: "",
    department: "",
    creditHours: "3",
    semester: "",
    term: "",
    templateStatus: "ready",
    extractionConfidence: "1",
    instructor: "",
    instructorEmail: "",
    schedule: "",
    classroom: "",
    officeHours: "",
    prerequisites: "",
    description: "",
    sourceFileName: "admin-created",
    sourceFolderPath: "admin",
    sourceSyllabusFileName: "",
    sourceSyllabusPath: "",
    contributorUsername: "",
    contributorName: "",
    extractionWarningsText: "",
    textbooksText: "",
    assessments: [blankAssessment()],
    materials: []
  };
}

function templateToForm(template: TemplateWithRows): TemplateForm {
  return {
    id: template.id,
    uniqueKey: template.unique_key ?? "",
    courseCode: template.course_code ?? "",
    courseName: template.course_name ?? "",
    department: template.department ?? "",
    creditHours: asText(template.credit_hours || 3),
    semester: template.semester ?? "",
    term: template.term ?? "",
    templateStatus: getTemplateStatus(template),
    extractionConfidence: asText(template.extraction_confidence || 1),
    instructor: template.instructor ?? "",
    instructorEmail: template.instructor_email ?? "",
    schedule: template.schedule ?? "",
    classroom: template.classroom ?? "",
    officeHours: template.office_hours ?? "",
    prerequisites: template.prerequisites ?? "",
    description: template.course_description ?? template.description ?? "",
    sourceFileName: template.source_file_name ?? "",
    sourceFolderPath: template.source_folder_path ?? "",
    sourceSyllabusFileName: template.source_syllabus_file_name ?? "",
    sourceSyllabusPath: template.source_syllabus_path ?? "",
    contributorUsername: template.contributor_username ?? "",
    contributorName: template.contributor_name ?? "",
    extractionWarningsText: jsonText(template.extraction_warnings),
    textbooksText: jsonText(template.textbooks),
    assessments: template.assessments.length
      ? template.assessments.map(assessmentToDraft)
      : [blankAssessment()],
    materials: template.materials.map(materialToDraft)
  };
}

function isReadyTotal(total: number) {
  return total >= 99.5 && total <= 100.5;
}

export function AdminCourseLibraryClient() {
  const { isGuest, supabase, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [templates, setTemplates] = useState<TemplateWithRows[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<TemplateForm | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user.id, isGuest]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates]
  );

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();

    return templates.filter((template) => {
      const status = getTemplateStatus(template);
      const haystack =
        `${template.course_code} ${template.course_name} ${template.semester ?? ""} ${template.term ?? ""}`.toLowerCase();
      return (
        (!query || haystack.includes(query)) &&
        (statusFilter === "all" || status === statusFilter)
      );
    });
  }, [search, statusFilter, templates]);

  const readyCount = templates.filter(
    (template) => getTemplateStatus(template) === "ready"
  ).length;
  const issueCount = templates.filter((template) => {
    const weight = template.assessments.reduce(
      (sum, row) => sum + Number(row.weight_percentage || 0),
      0
    );
    return getTemplateStatus(template) === "ready" && !isReadyTotal(weight);
  }).length;

  async function loadLibrary(nextSelectedId?: string) {
    setError("");
    setMessage("");

    if (!supabase) {
      setError("Course Library admin needs Supabase configured.");
      setIsLoading(false);
      return;
    }

    if (isGuest) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

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

      const [templateResponse, assessmentResponse, materialResponse] =
        await Promise.all([
          supabase
            .from("course_templates")
            .select("*")
            .order("course_code", { ascending: true }),
          supabase
            .from("course_template_assessments")
            .select("*")
            .order("created_at", { ascending: true }),
          supabase
            .from("course_template_materials")
            .select("*")
            .order("file_name", { ascending: true })
        ]);

      if (templateResponse.error || assessmentResponse.error || materialResponse.error) {
        throw templateResponse.error ?? assessmentResponse.error ?? materialResponse.error;
      }

      const assessmentRows =
        (assessmentResponse.data ?? []) as CourseTemplateAssessmentRecord[];
      const materialRows =
        (materialResponse.data ?? []) as CourseTemplateMaterialRecord[];
      const groupedAssessments = new Map<string, CourseTemplateAssessmentRecord[]>();
      const groupedMaterials = new Map<string, CourseTemplateMaterialRecord[]>();

      for (const row of assessmentRows) {
        const rows = groupedAssessments.get(row.course_template_id) ?? [];
        rows.push(row);
        groupedAssessments.set(row.course_template_id, rows);
      }

      for (const row of materialRows) {
        const rows = groupedMaterials.get(row.course_template_id) ?? [];
        rows.push(row);
        groupedMaterials.set(row.course_template_id, rows);
      }

      const nextTemplates = ((templateResponse.data ?? []) as CourseTemplateRecord[]).map(
        (template) => ({
          ...template,
          assessments: groupedAssessments.get(template.id) ?? [],
          materials: groupedMaterials.get(template.id) ?? []
        })
      );

      setTemplates(nextTemplates);

      const nextId =
        nextSelectedId ??
        (selectedId && selectedId !== "new" ? selectedId : null) ??
        nextTemplates[0]?.id ??
        null;

      if (nextId) {
        const nextTemplate =
          nextTemplates.find((template) => template.id === nextId) ?? nextTemplates[0];
        setSelectedId(nextTemplate?.id ?? null);
        setForm(nextTemplate ? templateToForm(nextTemplate) : null);
      } else {
        setSelectedId(null);
        setForm(null);
      }
    } catch (loadError) {
      setError(
        getSupabaseErrorMessage(
          loadError,
          "Could not load admin Course Library. Make sure admin RLS policies are installed."
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  function startNewTemplate() {
    setSelectedId("new");
    setForm(emptyForm());
    setError("");
    setMessage("");
  }

  function selectTemplate(template: TemplateWithRows) {
    setSelectedId(template.id);
    setForm(templateToForm(template));
    setError("");
    setMessage("");
  }

  function updateForm<K extends keyof TemplateForm>(field: K, value: TemplateForm[K]) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateAssessment(index: number, patch: Partial<AssessmentDraft>) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        assessments: current.assessments.map((row, rowIndex) =>
          rowIndex === index ? { ...row, ...patch } : row
        )
      };
    });
  }

  function removeAssessment(index: number) {
    setForm((current) => {
      if (!current) return current;
      const assessments = current.assessments.filter((_, rowIndex) => rowIndex !== index);
      return { ...current, assessments: assessments.length ? assessments : [blankAssessment()] };
    });
  }

  function updateMaterial(index: number, patch: Partial<MaterialDraft>) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        materials: current.materials.map((row, rowIndex) =>
          rowIndex === index ? { ...row, ...patch } : row
        )
      };
    });
  }

  function removeMaterial(index: number) {
    setForm((current) =>
      current
        ? { ...current, materials: current.materials.filter((_, rowIndex) => rowIndex !== index) }
        : current
    );
  }

  async function saveVersionSnapshot(template: TemplateWithRows) {
    if (!supabase) return;

    const response = await supabase.from("course_template_versions").insert({
      template_id: template.id,
      previous_template_json: template as unknown as Json,
      previous_assessments_json: template.assessments as unknown as Json,
      previous_materials_json: template.materials as unknown as Json,
      replaced_by_admin_id: user.id
    });

    if (response.error) throw response.error;
  }

  function buildTemplatePayload(templateId: string, currentForm: TemplateForm) {
    const semester = clean(currentForm.semester) ?? clean(currentForm.term);
    const uniqueKey =
      clean(currentForm.uniqueKey) ??
      buildCourseTemplateUniqueKey({
        courseCode: currentForm.courseCode,
        courseName: currentForm.courseName,
        fallbackId: templateId,
        semester,
        sourceName:
          clean(currentForm.sourceSyllabusFileName) ??
          clean(currentForm.sourceFileName) ??
          "admin-created"
      });

    return {
      unique_key: uniqueKey,
      course_code: currentForm.courseCode.trim().toUpperCase(),
      course_name: currentForm.courseName.trim(),
      department:
        clean(currentForm.department) ??
        currentForm.courseCode.match(/^[A-Z]{2,5}/i)?.[0]?.toUpperCase() ??
        null,
      credit_hours: toNumber(currentForm.creditHours, 3),
      instructor: clean(currentForm.instructor),
      term: clean(currentForm.term) ?? clean(currentForm.semester),
      description: clean(currentForm.description),
      source_file_name: clean(currentForm.sourceFileName) ?? "admin-created",
      source_folder_path: clean(currentForm.sourceFolderPath) ?? "admin",
      source_syllabus_file_name: clean(currentForm.sourceSyllabusFileName),
      source_syllabus_path: clean(currentForm.sourceSyllabusPath),
      contributor_username: clean(currentForm.contributorUsername),
      contributor_name: clean(currentForm.contributorName),
      extractor_version: "admin_course_library_editor",
      extraction_warnings: parseListJson(currentForm.extractionWarningsText),
      template_status: currentForm.templateStatus,
      semester: clean(currentForm.semester) ?? clean(currentForm.term),
      instructor_email: clean(currentForm.instructorEmail),
      schedule: clean(currentForm.schedule),
      classroom: clean(currentForm.classroom),
      office_hours: clean(currentForm.officeHours),
      prerequisites: clean(currentForm.prerequisites),
      textbooks: parseListJson(currentForm.textbooksText),
      course_description: clean(currentForm.description),
      extraction_confidence: toNumber(currentForm.extractionConfidence, 1),
      updated_at: new Date().toISOString()
    };
  }

  function buildAssessmentRows(templateId: string, currentForm: TemplateForm) {
    return currentForm.assessments
      .filter((row) => row.name.trim())
      .map((row) => ({
        course_template_id: templateId,
        name: row.name.trim(),
        weight_percentage: toNumber(row.weightPercentage),
        max_score: toNumber(row.maxScore, 100),
        confidence: toNumber(row.confidence, 1),
        source_text_snippet: clean(row.sourceTextSnippet),
        source: clean(row.source) ?? "admin_edit",
        inferred: row.inferred,
        warning: clean(row.warning),
        updated_at: new Date().toISOString()
      }));
  }

  function buildMaterialRows(templateId: string, currentForm: TemplateForm) {
    return currentForm.materials
      .filter((row) => row.fileName.trim() && row.filePath.trim())
      .map((row) => ({
        course_template_id: templateId,
        file_name: row.fileName.trim(),
        file_path: row.filePath.trim(),
        file_type: clean(row.fileType),
        material_type: clean(row.materialType)
      }));
  }

  async function saveTemplate() {
    if (!supabase || !form || !isAdmin) return;

    setError("");
    setMessage("");

    const templateId = form.id ?? crypto.randomUUID();
    const assessmentRows = buildAssessmentRows(templateId, form);
    const materialRows = buildMaterialRows(templateId, form);
    const weight = totalWeight(form.assessments);

    if (!form.courseCode.trim() || !form.courseName.trim()) {
      setError("Course code and course name are required.");
      return;
    }

    if (form.templateStatus === "ready" && assessmentRows.length === 0) {
      setError("Ready templates need at least one assessment row.");
      return;
    }

    if (form.templateStatus === "ready" && !isReadyTotal(weight)) {
      setError("Ready templates should total 100%. Move this to needs review or fix the weights.");
      return;
    }

    setIsSaving(true);

    try {
      const previousTemplate = form.id
        ? templates.find((template) => template.id === form.id) ?? null
        : null;

      if (previousTemplate) {
        await saveVersionSnapshot(previousTemplate);
      }

      const templatePayload = buildTemplatePayload(templateId, form);

      if (form.id) {
        const updateResponse = await supabase
          .from("course_templates")
          .update(templatePayload)
          .eq("id", form.id);

        if (updateResponse.error) throw updateResponse.error;
      } else {
        const insertResponse = await supabase.from("course_templates").insert({
          id: templateId,
          ...templatePayload
        });

        if (insertResponse.error) throw insertResponse.error;
      }

      const assessmentDelete = await supabase
        .from("course_template_assessments")
        .delete()
        .eq("course_template_id", templateId);
      if (assessmentDelete.error) throw assessmentDelete.error;

      if (assessmentRows.length) {
        const assessmentInsert = await supabase
          .from("course_template_assessments")
          .insert(assessmentRows);
        if (assessmentInsert.error) throw assessmentInsert.error;
      }

      const materialDelete = await supabase
        .from("course_template_materials")
        .delete()
        .eq("course_template_id", templateId);
      if (materialDelete.error) throw materialDelete.error;

      if (materialRows.length) {
        const materialInsert = await supabase
          .from("course_template_materials")
          .insert(materialRows);
        if (materialInsert.error) throw materialInsert.error;
      }

      setMessage(
        form.id
          ? "Shared template updated. Existing student workspaces were not changed."
          : "Shared template created for future Course Library imports."
      );
      await loadLibrary(templateId);
    } catch (saveError) {
      setError(
        getSupabaseErrorMessage(
          saveError,
          "Could not save this shared template. Check admin policies and required fields."
        )
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveTemplate() {
    if (!supabase || !selectedTemplate) return;

    const nextStatus =
      getTemplateStatus(selectedTemplate) === "archived" ? "ready" : "archived";

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await saveVersionSnapshot(selectedTemplate);
      const response = await supabase
        .from("course_templates")
        .update({ template_status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", selectedTemplate.id);

      if (response.error) throw response.error;

      setMessage(
        nextStatus === "archived"
          ? "Template archived. It is hidden from normal Course Library users."
          : "Template restored as ready."
      );
      await loadLibrary(selectedTemplate.id);
    } catch (archiveError) {
      setError(getSupabaseErrorMessage(archiveError, "Could not update template status."));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTemplatePermanently() {
    if (!supabase || !selectedTemplate) return;

    const removedLabel = `${selectedTemplate.course_code} ${selectedTemplate.course_name}`.trim();

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const materialDelete = await supabase
        .from("course_template_materials")
        .delete()
        .eq("course_template_id", selectedTemplate.id);
      if (materialDelete.error) throw materialDelete.error;

      const assessmentDelete = await supabase
        .from("course_template_assessments")
        .delete()
        .eq("course_template_id", selectedTemplate.id);
      if (assessmentDelete.error) throw assessmentDelete.error;

      const templateDelete = await supabase
        .from("course_templates")
        .delete()
        .eq("id", selectedTemplate.id);
      if (templateDelete.error) throw templateDelete.error;

      setSelectedId(null);
      setForm(null);
      setMessage(`${removedLabel} was permanently removed from the shared Course Library.`);
      await loadLibrary();
    } catch (deleteError) {
      setError(
        getSupabaseErrorMessage(
          deleteError,
          "Could not permanently remove this shared template. Check admin policies and linked contribution references."
        )
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Card className="p-5 text-sm font-medium text-ink-600">
        Loading admin Course Library...
      </Card>
    );
  }

  if (isGuest || !isAdmin) {
    return (
      <EmptyState
        description="Only GradeMate admins can edit shared Course Library templates. Ask an existing admin to grant access for your account."
        icon={<ShieldAlert aria-hidden="true" className="h-5 w-5" />}
        title="Admin access required"
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <>
            <Button onClick={() => void loadLibrary()} size="sm" variant="secondary">
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={startNewTemplate} size="sm">
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              New template
            </Button>
          </>
        }
        description="Edit shared Course Library templates for future imports only. Existing student workspaces are never changed."
        eyebrow="Admin"
        title="Course Library Manager"
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-700">Templates</p>
          <p className="mt-2 text-2xl font-bold text-ink-900">{templates.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal-300">Ready</p>
          <p className="mt-2 text-2xl font-bold text-ink-900">{readyCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-700">Weight issues</p>
          <p className="mt-2 text-2xl font-bold text-ink-900">{issueCount}</p>
        </Card>
      </div>

      {message ? (
        <div className="flex items-center gap-2 rounded-[3px] border border-lime-200 bg-lime-50 px-4 py-3 text-sm font-medium text-lime-800">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="flex items-center gap-2 rounded-[3px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-200 p-4">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
              <input
                className="gm-input h-9 pl-9 text-[13px]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search code or name"
                value={search}
              />
            </div>
            <select
              className="gm-input mt-3 h-9 px-2.5 text-[13px]"
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              <option value="ready">Ready</option>
              <option value="needs_review">Needs review</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="max-h-[calc(100dvh-20rem)] overflow-y-auto">
            {filteredTemplates.length === 0 ? (
              <div className="p-4 text-sm text-ink-500">No templates match this filter.</div>
            ) : (
              filteredTemplates.map((template) => {
                const active = template.id === selectedId;
                const weight = template.assessments.reduce(
                  (sum, row) => sum + Number(row.weight_percentage || 0),
                  0
                );

                return (
                  <button
                    className={`block w-full border-b border-ink-200 px-4 py-3 text-left transition-colors ${
                      active ? "bg-teal-50" : "hover:bg-ink-100"
                    }`}
                    key={template.id}
                    onClick={() => selectTemplate(template)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold uppercase tracking-[0.06em] text-teal-300">
                          {template.course_code}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-ink-900">
                          {template.course_name}
                        </p>
                      </div>
                      <Badge tone={statusTone(getTemplateStatus(template))}>
                        {getTemplateStatus(template).replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-ink-500">
                      {template.assessments.length} rows / {Number(weight.toFixed(2))}% total
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {form ? (
          <TemplateEditor
            archiveTemplate={archiveTemplate}
            deleteTemplatePermanently={deleteTemplatePermanently}
            form={form}
            isSaving={isSaving}
            removeAssessment={removeAssessment}
            removeMaterial={removeMaterial}
            saveTemplate={saveTemplate}
            selectedTemplate={selectedTemplate}
            updateAssessment={updateAssessment}
            updateForm={updateForm}
            updateMaterial={updateMaterial}
          />
        ) : (
          <EmptyState
            action={<Button onClick={startNewTemplate}>Create template</Button>}
            description="Choose a template to edit or create a new shared template."
            icon={<BookMarked aria-hidden="true" className="h-5 w-5" />}
            title="No template selected"
          />
        )}
      </div>
    </div>
  );
}

function TemplateEditor({
  archiveTemplate,
  deleteTemplatePermanently,
  form,
  isSaving,
  removeAssessment,
  removeMaterial,
  saveTemplate,
  selectedTemplate,
  updateAssessment,
  updateForm,
  updateMaterial
}: {
  archiveTemplate: () => Promise<void>;
  deleteTemplatePermanently: () => Promise<void>;
  form: TemplateForm;
  isSaving: boolean;
  removeAssessment: (index: number) => void;
  removeMaterial: (index: number) => void;
  saveTemplate: () => Promise<void>;
  selectedTemplate: TemplateWithRows | null;
  updateAssessment: (index: number, patch: Partial<AssessmentDraft>) => void;
  updateForm: <K extends keyof TemplateForm>(field: K, value: TemplateForm[K]) => void;
  updateMaterial: (index: number, patch: Partial<MaterialDraft>) => void;
}) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const weight = totalWeight(form.assessments);
  const deleteConfirmationLabel = `${form.courseCode.trim().toUpperCase()} ${form.courseName.trim()}`.trim();
  const canDelete = deleteConfirmText.trim() === deleteConfirmationLabel;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-ink-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-ink-900">
              {form.id ? "Edit shared template" : "New shared template"}
            </h2>
            <Badge tone={statusTone(form.templateStatus)}>
              {form.templateStatus.replace(/_/g, " ")}
            </Badge>
            <Badge tone={isReadyTotal(weight) ? "green" : "gold"}>
              {Number(weight.toFixed(2))}% total
            </Badge>
          </div>
          <p className="mt-1 text-sm text-ink-500">
            Updates affect future Course Library imports only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {form.id ? (
            <>
              <Button disabled={isSaving} onClick={() => void archiveTemplate()} size="sm" variant="secondary">
                <Archive aria-hidden="true" className="h-4 w-4" />
                {selectedTemplate && getTemplateStatus(selectedTemplate) === "archived"
                  ? "Restore"
                  : "Archive"}
              </Button>
              <Button
                disabled={isSaving}
                onClick={() => {
                  setIsDeleteOpen((current) => !current);
                  setDeleteConfirmText("");
                }}
                size="sm"
                variant="danger"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Remove permanently
              </Button>
            </>
          ) : null}
          <Button disabled={isSaving} onClick={() => void saveTemplate()} size="sm">
            <Save aria-hidden="true" className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save template"}
          </Button>
        </div>
      </div>

      {form.id && isDeleteOpen ? (
        <div className="border-b border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-800">
            <AlertTriangle aria-hidden="true" className="h-4 w-4" />
            Permanent removal
          </div>
          <p className="mt-1 max-w-3xl text-sm text-rose-700">
            This removes the shared Course Library template and its template rows for future imports. It does not change courses students already imported.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <Field label={`Type ${deleteConfirmationLabel || "the course name"} to confirm`}>
              <input
                className={inputStyles}
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
              />
            </Field>
            <Button
              disabled={isSaving || !canDelete}
              onClick={() => void deleteTemplatePermanently()}
              size="sm"
              variant="danger"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              {isSaving ? "Removing..." : "Confirm removal"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-5 p-4">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Course code">
            <input className={inputStyles} value={form.courseCode} onChange={(event) => updateForm("courseCode", event.target.value)} />
          </Field>
          <Field label="Course name" className="xl:col-span-2">
            <input className={inputStyles} value={form.courseName} onChange={(event) => updateForm("courseName", event.target.value)} />
          </Field>
          <Field label="Credits">
            <input className={inputStyles} type="number" min="0" step="0.5" value={form.creditHours} onChange={(event) => updateForm("creditHours", event.target.value)} />
          </Field>
          <Field label="Department">
            <input className={inputStyles} value={form.department} onChange={(event) => updateForm("department", event.target.value)} />
          </Field>
          <Field label="Semester">
            <input className={inputStyles} placeholder="Fall 2026" value={form.semester} onChange={(event) => updateForm("semester", event.target.value)} />
          </Field>
          <Field label="Status">
            <select className={inputStyles} value={form.templateStatus} onChange={(event) => updateForm("templateStatus", event.target.value)}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Confidence">
            <input className={inputStyles} type="number" min="0" max="1" step="0.01" value={form.extractionConfidence} onChange={(event) => updateForm("extractionConfidence", event.target.value)} />
          </Field>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <Field label="Instructor">
            <input className={inputStyles} value={form.instructor} onChange={(event) => updateForm("instructor", event.target.value)} />
          </Field>
          <Field label="Instructor email">
            <input className={inputStyles} value={form.instructorEmail} onChange={(event) => updateForm("instructorEmail", event.target.value)} />
          </Field>
          <Field label="Schedule">
            <input className={inputStyles} value={form.schedule} onChange={(event) => updateForm("schedule", event.target.value)} />
          </Field>
          <Field label="Classroom">
            <input className={inputStyles} value={form.classroom} onChange={(event) => updateForm("classroom", event.target.value)} />
          </Field>
          <Field label="Contributor username">
            <input className={inputStyles} placeholder="username" value={form.contributorUsername} onChange={(event) => updateForm("contributorUsername", event.target.value)} />
          </Field>
          <Field label="Contributor name">
            <input className={inputStyles} value={form.contributorName} onChange={(event) => updateForm("contributorName", event.target.value)} />
          </Field>
        </section>

        <Field label="Description">
          <textarea className={textareaStyles} value={form.description} onChange={(event) => updateForm("description", event.target.value)} />
        </Field>

        <AssessmentEditor
          form={form}
          removeAssessment={removeAssessment}
          updateAssessment={updateAssessment}
          updateForm={updateForm}
        />

        <section className="grid gap-3 lg:grid-cols-2">
          <Field label="Warnings">
            <textarea className={textareaStyles} placeholder="One warning per line or JSON array" value={form.extractionWarningsText} onChange={(event) => updateForm("extractionWarningsText", event.target.value)} />
          </Field>
          <Field label="Textbooks">
            <textarea className={textareaStyles} placeholder="One item per line or JSON array" value={form.textbooksText} onChange={(event) => updateForm("textbooksText", event.target.value)} />
          </Field>
        </section>

        <MaterialEditor
          form={form}
          removeMaterial={removeMaterial}
          updateForm={updateForm}
          updateMaterial={updateMaterial}
        />

        <section className="grid gap-3 lg:grid-cols-2">
          <Field label="Source file">
            <input className={inputStyles} value={form.sourceFileName} onChange={(event) => updateForm("sourceFileName", event.target.value)} />
          </Field>
          <Field label="Source folder">
            <input className={inputStyles} value={form.sourceFolderPath} onChange={(event) => updateForm("sourceFolderPath", event.target.value)} />
          </Field>
          <Field label="Unique key">
            <input className={inputStyles} placeholder="Auto-generated if blank" value={form.uniqueKey} onChange={(event) => updateForm("uniqueKey", event.target.value)} />
          </Field>
          <Field label="Prerequisites">
            <input className={inputStyles} value={form.prerequisites} onChange={(event) => updateForm("prerequisites", event.target.value)} />
          </Field>
        </section>

      </div>
    </Card>
  );
}

function AssessmentEditor({
  form,
  removeAssessment,
  updateAssessment,
  updateForm
}: {
  form: TemplateForm;
  removeAssessment: (index: number) => void;
  updateAssessment: (index: number, patch: Partial<AssessmentDraft>) => void;
  updateForm: <K extends keyof TemplateForm>(field: K, value: TemplateForm[K]) => void;
}) {
  return (
    <section>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-ink-900">Assessment rows</h3>
          <p className="text-[13px] text-ink-500">Ready templates should add up to 100%.</p>
        </div>
        <Button onClick={() => updateForm("assessments", [...form.assessments, blankAssessment()])} size="sm" variant="secondary">
          <PlusCircle aria-hidden="true" className="h-4 w-4" />
          Add row
        </Button>
      </div>
      <div className="mt-3 overflow-x-auto border border-ink-200">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-ink-100 text-left text-[11px] uppercase tracking-[0.06em] text-ink-700">
            <tr>
              <th className="px-3 py-2">Assessment</th>
              <th className="px-3 py-2">Weight</th>
              <th className="px-3 py-2">Max</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Warning</th>
              <th className="px-3 py-2 text-right">Remove</th>
            </tr>
          </thead>
          <tbody>
            {form.assessments.map((row, index) => (
              <tr className="border-t border-ink-200" key={`${row.id ?? "new"}-${index}`}>
                <td className="px-3 py-2"><input className={inputStyles} value={row.name} onChange={(event) => updateAssessment(index, { name: event.target.value })} /></td>
                <td className="px-3 py-2"><input className={inputStyles} type="number" step="0.01" value={row.weightPercentage} onChange={(event) => updateAssessment(index, { weightPercentage: event.target.value })} /></td>
                <td className="px-3 py-2"><input className={inputStyles} type="number" step="0.01" value={row.maxScore} onChange={(event) => updateAssessment(index, { maxScore: event.target.value })} /></td>
                <td className="px-3 py-2"><input className={inputStyles} type="number" min="0" max="1" step="0.01" value={row.confidence} onChange={(event) => updateAssessment(index, { confidence: event.target.value })} /></td>
                <td className="px-3 py-2"><input className={inputStyles} value={row.warning} onChange={(event) => updateAssessment(index, { warning: event.target.value })} /></td>
                <td className="px-3 py-2 text-right">
                  <Button aria-label="Remove assessment" onClick={() => removeAssessment(index)} size="icon" variant="ghost">
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MaterialEditor({
  form,
  removeMaterial,
  updateForm,
  updateMaterial
}: {
  form: TemplateForm;
  removeMaterial: (index: number) => void;
  updateForm: <K extends keyof TemplateForm>(field: K, value: TemplateForm[K]) => void;
  updateMaterial: (index: number, patch: Partial<MaterialDraft>) => void;
}) {
  return (
    <section>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-ink-900">Materials</h3>
          <p className="text-[13px] text-ink-500">Optional shared source/material links for this template.</p>
        </div>
        <Button onClick={() => updateForm("materials", [...form.materials, blankMaterial()])} size="sm" variant="secondary">
          <PlusCircle aria-hidden="true" className="h-4 w-4" />
          Add material
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {form.materials.length === 0 ? (
          <p className="rounded-[3px] border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-500">No materials attached.</p>
        ) : form.materials.map((row, index) => (
          <div className="grid gap-2 rounded-[3px] border border-ink-200 p-3 lg:grid-cols-[1fr_1.5fr_0.7fr_0.7fr_auto]" key={`${row.id ?? "new"}-${index}`}>
            <input className={inputStyles} placeholder="File name" value={row.fileName} onChange={(event) => updateMaterial(index, { fileName: event.target.value })} />
            <input className={inputStyles} placeholder="File path" value={row.filePath} onChange={(event) => updateMaterial(index, { filePath: event.target.value })} />
            <input className={inputStyles} placeholder="File type" value={row.fileType} onChange={(event) => updateMaterial(index, { fileType: event.target.value })} />
            <input className={inputStyles} placeholder="Material type" value={row.materialType} onChange={(event) => updateMaterial(index, { materialType: event.target.value })} />
            <Button aria-label="Remove material" onClick={() => removeMaterial(index)} size="icon" variant="ghost">
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({
  children,
  className,
  label
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={`block min-w-0 ${className ?? ""}`}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-700">
        {label}
      </span>
      {children}
    </label>
  );
}
