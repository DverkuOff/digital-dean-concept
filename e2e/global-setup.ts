import { execSync } from "node:child_process";

export default function globalSetup() {
  execSync("npx tsx scripts/reset.ts", { stdio: "inherit" });
}
