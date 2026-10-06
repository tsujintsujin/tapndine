import type { Metadata } from "next";
import { requireStaff } from "@/lib/staff";
import { linksPage } from "@/lib/tables";
import Shell from "../Shell";
import LinksBoard from "./LinksBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NFC links · tapndine", robots: { index: false, follow: false } };

export default async function LinksPage() {
  const me = await requireStaff("manager");
  return (
    <Shell name={me.name}>
      <LinksBoard {...await linksPage(me.business_id)} />
    </Shell>
  );
}
