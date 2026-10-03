import type { Metadata } from "next";
import { ProfileView } from "@/components/views/profile";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return <ProfileView />;
}
