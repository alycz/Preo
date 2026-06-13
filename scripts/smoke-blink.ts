import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["--filter", "@preo/web", "smoke:blink"], {
  stdio: "inherit",
  shell: false
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
