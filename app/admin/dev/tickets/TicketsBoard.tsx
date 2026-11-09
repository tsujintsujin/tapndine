"use client";

import Link from "next/link";
import { ChatIcon, ChevronLeft } from "@/app/components/Icons";
import { formatDate, formatTime } from "@/lib/format";
import type { SupportMessage, Ticket } from "@/lib/support";
import { useTickets } from "../../Alerts";
import Chat, { RestaurantAvatar } from "../../Chat";

const when = (ms: number) => (formatDate(ms) === formatDate(Date.now()) ? formatTime(ms) : formatDate(ms));

export default function TicketsBoard({
  initial,
  open,
}: {
  initial: Ticket[];
  open: { id: string; name: string; logo: string | null; messages: SupportMessage[] } | null;
}) {
  const list = useTickets().tickets ?? initial;

  return (
    <div
      className={`overflow-hidden bg-white shadow-[0_1px_2px_rgb(16_52_42/0.06)] lg:mt-4 lg:flex lg:h-[calc(100dvh-154px)] lg:-mb-9 lg:rounded-[22px] ${
        // On a phone an open conversation takes the whole screen under the top bar.
        open ? "-mx-4 -mb-12 -mt-5 flex h-[calc(100dvh-64px)] sm:-mx-6 lg:mx-0 lg:mt-4" : "mt-4 rounded-[22px]"
      }`}
    >
      <nav aria-label="Conversations" className={`shrink-0 overflow-y-auto overscroll-contain lg:block lg:w-[340px] lg:border-r lg:border-line xl:w-[380px] ${open ? "hidden" : ""}`}>
        {list.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ChatIcon width={40} height={40} className="mx-auto text-leaf" />
            <p className="mt-3 font-display text-[20px] font-bold">No messages yet</p>
            <p className="mt-1 text-[15px] text-muted">When a restaurant writes from its Support page, it shows up here.</p>
          </div>
        ) : (
          <ul className="p-2">
            {list.map((t) => {
              const here = t.id === open?.id;
              const unread = here ? 0 : t.unread;
              return (
                <li key={t.id}>
                  <Link
                    href={`/admin/dev/tickets?r=${t.id}`}
                    scroll={false}
                    aria-current={here ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${here ? "bg-leaf-tint" : "hover:bg-paper"}`}
                  >
                    <RestaurantAvatar logo={t.logo} name={t.name} className="h-12 w-12 text-[20px]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-[16px] ${unread ? "font-bold" : "font-semibold"}`}>{t.name}</span>
                        <span className="shrink-0 text-[13px] text-muted">{when(t.at)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={`truncate text-[15px] ${unread ? "font-semibold text-ink" : "text-muted"}`}>
                          {t.lastFromDev ? "You: " : ""}
                          {t.last}
                        </span>
                        {unread > 0 && (
                          <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-mango px-1.5 text-[13px] font-bold text-forest">
                            {unread}
                            <span className="sr-only"> unread</span>
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      {open ? (
        <section aria-label={open.name} className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line px-2 sm:px-3 lg:px-5">
            <Link href="/admin/dev/tickets" aria-label="All conversations" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-forest active:bg-wash lg:hidden">
              <ChevronLeft width={22} height={22} />
            </Link>
            <RestaurantAvatar logo={open.logo} name={open.name} className="h-10 w-10 text-[17px]" />
            <h2 className="ml-1 truncate text-[17px] font-semibold">{open.name}</h2>
          </header>
          {/* A fresh Chat per restaurant: its messages, scroll and draft are its own. */}
          <Chat
            key={open.id}
            path={`/api/dev/tickets/${open.id}`}
            initial={open.messages}
            dev
            otherName={open.name}
            avatar={<RestaurantAvatar logo={open.logo} name={open.name} />}
            empty={{ title: "Nothing here yet", text: `Write to ${open.name} and it shows on their Support page.` }}
          />
        </section>
      ) : (
        <div className="hidden min-w-0 flex-1 place-items-center px-6 text-center lg:grid">
          <div>
            <ChatIcon width={40} height={40} className="mx-auto text-leaf" />
            <p className="mt-3 text-[15px] text-muted">Choose a restaurant to read its messages.</p>
          </div>
        </div>
      )}
    </div>
  );
}
