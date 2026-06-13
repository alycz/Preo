import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@preo/shared", "@preo/canton-client", "@preo/dynamic-integration"],
  serverExternalPackages: ["@prisma/client", "prisma"]
};

export default nextConfig;
