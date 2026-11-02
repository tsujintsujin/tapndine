// What the staff screens alert on: new orders and guest calls per table.

type Flags = { id: string; newOrders: number; calls: unknown[] };
/** A table's unseen orders and open calls at the last look. */
export type Seen = Map<string, [number, number]>;

export const seenNow = (tables: Flags[]): Seen => new Map(tables.map((t) => [t.id, [t.newOrders, t.calls.length]]));

/** Tables with something a waiter hasn't opened yet. */
export const tablesNeedingYou = (tables: Flags[]) => tables.filter((t) => t.newOrders > 0 || t.calls.length > 0).length;

/** Did an order or call arrive since `before`? Things being opened or cleared don't count. */
export function somethingNew(before: Seen, tables: Flags[]) {
  return tables.some((t) => {
    const [orders, calls] = before.get(t.id) ?? [0, 0];
    return t.newOrders > orders || t.calls.length > calls;
  });
}
