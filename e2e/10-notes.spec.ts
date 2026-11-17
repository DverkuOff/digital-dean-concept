import { test, expect } from "@playwright/test";
import { AUTH, sql } from "./helpers";

// Заметка к паре: своя, видна только автору; чужую пару по подменённому id не изменить.
const NOTE = "Принести эссе по главе 3";

test("Соколова сохраняет заметку, она видна после перезагрузки", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: AUTH.a, viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/schedule?view=week");
  // Карточку фиксируем по id: после клика кнопка «Заметка» исчезает, и фильтр по ней «перескочил» бы на соседнюю пару.
  const id = await page.getByTestId("lesson").filter({ has: page.getByTestId("add-note") }).first().getAttribute("data-lesson-id");
  const card = page.locator(`[data-lesson-id="${id}"]`);
  const title = (await card.locator("h3").textContent())!;
  await card.getByTestId("add-note").click();
  await card.getByRole("textbox").fill(NOTE);
  await card.getByRole("button", { name: "Сохранить" }).click();
  await expect(card.getByTestId("lesson-note")).toHaveText(NOTE);
  await page.reload();
  await expect(page.getByTestId("lesson-note").filter({ hasText: NOTE })).toHaveCount(1);
  expect(title.length).toBeGreaterThan(0);
  await ctx.close();
});

test("Орлов не видит чужую заметку и не может писать в пару чужой группы", async ({ browser }) => {
  const [aLesson] = await sql<{ lesson_id: string }>(
    `select n.lesson_id from lesson_note n join student s on s.id = n.student_id where s.last_name = 'Соколова' limit 1`,
  );
  expect(aLesson).toBeTruthy();

  const ctx = await browser.newContext({ storageState: AUTH.b, viewport: { width: 360, height: 800 } });
  const page = await ctx.newPage();
  await page.goto("/schedule?view=week");
  await expect(page.getByText(NOTE)).toHaveCount(0);

  // Открываем форму у своей пары и подменяем lessonId на пару группы Соколовой.
  const id = await page.getByTestId("lesson").filter({ has: page.getByTestId("add-note") }).first().getAttribute("data-lesson-id");
  const card = page.locator(`[data-lesson-id="${id}"]`);
  await card.getByTestId("add-note").click();
  await card.locator('input[name="lessonId"]').evaluate((el, id) => ((el as HTMLInputElement).value = id), aLesson.lesson_id);
  await card.getByRole("textbox").fill("взлом");
  await card.getByRole("button", { name: "Сохранить" }).click();
  await expect(card.locator("[role=alert]")).toContainText("Пара не найдена");

  const rows = await sql<{ text: string; last_name: string }>(
    `select n.text, s.last_name from lesson_note n join student s on s.id = n.student_id where n.lesson_id = $1`,
    [aLesson.lesson_id],
  );
  expect(rows).toEqual([{ text: NOTE, last_name: "Соколова" }]);
  await ctx.close();
});
