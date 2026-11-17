import { Pool } from "pg";
import type { Page } from "@playwright/test";

try {
  process.loadEnvFile(".env");
} catch {}

export const AUTH = {
  a: "e2e/.auth/sokolova.json",
  b: "e2e/.auth/orlov.json",
  staff: "e2e/.auth/metodist.json",
};

let pool: Pool | null = null;
export function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  return pool.query(text, params).then((r) => r.rows as T[]);
}

/** id заявки студента по фамилии и типу. */
export async function requestIdOf(lastName: string, type: string) {
  const rows = await sql<{ id: string }>(
    `select r.id from request r join student s on s.id = r.student_id where s.last_name = $1 and r.type = $2 order by r.created_at limit 1`,
    [lastName, type],
  );
  if (!rows[0]) throw new Error(`нет заявки ${type} у ${lastName}`);
  return rows[0].id;
}

export async function login(page: Page, username: string, password = "demo2026") {
  await page.goto("/login");
  await page.getByText("Войти по логину и паролю").click();
  await page.getByLabel("Логин").fill(username);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
}
