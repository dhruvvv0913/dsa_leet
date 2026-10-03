import type { Difficulty, LeetCodeProblem } from "./types";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Pulls the problem slug out of anything an admin might paste:
 *   https://leetcode.com/problems/missing-number/
 *   https://leetcode.com/problems/missing-number/description/?envType=study-plan
 *   leetcode.com/problems/missing-number
 *   missing-number
 */
export function parseLeetCodeSlug(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const match = value.match(/leetcode\.(?:com|cn)\/(?:problems|explore\/[^/]+\/[^/]+\/[^/]+)\/([a-z0-9-]+)/i);
  if (match) return match[1].toLowerCase();
  const bare = value.toLowerCase();
  return SLUG_RE.test(bare) ? bare : null;
}

export function isValidSlug(slug: string) {
  return SLUG_RE.test(slug) && slug.length <= 120;
}

/** Best-effort title when LeetCode can't be reached: "two-sum-ii" -> "Two Sum Ii" */
export function slugToTitle(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function problemUrl(slug: string) {
  return `https://leetcode.com/problems/${slug}/`;
}

export function profileUrl(username: string) {
  return `https://leetcode.com/u/${encodeURIComponent(username)}/`;
}

export function isDifficulty(value: unknown): value is Difficulty {
  return value === "Easy" || value === "Medium" || value === "Hard";
}

/** Asks our own API route, which talks to LeetCode server-side. Falls back to the slug. */
export async function lookupProblem(slug: string): Promise<LeetCodeProblem> {
  try {
    const res = await fetch(`/api/leetcode?slug=${encodeURIComponent(slug)}`);
    if (res.ok) return (await res.json()) as LeetCodeProblem;
  } catch {
    // fall through to the offline guess
  }
  return { slug, number: null, title: slugToTitle(slug), difficulty: null, url: problemUrl(slug), verified: false };
}

// LeetCode usernames: letters, digits, underscores, hyphens, dots.
export const LEETCODE_USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{1,38}[A-Za-z0-9_]$/;
