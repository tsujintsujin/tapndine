import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { BASE_PATH } from "./lib/base";

// Gives `next dev` the Worker's bindings (a local D1 under .localdb/).
// Run `npm run db:reset` once to create the tables and the sample restaurant.
initOpenNextCloudflareForDev({ persist: { path: ".localdb/v3" } });

// This PC's own Wi-Fi addresses. A phone on the same network opens the menu
// at http://<address>:3300 (the dev server listens on all interfaces), and
// next dev refuses to serve its scripts to origins it was not told about.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n !== undefined && n.family === "IPv4" && !n.internal)
  .map((n) => n!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
  basePath: BASE_PATH,
  eslint: { ignoreDuringBuilds: true },
  // The workspace root holds other projects; stop the bundler walking up into them.
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  // The staff screens moved from /staff to /admin, and their login to /login
  // (everyone logs in there); old links and bookmarks still land. First match wins.
  async redirects() {
    return [
      { source: "/staff/login", destination: "/login", permanent: false },
      { source: "/admin/login", destination: "/login", permanent: false },
      { source: "/staff", destination: "/admin", permanent: false },
      { source: "/staff/:path*", destination: "/admin/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
