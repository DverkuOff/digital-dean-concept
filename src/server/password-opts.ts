import type { Options } from "@node-rs/argon2";

// argon2id, параметры по рекомендации OWASP (m=19 MiB, t=2, p=1).
// Отдельный файл без server-only: его использует и сид (scripts/seed.ts).
export const ARGON2_OPTIONS: Options = {
  algorithm: 2, // Argon2id
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};
