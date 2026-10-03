import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionsAdminView } from "@/components/admin/sessions";

export const metadata: Metadata = { title: "Sessions · Admin" };

export default function SessionsAdminPage() {
  return (
    <Suspense>
      <SessionsAdminView />
    </Suspense>
  );
}
