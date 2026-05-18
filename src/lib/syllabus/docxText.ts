const docxXmlFiles = [
  "word/document.xml",
  "word/header1.xml",
  "word/header2.xml",
  "word/footer1.xml"
];

export async function extractTextFromDocxFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const xmlParts = await extractZipEntries(bytes, docxXmlFiles);
  const text = xmlParts.map(docxXmlToText).join("\n\n");

  return normalizeExtractedDocxText(text);
}

async function extractZipEntries(bytes: Uint8Array, wantedNames: string[]) {
  const wanted = new Set(wantedNames);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findEndOfCentralDirectory(view);
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true);
  const totalEntries = view.getUint16(endOffset + 10, true);
  const values: string[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("Invalid DOCX central directory");
    }

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileName = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + fileNameLength)
    );

    if (wanted.has(fileName)) {
      values.push(
        await readZipLocalEntry(bytes, {
          compressedSize,
          compressionMethod,
          localHeaderOffset
        })
      );
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  if (values.length === 0) {
    throw new Error("DOCX did not contain document text");
  }

  return values;
}

function findEndOfCentralDirectory(view: DataView) {
  const minOffset = Math.max(0, view.byteLength - 65557);

  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("Could not read DOCX zip directory");
}

async function readZipLocalEntry(
  bytes: Uint8Array,
  entry: {
    compressedSize: number;
    compressionMethod: number;
    localHeaderOffset: number;
  }
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localHeaderOffset;

  if (view.getUint32(offset, true) !== 0x04034b50) {
    throw new Error("Invalid DOCX local file header");
  }

  const fileNameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return new TextDecoder().decode(compressed);
  }

  if (entry.compressionMethod === 8) {
    return inflateRaw(compressed);
  }

  throw new Error(`Unsupported DOCX compression method: ${entry.compressionMethod}`);
}

async function inflateRaw(compressed: Uint8Array) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DOCX decompression is not available in this browser");
  }

  const compressedBuffer = compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength
  ) as ArrayBuffer;
  const stream = new Blob([compressedBuffer]).stream().pipeThrough(
    new DecompressionStream("deflate-raw")
  );
  const inflated = await new Response(stream).arrayBuffer();

  return new TextDecoder().decode(inflated);
}

function docxXmlToText(xml: string) {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<\/w:tc>/g, "\n")
      .replace(/<\/w:tr>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
  );
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeExtractedDocxText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+%/g, "%")
    .replace(/(\d)\s+%/g, "$1%")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
