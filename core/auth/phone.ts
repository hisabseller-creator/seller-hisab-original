export function normalizeIndiaMobile(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local)) {
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  }
  return `91${local}`;
}

export function formatIndiaMobile(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local)
    ? `+91 ${local.slice(0, 5)} ${local.slice(5)}`
    : value;
}
