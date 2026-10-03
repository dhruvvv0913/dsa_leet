"use client";

import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompressedImage } from "../image";
import type {
  AttendanceSheet,
  LeaderboardCriteria,
  Question,
  QuestionInput,
  Role,
  SessionInput,
  SessionStatus,
  Submission,
} from "../types";
import { useData } from "./provider";

export const keys = {
  viewer: ["viewer"] as const,
  sessions: ["sessions"] as const,
  mySubmissions: ["my-submissions"] as const,
  overview: ["admin", "overview"] as const,
  people: ["admin", "people"] as const,
  grid: (sessionId: string) => ["admin", "grid", sessionId] as const,
  attendance: (sessionId: string) => ["admin", "attendance", sessionId] as const,
  leaderboard: (criteria: LeaderboardCriteria) => ["leaderboard", criteria] as const,
  screenshot: (path: string) => ["screenshot", path] as const,
};

// ---------- reads ----------

export function useViewer() {
  const data = useData();
  return useQuery({ queryKey: keys.viewer, queryFn: () => data.getViewer(), staleTime: 60_000 });
}

export function useSessions(enabled = true) {
  const data = useData();
  return useQuery({ queryKey: keys.sessions, queryFn: () => data.listSessions(), enabled });
}

export function useMySubmissions(enabled = true) {
  const data = useData();
  return useQuery({ queryKey: keys.mySubmissions, queryFn: () => data.listMySubmissions(), enabled });
}

export function useScreenshotUrl(submission: Submission | null) {
  const data = useData();
  return useQuery({
    queryKey: keys.screenshot(submission?.screenshotPath ?? "none"),
    queryFn: () => data.getScreenshotUrl(submission!),
    enabled: !!submission && !!submission.screenshotPath,
    staleTime: 8 * 60_000,
  });
}

export function useOverview() {
  const data = useData();
  return useQuery({ queryKey: keys.overview, queryFn: () => data.getOverview() });
}

export function usePeople() {
  const data = useData();
  return useQuery({ queryKey: keys.people, queryFn: () => data.listPeople() });
}

export function useGrid(sessionId: string | null) {
  const data = useData();
  return useQuery({
    queryKey: keys.grid(sessionId ?? "none"),
    queryFn: () => data.getGrid(sessionId!),
    enabled: !!sessionId,
  });
}

// ---------- student writes ----------

export function useUploadingCount(questionId: string) {
  return useIsMutating({ mutationKey: ["submit", questionId] });
}

export function useSubmitScreenshot(question: Question) {
  const data = useData();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["submit", question.id],
    mutationFn: (image: CompressedImage) => data.submitScreenshot(question.id, image),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: keys.mySubmissions });
      const previous = qc.getQueryData<Submission[]>(keys.mySubmissions);
      const now = new Date().toISOString();
      const existing = previous?.find((s) => s.questionId === question.id);
      const optimistic: Submission = existing
        ? { ...existing, updatedAt: now }
        : { id: `pending-${question.id}`, userId: "me", questionId: question.id, screenshotPath: "", submittedAt: now, updatedAt: now };
      qc.setQueryData<Submission[]>(keys.mySubmissions, (old = []) => [
        ...old.filter((s) => s.questionId !== question.id),
        optimistic,
      ]);
      return { previous };
    },
    onError: (_error, _image, context) => {
      if (context?.previous) qc.setQueryData(keys.mySubmissions, context.previous);
    },
    onSuccess: (submission) => {
      qc.setQueryData<Submission[]>(keys.mySubmissions, (old = []) => [
        ...old.filter((s) => s.questionId !== question.id),
        submission,
      ]);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.mySubmissions });
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useRemoveSubmission() {
  const data = useData();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => data.removeSubmission(questionId),
    onMutate: async (questionId) => {
      await qc.cancelQueries({ queryKey: keys.mySubmissions });
      const previous = qc.getQueryData<Submission[]>(keys.mySubmissions);
      qc.setQueryData<Submission[]>(keys.mySubmissions, (old = []) => old.filter((s) => s.questionId !== questionId));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) qc.setQueryData(keys.mySubmissions, context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.mySubmissions });
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useUpdateProfile() {
  const data = useData();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leetcodeUsername: string) => data.updateProfile({ leetcodeUsername }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.viewer });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

// ---------- admin writes ----------

function useAdminMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>, alsoSessions = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      if (alsoSessions) {
        qc.invalidateQueries({ queryKey: keys.sessions });
        qc.invalidateQueries({ queryKey: keys.mySubmissions });
      }
      qc.invalidateQueries({ queryKey: keys.viewer });
    },
  });
}

export function useAddPeople() {
  const data = useData();
  return useAdminMutation((vars: { emails: string[]; role: Role }) => data.addPeople(vars.emails, vars.role));
}

export function useSetRole() {
  const data = useData();
  return useAdminMutation((vars: { email: string; role: Role }) => data.setRole(vars.email, vars.role));
}

export function useRemovePerson() {
  const data = useData();
  return useAdminMutation((email: string) => data.removePerson(email));
}

export function useCreateSession() {
  const data = useData();
  return useAdminMutation((input: SessionInput) => data.createSession(input), true);
}

export function useUpdateSession() {
  const data = useData();
  return useAdminMutation((vars: { id: string; input: SessionInput }) => data.updateSession(vars.id, vars.input), true);
}

export function useSetSessionStatus() {
  const data = useData();
  return useAdminMutation(
    (vars: { id: string; status: SessionStatus }) => data.setSessionStatus(vars.id, vars.status),
    true,
  );
}

export function useDeleteSession() {
  const data = useData();
  return useAdminMutation((id: string) => data.deleteSession(id), true);
}

export function useCreateQuestion() {
  const data = useData();
  return useAdminMutation((input: QuestionInput) => data.createQuestion(input), true);
}

export function useUpdateQuestion() {
  const data = useData();
  return useAdminMutation((vars: { id: string; input: QuestionInput }) => data.updateQuestion(vars.id, vars.input), true);
}

export function useDeleteQuestion() {
  const data = useData();
  return useAdminMutation((id: string) => data.deleteQuestion(id), true);
}

export function useMoveQuestion() {
  const data = useData();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; direction: -1 | 1 }) => data.moveQuestion(vars.id, vars.direction),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.sessions });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

// ---------- leaderboard & attendance ----------

export function useLeaderboard(criteria: LeaderboardCriteria) {
  const data = useData();
  return useQuery({
    queryKey: keys.leaderboard(criteria),
    queryFn: () => data.getLeaderboard(criteria),
    placeholderData: (previous) => previous,
  });
}

export function useAttendance(sessionId: string | null) {
  const data = useData();
  return useQuery({
    queryKey: keys.attendance(sessionId ?? "none"),
    queryFn: () => data.getAttendance(sessionId!),
    enabled: !!sessionId,
  });
}

export function useSetAttendance(sessionId: string) {
  const data = useData();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { emails: string[]; present: boolean | null }) =>
      data.setAttendance(sessionId, vars.emails, vars.present),
    onMutate: async ({ emails, present }) => {
      const key = keys.attendance(sessionId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<AttendanceSheet>(key);
      const changed = new Set(emails);
      if (previous) {
        qc.setQueryData<AttendanceSheet>(key, {
          ...previous,
          rows: previous.rows.map((r) => (changed.has(r.email) ? { ...r, present } : r)),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(keys.attendance(sessionId), context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.attendance(sessionId) });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}
