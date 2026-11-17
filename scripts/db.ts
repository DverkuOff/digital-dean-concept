// Подключение к БД для скриптов (вне Next.js).
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";

try {
  process.loadEnvFile(".env");
} catch {
  // .env нет (например, в контейнере) — берём переменные окружения как есть
}

export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL не задан");
  const pool = new Pool({ connectionString: url, max: 4 });
  return { pool, db: drizzle(pool, { schema }) };
}
