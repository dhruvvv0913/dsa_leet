import type { Metadata } from "next";
import { SessionEditorView } from "@/components/admin/session-editor";

export const metadata: Metadata = { title: "Edit session · Admin" };

export default async function SessionEditorPage({ params }: PageProps<"/admin/sessions/[id]">) {
  const { id } = await params;
  return <SessionEditorView id={id} />;
}
