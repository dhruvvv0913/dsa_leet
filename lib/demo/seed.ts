import type { DemoPersona } from "../data/client";
import { dayOffset } from "../format";
import { problemUrl } from "../leetcode";
import type { Question, Role, Session, Submission } from "../types";
import { CATALOG } from "./catalog";

export const DEMO_STATE_VERSION = 6;

export interface DemoProfile {
  id: string;
  email: string;
  fullName: string | null;
  leetcodeUsername: string | null;
  createdAt: string;
}

export interface DemoAllowed {
  email: string;
  role: Role;
  createdAt: string;
}

export interface DemoAttendance {
  sessionId: string;
  email: string;
  present: boolean;
}

export interface DemoState {
  version: number;
  seededAt: string;
  persona: DemoPersona | null;
  allowed: DemoAllowed[];
  profiles: DemoProfile[];
  sessions: Session[];
  questions: Question[];
  submissions: Submission[];
  attendance: DemoAttendance[];
}

/** Stand-in accounts for preview mode, until real Google sign-in is connected. */
export const DEMO_USERS = {
  student: { id: "u-preview-student", email: "student@example.com", fullName: null },
  instructor: { id: "u-preview-instructor", email: "instructor@example.com", fullName: "Instructor" },
  outsider: { id: "u-preview-outsider", email: "not.enrolled@example.com", fullName: null },
} as const;

export const PERSONA_USER: Record<DemoPersona, keyof typeof DEMO_USERS> = {
  student: "student",
  instructor: "instructor",
  outsider: "outsider",
};

/** Class starts 7:00 pm IST on the class date. */
function classStart(day: string) {
  return new Date(`${day}T13:30:00.000Z`).getTime();
}

/** A fresh cohort on Day 1: Session 1 is live, one enrolled student, nothing submitted yet. */
export function buildSeed(now = new Date()): DemoState {
  const createdAt = now.toISOString();
  const sessions: Session[] = [];
  const questions: Question[] = [];

  for (const entry of CATALOG) {
    const id = `s-${entry.number}`;
    const day = dayOffset(entry.dayOffset, now);
    sessions.push({
      id,
      number: entry.number,
      title: entry.title,
      description: entry.description,
      classDate: day,
      recordingUrl: null,
      notesUrl: null,
      status: entry.status,
      publishedAt: entry.status === "published" ? new Date(Math.min(classStart(day), now.getTime())).toISOString() : null,
      createdAt,
    });
    (["class", "homework"] as const).forEach((kind) => {
      entry[kind].forEach(([slug, lcNumber, title, difficulty, hint], index) => {
        questions.push({
          id: `q-s${entry.number}-${kind === "class" ? "c" : "h"}${index + 1}`,
          sessionId: id,
          kind,
          position: index + 1,
          lcNumber,
          title,
          leetcodeUrl: problemUrl(slug),
          difficulty,
          hint: hint ?? null,
        });
      });
    });
  }

  return {
    version: DEMO_STATE_VERSION,
    seededAt: createdAt,
    persona: null,
    allowed: [
      { email: DEMO_USERS.instructor.email, role: "admin", createdAt },
      { email: DEMO_USERS.student.email, role: "student", createdAt },
    ],
    profiles: [
      { id: DEMO_USERS.instructor.id, email: DEMO_USERS.instructor.email, fullName: DEMO_USERS.instructor.fullName, leetcodeUsername: null, createdAt },
    ],
    sessions,
    questions,
    submissions: [],
    attendance: [],
  };
}
