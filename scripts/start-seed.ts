// При старте контейнера: миграции и сид, если база пустая (первый деплой).
// Если задан DEMO_RESET_ON_START=1 — полный сброс демо при каждом старте.
import { sql } from "drizzle-orm";
import { connect } from "./db";
import { runMigrations } from "./migrate";
import { seed } from "./seed";

/** База может подниматься одновременно с приложением (рестарт кластера): ждём до 30 × 2 с. */
async function waitForDb(pool: ReturnType<typeof connect>["pool"], attempts = Number(process.env.DB_WAIT_ATTEMPTS ?? 30)) {
  for (let i = 1; ; i++) {
    try {
      await pool.query("select 1");
      return;
    } catch (e) {
      if (i >= attempts) throw e;
      console.log(`База недоступна (${(e as Error).message}), попытка ${i}/${attempts}, ждём 2 с`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function main() {
  const { pool, db } = connect();
  try {
    await waitForDb(pool);
    if (process.env.DEMO_RESET_ON_START === "1") {
      await db.execute(sql`drop schema if exists drizzle cascade`);
      await db.execute(sql`drop schema public cascade`);
      await db.execute(sql`create schema public`);
    }
    await runMigrations(db);
    const res = await db.execute(sql`select count(*)::int as n from "user"`);
    if (Number((res.rows[0] as { n: number }).n) === 0) {
      await seed(db);
      console.log("База была пустой — демо-данные созданы");
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
