import type {
  AssessmentRecord,
  CourseRecord,
  SemesterRecord
} from "@/types/database";

const guestSessionKey = "grademate_guest_session";
const guestDataKey = "grademate_guest_data";

export const guestUser = {
  id: "guest-user",
  email: "Guest session"
};

export type GuestData = {
  semesters: SemesterRecord[];
  courses: CourseRecord[];
  assessments: AssessmentRecord[];
};

export const emptyGuestData: GuestData = {
  semesters: [],
  courses: [],
  assessments: []
};

function canUseSessionStorage() {
  return typeof window !== "undefined" && "sessionStorage" in window;
}

export function hasGuestSession() {
  return canUseSessionStorage() && sessionStorage.getItem(guestSessionKey) === "true";
}

export function startGuestSession() {
  if (!canUseSessionStorage()) {
    return;
  }

  sessionStorage.setItem(guestSessionKey, "true");
}

export function endGuestSession() {
  if (!canUseSessionStorage()) {
    return;
  }

  sessionStorage.removeItem(guestSessionKey);
  sessionStorage.removeItem(guestDataKey);
}

export function readGuestData(): GuestData {
  if (!canUseSessionStorage()) {
    return emptyGuestData;
  }

  const rawData = sessionStorage.getItem(guestDataKey);

  if (!rawData) {
    return emptyGuestData;
  }

  try {
    const parsedData = JSON.parse(rawData) as Partial<GuestData>;
    return {
      semesters: parsedData.semesters ?? [],
      courses: parsedData.courses ?? [],
      assessments: parsedData.assessments ?? []
    };
  } catch {
    return emptyGuestData;
  }
}

export function writeGuestData(data: GuestData) {
  if (!canUseSessionStorage()) {
    return;
  }

  sessionStorage.setItem(guestDataKey, JSON.stringify(data));
}

export function createGuestId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
