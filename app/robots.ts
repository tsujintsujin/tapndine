import type { MetadataRoute } from "next";

// Cloudflare adds its own content-signal comments above this.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/login", "/api/", "/m/", "/t/", "/unknown-tag", "/dev"] },
    sitemap: "https://tapndine.online/sitemap.xml",
  };
}
