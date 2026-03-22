import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";

// Next.js only loads .env from the package directory, not the monorepo root.
// Read the root .env manually at startup so MONGODB_URI and other shared vars
// are available to API routes in both `next dev` and `next start`.
try {
  const lines = readFileSync(
    resolve(process.cwd(), "../../.env"),
    "utf-8",
  ).split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    // don't overwrite vars already set in the environment (e.g. CI / Railway)
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {
  // root .env not present — rely on host environment
}

const nextConfig: NextConfig = {
  transpilePackages: ["@rangerai/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "inaturalist-open-data.s3.amazonaws.com" },
      { protocol: "https", hostname: "static.inaturalist.org" },
      { protocol: "https", hostname: "**.inaturalist.org" },
    ],
  },
};

export default nextConfig;
