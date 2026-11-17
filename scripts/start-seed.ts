// При старте контейнера: миграции и сид, если база пустая (первый деплой).
// Если задан DEMO_RESET_ON_START=1 — полный сброс демо при каждом старте.
import { sql } from "drizzle-orm";
import { connect } from "./db";
import { runMigrations } from "./migrate";
import { seed } from "./seed";

async function main() {
  const { pool, db } = connect();
  try {
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
