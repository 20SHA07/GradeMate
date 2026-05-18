import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workerCandidates = [
  path.join(rootDir, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs"),
  path.join(
    rootDir,
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.min.mjs"
  )
];
const publicDir = path.join(rootDir, "public");
const destination = path.join(publicDir, "pdf.worker.min.mjs");

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyPdfWorker() {
  const source = await workerCandidates.reduce(async (matchPromise, candidate) => {
    const match = await matchPromise;

    if (match) {
      return match;
    }

    return (await fileExists(candidate)) ? candidate : "";
  }, Promise.resolve(""));

  if (!source) {
    throw new Error(
      "Could not find pdf.worker.min.mjs in pdfjs-dist. Run npm install first."
    );
  }

  await mkdir(publicDir, { recursive: true });
  await copyFile(source, destination);
  console.log(`Copied PDF.js worker to ${path.relative(rootDir, destination)}`);
}

await copyPdfWorker();
