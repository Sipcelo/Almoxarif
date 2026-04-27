import { spawnSync } from "node:child_process";
import path from "node:path";
import dotenv from "dotenv";

const envPath = path.resolve(__dirname, "../.env.test");
const loaded = dotenv.config({ path: envPath });

if (loaded.error) {
  console.error(`[pretest] Falha ao carregar ${envPath}`);
  console.error(loaded.error.message);
  process.exit(1);
}

function runPrisma(args: string[]) {
  const result = spawnSync("npx", ["prisma", ...args], {
    env: process.env,
    shell: true,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runPrisma(["generate"]);
runPrisma(["db", "push", "--accept-data-loss"]);
