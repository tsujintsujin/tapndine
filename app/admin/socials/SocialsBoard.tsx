"use client";

import { useState } from "react";
import { CheckIcon } from "@/app/components/Icons";
import { SocialLogo } from "@/app/components/SocialLogo";
import { cleanLink, NETWORKS, type NetworkId, type Social, type Socials } from "@/lib/socials";
import { card } from "../kit";
import { Switch } from "../menu/MenuBoard";
import { api } from "../ui";

const field =
  "block h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20 aria-[invalid=true]:border-chili";

type PerNetwork<T> = Partial<Record<NetworkId, T>>;

/** A saved link as the box shows it: "https://" only takes room on a phone. */
const bare = (url?: string) => url?.replace(/^https:\/\//, "") ?? "";

/**
 * One row per network: its logo, the link, and a switch for whether guests
 * see it. A link saves when the box is left (or on Enter); the switch saves
 * on tap. A first link switches on by itself; with no link the switch is off.
 */
export default function SocialsBoard({ initial }: { initial: Socials }) {
  const [socials, setSocials] = useState(initial);
  const [text, setText] = useState(() => Object.fromEntries(NETWORKS.map(({ id }) => [id, bare(initial[id]?.url)])) as Record<NetworkId, string>);
  const [errors, setErrors] = useState<PerNetwork<string>>({});
  /** The row showing "Saved" for a moment. */
  const [done, setDone] = useState<NetworkId | null>(null);

  /** Saves one row (null removes its link); the others are left as they are. */
  const save = async (id: NetworkId, next: Social | null) => {
    const before = socials[id];
    const put = (s: Social | null | undefined) => setSocials((all) => ({ ...all, [id]: s ?? undefined }));
    put(next);
    setErrors((e) => ({ ...e, [id]: undefined }));
    try {
      await api("/api/staff/socials", { method: "POST", body: { network: id, url: next?.url ?? "", on: next?.on ?? false } });
      setDone(id);
      setTimeout(() => setDone((d) => (d === id ? null : d)), 2500);
    } catch (e) {
      put(before);
      setText((t) => ({ ...t, [id]: bare(before?.url) }));
      setErrors((x) => ({ ...x, [id]: (e as Error).message }));
    }
  };

  const commit = (id: NetworkId) => {
    const raw = text[id].trim();
    const had = socials[id];
    if (!raw) return had ? save(id, null) : undefined;
    const url = cleanLink(id, raw);
    if (!url) {
      const { name, example } = NETWORKS.find((n) => n.id === id)!;
      return setErrors((e) => ({ ...e, [id]: `That isn't a ${name} page link. It looks like ${example}.` }));
    }
    setText((t) => ({ ...t, [id]: bare(url) }));
    // A first link shows straight away; a changed one keeps its switch.
    if (url !== had?.url) save(id, { url, on: had ? had.on : true });
  };

  const flip = (id: NetworkId) => {
    const s = socials[id];
    if (s) save(id, { ...s, on: !s.on });
  };

  return (
    <ul className="mt-6 grid gap-4 lg:grid-cols-2">
      {NETWORKS.map(({ id, name, example }) => {
        const s = socials[id];
        const err = errors[id];
        return (
          <li key={id} className={`${card} grid grid-cols-[auto_minmax(0,1fr)_auto] content-start items-center gap-x-3 gap-y-1.5 sm:gap-x-4`}>
            <div className="col-start-2 flex items-center gap-2">
              <label htmlFor={`social-${id}`} className="text-[15px] font-semibold">
                {name}
              </label>
              {done === id && (
                <span role="status" className="flex items-center gap-1 text-[13px] font-semibold text-leaf">
                  <CheckIcon width={16} height={16} />
                  Saved
                </span>
              )}
            </div>
            <SocialLogo id={id} className="col-start-1 row-start-2 h-11 w-11" />
            <input
              id={`social-${id}`}
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={example}
              value={text[id]}
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? `social-${id}-error` : undefined}
              onChange={(e) => {
                const v = e.target.value;
                setText((t) => ({ ...t, [id]: v }));
                if (err) setErrors((x) => ({ ...x, [id]: undefined }));
              }}
              onBlur={() => commit(id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className={`${field} col-start-2 row-start-2`}
            />
            <div className="col-start-3 row-start-2 flex">
              <Switch on={!!s?.on} disabled={!s} label={`Show ${name} on your menu`} onChange={() => flip(id)} />
            </div>
            {err && (
              <p id={`social-${id}-error`} role="alert" className="col-start-2 text-[14px] text-chili">
                {err}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
