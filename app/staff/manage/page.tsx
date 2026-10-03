import type { Metadata } from "next";
import { listStaff, requireStaff } from "@/lib/staff";
import ManageStaff from "./ManageStaff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff · tapndine", robots: { index: false, follow: false } };

export default async function ManagePage() {
  const me = await requireStaff("manager");
  return <ManageStaff me={me.id} staff={await listStaff(me.business_id)} />;
}
