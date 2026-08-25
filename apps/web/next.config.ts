import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@niva/ui", "@niva/types", "@niva/validation"],
};

export default nextConfig;
