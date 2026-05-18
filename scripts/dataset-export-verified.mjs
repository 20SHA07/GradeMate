import { promises as fs } from "node:fs";
import path from "node:path";

const outputDir = path.join("training-data", "verified-json");
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before exporting verified examples."
  );
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  }
});

const { data, error } = await supabase
  .from("verified_extractions")
  .select("*")
  .order("created_at", { ascending: false });

if (error) {
  console.error(error.message);
  process.exit(1);
}

await fs.mkdir(outputDir, { recursive: true });

for (const row of data ?? []) {
  const confirmed = row.confirmed_json ?? {};
  const baseName =
    [confirmed.courseCode, confirmed.courseName, row.id]
      .filter(Boolean)
      .join("_")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) || row.id;
  const filePath = path.join(outputDir, `${baseName}.json`);

  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        ...confirmed,
        source: {
          id: row.id,
          sourceType: row.source_type,
          sourceFileName: row.source_file_name,
          sourceTextHash: row.source_text_hash,
          userFeedback: row.user_feedback,
          extractorVersion: row.extractor_version,
          confidence: row.confidence,
          totalWeight: row.total_weight,
          createdAt: row.created_at
        }
      },
      null,
      2
    )
  );
}

console.log(`Exported ${(data ?? []).length} verified examples to ${outputDir}`);
