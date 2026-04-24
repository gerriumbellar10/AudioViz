import { spawnSync } from "node:child_process";

if (process.platform !== "darwin") process.exit(0);

if (has("cargo") && has("rustc")) process.exit(0);

console.log("[rust] cargo/rustc not found. Installing Rust via rustup…");

const install = spawnSync("sh", ["-c", "curl -fsSL https://sh.rustup.rs | sh -s -- -y"], {
  stdio: "inherit"
});
if (install.status !== 0) process.exit(install.status ?? 1);

process.env.PATH = `${process.env.HOME}/.cargo/bin:${process.env.PATH ?? ""}`;
if (!has("cargo")) {
  console.error("[rust] cargo still not available. Restart your terminal or add ~/.cargo/bin to PATH.");
  process.exit(1);
}

console.log("[rust] Rust installed OK.");

function has(cmd) {
  const r = spawnSync("sh", ["-lc", `command -v ${cmd} >/dev/null 2>&1`], { stdio: "ignore" });
  return r.status === 0;
}

