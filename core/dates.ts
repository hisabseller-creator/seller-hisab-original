/**
 * Deterministic date parsing for financially material inputs.
 *
 * Rules:
 * - ISO/RFC3339-like values are accepted explicitly.
 * - Slash/dash numeric dates default to Indian DMY order; they are never
 *   delegated to the host runtime's locale parser.
 * - Excel serial dates are supported intentionally.
 * - Unknown/ambiguous free-form strings fail closed instead of being guessed.
 */
export type FinancialDateOrder = "dmy" | "mdy";

export type ParseFinancialDateOptions = {
  numericDateOrder?: FinancialDateOrder;
  assumeUtcForTimezoneLessIso?: boolean;
  allowExcelSerial?: boolean;
};

const DAY_MS = 86_400_000;
const EXCEL_UNIX_EPOCH_SERIAL = 25569; // Excel serial 25569 == 1970-01-01 (1900 date system)

export function parseFinancialDate(
  value: unknown,
  options: ParseFinancialDateOptions = {},
): string | undefined {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : undefined;
  }

  if (typeof value === "number") {
    return options.allowExcelSerial === false ? undefined : parseExcelSerialDate(value);
  }

  const raw = String(value ?? "").trim();
  if (!raw) return undefined;

  if (options.allowExcelSerial !== false && /^\d{1,7}(?:\.\d+)?$/.test(raw)) {
    const numeric = Number(raw);
    // A plain 8-digit YYYYMMDD is not an Excel serial; the supported serial
    // range intentionally covers practical workbook dates only.
    if (numeric >= 1 && numeric <= 2_958_465) {
      const excel = parseExcelSerialDate(numeric);
      if (excel) return excel;
    }
  }

  const iso = parseExplicitIso(raw, options.assumeUtcForTimezoneLessIso === true);
  if (iso) return iso;

  const numeric = parseNumericDate(raw, options.numericDateOrder ?? "dmy");
  if (numeric) return numeric;

  const named = parseNamedMonthDate(raw);
  if (named) return named;

  return undefined;
}

export function parseFinancialTimestamp(value: unknown, options?: ParseFinancialDateOptions): number | undefined {
  const iso = parseFinancialDate(value, options);
  if (!iso) return undefined;
  const timestamp = Date.parse(iso);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function isCanonicalIsoDate(value: string): boolean {
  return parseExplicitIso(value.trim(), false) !== undefined;
}

function parseExcelSerialDate(serial: number): string | undefined {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return undefined;
  const milliseconds = Math.round((serial - EXCEL_UNIX_EPOCH_SERIAL) * DAY_MS);
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function parseExplicitIso(raw: string, assumeUtc: boolean): string | undefined {
  // Date only. Always represent it as midnight UTC so period boundaries do not
  // depend on the machine/browser locale.
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    return utcDate(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]), 0, 0, 0, 0);
  }

  // ISO timestamp with T or a single space. A timezone-less timestamp is only
  // accepted when the caller explicitly states that the provider defines it as UTC.
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(?:\s*(Z|[+-]\d{2}:?\d{2}|UTC))?$/i,
  );
  if (!match) return undefined;

  const [, y, mo, d, h, mi, s = "0", fraction = "", zoneRaw] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  const millisecond = Number((fraction + "000").slice(0, 3));
  if (!validClock(hour, minute, second, millisecond)) return undefined;
  if (!validCalendarDate(year, month, day)) return undefined;

  const zone = zoneRaw?.toUpperCase();
  if (!zone) {
    if (!assumeUtc) return undefined;
    return utcDate(year, month, day, hour, minute, second, millisecond);
  }
  if (zone === "Z" || zone === "UTC") {
    return utcDate(year, month, day, hour, minute, second, millisecond);
  }

  const normalizedZone = zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const timestamp = Date.parse(
    `${y}-${mo}-${d}T${h}:${mi}:${String(second).padStart(2, "0")}.${String(millisecond).padStart(3, "0")}${normalizedZone}`,
  );
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function parseNumericDate(raw: string, order: FinancialDateOrder): string | undefined {
  const match = raw.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i,
  );
  if (!match) return undefined;

  const first = Number(match[1]);
  const second = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const day = order === "dmy" ? first : second;
  const month = order === "dmy" ? second : first;
  if (!validCalendarDate(year, month, day)) return undefined;

  let hour = match[4] === undefined ? 0 : Number(match[4]);
  const minute = match[5] === undefined ? 0 : Number(match[5]);
  const secondValue = match[6] === undefined ? 0 : Number(match[6]);
  const ampm = match[7]?.toUpperCase();
  if (ampm) {
    if (hour < 1 || hour > 12) return undefined;
    if (hour === 12) hour = 0;
    if (ampm === "PM") hour += 12;
  }
  if (!validClock(hour, minute, secondValue, 0)) return undefined;
  return utcDate(year, month, day, hour, minute, secondValue, 0);
}

function parseNamedMonthDate(raw: string): string | undefined {
  const match = raw.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) return undefined;
  const months: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
    may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9,
    sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  const month = months[match[2].toLowerCase()];
  if (!month) return undefined;
  const year = Number(match[3]);
  const day = Number(match[1]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0);
  if (!validCalendarDate(year, month, day) || !validClock(hour, minute, second, 0)) return undefined;
  return utcDate(year, month, day, hour, minute, second, 0);
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validClock(hour: number, minute: number, second: number, millisecond: number): boolean {
  return Number.isInteger(hour) && hour >= 0 && hour <= 23
    && Number.isInteger(minute) && minute >= 0 && minute <= 59
    && Number.isInteger(second) && second >= 0 && second <= 59
    && Number.isInteger(millisecond) && millisecond >= 0 && millisecond <= 999;
}

function utcDate(year: number, month: number, day: number, hour: number, minute: number, second: number, millisecond: number): string | undefined {
  if (!validCalendarDate(year, month, day) || !validClock(hour, minute, second, millisecond)) return undefined;
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond)).toISOString();
}
