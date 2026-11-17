// Применяет миграции из ./drizzle. Используется локально и при старте контейнера.
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { connect } from "./db";

export async function runMigrations(db: ReturnType<typeof connect>["db"]) {
  await migrate(db, { migrationsFolder: path.resolve(process.env.MIGRATIONS_DIR ?? "drizzle") });
}

if (process.argv[1]?.match(/migrate\.(ts|js|cjs|mjs)$/)) {
  const { pool, db } = connect();
  runMigrations(db)
    .then(() => console.log("Миграции применены"))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
