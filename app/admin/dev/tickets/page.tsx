import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { restaurantLogo, restaurantName } from "@/lib/dev";
import { requireDeveloper } from "@/lib/staff";
import { thread, tickets } from "@/lib/support";
import { PageHead } from "@/app/admin/kit";
import Shell from "@/app/admin/Shell";
import TicketsBoard from "./TicketsBoard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tickets · tappetite", robots: { index: false, follow: false } };

/** The developers' inbox: every restaurant's Support conversation. ?r= opens one. */
export default async function TicketsPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const me = await requireDeveloper();
  const { r } = await searchParams;
  const name = r ? await restaurantName(r) : null;
  if (r && !name) redirect("/admin/dev/tickets");
  const [list, logo, messages] = await Promise.all([tickets(), r ? restaurantLogo(r) : null, r ? thread(r) : []]);

  return (
    <Shell name={me.name}>
      {/* A phone shows the list or one conversation, never both. */}
      <div className={r ? "hidden lg:block" : ""}>
        <PageHead title="Tickets" sub="Messages from every restaurant, newest first." />
      </div>
      <TicketsBoard initial={list} open={r && name ? { id: r, name, logo, messages } : null} />
    </Shell>
  );
}
