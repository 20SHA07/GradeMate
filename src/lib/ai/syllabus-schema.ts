import { z } from "zod";

export const AssessmentSchema = z.object({
  name: z.string().min(1),
  weight_percentage: z.number().min(0).max(100),
  max_score: z.number().positive().nullable().optional(),
  category: z.string().min(1).default("Planned"),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export const SyllabusExtractionSchema = z.object({
  course: z.object({
    code: z.string().nullable().optional(),
    name: z.string().min(1),
    credit_hours: z.number().positive().nullable().optional(),
    instructor: z.string().nullable().optional()
  }),
  assessments: z.array(AssessmentSchema),
  gradingScale: z
    .array(
      z.object({
        label: z.string().min(1),
        minimumPercent: z.number().min(0).max(100)
      })
    )
    .default([]),
  policies: z.array(z.string()).default([])
});

export type SyllabusExtraction = z.infer<typeof SyllabusExtractionSchema>;
