import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page reads the visit from D1 on each request, so there is nothing for
// an incremental cache to hold.
export default defineCloudflareConfig();
