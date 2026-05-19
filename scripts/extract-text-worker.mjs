import { extractDocumentText } from "./dataset-utils.mjs";

const [filePath, optionsJson = "{}"] = process.argv.slice(2);

if (!filePath) {
  console.error("Missing file path");
  process.exit(1);
}

try {
  const options = JSON.parse(optionsJson);
  const result = await extractDocumentText(filePath, options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
