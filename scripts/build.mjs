import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = join(root, "dist");
await rm(output, { recursive: true, force: true });

const compiler = join(root, "node_modules", "typescript", "bin", "tsc");
const result = spawnSync(
  process.execPath,
  [compiler, "-p", "tsconfig.build.json"],
  {
    cwd: root,
    stdio: "inherit",
  },
);
process.exitCode = result.status ?? 1;
