import type { Metadata } from "next";
import { tablesOverview } from "@/lib/orders";
import { requireStaff } from "@/lib/staff";
import TablesBoard from "./TablesBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tables · tappetite", robots: { index: false, follow: false } };

export default async function TablesPage() {
  const staff = await requireStaff();
  return (
    <TablesBoard
      initial={await tablesOverview(staff.business_id)}
      staffName={staff.name}
      isManager={staff.role === "manager"}
    />
  );
}
