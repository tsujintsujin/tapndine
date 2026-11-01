import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/app/login/LoginForm";
import { BASE_PATH } from "@/lib/base";
import { env } from "@/lib/cf";
import { pendingEmail } from "@/lib/signup";
import { currentLogin } from "@/lib/staff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Try tapndine free",
  description: "Start a free 7-day trial of tapndine: your menu online and orders to your waiter's phone.",
  manifest: `${BASE_PATH}/staff.webmanifest`,
};

/** The free trial's sign-up, and the way back in for managers who signed up with email or Google. */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await currentLogin();
  if (me) redirect(me.role === "developer" ? "/admin/dev" : me.role === "waiter" ? "/admin" : "/admin/dashboard");
  return (
    <LoginForm start pending={await pendingEmail()} google={!!env().GOOGLE_CLIENT_ID} startError={(await searchParams).error} />
  );
}
