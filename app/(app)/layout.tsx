import type { ReactNode } from "react";
import { AppGate } from "@/components/app-gate";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppGate>{children}</AppGate>;
}
