import type { Metadata, Viewport } from "next";
import { cache } from "react";
import Expired from "@/app/components/Expired";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { loadMenu } from "@/lib/menu";
import { hex, palette, paletteCss } from "@/lib/palettes";
import { DEMO_TAG, liveVisit } from "@/lib/visits";
import MenuApp from "./MenuApp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Once per request: the page and its viewport both need the menu. */
const load = cache(async (visitId: string) => {
  const visit = await liveVisit(visitId);
  const menu = visit && (await loadMenu(visit));
  return visit && menu ? { visit, menu } : null;
});

// The menu's header is light, so the phone's status bar is too: the page's
// background, in the restaurant's palette when it picked one.
export async function generateViewport({ params }: { params: Promise<{ visitId: string }> }): Promise<Viewport> {
  const c = palette((await load((await params).visitId))?.menu.palette);
  return { themeColor: c ? hex(c.paper) : "#FFF9E7" };
}

export default async function MenuPage({ params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const loaded = await load(visitId);
  if (!loaded) return <Expired />;
  const { visit, menu } = loaded;
  const colors = palette(menu.palette);
  // A tag not placed at a table has no waiter to send to.
  return (
    <>
      {/* The backdrop's cream shapes belong to Design A's default colours. */}
      {colors ? <style>{paletteCss(colors)}</style> : menu.design === "a" && <WarmBackdrop />}
      <MenuApp
        visitId={visitId}
        menu={menu}
        expiresAt={visit.expires_at}
        canSend={!!visit.sitting_id}
        demo={visit.tag_id === DEMO_TAG}
      />
    </>
  );
}
