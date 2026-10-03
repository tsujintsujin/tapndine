import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/staff";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff login · tapndine", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await currentStaff()) redirect("/staff");
  return <LoginForm />;
}
