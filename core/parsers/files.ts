import JSZip from "jszip";
import Papa from "papaparse";
import { PARSER_VERSION, type ParsedReport, type ParserIssue } from "../types";
import { parseTabularSource } from "./tabular";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_ZIP_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const MAX_ZIP_FILES = 20;
const MAX_COMPRESSION_RATIO = 100;

export type BrowserFileInput = {
  name: string;
  buffer: ArrayBuffer;
};

export type ParsedFileBundle = {
  reports: ParsedReport[];
  issues: ParserIssue[];
  fingerprints: string[];
};

export async function parseBrowserFiles(
  files: BrowserFileInput[],
  onProgress?: (message: string, percent: number) => void,
): Promise<ParsedFileBundle> {
  const reports: ParsedReport[] = [];
  const issues: ParserIssue[] = [];
  const fingerprints: string[] = [];
  const seenFiles = new Set<string>();

  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const file = files[fileIndex];
    onProgress?.("Reading file", Math.round((fileIndex / Math.max(1, files.length)) * 22));
    if (file.buffer.byteLength > MAX_FILE_BYTES) {
      issues.push({
        code: "unsupported_file",
        severity: "critical",
        message: `${file.name} is larger than the 50 MB V1 limit. Split it by period and retry.`,
      });
      continue;
    }
    const fingerprint = await sha256(file.buffer);
    if (seenFiles.has(fingerprint)) {
      issues.push({
        code: "duplicate_file",
        severity: "warning",
        message: `${file.name} is a duplicate and was ignored.`,
      });
      continue;
    }
    seenFiles.add(fingerprint);
    fingerprints.push(fingerprint);

    if (file.name.toLowerCase().endsWith(".zip")) {
      const nested = await extractSafeZip(file, issues);
      for (const entry of nested) {
        const entryFingerprint = await sha256(entry.buffer);
        if (seenFiles.has(entryFingerprint)) {
          issues.push({ code: "duplicate_file", severity: "warning", message: `${entry.name} inside ${file.name} is a duplicate and was ignored.` });
          continue;
        }
        seenFiles.add(entryFingerprint);
        fingerprints.push(entryFingerprint);
        reports.push(...await parseSingle(entry, entryFingerprint));
      }
    } else {
      reports.push(...await parseSingle(file, fingerprint));
    }
  }

  onProgress?.("Mapping columns", 35);
  for (const report of reports) issues.push(...report.issues);
  return { reports, issues, fingerprints };
}

async function parseSingle(file: BrowserFileInput, fingerprint: string): Promise<ParsedReport[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(file.buffer);
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy", delimiter: lower.endsWith(".tsv") || lower.endsWith(".txt") ? "\t" : "" });
    if (parsed.errors.some((error) => error.type === "Quotes" || error.type === "Delimiter")) {
      return [
        {
          reportType: "diagnostic",
          supportState: "unrecognized",
          adapterId: "unrecognized",
          parserVersion: PARSER_VERSION,
          sourceFingerprint: fingerprint,
          events: [],
          adCosts: [],
          issues: [{ code: "unknown_format", severity: "critical", message: `${file.name} contains malformed CSV structure and was not used.` }],
          ignoredColumns: [],
        },
      ];
    }
    return [parseTabularSource({ fileName: file.name, sheetName: "CSV", fingerprint, rows: parsed.data })];
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX=await import("xlsx");
    const workbook = XLSX.read(file.buffer, { type: "array", cellDates: true, dense: true });
    return workbook.SheetNames.map((sheetName) => {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      });
      return parseTabularSource({ fileName: file.name, sheetName, fingerprint, rows });
    }).filter((report) => report.events.length > 0 || report.adCosts.length > 0 || (report.settlementEvidence?.length ?? 0) > 0 || (report.settlementBatches?.length ?? 0) > 0 || report.issues.some((issue) => issue.severity === "critical"));
  }
  return [
    {
      reportType: "diagnostic",
      supportState: "unrecognized",
      adapterId: "unsupported",
      parserVersion: PARSER_VERSION,
      sourceFingerprint: fingerprint,
      events: [],
      adCosts: [],
      issues: [{ code: "unsupported_file", severity: "critical", message: `${file.name} is not a supported XLSX, CSV, TSV, TXT or ZIP report.` }],
      ignoredColumns: [],
    },
  ];
}

