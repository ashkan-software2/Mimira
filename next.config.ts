import type { NextConfig } from "next";

// Next 16's `allowedDevOrigins` matches hostnames via picomatch globs, where
// `*` does NOT cross dots. That means a bare `"*"` won't match a literal IPv4
// like `52.38.207.78` — server actions then 403 silently and buttons appear
// dead. serve.sh discovers the EC2 public IP at boot and passes it through
// `YUNA_DEV_ORIGIN`; we append it here.
const extraDevOrigin = process.env.YUNA_DEV_ORIGIN?.trim();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "0.0.0.0",
    "*.*.*.*",
    "*.trycloudflare.com",
    "*.ngrok.app",
    "*.ngrok-free.app",
    ...(extraDevOrigin ? [extraDevOrigin] : []),
  ],
};

export default nextConfig;
