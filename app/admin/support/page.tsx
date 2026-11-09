import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { thread } from "@/lib/support";
import Chat, { TapndineAvatar } from "../Chat";
import { PageHead } from "../kit";
import Shell from "../Shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Support · tapndine", robots: { index: false, follow: false } };

/** Settings > Support: the restaurant's conversation with tapndine. */
export default async function SupportPage() {
  const me = await requireStaff("manager");
  // A developer with this restaurant open answers it as tapndine, from Tickets.
  if (me.developer) redirect(me.guide ? "/admin/dev/tickets" : `/admin/dev/tickets?r=${me.business_id}`);
  return (
    <Shell name={me.name}>
      <PageHead title="Support" sub="Message the tapndine team. Replies show up here." />
      {/* On a phone the chat runs to the screen's edges and bottom, as a messaging app does. */}
      <section className="-mx-4 -mb-12 mt-4 flex h-[calc(100dvh-167px)] min-h-[360px] flex-col overflow-hidden rounded-t-[22px] bg-white shadow-[0_1px_2px_rgb(16_52_42/0.06)] sm:-mx-6 lg:mx-0 lg:-mb-9 lg:h-[calc(100dvh-154px)] lg:rounded-[22px]">
        <Chat
          path="/api/staff/support"
          initial={await thread(me.business_id)}
          dev={false}
          otherName="tapndine support"
          avatar={<TapndineAvatar />}
          empty={{ title: "How can we help?", text: "Ask about your menu, tables or plan. Your whole conversation stays here." }}
        />
      </section>
    </Shell>
  );
}
