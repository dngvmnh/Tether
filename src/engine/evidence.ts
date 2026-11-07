/**
 * Evidence verification: every quote shown to a user must appear verbatim (modulo
 * whitespace, case and typographic punctuation) in the source it is attributed to.
 * This is Tether's main guard against LLM-invented citations.
 */
export function normalizeForQuote(s: string): string {
  return s
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function verifyQuote(quote: string, source: string): boolean {
  const q = normalizeForQuote(quote);
  if (q.length < 8) return false; // too short to be meaningful evidence
  return normalizeForQuote(source).includes(q);
}
