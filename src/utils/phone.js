/**
 * Normalizes a phone number for duplicate-detection purposes.
 * Strips spaces, dashes, parens, and leading "00" -> "+".
 * This is intentionally simple; swap in a proper libphonenumber-js
 * implementation once you need real country-code-aware parsing
 * (recommended before Phase 1 ships broadly across multiple countries).
 */
function normalizePhone(raw) {
  if (!raw) return null;

  let digits = raw.replace(/[^\d+]/g, "");

  if (digits.startsWith("00")) {
    digits = "+" + digits.slice(2);
  }

  // If no country code prefix at all, leave as-is — caller should
  // ideally supply the user's default country code for local numbers.
  return digits;
}

module.exports = { normalizePhone };
