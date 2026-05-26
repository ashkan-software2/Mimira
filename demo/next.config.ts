import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow access from arbitrary origins during `next dev` — EC2 public IPs
  // change across instance restarts, and we also tunnel via localhost. Dev only.
  allowedDevOrigins: [
    "*",
    "127.0.0.1",
    "localhost",
    "0.0.0.0",
    "*.trycloudflare.com",
    "*.ngrok.app",
    "*.ngrok-free.app",
  ],
  // better-sqlite3 is a native addon — Next must not try to bundle it.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
