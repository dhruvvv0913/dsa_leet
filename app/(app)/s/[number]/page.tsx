import type { Metadata } from "next";
import { SessionView } from "@/components/views/session";

export async function generateMetadata({ params }: PageProps<"/s/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: `S${number}` };
}

export default async function SessionPage({ params }: PageProps<"/s/[number]">) {
  const { number } = await params;
  return <SessionView number={Number(number)} />;
}
