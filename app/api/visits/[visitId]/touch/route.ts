import { NextResponse } from "next/server";
import { touchVisit } from "@/lib/visits";

/** The menu calls this on activity, which keeps the visit alive. */
export async function POST(_req: Request, { params }: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await params;
  const visit = await touchVisit(visitId);
  return NextResponse.json(
    { alive: !!visit, expiresAt: visit?.expires_at ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
