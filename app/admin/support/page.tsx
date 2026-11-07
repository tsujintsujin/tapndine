import type { Metadata } from "next";
import { requireStaff } from "@/lib/staff";
import { PageHead } from "../kit";
import Shell from "../Shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Support · tapndine", robots: { index: false, follow: false } };

/** Settings > Support: empty for now. */
export default async function SupportPage() {
  const me = await requireStaff("manager");
  return (
    <Shell name={me.name}>
      <PageHead title="Support" />
    </Shell>
  );
}
