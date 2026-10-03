import type { Metadata } from "next";
import { NotEnrolledView } from "@/components/views/not-enrolled";

export const metadata: Metadata = { title: "Not enrolled" };

export default function NotEnrolledPage() {
  return <NotEnrolledView />;
}
