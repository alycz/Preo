import { spawnSync } from "node:child_process";

function run(label: string, args: string[]) {
  console.log(`\n${label}`);
  const result = spawnSync("pnpm", args, { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("Checking Dynamic Flow availability...", ["--filter", "@preo/web", "smoke:flow"]);
run("Checking Dynamic agent wallet signing path...", ["--filter", "@preo/web", "smoke:agent-wallet"]);
