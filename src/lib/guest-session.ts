import {
  clearGuestWorkspaceData,
  createLocalId,
  emptyGuestWorkspaceData,
  guestUser,
  hasGuestWorkspaceData,
  readGuestWorkspaceData,
  startGuestWorkspace,
  writeGuestWorkspaceData,
  type GuestWorkspaceData
} from "@/lib/data/workspace-store";

export { guestUser };

export type GuestData = GuestWorkspaceData;

export const emptyGuestData = emptyGuestWorkspaceData;

export function hasGuestSession() {
  return true;
}

export function startGuestSession() {
  startGuestWorkspace();
}

export function endGuestSession() {
  clearGuestWorkspaceData();
}

export function hasGuestData() {
  return hasGuestWorkspaceData();
}

export function readGuestData(): GuestData {
  return readGuestWorkspaceData();
}

export function writeGuestData(data: Partial<GuestData>) {
  writeGuestWorkspaceData({
    ...readGuestWorkspaceData(),
    ...data,
    semesters: data.semesters ?? readGuestWorkspaceData().semesters,
    courses: data.courses ?? readGuestWorkspaceData().courses,
    assessments: data.assessments ?? readGuestWorkspaceData().assessments,
    importedTemplates:
      data.importedTemplates ?? readGuestWorkspaceData().importedTemplates,
    gpaCalculator: data.gpaCalculator ?? readGuestWorkspaceData().gpaCalculator
  });
}

export function createGuestId(prefix?: string) {
  void prefix;
  return createLocalId();
}
