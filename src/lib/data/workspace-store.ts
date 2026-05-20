import type { SupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getCoreAssessmentPayload,
  getCoreAssessmentPayloads,
  isMissingAssessmentOptionalColumnError
} from "@/lib/supabase/assessment-write";
import { getSupabaseErrorMessage } from "@/lib/supabase/config";
import {
  clearGuestVerifiedExtractions,
  readGuestVerifiedExtractions
} from "@/lib/syllabus/verified-extractions";
import type {
  AssessmentRecord,
  CourseRecord,
  SemesterRecord
} from "@/types/database";

const guestWorkspaceKey = "grademate_guest_workspace";
const legacyGuestDataKey = "grademate_guest_data";
const legacyGuestSessionKey = "grademate_guest_session";

export type ImportedTemplateRecord = {
  templateId: string;
  courseId: string;
  semesterId: string;
  importedAt: string;
};

export type GpaCalculatorData = {
  selectedSemesterIds?: string[];
  manualGrades?: Record<string, string>;
  whatIfCourse?: {
    courseName: string;
    credits: string;
    expectedGrade: string;
  };
};

export type DegreePlanCategory = {
  id: string;
  label: string;
  requiredCredits: number;
  completedCredits: number;
};

export type DegreePlanSettings = {
  totalCredits: number;
  completedCredits: number;
  categories: DegreePlanCategory[];
};

export type DegreePlanResult = {
  settings: DegreePlanSettings;
  isDefault: boolean;
  syncStatus: "local" | "supabase" | "fallback";
};

export type GuestWorkspaceData = {
  semesters: SemesterRecord[];
  courses: CourseRecord[];
  assessments: AssessmentRecord[];
  importedTemplates: ImportedTemplateRecord[];
  gpaCalculator: GpaCalculatorData;
  degreePlan: DegreePlanSettings | null;
  updatedAt: string | null;
};

export type WorkspaceContext = {
  isGuest: boolean;
  supabase: SupabaseBrowserClient | null;
  userId: string;
};

export const guestUserId = "guest-user";

export const guestUser = {
  id: guestUserId,
  email: undefined,
  user_metadata: {}
};

export const emptyGuestWorkspaceData: GuestWorkspaceData = {
  semesters: [],
  courses: [],
  assessments: [],
  importedTemplates: [],
  gpaCalculator: {},
  degreePlan: null,
  updatedAt: null
};

export const defaultDegreePlanSettings: DegreePlanSettings = {
  totalCredits: 120,
  completedCredits: 0,
  categories: [
    {
      completedCredits: 0,
      id: "major-core",
      label: "Major Core",
      requiredCredits: 0
    },
    {
      completedCredits: 0,
      id: "electives",
      label: "Electives",
      requiredCredits: 0
    }
  ]
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function normalizeWorkspaceData(
  data: Partial<GuestWorkspaceData> | null | undefined
): GuestWorkspaceData {
  return {
    semesters: data?.semesters ?? [],
    courses: data?.courses ?? [],
    assessments: data?.assessments ?? [],
    importedTemplates: data?.importedTemplates ?? [],
    gpaCalculator: data?.gpaCalculator ?? {},
    degreePlan: data?.degreePlan
      ? normalizeDegreePlanSettings(data.degreePlan)
      : null,
    updatedAt: data?.updatedAt ?? null
  };
}

function getAuthenticatedDegreePlanKey(userId: string) {
  return `grademate_degree_plan_${userId}`;
}

function readAuthenticatedLocalDegreePlan(userId: string) {
  if (!canUseLocalStorage()) {
    return null;
  }

  const rawData = window.localStorage.getItem(getAuthenticatedDegreePlanKey(userId));

  if (!rawData) {
    return null;
  }

  try {
    return normalizeDegreePlanSettings(JSON.parse(rawData));
  } catch {
    return null;
  }
}

function writeAuthenticatedLocalDegreePlan(
  userId: string,
  settings: DegreePlanSettings
) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
    getAuthenticatedDegreePlanKey(userId),
    JSON.stringify(normalizeDegreePlanSettings(settings))
  );
}

function isMissingDegreePlanTableError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  return /degree_plans|schema cache|does not exist|not found/i.test(message);
}

