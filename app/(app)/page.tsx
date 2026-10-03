import type { Metadata } from "next";
import { DashboardView } from "@/components/views/dashboard";

export const metadata: Metadata = { title: "Sessions" };

export default function DashboardPage() {
  return <DashboardView />;
}
