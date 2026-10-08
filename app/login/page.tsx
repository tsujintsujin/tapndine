import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentLogin } from "@/lib/staff";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Log in · tapndine", robots: { index: false, follow: false } };

export default async function LoginPage() {
  const me = await currentLogin();
  if (me) redirect(me.role === "developer" ? "/admin/dev" : me.role === "waiter" ? "/admin" : "/admin/dashboard");
  return <LoginForm />;
}