function normalizeNumber(value: unknown, fallback: number) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizeCategory(
  category: Partial<DegreePlanCategory> | null | undefined,
  index: number
): DegreePlanCategory {
  const label =
    typeof category?.label === "string" && category.label.trim()
      ? category.label.trim()
      : `Category ${index + 1}`;

  return {
    completedCredits: normalizeNumber(category?.completedCredits, 0),
    id:
      typeof category?.id === "string" && category.id.trim()
        ? category.id
        : createLocalId(),
    label,
    requiredCredits: normalizeNumber(category?.requiredCredits, 0)
  };
}

export function normalizeDegreePlanSettings(
  settings: Partial<DegreePlanSettings> | null | undefined
): DegreePlanSettings {
  const totalCredits = normalizeNumber(
    settings?.totalCredits,
    defaultDegreePlanSettings.totalCredits
  );
  const completedCredits = Math.min(
    normalizeNumber(settings?.completedCredits, 0),
    totalCredits
  );
  const categories = Array.isArray(settings?.categories)
    ? settings.categories.map(normalizeCategory)
    : defaultDegreePlanSettings.categories;

  return {
    categories: categories.length > 0
      ? categories
      : defaultDegreePlanSettings.categories,
    completedCredits,
    totalCredits: totalCredits > 0 ? totalCredits : 120
  };
}

function readLegacyGuestData() {
  if (typeof window === "undefined" || !("sessionStorage" in window)) {
    return null;
  }

  const rawData = window.sessionStorage.getItem(legacyGuestDataKey);

  if (!rawData) {
    return null;
  }

  try {
    return normalizeWorkspaceData(JSON.parse(rawData) as Partial<GuestWorkspaceData>);
  } catch {
    return null;
  }
}

export function readGuestWorkspaceData(): GuestWorkspaceData {
  if (!canUseLocalStorage()) {
    return emptyGuestWorkspaceData;
  }

  const rawData = window.localStorage.getItem(guestWorkspaceKey);

  if (rawData) {
    try {
      return normalizeWorkspaceData(JSON.parse(rawData) as Partial<GuestWorkspaceData>);
    } catch {
      return emptyGuestWorkspaceData;
    }
  }

  const legacyData = readLegacyGuestData();

  if (legacyData) {
    writeGuestWorkspaceData(legacyData);
    window.sessionStorage.removeItem(legacyGuestDataKey);
  }

  return legacyData ?? emptyGuestWorkspaceData;
}

export function writeGuestWorkspaceData(data: GuestWorkspaceData) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
    guestWorkspaceKey,
    JSON.stringify({
      ...data,
      updatedAt: new Date().toISOString()
    })
  );
}

export function clearGuestWorkspaceData() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(guestWorkspaceKey);

  if ("sessionStorage" in window) {
    window.sessionStorage.removeItem(legacyGuestDataKey);
    window.sessionStorage.removeItem(legacyGuestSessionKey);
  }
}

export function hasGuestWorkspaceData() {
  const data = readGuestWorkspaceData();

  return (
    data.semesters.length > 0 ||
    data.courses.length > 0 ||
    data.assessments.length > 0 ||
    data.importedTemplates.length > 0 ||
    Object.keys(data.gpaCalculator).length > 0 ||
    data.degreePlan !== null
  );
}

export function startGuestWorkspace() {
  if (!canUseLocalStorage()) {
    return;
  }

  if (!window.localStorage.getItem(guestWorkspaceKey)) {
    writeGuestWorkspaceData(emptyGuestWorkspaceData);
  }
}

export function createLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (value) =>
    (
      Number(value) ^
      (Math.random() * 16) >>
        (Number(value) / 4)
    ).toString(16)
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function ensureUuid(value: string, map: Map<string, string>) {
  if (isUuid(value)) {
    return value;
  }

  const existing = map.get(value);

  if (existing) {
    return existing;
  }

  const nextId = createLocalId();
  map.set(value, nextId);
  return nextId;
}

export async function getSemesters(context: WorkspaceContext) {
  if (context.isGuest) {
    return readGuestWorkspaceData().semesters;
  }

  if (!context.supabase) {
    return [];
  }

  const { data, error } = await context.supabase
    .from("semesters")
    .select("*")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error));
  }

  return (data ?? []) as SemesterRecord[];
}

export async function getCourses(context: WorkspaceContext) {
  if (context.isGuest) {
    return readGuestWorkspaceData().courses;
  }

  if (!context.supabase) {
    return [];
  }

  const { data, error } = await context.supabase
    .from("courses")
    .select("*")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error));
  }

  return (data ?? []) as CourseRecord[];
}

