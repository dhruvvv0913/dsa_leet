import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmissionsView } from "@/components/admin/submissions";

export const metadata: Metadata = { title: "Submissions · Admin" };

export default function SubmissionsPage() {
  return (
    <Suspense>
      <SubmissionsView />
    </Suspense>
  );
}
