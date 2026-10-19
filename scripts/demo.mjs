import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const project = resolve(root, "examples/basic");
const server = spawn(
  process.execPath,
  [resolve(root, "dist/container-server.js")],
  {
    cwd: project,
    env: {
      ...process.env,
      HOST: process.env.HOST ?? "127.0.0.1",
      PORT: process.env.PORT ?? "4173",
      MDD_PROJECT_DIR: project,
      MDD_OUTPUT_DIR: resolve(root, "mdd-dist"),
      MDD_BASE_PATH: "/docs/",
    },
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.kill(signal));
}
server.once("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
