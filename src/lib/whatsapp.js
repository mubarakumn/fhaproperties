export function normalizeWhatsAppPhone(phone) {
  const raw = String(phone ?? "").trim();
  let digits = raw.replace(/\D/g, "");

  if (raw.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("234") && digits.length >= 11 && digits.length <= 15) {
    return digits;
  }

  if (
    (raw.startsWith("+") || raw.startsWith("00")) &&
    digits.length >= 8 &&
    digits.length <= 15
  ) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `234${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `234${digits}`;
  }

  return "";
}
