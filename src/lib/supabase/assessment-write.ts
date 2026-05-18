type AssessmentWritePayload = {
  category?: string | null;
  course_id?: string;
  created_at?: string;
  id?: string;
  max_score?: number | null;
  name?: string | null;
  score?: number | null;
  title?: string | null;
  user_id?: string;
  weight?: number | null;
  weight_percentage?: number | null;
};

const optionalAssessmentColumns = ["category", "title", "weight"];

function getErrorMessage(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : "";
}

export function isMissingAssessmentOptionalColumnError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return optionalAssessmentColumns.some(
    (column) =>
      message.includes(`'${column}' column`) ||
      message.includes(`\"${column}\" column`) ||
      message.includes(`column ${column}`)
  );
}

export function getCoreAssessmentPayload<T extends AssessmentWritePayload>(
  payload: T
) {
  const { category, title, weight, ...corePayload } = payload;
  void category;
  void title;
  void weight;

  return corePayload;
}

export function getCoreAssessmentPayloads<T extends AssessmentWritePayload>(
  payloads: T[]
) {
  return payloads.map((payload) => getCoreAssessmentPayload(payload));
}
