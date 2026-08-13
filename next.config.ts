import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

function getSupabaseImagePattern() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!rawUrl) return [];

  const url = new URL(rawUrl);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use http or https.");
  }

  return [
    {
      protocol: url.protocol.slice(0, -1) as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      pathname: "/storage/v1/object/sign/**",
    },
  ];
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: getSupabaseImagePattern(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default withSerwist(nextConfig);
