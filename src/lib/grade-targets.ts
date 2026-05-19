export const targetGradeOptions = [
  { label: "A", value: 93 },
  { label: "A-", value: 90 },
  { label: "B+", value: 87 },
  { label: "B", value: 83 },
  { label: "B-", value: 80 },
  { label: "C+", value: 77 },
  { label: "C", value: 73 },
  { label: "C-", value: 70 },
  { label: "D", value: 60 }
] as const;

export function getTargetDifficultyTone(neededAverage: number | null) {
  if (neededAverage === null) {
    return "ink" as const;
  }

  if (neededAverage > 100) {
    return "rose" as const;
  }

  if (neededAverage >= 90) {
    return "gold" as const;
  }

  return "teal" as const;
}

export function getTargetDifficultyLabel(neededAverage: number | null) {
  if (neededAverage === null) {
    return "Needs remaining work";
  }

  if (neededAverage > 100) {
    return "Impossible";
  }

  if (neededAverage >= 90) {
    return "Hard";
  }

  return "Possible";
}
