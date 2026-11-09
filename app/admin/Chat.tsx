"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChatIcon, SendIcon } from "@/app/components/Icons";
import { formatDate, formatTime } from "@/lib/format";
import type { SupportMessage } from "@/lib/support";
import { useAlerts, useTickets } from "./Alerts";
import { api, usePoll } from "./ui";

// The Messenger-style conversation between a restaurant and tapndine, the same
// on both sides: the manager's Support page and the developers' Tickets.

/** The restaurant's logo, or the first letter of its name when it has none. */
export function RestaurantAvatar({ logo, name, className = "h-9 w-9 text-[15px]" }: { logo: string | null; name: string; className?: string }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" className={`shrink-0 rounded-full border border-line bg-white object-contain ${className}`} />
  ) : (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-leaf-tint font-bold text-forest ${className}`}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** tapndine, in the wordmark's lettering and with its dot. */
export function TapndineAvatar({ className = "h-9 w-9 text-[19px]" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-forest font-display font-bold leading-none text-white ${className}`}>
      <span>
        t<span className="text-mango">.</span>
      </span>
    </span>
  );
}

const dayLabel = (ms: number) => (formatDate(ms) === formatDate(Date.now()) ? "Today" : formatDate(ms));

/** Two messages read as one burst: same person, same day, close together. */
const sameRun = (a: SupportMessage | undefined, b: SupportMessage | undefined) =>
  !!a && !!b && a.fromDev === b.fromDev && a.sender === b.sender && b.at - a.at < 5 * 60_000 && formatDate(a.at) === formatDate(b.at);

