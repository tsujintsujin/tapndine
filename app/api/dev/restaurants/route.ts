import { NextResponse } from "next/server";
import { addRestaurant, isSlug, parseName } from "@/lib/dev";
import { body, developerOr, fail } from "@/lib/manager";
import { isLoginName, MIN_PASSWORD, restaurantLogin } from "@/lib/staff";

/** A developer adds a restaurant with its first manager. Body: { name, slug, managerName, username, password }; username is the part after the code. */
export async function POST(req: Request) {
  const me = await developerOr();
  if (me instanceof NextResponse) return me;
  const b = await body(req);
  const name = parseName(b?.name);
  const slug = typeof b?.slug === "string" ? b.slug.trim().toLowerCase() : "";
  const managerName = parseName(b?.managerName);
  const username = typeof b?.username === "string" ? b.username.trim().toLowerCase() : "";
  const password = typeof b?.password === "string" ? b.password : "";
  if (!name) return fail("Name the restaurant (up to 60 characters).");
  if (!isSlug(slug)) return fail("Code: 2 to 31 lower-case letters, numbers or dashes.");
  if (!managerName) return fail("Enter the manager's name.");
  if (!isLoginName(username)) return fail("Username: 2 to 30 letters, numbers, dots or underscores, no dashes.");
  if (password.length < MIN_PASSWORD || password.length > 200) return fail(`Password: at least ${MIN_PASSWORD} characters.`);
  const login = restaurantLogin(slug, username);
  const r = await addRestaurant(name, slug, { name: managerName, username: login, password });
  if (r === "slug") return fail("Another restaurant already uses that code.", 409);
  if (r === "username") return fail("That username is taken.", 409);
  if (r === "race") return fail("The code or the username was just taken. Try another.", 409);
  return NextResponse.json({ ok: true, username: login });
}
