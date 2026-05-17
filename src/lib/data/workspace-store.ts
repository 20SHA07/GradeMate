import type { SupabaseBrowserClient } from "@/lib/supabase/client";
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

export type GuestWorkspaceData = {
  semesters: SemesterRecord[];
  courses: CourseRecord[];
  assessments: AssessmentRecord[];
  importedTemplates: ImportedTemplateRecord[];
  gpaCalculator: GpaCalculatorData;
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
  email: "Guest workspace"
};

export const emptyGuestWorkspaceData: GuestWorkspaceData = {
  semesters: [],
  courses: [],
  assessments: [],
  importedTemplates: [],
  gpaCalculator: {},
  updatedAt: null
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
    updatedAt: data?.updatedAt ?? null
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
    Object.keys(data.gpaCalculator).length > 0
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
    throw new Error(error.message);
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
    throw new Error(error.message);
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
    throw new Error(error.message);
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
    throw new Error("Supabase is not available.");
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
    throw new Error(error?.message ?? "Could not create semester.");
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
    throw new Error("Supabase is not available.");
  }

  const { data, error } = await context.supabase
    .from("semesters")
    .update(updates)
    .eq("id", semesterId)
    .eq("user_id", context.userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
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
    throw new Error("Supabase is not available.");
  }

  const { error } = await context.supabase
    .from("semesters")
    .delete()
    .eq("id", semesterId)
    .eq("user_id", context.userId);

  if (error) {
    throw new Error(error.message);
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
    throw new Error("Supabase is not available.");
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
    throw new Error(error?.message ?? "Could not create course.");
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
    throw new Error("Supabase is not available.");
  }

  const { data, error } = await context.supabase
    .from("courses")
    .update(updates)
    .eq("id", courseId)
    .eq("user_id", context.userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
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
    throw new Error("Supabase is not available.");
  }

  const { error } = await context.supabase
    .from("courses")
    .delete()
    .eq("id", courseId)
    .eq("user_id", context.userId);

  if (error) {
    throw new Error(error.message);
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
    throw new Error("Supabase is not available.");
  }

  const { data, error } = await context.supabase
    .from("assessments")
    .insert({
      user_id: context.userId,
      course_id: input.course_id,
      name,
      weight_percentage: weight,
      score: input.score ?? null,
      max_score: input.max_score ?? null,
      category: input.category ?? "Planned",
      title: name,
      weight
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create assessment.");
  }

  return data as AssessmentRecord;
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
    throw new Error("Supabase is not available.");
  }

  const { data, error } = await context.supabase
    .from("assessments")
    .update(updates)
    .eq("id", assessmentId)
    .eq("user_id", context.userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AssessmentRecord;
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
    throw new Error("Supabase is not available.");
  }

  const { error } = await context.supabase
    .from("assessments")
    .delete()
    .eq("id", assessmentId)
    .eq("user_id", context.userId);

  if (error) {
    throw new Error(error.message);
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

  if (semesterRows.length > 0) {
    const { error } = await supabase
      .from("semesters")
      .upsert(semesterRows, { onConflict: "id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  if (courseRows.length > 0) {
    const { error } = await supabase
      .from("courses")
      .upsert(courseRows, { onConflict: "id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  if (assessmentRows.length > 0) {
    const { error } = await supabase
      .from("assessments")
      .upsert(assessmentRows, { onConflict: "id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  clearGuestWorkspaceData();
}
