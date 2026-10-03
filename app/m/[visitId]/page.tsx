import type { Metadata, Viewport } from "next";
import Expired from "@/app/components/Expired";
import { loadMenu } from "@/lib/menu";
import { liveVisit } from "@/lib/visits";
import MenuApp from "./MenuApp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };
// The menu's header is light, so the phone's status bar is too.
export const viewport: Viewport = { themeColor: "#F5F6F2" };

export default async function MenuPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const visit = await liveVisit(visitId);
  if (!visit) return <Expired />;
  const menu = await loadMenu(visit);
  if (!menu) return <Expired />;
  // A tag not placed at a table has no waiter to send to.
  return <MenuApp visitId={visitId} menu={menu} expiresAt={visit.expires_at} canSend={!!visit.sitting_id} />;
}
