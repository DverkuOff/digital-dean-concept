// Сброс демо в исходное состояние: удалить всё → миграции → сид (даты от текущего момента).
// npm run db:reset
import { sql } from "drizzle-orm";
import { connect } from "./db";
import { runMigrations } from "./migrate";
import { seed, DEMO_LOGINS, DEMO_PASSWORD } from "./seed";

async function main() {
  const { pool, db } = connect();
  try {
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`drop schema public cascade`);
    await db.execute(sql`create schema public`);
    await runMigrations(db);
    const t = Date.now();
    await seed(db);
    console.log(`Демо сброшено за ${((Date.now() - t) / 1000).toFixed(1)} с. Логины: ${Object.values(DEMO_LOGINS).join(", ")}; пароль: ${DEMO_PASSWORD}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
