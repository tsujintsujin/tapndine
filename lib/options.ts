// Dish options (migrations/0014, 0015): what a guest or waiter can pick for a
// dish, and the rules for a valid pick. Shared by the server (pricing a send)
// and the phones (showing the price before sending), so both agree.

export type OptionKind = "size" | "choice" | "addon" | "spice";
/** In the order picks are shown and sent: size, choose-one lists, add-ons, spice. */
export const OPTION_KINDS: OptionKind[] = ["size", "choice", "addon", "spice"];

/**
 * group: the choose-one list's name ("Drink"), for kind "choice"; null for the rest.
 * ref: the menu dish a "choice" is (its name comes from that dish); null for the rest.
 */
export type DishOption = { id: string; kind: OptionKind; group: string | null; ref?: string | null; name: string; priceCents: number };

/**
 * The parts of a dish the rules need. Options in their menu order. sizeLabel:
 * what its sizes are called when they aren't sizes ("Meat"); missing is "Size".
 */
export type Pickable = { options: DishOption[]; sizeRequired: boolean; spiceLevel: number | null; sizeLabel?: string | null };

/** The heading over a dish's sizes: "Size", or what the manager called them ("Meat"). */
export const sizeTitle = (d: { sizeLabel?: string | null }) => d.sizeLabel?.trim() || "Size";

/** Spice choices only make sense on a spicy dish; the rest always show. */
export const offered = (d: Pickable, kind: OptionKind) =>
  d.options.filter((o) => o.kind === kind && (kind !== "spice" || (d.spiceLevel ?? 0) > 0));

/** The dish's choose-one lists ("Drink", "Side"), in menu order, each with its choices. */
export function choiceLists(d: Pickable): { name: string; options: DishOption[] }[] {
  const lists = new Map<string, DishOption[]>();
  for (const o of offered(d, "choice")) {
    const name = o.group ?? "";
    if (!lists.has(name)) lists.set(name, []);
    lists.get(name)!.push(o);
  }
  return [...lists].map(([name, options]) => ({ name, options }));
}

/** True when the guest has to pick before the dish can go in: the quick + opens the dish instead. */
export const mustPick = (d: Pickable) => (d.sizeRequired && offered(d, "size").length > 0) || offered(d, "choice").length > 0;

/**
 * The picks as they will be sent, in order (size, choose-one lists, add-ons,
 * spice), or null if they break a rule: an id not offered on this dish, two
 * sizes, two spice choices, no size when one is required, or not exactly one
 * pick from each choose-one list. No size on a dish where it isn't required
 * gets the first size.
 */
export function resolvePicks(d: Pickable, ids: readonly string[]): DishOption[] | null {
  const want = new Set(ids);
  const take = (list: DishOption[]) => {
    const got = list.filter((o) => want.has(o.id));
    got.forEach((o) => want.delete(o.id));
    return got;
  };
  const picks: DishOption[] = [];
  for (const kind of OPTION_KINDS) {
    if (kind === "choice") {
      for (const list of choiceLists(d)) {
        const got = take(list.options);
        if (got.length !== 1) return null;
        picks.push(...got);
      }
      continue;
    }
    const list = offered(d, kind);
    const got = take(list);
    if (kind !== "addon" && got.length > 1) return null;
    if (kind === "size" && list.length > 0 && got.length === 0) {
      if (d.sizeRequired) return null;
      got.push(list[0]);
    }
    picks.push(...got);
  }
  return want.size === 0 ? picks : null;
}

/** What still needs picking before Add works ("size", "meat", "drink"), or null when nothing does. */
export function missingPick(d: Pickable, picked: ReadonlySet<string>): string | null {
  const sizes = offered(d, "size");
  if (d.sizeRequired && sizes.length && !sizes.some((o) => picked.has(o.id))) return sizeTitle(d).toLowerCase();
  const list = choiceLists(d).find((l) => !l.options.some((o) => picked.has(o.id)));
  return list ? list.name.toLowerCase() : null;
}

/** What a picker starts on: the first size when the guest needn't pick one, else nothing. */
export function startPicks(d: Pickable) {
  const first = offered(d, "size")[0];
  return new Set(!d.sizeRequired && first ? [first.id] : []);
}

/** Tapping o: sizes, each choose-one list and spice one at a time (spice can be un-picked), add-ons toggle. */
export function togglePick(d: Pickable, picked: ReadonlySet<string>, o: DishOption): Set<string> {
  const next = new Set(picked);
  if (o.kind === "addon") {
    if (!next.delete(o.id)) next.add(o.id);
    return next;
  }
  const was = next.has(o.id);
  for (const x of offered(d, o.kind)) if (o.kind !== "choice" || x.group === o.group) next.delete(x.id);
  if (!was || o.kind !== "spice") next.add(o.id);
  return next;
}

/** One pick as the waiter reads it: "Drink: Coke" for a choose-one list, else the name. */
export const pickLabel = (p: DishOption) => (p.kind === "choice" && p.group ? `${p.group}: ${p.name}` : p.name);

/** "Sharing · Drink: Coke · Extra egg", or null for none. */
export const optionsLabel = (picks: DishOption[]) => picks.map(pickLabel).join(" · ") || null;

export const extraCents = (picks: DishOption[]) => picks.reduce((s, p) => s + p.priceCents, 0);

/** One line in a phone's order: the dish plus its picks, so the same dish picked two ways is two lines. */
export const lineKey = (dishId: string, picks: DishOption[]) =>
  picks.length ? `${dishId}|${picks.map((p) => p.id).join(",")}` : dishId;

export function parseLineKey(key: string): { dishId: string; optionIds: string[] } {
  const [dishId, ids = ""] = key.split("|");
  return { dishId, optionIds: ids ? ids.split(",") : [] };
}
