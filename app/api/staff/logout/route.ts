import { NextResponse } from "next/server";
import { logOut } from "@/lib/staff";

export async function POST() {
  await logOut();
  return NextResponse.json({ ok: true });
}