async function extractSafeZip(file: BrowserFileInput, issues: ParserIssue[]): Promise<BrowserFileInput[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file.buffer, { checkCRC32: true, createFolders: false });
  } catch {
    issues.push({ code: "unsafe_archive", severity: "critical", message: `${file.name} is corrupt or failed ZIP integrity checks.` });
    return [];
  }
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_ZIP_FILES) {
    issues.push({ code: "unsafe_archive", severity: "critical", message: `${file.name} contains too many files. Maximum supported is ${MAX_ZIP_FILES}.` });
    return [];
  }
  let uncompressedTotal = 0;
  const output: BrowserFileInput[] = [];
  for (const entry of entries) {
    const originalName = (entry as unknown as { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
    const normalizedName = originalName.replace(/\\/g, "/");
    const lower = normalizedName.toLowerCase();
    if (normalizedName.startsWith("/") || normalizedName.split("/").includes("..") || /\.zip$/i.test(lower)) {
      issues.push({ code: "unsafe_archive", severity: "critical", message: `${file.name} contains a nested or unsafe archive path.` });
      return [];
    }
    if (normalizedName.length > 240) {
      issues.push({ code: "unsafe_archive", severity: "critical", message: `${file.name} contains an archive entry with an unsafe filename length.` });
      return [];
    }
    if (!/\.(xlsx|xls|csv|tsv|txt)$/i.test(lower)) {
      issues.push({ code: "unsupported_file", severity: "critical", message: `${normalizedName} inside ${file.name} is unsupported.` });
      continue;
    }
    // JSZip exposes central-directory sizes after loadAsync. Enforce those
    // BEFORE decompression so a declared ZIP bomb is rejected before memory is
    // allocated for the expanded entry. Post-decompression checks below remain
    // as a second boundary in case archive metadata is inconsistent.
    const metadata = (entry as unknown as { _data?: { compressedSize?: number; uncompressedSize?: number } })._data;
    const declaredCompressed = Number(metadata?.compressedSize ?? 0);
    const declaredUncompressed = Number(metadata?.uncompressedSize ?? 0);
    if (!Number.isSafeInteger(declaredUncompressed) || declaredUncompressed < 0 || declaredUncompressed > MAX_FILE_BYTES) {
      issues.push({ code: "unsafe_archive", severity: "critical", message: `${normalizedName} declares an unsafe expanded size.` });
      return [];
    }
    if (uncompressedTotal + declaredUncompressed > MAX_ZIP_UNCOMPRESSED_BYTES) {
      issues.push({ code: "unsafe_archive", severity: "critical", message: `${file.name} declares more than the safe total expanded size.` });
      return [];
    }
    if (declaredCompressed > 0 && declaredUncompressed / declaredCompressed > MAX_COMPRESSION_RATIO) {
      issues.push({ code: "unsafe_archive", severity: "critical", message: `${normalizedName} declares an unsafe compression ratio.` });
      return [];
    }
    const bytes = await entry.async("uint8array");
    uncompressedTotal += bytes.byteLength;
    if (uncompressedTotal > MAX_ZIP_UNCOMPRESSED_BYTES || bytes.byteLength > MAX_FILE_BYTES) {
      issues.push({ code: "unsafe_archive", severity: "critical", message: `${file.name} expands beyond safe V1 limits.` });
      return [];
    }
    const compressedSize = declaredCompressed || bytes.byteLength;
    if (compressedSize > 0 && bytes.byteLength / compressedSize > MAX_COMPRESSION_RATIO) {
      issues.push({ code: "unsafe_archive", severity: "critical", message: `${normalizedName} has an unsafe compression ratio.` });
      return [];
    }
    output.push({ name: normalizedName.split("/").pop() ?? normalizedName, buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer });
  }
  return output;
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
