import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * The Worker's bindings. D1 arrives on this `env` object rather than
 * `process.env`, because bindings are live objects, not strings. This is the
 * one place the adapter is imported.
 */
export type Env = {
  DB: D1Database;
  /** Dish photo uploads. Worker secrets; .dev.vars locally. */
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  /** Demo request emails (lib/mail.ts). Worker secrets; .dev.vars locally. */
  BREVO_API_KEY?: string;
  MAIL_FROM?: string;
  /** "Continue with Google" on the sign-up page (lib/signup.ts); without them the button is hidden. Worker secrets; .dev.vars locally. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Buying a plan with QR Ph (lib/checkout.ts); the same PayMongo account as TheJobStash. Worker secret; .dev.vars locally. */
  PAYMONGO_SECRET_KEY?: string;
};

export const env = () => getCloudflareContext().env as unknown as Env;

export function db(): D1Database {
  return env().DB;
}
