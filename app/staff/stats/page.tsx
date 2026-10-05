import { redirect } from "next/navigation";

/** Statistics became the Dashboard; old links still land there. */
export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const q = new URLSearchParams(await searchParams).toString();
  redirect(`/staff/dashboard${q ? `?${q}` : ""}`);
}
