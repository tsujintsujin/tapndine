import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * The Worker's bindings. D1 arrives on this `env` object rather than
 * `process.env`, because bindings are live objects, not strings. This is the
 * one place the adapter is imported.
 */
export type Env = {
  DB: D1Database;
};

export function db(): D1Database {
  return (getCloudflareContext().env as unknown as Env).DB;
}
