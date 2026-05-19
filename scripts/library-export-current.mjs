import {
  createCourseLibraryBackup,
  printBackupSummary
} from "./library-backup-utils.mjs";

try {
  const backup = await createCourseLibraryBackup({ reason: "manual export" });
  printBackupSummary(backup);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
