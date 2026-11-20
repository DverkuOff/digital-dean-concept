import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: Pool };

function getPool() {
  if (!globalForDb.pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL не задан (см. .env.example)");
    const pool = new Pool({ connectionString: url, max: 10 });
    // Разрыв простаивающего соединения (перезапуск БД, сброс демо) не должен ронять процесс:
    // пул выбрасывает битый клиент, следующий запрос откроет новое соединение.
    pool.on("error", (err) => console.error("[db] соединение разорвано, переподключимся:", err.message));
    globalForDb.pool = pool;
  }
  return globalForDb.pool;
}

export const db = drizzle(getPool(), { schema });
export type DB = typeof db;