export async function getAssessments(context: WorkspaceContext) {
  if (context.isGuest) {
    return readGuestWorkspaceData().assessments;
  }

  if (!context.supabase) {
    return [];
  }

  const { data, error } = await context.supabase
    .from("assessments")
    .select("*")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error));
  }

  return (data ?? []) as AssessmentRecord[];
}

export async function getWorkspaceSnapshot(context: WorkspaceContext) {
  const [semesters, courses, assessments] = await Promise.all([
    getSemesters(context),
    getCourses(context),
    getAssessments(context)
  ]);

  return { semesters, courses, assessments };
}

export async function getDegreePlanSettings(
  context: WorkspaceContext
): Promise<DegreePlanResult> {
  if (context.isGuest) {
    const data = readGuestWorkspaceData();

    return {
      isDefault: !data.degreePlan,
      settings: data.degreePlan ?? defaultDegreePlanSettings,
      syncStatus: "local"
    };
  }

  const localFallback = readAuthenticatedLocalDegreePlan(context.userId);

  if (!context.supabase) {
    return {
      isDefault: !localFallback,
      settings: localFallback ?? defaultDegreePlanSettings,
      syncStatus: "local"
    };
  }

  const { data, error } = await context.supabase
    .from("degree_plans")
    .select("total_credits, completed_credits, categories")
    .eq("user_id", context.userId)
    .maybeSingle();

  if (error) {
    if (isMissingDegreePlanTableError(error)) {
      return {
        isDefault: !localFallback,
        settings: localFallback ?? defaultDegreePlanSettings,
        syncStatus: localFallback ? "fallback" : "local"
      };
    }

    throw new Error(
      getSupabaseErrorMessage(error, "Could not load degree settings.")
    );
  }

  if (!data) {
    return {
      isDefault: !localFallback,
      settings: localFallback ?? defaultDegreePlanSettings,
      syncStatus: localFallback ? "fallback" : "supabase"
    };
  }

  return {
    isDefault: false,
    settings: normalizeDegreePlanSettings({
      categories: data.categories as DegreePlanCategory[],
      completedCredits: Number(data.completed_credits),
      totalCredits: Number(data.total_credits)
    }),
    syncStatus: "supabase"
  };
}

export async function saveDegreePlanSettings(
  context: WorkspaceContext,
  settings: DegreePlanSettings
): Promise<DegreePlanResult> {
  const normalizedSettings = normalizeDegreePlanSettings(settings);

  if (context.isGuest) {
    const data = readGuestWorkspaceData();

    writeGuestWorkspaceData({
      ...data,
      degreePlan: normalizedSettings
    });

    return {
      isDefault: false,
      settings: normalizedSettings,
      syncStatus: "local"
    };
  }

  if (!context.supabase) {
    writeAuthenticatedLocalDegreePlan(context.userId, normalizedSettings);

    return {
      isDefault: false,
      settings: normalizedSettings,
      syncStatus: "local"
    };
  }

  const { data, error } = await context.supabase
    .from("degree_plans")
    .upsert(
      {
        categories: normalizedSettings.categories,
        completed_credits: normalizedSettings.completedCredits,
        total_credits: normalizedSettings.totalCredits,
        updated_at: new Date().toISOString(),
        user_id: context.userId
      },
      { onConflict: "user_id" }
    )
    .select("total_credits, completed_credits, categories")
    .single();

  if (error) {
    if (isMissingDegreePlanTableError(error)) {
      writeAuthenticatedLocalDegreePlan(context.userId, normalizedSettings);

      return {
        isDefault: false,
        settings: normalizedSettings,
        syncStatus: "fallback"
      };
    }

    throw new Error(
      getSupabaseErrorMessage(error, "Could not save degree settings.")
    );
  }

  return {
    isDefault: false,
    settings: normalizeDegreePlanSettings({
      categories: data.categories as DegreePlanCategory[],
      completedCredits: Number(data.completed_credits),
      totalCredits: Number(data.total_credits)
    }),
    syncStatus: "supabase"
  };
}

export function resetDegreePlanSettings() {
  return normalizeDegreePlanSettings(defaultDegreePlanSettings);
}

export function updateGuestGpaCalculator(
  gpaCalculator: Partial<GpaCalculatorData>
) {
  const data = readGuestWorkspaceData();

  writeGuestWorkspaceData({
    ...data,
    gpaCalculator: {
      ...data.gpaCalculator,
      ...gpaCalculator
    }
  });
}

