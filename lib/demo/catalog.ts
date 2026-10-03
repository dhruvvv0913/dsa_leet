import type { Difficulty, SessionStatus } from "../types";

// [slug, LeetCode number, title, difficulty, hint]
export type CatalogQuestion = [string, number, string, Difficulty, string?];

export interface CatalogSession {
  number: number;
  title: string;
  description: string;
  /** days relative to today (0 = today) */
  dayOffset: number;
  status: SessionStatus;
  class: CatalogQuestion[];
  homework: CatalogQuestion[];
}

/**
 * Course content used when the site runs without a database (preview mode).
 * Keep in sync with supabase/seed.sql, which loads the same Day 1 into the real database.
 * Numbers, titles and difficulties are checked against LeetCode.
 */
export const CATALOG: CatalogSession[] = [
  {
    number: 1,
    title: "Complexity Analysis + Math & Logic Building",
    description:
      "How to measure what an algorithm costs (Big-O for time and space), then number puzzles that train the habit of spotting patterns before writing code.",
    dayOffset: 0,
    status: "published",
    class: [
      ["palindrome-number", 9, "Palindrome Number", "Easy"],
      ["missing-number", 268, "Missing Number", "Easy", "Solve it with the sum formula — it comes back in S2 with XOR"],
      ["nim-game", 292, "Nim Game", "Easy"],
      ["bulb-switcher", 319, "Bulb Switcher", "Medium"],
      ["add-digits", 258, "Add Digits", "Easy"],
      ["find-greatest-common-divisor-of-array", 1979, "Find Greatest Common Divisor of Array", "Easy"],
    ],
    homework: [
      ["fizz-buzz", 412, "Fizz Buzz", "Easy"],
      ["number-of-steps-to-reduce-a-number-to-zero", 1342, "Number of Steps to Reduce a Number to Zero", "Easy"],
      ["find-numbers-with-even-number-of-digits", 1295, "Find Numbers with Even Number of Digits", "Easy"],
      ["count-the-digits-that-divide-a-number", 2520, "Count the Digits That Divide a Number", "Easy"],
      ["perfect-number", 507, "Perfect Number", "Easy"],
      ["ugly-number", 263, "Ugly Number", "Easy"],
      ["power-of-three", 326, "Power of Three", "Easy"],
      ["factorial-trailing-zeroes", 172, "Factorial Trailing Zeroes", "Medium"],
      ["count-primes", 204, "Count Primes", "Medium"],
      ["stone-game", 877, "Stone Game", "Medium"],
    ],
  },
];
