export function normalizeTemplateKeyPart(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

export function buildCourseTemplateUniqueKey({
  courseCode,
  courseName,
  fallbackId,
  semester,
  sourceHash,
  sourceName
}: {
  courseCode: string | null | undefined;
  courseName: string | null | undefined;
  fallbackId?: string | null;
  semester?: string | null;
  sourceHash?: string | null;
  sourceName?: string | null;
}) {
  const code = normalizeTemplateKeyPart(courseCode) || "unknown-code";
  const name = normalizeTemplateKeyPart(courseName) || "unknown-course";
  const term = normalizeTemplateKeyPart(semester);

  if (term) {
    return `${code}::${name}::${term}`;
  }

  const sourceSuffix =
    normalizeTemplateKeyPart(sourceHash).slice(0, 12) ||
    normalizeTemplateKeyPart(sourceName).slice(0, 48) ||
    normalizeTemplateKeyPart(fallbackId).slice(0, 12) ||
    "unknown-source";

  return `${code}::${name}::unknown::${sourceSuffix}`;
}
