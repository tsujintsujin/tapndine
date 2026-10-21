// Dish options (migrations/0014): what a guest or waiter can pick for a dish,
// and the rules for a valid pick. Shared by the server (pricing a send) and
// the phones (showing the price before sending), so both agree.

export type OptionKind = "size" | "addon" | "spice";
export const OPTION_KINDS: OptionKind[] = ["size", "addon", "spice"];

export type DishOption = { id: string; kind: OptionKind; name: string; priceCents: number };

/** The parts of a dish the rules need. Options in their menu order. */
export type Pickable = { options: DishOption[]; sizeRequired: boolean; spiceLevel: number | null };

/** Spice choices only make sense on a spicy dish; the rest always show. */
export const offered = (d: Pickable, kind: OptionKind) =>
  d.options.filter((o) => o.kind === kind && (kind !== "spice" || (d.spiceLevel ?? 0) > 0));

/** True when the guest has to pick a size before the dish can go in: the quick + opens the dish instead. */
export const mustPick = (d: Pickable) => d.sizeRequired && offered(d, "size").length > 0;

/**
 * The picks as they will be sent, in order (size, add-ons, spice), or null if
 * they break a rule: an id not offered on this dish, two sizes, two spice
 * choices, or no size when one is required. No size on a dish where it isn't
 * required gets the first size.
 */
export function resolvePicks(d: Pickable, ids: readonly string[]): DishOption[] | null {
  const want = new Set(ids);
  const picks: DishOption[] = [];
  for (const kind of OPTION_KINDS) {
    const list = offered(d, kind);
    const got = list.filter((o) => want.has(o.id));
    got.forEach((o) => want.delete(o.id));
    if (kind !== "addon" && got.length > 1) return null;
    if (kind === "size" && list.length > 0 && got.length === 0) {
      if (d.sizeRequired) return null;
      got.push(list[0]);
    }
    picks.push(...got);
  }
  return want.size === 0 ? picks : null;
}

/** What a picker starts on: the first size when the guest needn't pick one, else nothing. */
export const startPicks = (d: Pickable) => new Set((resolvePicks(d, []) ?? []).map((o) => o.id));

/** Tapping o: sizes and spice one at a time (spice can be un-picked), add-ons toggle. */
export function togglePick(d: Pickable, picked: ReadonlySet<string>, o: DishOption): Set<string> {
  const next = new Set(picked);
  if (o.kind === "addon") {
    if (!next.delete(o.id)) next.add(o.id);
    return next;
  }
  const was = next.has(o.id);
  for (const x of offered(d, o.kind)) next.delete(x.id);
  if (!was || o.kind === "size") next.add(o.id);
  return next;
}

/** "Sharing · Extra egg", or null for none. */
export const optionsLabel = (picks: DishOption[]) => picks.map((p) => p.name).join(" · ") || null;

export const extraCents = (picks: DishOption[]) => picks.reduce((s, p) => s + p.priceCents, 0);

/** One line in a phone's order: the dish plus its picks, so the same dish picked two ways is two lines. */
export const lineKey = (dishId: string, picks: DishOption[]) =>
  picks.length ? `${dishId}|${picks.map((p) => p.id).join(",")}` : dishId;

export function parseLineKey(key: string): { dishId: string; optionIds: string[] } {
  const [dishId, ids = ""] = key.split("|");
  return { dishId, optionIds: ids ? ids.split(",") : [] };
}
