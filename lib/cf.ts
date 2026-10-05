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
};

export const env = () => getCloudflareContext().env as unknown as Env;

export function db(): D1Database {
  return env().DB;
}
