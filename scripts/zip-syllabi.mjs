import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import {
  collectedFilesDir,
  indexCsvPath,
  indexJsonPath,
  zipPath
} from "./syllabi-collector-utils.mjs";

let crcTable = null;
const files = [];

if (fsSync.existsSync(collectedFilesDir)) {
  for (const fileName of await fs.readdir(collectedFilesDir)) {
    const filePath = path.join(collectedFilesDir, fileName);
    const stats = await fs.stat(filePath);

    if (stats.isFile()) {
      files.push({
        sourcePath: filePath,
        zipName: `files/${fileName}`
      });
    }
  }
}

for (const indexPath of [indexJsonPath, indexCsvPath]) {
  if (fsSync.existsSync(indexPath)) {
    files.push({
      sourcePath: indexPath,
      zipName: path.basename(indexPath)
    });
  }
}

if (files.length === 0) {
  console.error("No collected syllabi or index files found. Run syllabi:collect first.");
  process.exit(1);
}

await fs.mkdir(path.dirname(zipPath), { recursive: true });
await fs.writeFile(zipPath, buildZip(await Promise.all(files.map(readZipEntry))));

console.log(`Created zip: ${zipPath}`);
console.log(`Files included: ${files.length}`);

async function readZipEntry(entry) {
  const data = await fs.readFile(entry.sourcePath);
  const stats = await fs.stat(entry.sourcePath);

  return {
    ...entry,
    data,
    modifiedAt: stats.mtime
  };
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.zipName.replace(/\\/g, "/"), "utf8");
    const crc = crc32(entry.data);
    const { dosTime, dosDate } = toDosDateTime(entry.modifiedAt);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileName, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, fileName);

    offset += localHeader.length + fileName.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function toDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());

  return {
    dosTime:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    dosDate:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate()
  };
}

function crc32(buffer) {
  crcTable ??= buildCrcTable();
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  return new Uint32Array(256).map((_, index) => {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    return value >>> 0;
  });
}
