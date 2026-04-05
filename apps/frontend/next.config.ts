import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Keeps tracing inside this app; avoids picking parent lockfiles and reduces path bugs. */
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
