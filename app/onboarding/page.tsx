import type { Metadata } from "next";
import { OnboardingView } from "@/components/views/onboarding";

export const metadata: Metadata = { title: "Welcome" };

export default function OnboardingPage() {
  return <OnboardingView />;
}