export function recordImportedTemplate(record: ImportedTemplateRecord) {
  const data = readGuestWorkspaceData();
  const alreadyRecorded = data.importedTemplates.some(
    (item) =>
      item.templateId === record.templateId &&
      item.courseId === record.courseId &&
      item.semesterId === record.semesterId
  );

  if (alreadyRecorded) {
    return;
  }

  writeGuestWorkspaceData({
    ...data,
    importedTemplates: [...data.importedTemplates, record]
  });
}

export async function createSemester(
  context: WorkspaceContext,
  input: Pick<SemesterRecord, "name"> &
    Partial<Pick<SemesterRecord, "academic_year" | "term">>
) {
  if (context.isGuest) {
    const data = readGuestWorkspaceData();
    const semester: SemesterRecord = {
      id: createLocalId(),
      user_id: guestUserId,
      name: input.name,
      academic_year: input.academic_year ?? null,
      term: input.term ?? null,
      created_at: new Date().toISOString()
    };

    writeGuestWorkspaceData({
      ...data,
      semesters: [semester, ...data.semesters]
    });

    return semester;
  }

  if (!context.supabase) {
    throw new Error("Account sync is not available right now.");
  }

  const { data, error } = await context.supabase
    .from("semesters")
    .insert({
      user_id: context.userId,
      name: input.name,
      academic_year: input.academic_year ?? null,
      term: input.term ?? null
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Could not create semester."));
  }

  return data as SemesterRecord;
}

export async function updateSemester(
  context: WorkspaceContext,
  semesterId: string,
  updates: Partial<Omit<SemesterRecord, "id" | "user_id" | "created_at">>
) {
  if (context.isGuest) {
    const data = readGuestWorkspaceData();
    const semesters = data.semesters.map((semester) =>
      semester.id === semesterId ? { ...semester, ...updates } : semester
    );

    writeGuestWorkspaceData({ ...data, semesters });
    return semesters.find((semester) => semester.id === semesterId) ?? null;
  }

  if (!context.supabase) {
    throw new Error("Account sync is not available right now.");
  }

  const { data, error } = await context.supabase
    .from("semesters")
    .update(updates)
    .eq("id", semesterId)
    .eq("user_id", context.userId)
    .select()
    .single();

  if (error) {
    throw new Error(getSupabaseErrorMessage(error));
  }

  return data as SemesterRecord;
}

export async function deleteSemester(context: WorkspaceContext, semesterId: string) {
  if (context.isGuest) {
    const data = readGuestWorkspaceData();
    const courseIds = new Set(
      data.courses
        .filter((course) => course.semester_id === semesterId)
        .map((course) => course.id)
    );

    writeGuestWorkspaceData({
      ...data,
      semesters: data.semesters.filter((semester) => semester.id !== semesterId),
      courses: data.courses.filter((course) => course.semester_id !== semesterId),
      assessments: data.assessments.filter(
        (assessment) => !courseIds.has(assessment.course_id)
      )
    });
    return;
  }

  if (!context.supabase) {
    throw new Error("Account sync is not available right now.");
  }

  const { error } = await context.supabase
    .from("semesters")
    .delete()
    .eq("id", semesterId)
    .eq("user_id", context.userId);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error));
  }
}

