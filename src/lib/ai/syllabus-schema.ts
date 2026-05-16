import { z } from "zod";

export const AssessmentSchema = z.object({
  title: z.string().min(1),
  weight: z.number().min(0).max(100),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export const SyllabusExtractionSchema = z.object({
  course: z.object({
    code: z.string().min(1),
    title: z.string().min(1),
    credits: z.number().positive().nullable().optional(),
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
