import type { Metadata } from "next";
import { AttendanceView } from "@/components/admin/attendance";

export const metadata: Metadata = { title: "Attendance · Admin" };

export default function AttendancePage() {
  return <AttendanceView />;
}
