import type { Metadata } from "next";
import { OverviewView } from "@/components/admin/overview";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return <OverviewView />;
}
