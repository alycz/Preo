import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rootEnvLocal = resolve(repoRoot, ".env.local");

if (existsSync(rootEnvLocal)) {
  for (const line of readFileSync(rootEnvLocal, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    const key = match?.[1];
    const value = match?.[2];
    if (!key || value === undefined || process.env[key] !== undefined) {
      continue;
    }
    const rawValue = value.trim();
    process.env[key] =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ["@preo/shared", "@preo/canton-client", "@preo/dynamic-integration"],
  serverExternalPackages: ["@prisma/client", "prisma"]
};

export default nextConfig;
