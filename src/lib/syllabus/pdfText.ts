import { getAppBasePath } from "@/lib/routes";
import { extractTextFromDocxFile } from "@/lib/syllabus/docxText";

type PdfTextItem = {
  str?: unknown;
  transform?: unknown;
  width?: unknown;
};

const assessmentNamePattern =
  /\b(quiz|quizzes|exam|midterm|final|assignment|homework|lab|project|participation|attendance|presentation|report|essay|portfolio|discussion|tutorial|practical|test|case study|coursework|laboratory)s?\b/i;
const weightOnlyPattern = /^(\d{1,3}(?:\.\d+)?)\s*(%|percent|percentage)?$/i;

export async function extractTextFromPdfFile(file: File) {
  const data = new Uint8Array(await file.arrayBuffer());

  if (data[0] === 0x50 && data[1] === 0x4b) {
    return extractTextFromDocxFile(file);
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = `${getAppBasePath()}/pdf.worker.min.mjs`;
  const documentTask = pdfjs.getDocument({ data });
  const pdf = await documentTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textItemsToLines(textContent.items as PdfTextItem[]);
    pages.push(`--- Page ${pageNumber} ---\n${pageText}`);
  }

  return normalizeExtractedPdfText(pages.join("\n\n"));
}

function getPdfItemPosition(item: PdfTextItem) {
  if (!Array.isArray(item.transform) || item.transform.length < 6) {
    return { x: 0, y: 0 };
  }

  const x = Number(item.transform[4]);
  const y = Number(item.transform[5]);

  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0
  };
}

function textItemsToLines(items: PdfTextItem[]) {
  const textItems = items
    .filter((item) => typeof item.str === "string" && item.str.trim())
    .map((item) => {
      const { x, y } = getPdfItemPosition(item);

      return {
        text: String(item.str).trim(),
        width: Number(item.width) || 0,
        x,
        y
      };
    })
    .sort((first, second) => {
      const yDelta = second.y - first.y;
      return Math.abs(yDelta) > 2 ? yDelta : first.x - second.x;
    });
  const lines: Array<{ y: number; items: Array<{ text: string; x: number; width: number }> }> = [];

  textItems.forEach((item) => {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5);

    if (line) {
      line.items.push(item);
      line.y = (line.y + item.y) / 2;
      return;
    }

    lines.push({ y: item.y, items: [item] });
  });

  return lines
    .sort((first, second) => second.y - first.y)
    .map((line) =>
      joinPdfLineItems(
        line.items.sort((first, second) => first.x - second.x)
      )
    )
    .filter(Boolean)
    .join("\n");
}

function joinPdfLineItems(items: Array<{ text: string; x: number; width: number }>) {
  return items
    .reduce((line, item, index, sortedItems) => {
      const text = item.text.trim();

      if (!text) {
        return line;
      }

      if (!line) {
        return text;
      }

      const previous = sortedItems[index - 1];
      const previousRight = previous ? previous.x + previous.width : item.x;
      const gap = item.x - previousRight;
      const separator = gap > 16 || /^[,.;:%)]/.test(text) ? " " : " ";

      return `${line}${separator}${text}`;
    }, "")
    .replace(/\s+([%:;,.)])/g, "$1")
    .replace(/([(])\s+/g, "$1")
    .trim();
}

function normalizeExtractedPdfText(text: string) {
  const cleanedLines = text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+%/g, "%")
    .replace(/(\d)\s+%/g, "$1%")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const mergedLines: string[] = [];

  cleanedLines.forEach((line) => {
    const bareWeightMatch = line.match(/^(.*)\s+(\d{1,3}(?:\.\d+)?)$/);
    const normalizedLine =
      bareWeightMatch &&
      assessmentNamePattern.test(bareWeightMatch[1]) &&
      Number(bareWeightMatch[2]) >= 0 &&
      Number(bareWeightMatch[2]) <= 100 &&
      !/%|percent|percentage|\d+\s*\/\s*\d+/i.test(line)
        ? `${bareWeightMatch[1]} ${bareWeightMatch[2]}%`
        : line;
    const previous = mergedLines[mergedLines.length - 1];

    if (
      previous &&
      assessmentNamePattern.test(previous) &&
      !/(\d{1,3}(?:\.\d+)?)\s*(%|percent|percentage)\b/i.test(previous) &&
      weightOnlyPattern.test(normalizedLine)
    ) {
      mergedLines[mergedLines.length - 1] = `${previous} ${normalizedLine}`;
      return;
    }

    mergedLines.push(normalizedLine);
  });

  return mergedLines.join("\n");
}
