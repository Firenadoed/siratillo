import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
};

export default withPWA({
  ...nextConfig,
  pwa: {
    dest: "public",       // Service worker goes into public/
    register: true,       // Auto-register SW
    skipWaiting: true,    // Activate new SW immediately
  },
});
