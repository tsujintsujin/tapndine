import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/app/login/LoginForm";
import { BASE_PATH } from "@/lib/base";
import { env } from "@/lib/cf";
import { pendingEmail } from "@/lib/signup";
import { currentLogin } from "@/lib/staff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Create your account · tapndine",
  description: "Create a tapndine account for your restaurant or cafe, then start a free 7-day trial or buy a plan.",
  manifest: `${BASE_PATH}/staff.webmanifest`,
};

/** Creating an owner's account: email and password or Google, then the free trial or a plan to buy. */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await currentLogin();
  if (me) redirect(me.role === "developer" ? "/admin/dev" : me.role === "waiter" ? "/admin" : "/admin/dashboard");
  return (
    <LoginForm start pending={await pendingEmail()} google={!!env().GOOGLE_CLIENT_ID} startError={(await searchParams).error} />
  );
}
