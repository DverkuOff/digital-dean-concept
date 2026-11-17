import { sql } from "drizzle-orm";
import { db } from "@/server/db";

// Проверка живости для хостинга и для нас: приложение отвечает, база доступна.
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "up" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
