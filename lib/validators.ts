import { z } from "zod";
import { LEETCODE_USERNAME_RE } from "./leetcode";

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine((value) => value === null || /^https?:\/\/\S+$/i.test(value), "Must be a full link starting with https://");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

export const leetcodeUsernameSchema = z
  .string()
  .trim()
  .min(3, "That's too short for a LeetCode username")
  .max(40, "That's too long for a LeetCode username")
  .regex(LEETCODE_USERNAME_RE, "Use letters, numbers, dots, dashes or underscores — no spaces or @");

export const sessionSchema = z.object({
  number: z.coerce.number().int("Whole number only").min(1, "Starts at 1").max(999),
  title: z.string().trim().min(2, "Give the session a title").max(120),
  description: optionalText(2000),
  classDate: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), "Pick a date"),
  recordingUrl: optionalUrl,
  notesUrl: optionalUrl,
});

export const questionSchema = z.object({
  kind: z.enum(["class", "homework"]),
  lcNumber: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .nullable()
    .refine((value) => value === null || (Number.isInteger(value) && value > 0), "Problem numbers are whole numbers"),
  title: z.string().trim().min(1, "Title is required").max(200),
  leetcodeUrl: z
    .string()
    .trim()
    .regex(/^https:\/\/leetcode\.(com|cn)\/problems\/[a-z0-9-]+\/?$/i, "Paste a leetcode.com/problems/… link"),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  hint: optionalText(200),
});

export function firstError(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the form";
}

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
