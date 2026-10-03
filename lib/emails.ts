const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

export function isValidEmail(email: string) {
  return EMAIL_RE.test(email);
}

/**
 * Gmail ignores dots and "+tags" in the local part, so foo.bar@gmail.com and
 * FooBar+dsa@googlemail.com are the same inbox. Mirrors public.normalize_email() in SQL.
 */
export function normalizeEmail(email: string) {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at < 1) return lower;
  const local = lower.slice(0, at);
  const domain = lower.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
  }
  return lower;
}

/**
 * Accepts a pasted list or CSV contents: one email per line, or separated by
 * commas, semicolons, spaces or tabs. Header rows and names are ignored —
 * anything without an "@" is skipped, anything with one is validated.
 */
export function parseEmailList(text: string) {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  const tokens = text.split(/[\s,;]+/);
  for (const raw of tokens) {
    const token = raw.replace(/^[<"'(]+|[>"')]+$/g, "").replace(/^mailto:/i, "").trim().toLowerCase();
    if (!token || !token.includes("@")) continue;
    if (!isValidEmail(token)) {
      if (!invalid.includes(token)) invalid.push(token);
      continue;
    }
    const key = normalizeEmail(token);
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(token);
  }
  return { valid, invalid };
}
