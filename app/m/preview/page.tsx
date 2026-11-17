import type { Metadata } from "next";
import WarmBackdrop from "@/app/components/WarmBackdrop";
import { db } from "@/lib/cf";
import { loadMenu } from "@/lib/menu";
import { palette, paletteCss } from "@/lib/palettes";
import { requireStaff } from "@/lib/staff";
import MenuApp from "../[visitId]/MenuApp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Menu preview · tappetite", robots: { index: false, follow: false } };

/** The home rows the preview can open on. */
const ROWS = ["row-featured", "row-new"];

/**
 * The manager's own menu as a guest sees it, for the preview on the Homepage
 * page. Outside /admin so the staff alerts (and their chime) don't run in it.
 * Nothing can be sent from it, and it starts no visit, even with ?table=.
 */
export default async function MenuPreviewPage({ searchParams }: { searchParams: Promise<{ row?: string; table?: string }> }) {
  const me = await requireStaff("manager");
  const { row, table } = await searchParams;
  // From NFC links' Open: show that table's name, only if it is this restaurant's table.
  const own =
    table &&
    (await db().prepare("SELECT id FROM tables WHERE id = ? AND business_id = ?").bind(table, me.business_id).first<{ id: string }>());
  const menu = await loadMenu({ business_id: me.business_id, table_id: own ? own.id : null });
  if (!menu) return null;
  const colors = palette(menu.palette);
  return (
    <>
      {colors ? <style>{paletteCss(colors)}</style> : menu.design === "a" && <WarmBackdrop />}
      <MenuApp
        visitId="preview"
        menu={menu}
        expiresAt={Date.now() + 864e5}
        canSend={false}
        demo={false}
        preview
        startAt={row && ROWS.includes(row) ? row : undefined}
      />
    </>
  );
}
