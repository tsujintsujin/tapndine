import { NextResponse } from "next/server";
import { setSocial } from "@/lib/dev";
import { body, fail, managerOr } from "@/lib/manager";
import { cleanLink, NETWORKS } from "@/lib/socials";

/**
 * Manager saves one network's link and whether guests see it.
 * Body: { network: "facebook", url, on }. An empty url removes the link.
 */
export async function POST(req: Request) {
  const me = await managerOr();
  if (me instanceof NextResponse) return me;
  const b = await body(req);
  const net = NETWORKS.find((n) => n.id === b?.network);
  if (!net || typeof b?.url !== "string") return fail("Save the link again.");
  const raw = b.url.trim();
  const url = raw ? cleanLink(net.id, raw) : null;
  if (raw && !url) return fail(`That isn't a ${net.name} page link. It looks like ${net.example}.`);
  const social = url ? { url, on: b.on === true } : null;
  if (!(await setSocial(me.business_id, net.id, social))) return fail("No such restaurant.", 404);
  return NextResponse.json({ social });
}
