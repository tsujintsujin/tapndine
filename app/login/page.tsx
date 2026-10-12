import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BASE_PATH } from "@/lib/base";
import { currentLogin } from "@/lib/staff";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
// The staff app installed to a phone opens here, so the login carries the same manifest as /admin.
export const metadata: Metadata = {
  title: "Log in · tapndine",
  robots: { index: false, follow: false },
  manifest: `${BASE_PATH}/staff.webmanifest`,
  appleWebApp: { capable: true, title: "tapndine", statusBarStyle: "default" },
};

export default async function LoginPage() {
  const me = await currentLogin();
  if (me) redirect(me.role === "developer" ? "/admin/dev" : me.role === "waiter" ? "/admin" : "/admin/dashboard");
  return <LoginForm />;
}