export async function createCourse(
  context: WorkspaceContext,
  input: Pick<CourseRecord, "semester_id" | "name"> &
    Partial<Pick<CourseRecord, "code" | "credit_hours">>
) {
  if (context.isGuest) {
    const data = readGuestWorkspaceData();
    const course: CourseRecord = {
      id: createLocalId(),
      user_id: guestUserId,
      semester_id: input.semester_id,
      name: input.name,
      code: input.code ?? null,
      credit_hours: Number(input.credit_hours) || 3,
      created_at: new Date().toISOString()
    };

    writeGuestWorkspaceData({ ...data, courses: [course, ...data.courses] });
    return course;
  }

  if (!context.supabase) {
    throw new Error("Account sync is not available right now.");
  }

  const { data, error } = await context.supabase
    .from("courses")
    .insert({
      user_id: context.userId,
      semester_id: input.semester_id,
      name: input.name,
      code: input.code ?? null,
      credit_hours: Number(input.credit_hours) || 3
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Could not create course."));
  }

  return data as CourseRecord;
}

export async function updateCourse(
  context: WorkspaceContext,
  courseId: string,
  updates: Partial<Omit<CourseRecord, "id" | "user_id" | "created_at">>
) {
  if (context.isGuest) {
    const data = readGuestWorkspaceData();
    const courses = data.courses.map((course) =>
      course.id === courseId ? { ...course, ...updates } : course
    );

    writeGuestWorkspaceData({ ...data, courses });
    return courses.find((course) => course.id === courseId) ?? null;
  }

  if (!context.supabase) {
    throw new Error("Account sync is not available right now.");
  }

  const { data, error } = await context.supabase
    .from("courses")
    .update(updates)
    .eq("id", courseId)
    .eq("user_id", context.userId)
    .select()
    .single();

  if (error) {
    throw new Error(getSupabaseErrorMessage(error));
  }

  return data as CourseRecord;
}

export async function deleteCourse(context: WorkspaceContext, courseId: string) {
  if (context.isGuest) {
    const data = readGuestWorkspaceData();

    writeGuestWorkspaceData({
      ...data,
      courses: data.courses.filter((course) => course.id !== courseId),
      assessments: data.assessments.filter(
        (assessment) => assessment.course_id !== courseId
      )
    });
    return;
  }

  if (!context.supabase) {
    throw new Error("Account sync is not available right now.");
  }

  const { error } = await context.supabase
    .from("courses")
    .delete()
    .eq("id", courseId)
    .eq("user_id", context.userId);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error));
  }
}

export async function createAssessment(
  context: WorkspaceContext,
  input: Pick<AssessmentRecord, "course_id"> &
    Partial<
      Pick<
        AssessmentRecord,
        | "name"
        | "weight_percentage"
        | "score"
        | "max_score"
        | "category"
        | "title"
        | "weight"
      >
    >
) {
  const name = input.name ?? input.title ?? "Assessment";
  const weight = Number(input.weight_percentage ?? input.weight ?? 0);

  if (context.isGuest) {
    const data = readGuestWorkspaceData();
    const assessment: AssessmentRecord = {
      id: createLocalId(),
      user_id: guestUserId,
      course_id: input.course_id,
      name,
      weight_percentage: weight,
      score: input.score ?? null,
      max_score: input.max_score ?? null,
      category: input.category ?? "Planned",
      title: name,
      weight,
      created_at: new Date().toISOString()
    };

    writeGuestWorkspaceData({
      ...data,
      assessments: [...data.assessments, assessment]
    });
    return assessment;
  }

  if (!context.supabase) {
    throw new Error("Account sync is not available right now.");
  }

  const insertPayload = {
    user_id: context.userId,
    course_id: input.course_id,
    name,
    weight_percentage: weight,
    score: input.score ?? null,
    max_score: input.max_score ?? null,
    category: input.category ?? "Planned",
    title: name,
    weight
  };
  let response = await context.supabase
    .from("assessments")
    .insert(insertPayload)
    .select()
    .single();

  if (isMissingAssessmentOptionalColumnError(response.error)) {
    response = await context.supabase
      .from("assessments")
      .insert(getCoreAssessmentPayload(insertPayload))
      .select()
      .single();
  }

  if (response.error || !response.data) {
    throw new Error(
      getSupabaseErrorMessage(response.error, "Could not create assessment.")
    );
  }

  return response.data as AssessmentRecord;
}

export async function updateAssessment(
  context: WorkspaceContext,
  assessmentId: string,
  updates: Partial<Omit<AssessmentRecord, "id" | "user_id" | "created_at">>
) {
  if (context.isGuest) {
    const data = readGuestWorkspaceData();
    const assessments = data.assessments.map((assessment) =>
      assessment.id === assessmentId ? { ...assessment, ...updates } : assessment
    );

    writeGuestWorkspaceData({ ...data, assessments });
    return assessments.find((assessment) => assessment.id === assessmentId) ?? null;
  }

  if (!context.supabase) {
    throw new Error("Account sync is not available right now.");
  }

  let response = await context.supabase
    .from("assessments")
    .update(updates)
    .eq("id", assessmentId)
    .eq("user_id", context.userId)
    .select()
    .single();

  if (isMissingAssessmentOptionalColumnError(response.error)) {
    response = await context.supabase
      .from("assessments")
      .update(getCoreAssessmentPayload(updates))
      .eq("id", assessmentId)
      .eq("user_id", context.userId)
      .select()
      .single();
  }

  if (response.error) {
    throw new Error(getSupabaseErrorMessage(response.error));
  }

  return response.data as AssessmentRecord;
}

