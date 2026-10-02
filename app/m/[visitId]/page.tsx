import type { Metadata } from "next";
import Expired from "@/app/components/Expired";
import { loadMenu } from "@/lib/menu";
import { touchVisit } from "@/lib/visits";
import MenuApp from "./MenuApp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MenuPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  // Opening the page counts as activity: it pushes the expiry out again.
  const visit = await touchVisit(visitId);
  if (!visit) return <Expired />;
  const menu = await loadMenu(visit);
  if (!menu) return <Expired />;
  return <MenuApp visitId={visitId} menu={menu} />;
}
