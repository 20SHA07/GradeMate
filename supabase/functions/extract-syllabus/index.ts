import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "npm:zod@3.24.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const AssessmentSchema = z.object({
  name: z.string().min(1),
  weight_percentage: z.number().min(0).max(100),
  max_score: z.number().positive().nullable(),
  category: z.string().min(1),
  dueDate: z.string().nullable(),
  notes: z.string().nullable()
});

const SyllabusExtractionSchema = z.object({
  course: z.object({
    code: z.string().nullable(),
    name: z.string().min(1),
    credit_hours: z.number().positive().nullable(),
    instructor: z.string().nullable()
  }),
  assessments: z.array(AssessmentSchema),
  gradingScale: z.array(
    z.object({
      label: z.string().min(1),
      minimumPercent: z.number().min(0).max(100)
    })
  ),
  policies: z.array(z.string())
});

const syllabusJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["course", "assessments", "gradingScale", "policies"],
  properties: {
    course: {
      type: "object",
      additionalProperties: false,
      required: ["code", "name", "credit_hours", "instructor"],
      properties: {
        code: { type: ["string", "null"] },
        name: { type: "string" },
        credit_hours: { type: ["number", "null"] },
        instructor: { type: ["string", "null"] }
      }
    },
    assessments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "weight_percentage",
          "max_score",
          "category",
          "dueDate",
          "notes"
        ],
        properties: {
          name: { type: "string" },
          weight_percentage: { type: "number", minimum: 0, maximum: 100 },
          max_score: { type: ["number", "null"] },
          category: { type: "string" },
          dueDate: { type: ["string", "null"] },
          notes: { type: ["string", "null"] }
        }
      }
    },
    gradingScale: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "minimumPercent"],
        properties: {
          label: { type: "string" },
          minimumPercent: { type: "number", minimum: 0, maximum: 100 }
        }
      }
    },
    policies: {
      type: "array",
      items: { type: "string" }
    }
  }
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    },
    status
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function getResponseText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const output = Array.isArray(response.output) ? response.output : [];

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];

    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") {
        continue;
      }

      const text = (contentItem as { text?: unknown }).text;

      if (typeof text === "string") {
        return text;
      }
    }
  }

  return "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let requestPayload: Record<string, unknown> | null = null;

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      return jsonResponse(
        { error: "OPENAI_API_KEY is not configured for this Edge Function." },
        500
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = request.headers.get("Authorization");

    if (!supabaseUrl || !supabaseAnonKey || !authorization) {
      return jsonResponse({ error: "Missing Supabase auth context." }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authorization }
      }
    });

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "User is not authenticated." }, 401);
    }

    requestPayload = await request.json();
    const uploadId = String(requestPayload.uploadId ?? "");
    const courseId = String(requestPayload.courseId ?? "");
    const filePath = String(requestPayload.filePath ?? "");

    if (!uploadId || !courseId || !filePath) {
      return jsonResponse(
        { error: "uploadId, courseId, and filePath are required." },
        400
      );
    }

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .eq("user_id", user.id)
      .single();

    if (courseError || !course) {
      return jsonResponse({ error: "Course not found." }, 404);
    }

    const { data: upload, error: uploadError } = await supabase
      .from("syllabus_uploads")
      .select("*")
      .eq("id", uploadId)
      .eq("course_id", courseId)
      .eq("user_id", user.id)
      .single();

    if (uploadError || !upload || upload.file_path !== filePath) {
      return jsonResponse({ error: "Syllabus upload not found." }, 404);
    }

    await supabase
      .from("syllabus_uploads")
      .update({
        status: "extracting",
        error: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", uploadId)
      .eq("user_id", user.id);

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("syllabi")
      .download(filePath);

    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message ?? "Could not download PDF.");
    }

    const base64Pdf = arrayBufferToBase64(await fileBlob.arrayBuffer());
    const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-5-mini";
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "Extract course and grading information from a college syllabus PDF. Return only data that is present or strongly implied. Use Planned for assessment category unless a clearer category is present."
          },
          {
            role: "user",
            content: [
              {
                type: "input_file",
                filename: upload.original_filename,
                file_data: `data:application/pdf;base64,${base64Pdf}`
              },
              {
                type: "input_text",
                text:
                  "Extract the course code, course name, credit hours, instructor, weighted assessments, grading scale, and key grading policies. Assessment weights must be percentages totaling near 100 when the syllabus provides enough information."
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "syllabus_extraction",
            strict: true,
            schema: syllabusJsonSchema
          }
        }
      }),
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      method: "POST"
    });

    const openaiJson = await openaiResponse.json();

    if (!openaiResponse.ok) {
      throw new Error(
        openaiJson?.error?.message ?? "OpenAI syllabus extraction failed."
      );
    }

    const outputText = getResponseText(openaiJson);
    const parsedJson = JSON.parse(outputText);
    const extraction = SyllabusExtractionSchema.parse(parsedJson);

    const courseUpdate = {
      code: extraction.course.code || course.code,
      name: extraction.course.name || course.name,
      credit_hours: extraction.course.credit_hours ?? course.credit_hours
    };

    const { data: updatedCourse, error: updateCourseError } = await supabase
      .from("courses")
      .update(courseUpdate)
      .eq("id", courseId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateCourseError) {
      throw new Error(updateCourseError.message);
    }

    const assessmentRows = extraction.assessments.map((assessment) => ({
      user_id: user.id,
      course_id: courseId,
      name: assessment.name,
      weight_percentage: assessment.weight_percentage,
      score: null,
      max_score: assessment.max_score,
      category: assessment.category || "Planned",
      title: assessment.name,
      weight: assessment.weight_percentage
    }));

    const { data: createdAssessments, error: createAssessmentsError } =
      assessmentRows.length > 0
        ? await supabase.from("assessments").insert(assessmentRows).select()
        : { data: [], error: null };

    if (createAssessmentsError) {
      throw new Error(createAssessmentsError.message);
    }

    const { data: updatedUpload } = await supabase
      .from("syllabus_uploads")
      .update({
        status: "extracted",
        extraction,
        error: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", uploadId)
      .eq("user_id", user.id)
      .select()
      .single();

    return jsonResponse({
      upload: updatedUpload,
      course: updatedCourse,
      assessments: createdAssessments ?? [],
      extraction
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    try {
      const uploadId = String(requestPayload?.uploadId ?? "");
      const authorization = request.headers.get("Authorization");
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

      if (uploadId && authorization && supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authorization } }
        });

        await supabase
          .from("syllabus_uploads")
          .update({
            status: "error",
            error: message,
            updated_at: new Date().toISOString()
          })
          .eq("id", uploadId);
      }
    } catch {
      // The original extraction error is more useful than status update errors.
    }

    return jsonResponse({ error: message }, 500);
  }
});