export async function deleteAssessment(
  context: WorkspaceContext,
  assessmentId: string
) {
  if (context.isGuest) {
    const data = readGuestWorkspaceData();

    writeGuestWorkspaceData({
      ...data,
      assessments: data.assessments.filter(
        (assessment) => assessment.id !== assessmentId
      )
    });
    return;
  }

  if (!context.supabase) {
    throw new Error("Account sync is not available right now.");
  }

  const { error } = await context.supabase
    .from("assessments")
    .delete()
    .eq("id", assessmentId)
    .eq("user_id", context.userId);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error));
  }
}

export async function migrateGuestWorkspaceToSupabase({
  supabase,
  userId
}: {
  supabase: SupabaseBrowserClient;
  userId: string;
}) {
  const guestData = readGuestWorkspaceData();

  if (!hasGuestWorkspaceData()) {
    clearGuestWorkspaceData();
    return;
  }

  const idMap = new Map<string, string>();

  const semesterRows = guestData.semesters.map((semester) => ({
    id: ensureUuid(semester.id, idMap),
    user_id: userId,
    name: semester.name,
    academic_year: semester.academic_year,
    term: semester.term,
    created_at: semester.created_at
  }));
  const courseRows = guestData.courses.map((course) => ({
    id: ensureUuid(course.id, idMap),
    user_id: userId,
    semester_id: ensureUuid(course.semester_id, idMap),
    name: course.name,
    code: course.code,
    credit_hours: Number(course.credit_hours) || 3,
    instructor: course.instructor ?? null,
    instructor_email: course.instructor_email ?? null,
    schedule: course.schedule ?? null,
    classroom: course.classroom ?? null,
    office_hours: course.office_hours ?? null,
    prerequisites: course.prerequisites ?? null,
    textbooks: course.textbooks ?? null,
    description: course.description ?? null,
    term: course.term ?? null,
    created_at: course.created_at
  }));
  const assessmentRows = guestData.assessments.map((assessment) => {
    const name = assessment.name ?? assessment.title ?? "Assessment";
    const weight = Number(assessment.weight_percentage ?? assessment.weight ?? 0);

    return {
      id: ensureUuid(assessment.id, idMap),
      user_id: userId,
      course_id: ensureUuid(assessment.course_id, idMap),
      name,
      weight_percentage: weight,
      score: assessment.score,
      max_score: assessment.max_score,
      category: assessment.category,
      title: name,
      weight,
      created_at: assessment.created_at
    };
  });
  const verifiedExtractionRows = readGuestVerifiedExtractions().map((row) => ({
    ...(row as Record<string, unknown>),
    id: undefined,
    user_id: userId
  }));

  if (semesterRows.length > 0) {
    const { error } = await supabase
      .from("semesters")
      .upsert(semesterRows, { onConflict: "id" });

    if (error) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  }

  if (courseRows.length > 0) {
    let response = await supabase
      .from("courses")
      .upsert(courseRows, { onConflict: "id" });

    if (response.error && /column|schema cache|does not exist/i.test(response.error.message)) {
      response = await supabase.from("courses").upsert(
        courseRows.map((course) => ({
          created_at: course.created_at,
          code: course.code,
          credit_hours: course.credit_hours,
          id: course.id,
          name: course.name,
          semester_id: course.semester_id,
          user_id: course.user_id
        })),
        { onConflict: "id" }
      );
    }

    if (response.error) {
      throw new Error(getSupabaseErrorMessage(response.error));
    }
  }

  if (assessmentRows.length > 0) {
    let response = await supabase
      .from("assessments")
      .upsert(assessmentRows, { onConflict: "id" });

    if (isMissingAssessmentOptionalColumnError(response.error)) {
      response = await supabase
        .from("assessments")
        .upsert(getCoreAssessmentPayloads(assessmentRows), {
          onConflict: "id"
        });
    }

    if (response.error) {
      throw new Error(getSupabaseErrorMessage(response.error));
    }
  }

  if (verifiedExtractionRows.length > 0) {
    const { error } = await supabase
      .from("verified_extractions")
      .insert(verifiedExtractionRows);

    if (error && !/verified_extractions|schema cache|does not exist/i.test(error.message)) {
      throw new Error(getSupabaseErrorMessage(error));
    }
  }

  if (guestData.degreePlan) {
    await saveDegreePlanSettings(
      {
        isGuest: false,
        supabase,
        userId
      },
      guestData.degreePlan
    );
  }

  clearGuestWorkspaceData();
  clearGuestVerifiedExtractions();
}
