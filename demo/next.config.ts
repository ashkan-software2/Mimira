import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow access from arbitrary origins during `next dev` — EC2 public IPs
  // change across instance restarts, and we also tunnel via localhost. Dev only.
  allowedDevOrigins: ["*"],
};

export default nextConfig;
