import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const dmg = args.includes("--dmg");

run("node", ["./scripts/ensure-rust.mjs"]);

const env = { ...process.env };
env.PATH = `${env.HOME}/.cargo/bin:${env.PATH ?? ""}`;

run("node", ["./scripts/prepare-sidecar.mjs"], { env });

const tauriArgs = ["build"];
if (dmg) tauriArgs.push("--bundles", "dmg");
run("npx", ["tauri", ...tauriArgs], { env });

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

