import type { NextRequest } from "next/server";
import { BASE_PATH } from "./base";

// "Continue with Google" (app/api/auth/google): the pieces both its routes share.

/** Holds the random state sent to Google, to check it comes back unchanged. */
export const STATE_COOKIE = "tnd_gstate";

/** Where Google sends the browser back: this site's own callback, on whatever host it was reached. */
export const callbackUrl = (req: NextRequest) => `${req.nextUrl.origin}${BASE_PATH}/api/auth/google/callback`;
