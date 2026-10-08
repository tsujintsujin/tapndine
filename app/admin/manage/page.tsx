import type { Metadata } from "next";
import { listStaff, requireStaff } from "@/lib/staff";
import ManageStaff from "./ManageStaff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Staff · tapndine", robots: { index: false, follow: false } };

export default async function ManagePage() {
  const me = await requireStaff("manager");
  return <ManageStaff me={me.id} name={me.name} staff={await listStaff(me.business_id)} />;
}