export default function Chat({
  path,
  initial,
  dev,
  otherName,
  avatar,
  empty,
}: {
  /** Where this conversation is read and sent. */
  path: string;
  initial: SupportMessage[];
  /** The viewer is a developer (their messages are the ones from tapndine). */
  dev: boolean;
  otherName: string;
  /** The other side's picture, beside their messages. */
  avatar: React.ReactNode;
  empty: { title: string; text: string };
}) {
  const { data: messages, refresh, offline } = usePoll(path, initial, (d) => (d as { messages: SupportMessage[] }).messages);
  const alerts = useAlerts().refresh;
  const tickets = useTickets().refresh;
  const onSeen = dev ? tickets : alerts;

  const [text, setText] = useState("");
  /** Sent but not back from the server yet, oldest first: drawn as faded bubbles. */
  const [pending, setPending] = useState<string[]>([]);
  // One at a time, so a quick second message can't overtake the first on bad wifi.
  const queue = useRef(Promise.resolve());
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  // Follows new messages, unless they have scrolled up to read the history.
  const atBottom = useRef(true);

  // Asking the server is what marks the conversation read, so ask on opening (not
  // when the page is drawn, which a link can do ahead of time), then clear the badge.
  useEffect(() => {
    refresh().then(onSeen);
  }, [refresh, onSeen]);

  const last = messages[messages.length - 1];
  const lastId = last?.id;
  useEffect(() => {
    onSeen();
  }, [lastId, onSeen]);

  useLayoutEffect(() => {
    if (atBottom.current && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lastId, pending]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    atBottom.current = true;
    setError("");
    setPending((p) => [...p, body]);
    setText("");
    queue.current = queue.current.then(async () => {
      try {
        await api(path, { method: "POST", body: { text: body } });
        await refresh();
      } catch (e) {
        // Their words go back in the box instead of being lost.
        setText((now) => (now ? `${body}\n${now}` : body));
        setError(e instanceof Error ? e.message : "That didn't send. Try again.");
      }
      setPending((p) => p.slice(1));
    });
  };

  // A poll can bring the sent message back before the send has finished.
  const sending = last && last.fromDev === dev && last.body === pending[0] ? pending.slice(1) : pending;

  return (
    <>
      <div
        ref={box}
        role="log"
        aria-label={`Messages with ${otherName}`}
        tabIndex={0}
        onScroll={(e) => {
          const b = e.currentTarget;
          atBottom.current = b.scrollHeight - b.scrollTop - b.clientHeight < 80;
        }}
        // relative: keeps the screen-reader labels (absolute) inside this scroll box.
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 focus:outline-none sm:px-5"
      >
        {messages.length === 0 && sending.length === 0 ? (
          <div className="grid h-full place-items-center px-4 text-center">
            <div>
              <ChatIcon width={40} height={40} className="mx-auto text-leaf" />
              <p className="mt-3 font-display text-[20px] font-bold">{empty.title}</p>
              <p className="mt-1 max-w-sm text-[15px] text-muted">{empty.text}</p>
            </div>
          </div>
        ) : (
          <ol className="flex flex-col">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const mine = m.fromDev === dev;
              const firstOfRun = !sameRun(prev, m);
              const lastOfRun = !sameRun(m, next);
              const newDay = !prev || formatDate(prev.at) !== formatDate(m.at);
              return (
                <li key={m.id} className={firstOfRun && i > 0 ? "mt-4" : "mt-0.5"}>
                  {newDay && <p className="mb-4 mt-2 text-center text-[13px] font-medium text-muted">{dayLabel(m.at)}</p>}
                  <div className={`flex items-end gap-2 ${mine ? "justify-end" : ""}`}>
                    {!mine && (lastOfRun ? avatar : <span aria-hidden="true" className="w-9 shrink-0" />)}
                    <div className={`flex min-w-0 max-w-[78%] flex-col lg:max-w-[min(64%,560px)] ${mine ? "items-end" : "items-start"}`}>
                      {firstOfRun && !mine && <p className="mb-1 px-1 text-[13px] text-muted">{dev ? m.sender : "tapndine support"}</p>}
                      <p
                        className={`whitespace-pre-wrap rounded-[20px] px-4 py-2.5 text-[16px] leading-snug [overflow-wrap:anywhere] ${
                          mine ? `bg-forest text-white ${lastOfRun ? "rounded-br-md" : ""}` : `bg-paper text-ink ${lastOfRun ? "rounded-bl-md" : ""}`
                        }`}
                      >
                        <span className="sr-only">{mine ? "You: " : `${dev ? m.sender : "tapndine"}: `}</span>
                        {m.body}
                      </p>
                      {lastOfRun && <p className="mt-1 px-1 text-[12px] text-muted">{formatTime(m.at)}</p>}
                    </div>
                  </div>
                </li>
              );
            })}
            {sending.map((body, i) => (
              <li key={i} className="mt-1 flex flex-col items-end">
                <p className="max-w-[78%] whitespace-pre-wrap rounded-[20px] rounded-br-md bg-forest px-4 py-2.5 text-[16px] leading-snug text-white opacity-60 [overflow-wrap:anywhere] lg:max-w-[min(64%,560px)]">
                  {body}
                </p>
                {i === sending.length - 1 && <p className="mt-1 px-1 text-[12px] text-muted">Sending…</p>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="border-t border-line px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-5">
        {offline && <p role="status" className="mb-2 text-[14px] text-muted">Can&apos;t reach the server. Retrying…</p>}
        {error && <p role="alert" className="mb-2 text-[14px] text-chili">{error}</p>}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            aria-label="Message"
            placeholder="Write a message"
            rows={1}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // A computer sends on Enter; a phone's Enter key makes a new line, and the button sends.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !matchMedia("(pointer: coarse)").matches) {
                e.preventDefault();
                send();
              }
            }}
            className="max-h-36 min-h-11 min-w-0 flex-1 resize-none rounded-[22px] bg-paper px-4 py-2.5 text-[16px] leading-6 [field-sizing:content] placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!text.trim()}
            // Pressing Send keeps the keyboard up for the next message.
            onPointerDown={(e) => e.preventDefault()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest text-white hover:bg-forest-soft disabled:bg-wash disabled:text-muted"
          >
            <SendIcon width={20} height={20} />
          </button>
        </form>
      </div>
    </>
  );
}
