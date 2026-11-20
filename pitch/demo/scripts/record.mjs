// Запись экранов для демо-видео: локальная прод-сборка на свежем демо (npm run db:reset && npx next start -p 3100).
// Кадры снимаем через CDP screencast (JPEG, чёткий текст на deviceScaleFactor 2), потом ffmpeg собирает
// их в mp4 с настоящими паузами. Запуск: node pitch/demo/scripts/record.mjs <папка-для-кадров>
// Результат: pitch/demo/assets/clips/<сцена>.mp4 и clips.json с длительностями и ключевыми моментами.
import { chromium } from "../../../node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const BASE = "http://localhost:3100";
const HERE = path.dirname(new URL(import.meta.url).pathname);
const CLIPS = path.join(HERE, "..", "assets", "clips");
const RAW = process.argv[2] ?? "/tmp/orientir-frames";
fs.mkdirSync(CLIPS, { recursive: true });
fs.mkdirSync(RAW, { recursive: true });

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 };
const IP = `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const meta = {};

// Палец и курсор рисуем поверх страницы (только в записи, код приложения не меняется).
const overlay = () => {
  const mk = () => {
    const d = document.createElement("div");
    d.setAttribute("aria-hidden", "true");
    Object.assign(d.style, { position: "fixed", zIndex: "2147483647", pointerEvents: "none", left: "0", top: "0" });
    document.documentElement.appendChild(d);
    return d;
  };
  window.__tap = (x, y) => {
    const d = mk();
    Object.assign(d.style, { width: "46px", height: "46px", borderRadius: "50%", background: "rgba(37,80,192,.22)", border: "2.5px solid rgba(37,80,192,.75)", transform: `translate(${x - 23}px, ${y - 23}px)` });
    d.animate([{ opacity: 0, scale: "1.5" }, { opacity: 1, scale: "1", offset: 0.45 }, { opacity: 1, scale: "0.85", offset: 0.6 }, { opacity: 0, scale: "1.6" }], { duration: 900, easing: "ease-out" }).onfinish = () => d.remove();
  };
  let finger = null;
  window.__finger = (x, y, on) => {
    if (on === false) { finger?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished.then(() => { finger?.remove(); finger = null; }); return; }
    if (!finger) {
      finger = mk();
      Object.assign(finger.style, { width: "46px", height: "46px", borderRadius: "50%", background: "rgba(37,80,192,.22)", border: "2.5px solid rgba(37,80,192,.75)" });
    }
    finger.style.transform = `translate(${x - 23}px, ${y - 23}px)`;
  };
  let cur = null;
  window.__cursor = (x, y, ms) => {
    if (!cur) {
      cur = mk();
      cur.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1 3.8 7.4-2.6 1.3-3.8-7.4L5 19z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      const p = JSON.parse(sessionStorage.getItem("__cur") || "[720,520]");
      cur.style.transform = `translate(${p[0]}px, ${p[1]}px)`;
      cur.dataset.x = p[0]; cur.dataset.y = p[1];
    }
    const fx = +cur.dataset.x, fy = +cur.dataset.y;
    cur.dataset.x = x; cur.dataset.y = y;
    try { sessionStorage.setItem("__cur", JSON.stringify([x, y])); } catch {}
    const a = cur.animate([{ transform: `translate(${fx}px, ${fy}px)` }, { transform: `translate(${x}px, ${y}px)` }], { duration: ms, easing: "cubic-bezier(.45,0,.25,1)", fill: "forwards" });
    return a.finished.then(() => { cur.style.transform = `translate(${x}px, ${y}px)`; });
  };
  window.__click = (x, y) => {
    const d = mk();
    Object.assign(d.style, { width: "34px", height: "34px", borderRadius: "50%", border: "2.5px solid rgba(37,80,192,.8)", transform: `translate(${x - 17}px, ${y - 17}px)` });
    d.animate([{ opacity: 1, scale: "0.4" }, { opacity: 0, scale: "1.4" }], { duration: 600, easing: "ease-out" }).onfinish = () => d.remove();
  };
  // Курсор появляется сразу после загрузки страницы, а не при первом движении.
  addEventListener("DOMContentLoaded", () => { if (window.__desktopCursor) { const p = JSON.parse(sessionStorage.getItem("__cur") || "[720,520]"); window.__cursor(p[0], p[1], 1); } });
};

async function newCtx(browser, kind, extra = {}) {
  const ctx = await browser.newContext({ ...(kind === "phone" ? PHONE : DESKTOP), locale: "ru-RU", timezoneId: "Europe/Moscow", bypassCSP: true, extraHTTPHeaders: { "X-Forwarded-For": IP }, ...extra });
  if (kind === "desktop") await ctx.addInitScript(() => { window.__desktopCursor = true; });
  await ctx.addInitScript(overlay);
  return ctx;
}

// --- Запись: CDP screencast → JPEG-кадры с отметкой времени.
async function record(page, name, size) {
  const cdp = await page.context().newCDPSession(page);
  const dir = path.join(RAW, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  const t0 = Date.now();
  const marks = [];
  cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
    const f = path.join(dir, `${String(frames.length).padStart(5, "0")}.jpg`);
    frames.push({ f, t: (Date.now() - t0) / 1000 });
    fs.writeFileSync(f, Buffer.from(data, "base64"));
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 94, maxWidth: size[0], maxHeight: size[1], everyNthFrame: 1 });
  return {
    mark(label) { marks.push({ label, t: +((Date.now() - t0) / 1000).toFixed(2) }); console.log(`  [${name}] ${label} @ ${marks.at(-1).t}s`); },
    async stop() {
      await sleep(300);
      await cdp.send("Page.stopScreencast").catch(() => {});
      const end = (Date.now() - t0) / 1000;
      // concat-список: кадр держится до следующего. Первый кадр — с нуля.
      const lines = [];
      frames.forEach((fr, i) => {
        const next = i + 1 < frames.length ? frames[i + 1].t : end;
        const start = i === 0 ? 0 : fr.t;
        lines.push(`file '${fr.f}'`, `duration ${Math.max(0.001, next - start).toFixed(4)}`);
      });
      lines.push(`file '${frames.at(-1).f}'`);
      const list = path.join(dir, "list.txt");
      fs.writeFileSync(list, lines.join("\n"));
      const out = path.join(CLIPS, `${name}.mp4`);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", `fps=30,scale=${size[0]}:${size[1]}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-r", "30", out]);
      meta[name] = { duration: +end.toFixed(2), size, marks };
      fs.writeFileSync(path.join(CLIPS, "clips.json"), JSON.stringify(meta, null, 2));
      console.log(`  ✓ ${name}.mp4 ${end.toFixed(1)} c, кадров ${frames.length}`);
    },
  };
}

// --- Человеческие действия.
const ease = `k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2`;
async function scrollTo(page, y, ms = 1200) {
  await page.evaluate(([y, ms, ease]) => new Promise((r) => {
    const f = new Function("k", `return ${ease}`);
    const y0 = scrollY, t0 = performance.now(), max = document.documentElement.scrollHeight - innerHeight;
    const to = Math.max(0, Math.min(max, y));
    const step = (t) => { const k = Math.min(1, (t - t0) / ms); scrollTo(0, y0 + (to - y0) * f(k)); if (k < 1) requestAnimationFrame(step); else r(); };
    requestAnimationFrame(step);
  }), [y, ms, ease]);
  await sleep(150);
}
const scrollBy = async (page, dy, ms) => scrollTo(page, (await page.evaluate(() => scrollY)) + dy, ms);
// Прокрутить так, чтобы элемент оказался на высоте `at` от верха окна.
async function bring(page, loc, at = 180, ms = 1100) {
  await loc.waitFor();
  const top = await loc.evaluate((e) => e.getBoundingClientRect().top + scrollY);
  await scrollTo(page, top - at, ms);
}
async function inView(page, loc) {
  const b = await loc.boundingBox();
  const vh = page.viewportSize().height;
  return b && b.y > 70 && b.y + b.height < vh - 90;
}
async function tap(page, loc, { pre = 700, post = 1100 } = {}) {
  await loc.waitFor();
  if (!(await inView(page, loc))) await bring(page, loc, Math.round(page.viewportSize().height * 0.4));
  const b = await loc.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await sleep(pre);
  await page.evaluate(([x, y]) => window.__tap(x, y), [x, y]);
  await sleep(380);
  await loc.click({ position: { x: b.width / 2, y: b.height / 2 } });
  await sleep(post);
}
async function click(page, loc, { pre = 500, post = 1000, move = 750 } = {}) {
  await loc.waitFor();
  if (!(await inView(page, loc))) await bring(page, loc, 300);
  const b = await loc.boundingBox();
  const x = b.x + Math.min(b.width / 2, 60), y = b.y + b.height / 2;
  await sleep(pre);
  await page.evaluate(([x, y, ms]) => window.__cursor(x, y, ms), [x, y, move]);
  await sleep(250);
  await page.evaluate(([x, y]) => window.__click(x, y), [x, y]);
  await page.mouse.click(x, y);
  await sleep(post);
}
async function settle(page, ms = 900) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(ms);
}

const browser = await chromium.launch({ channel: "chrome" });
const P = [780, 1688];
const D = [2160, 1350];

// ---------- Сцены телефона Орлова: вход, «Сегодня», расписание, рейтинг, заявление.
const orlov = await newCtx(browser, "phone");
const op = await orlov.newPage();
await op.goto(BASE + "/login");
await settle(op, 400);

{
  const r = await record(op, "01-login-today", P);
  await sleep(1300);
  r.mark("tap-login");
  await tap(op, op.locator('[data-login="orlov"]'), { pre: 500, post: 0 });
  await op.waitForURL(/\/today/);
  await settle(op, 400);
  r.mark("today");
  await sleep(2600);
  await scrollBy(op, 330, 1800);
  r.mark("retake-card");
  await sleep(2600);
  await scrollBy(op, 330, 1600);
  await sleep(1800);
  await scrollTo(op, 0, 1300);
  await sleep(800);
  await r.stop();
}

let requestUrl, requestNo;
{
  const r = await record(op, "02-schedule", P);
  await sleep(500);
  r.mark("tab");
  await tap(op, op.getByRole("navigation").getByRole("link", { name: "Расписание" }), { post: 0 });
  await op.waitForURL(/\/schedule/);
  await settle(op, 1800);
  r.mark("day");
  await scrollBy(op, 260, 1400);
  await sleep(1800);
  await scrollTo(op, 0, 900);
  r.mark("week");
  await tap(op, op.getByRole("tab", { name: "Неделя" }), { post: 0 });
  await settle(op, 1600);
  await scrollBy(op, 420, 2000);
  await sleep(1500);
  await scrollBy(op, 420, 2000);
  await sleep(1300);
  await scrollTo(op, 0, 1000);
  r.mark("month");
  await tap(op, op.getByRole("tab", { name: "Месяц" }), { post: 0 });
  await settle(op, 2000);
  await scrollBy(op, 380, 1600);
  await sleep(2400);
  await r.stop();
}

{
  const r = await record(op, "03-rating", P);
  await sleep(400);
  r.mark("tab");
  await tap(op, op.getByRole("navigation").getByRole("link", { name: "Сегодня" }), { post: 0 });
  await op.waitForURL(/\/today/);
  await settle(op, 900);
  await tap(op, op.getByTestId("rating-teaser"), { post: 0 });
  await op.waitForURL(/\/rating/);
  await settle(op, 900);
  r.mark("rating-684");
  await sleep(2200);
  await bring(op, op.getByTestId("retake-mode"), 110, 2000);
  await sleep(1400);
  // Ползунок «Если пересдам на»: тянем пальцем до 70.
  const slider = op.getByTestId("retake-mode").locator('[role="slider"]').first();
  if (!(await inView(op, slider))) await bring(op, slider, 420, 900);
  const thumb = await slider.boundingBox();
  const track = await op.getByTestId("retake-mode").locator('[data-slot="slider-track"]').first().boundingBox();
  const target = track.x + ((70 - 30) / 70) * track.width;
  const sx = thumb.x + thumb.width / 2, sy = thumb.y + thumb.height / 2;
  r.mark("drag");
  await op.evaluate(([x, y]) => window.__finger(x, y), [sx, sy]);
  await sleep(500);
  await op.mouse.move(sx, sy);
  await op.mouse.down();
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const x = sx + (target - sx) * e;
    await op.mouse.move(x, sy);
    await op.evaluate(([x, y]) => window.__finger(x, y), [x, sy]);
    await sleep(28);
  }
  await op.mouse.up();
  await op.evaluate(() => window.__finger(0, 0, false));
  // Добиваем ровно до 70 стрелками, если палец промахнулся на балл.
  for (let i = 0; i < 6; i++) {
    const v = parseInt((await op.getByTestId("retake-value").textContent()).replace(/\D/g, ""), 10);
    if (v === 70) break;
    await slider.focus();
    await op.keyboard.press(v < 70 ? "ArrowRight" : "ArrowLeft");
  }
  await op.evaluate(() => document.activeElement?.blur());
  r.mark("at-70");
  await sleep(1800);
  await scrollTo(op, 0, 1600);
  r.mark("rating-717");
  await sleep(3200);
  await bring(op, op.getByTestId("thresholds"), 150, 1300);
  r.mark("scholarship-opens");
  await sleep(2600);
  r.mark("apply");
  await tap(op, op.getByRole("button", { name: "Подать заявление" }), { post: 0 });
  await op.waitForURL(/\/requests\/[0-9a-f-]{36}/);
  await settle(op, 900);
  requestUrl = op.url().split("?")[0];
  requestNo = (await op.getByText(/№ \d{4}-\d{5}/).first().textContent()).match(/\d{4}-\d{5}/)[0];
  r.mark("request-submitted");
  await sleep(2400);
  await bring(op, op.getByTestId("transparency"), 160, 1500);
  r.mark("queue-position");
  await sleep(3000);
  await r.stop();
}
console.log("Заявка", requestNo, requestUrl);

// ---------- Методист на компьютере: очередь, «Взять в работу» → «Готово».
const staff = await newCtx(browser, "desktop");
const sp = await staff.newPage();
await sp.goto(BASE + "/login");
await settle(sp, 300);
{
  const r = await record(sp, "04-staff", D);
  await sleep(900);
  r.mark("login");
  await click(sp, sp.locator('[data-login="metodist"]'), { post: 0 });
  await sp.waitForURL(/\/staff/);
  await settle(sp, 1500);
  r.mark("queue");
  await click(sp, sp.getByRole("link", { name: /^Новые/ }), { post: 0 });
  await settle(sp, 1200);
  const item = sp.getByTestId("queue-item").filter({ hasText: requestNo });
  r.mark("open-item");
  await click(sp, item.locator("summary"), { post: 1400 });
  r.mark("take");
  await click(sp, item.getByRole("button", { name: "Взять в работу" }), { post: 0 });
  // Заявка уходит из «Новых». Сразу переходим в «В работе»: после ухода строки раскрытие
  // соседних заявок остаётся по позиции (находка для docs/decisions.md), в кадре это лишнее.
  await sp.getByTestId("queue-item").filter({ hasText: requestNo }).waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
  await sleep(500);
  r.mark("filter-work");
  await click(sp, sp.getByRole("link", { name: /^В работе/ }), { post: 0 });
  await settle(sp, 1200);
  const item2 = sp.getByTestId("queue-item").filter({ hasText: requestNo });
  await click(sp, item2.locator("summary"), { post: 1400 });
  r.mark("done");
  await click(sp, item2.getByRole("button", { name: "Готово" }), { post: 0 });
  await sp.getByTestId("queue-item").filter({ hasText: requestNo }).waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
  await sleep(500);
  r.mark("filter-ready");
  await click(sp, sp.getByRole("link", { name: /^Готовы/ }), { post: 0 });
  await settle(sp, 800);
  const item3 = sp.getByTestId("queue-item").filter({ hasText: requestNo });
  await item3.waitFor({ timeout: 8000 });
  const box = await item3.boundingBox();
  await sp.evaluate(([x, y]) => window.__cursor(x, y, 800), [box.x + box.width - 260, box.y + box.height / 2]);
  r.mark("ready");
  await sleep(3000);
  await r.stop();
}
await staff.close();

// ---------- Снова телефон Орлова: статус обновился, уведомление, «Сегодня».
{
  const r = await record(op, "05-student-ready", P);
  await sleep(600);
  await scrollTo(op, 0, 800);
  r.mark("reload");
  await op.reload();
  await settle(op, 900);
  r.mark("ready");
  await sleep(2600);
  await bring(op, op.getByTestId("timeline"), 150, 1500);
  await sleep(2200);
  await scrollTo(op, 0, 1000);
  r.mark("bell");
  await tap(op, op.getByTestId("bell"), { post: 0 });
  await op.waitForURL(/\/notifications/);
  await settle(op, 900);
  r.mark("notifications");
  await sleep(2800);
  r.mark("today");
  await tap(op, op.getByRole("navigation").getByRole("link", { name: "Сегодня" }), { post: 0 });
  await op.waitForURL(/\/today/);
  await settle(op, 800);
  await bring(op, op.locator('[data-testid="today-card"][data-kind="retake"]'), 200, 1400);
  r.mark("accepted");
  await sleep(3200);
  await r.stop();
}

// ---------- Безопасность: Соколова открывает адрес заявки Орлова → 404.
{
  const sok = await newCtx(browser, "phone");
  const kp = await sok.newPage();
  await kp.goto(BASE + "/login");
  await kp.locator('[data-login="sokolova"]').click();
  await kp.waitForURL(/\/today/);
  await settle(kp, 1200);
  const r = await record(kp, "06-security", P);
  await sleep(1500);
  r.mark("goto");
  await kp.goto(requestUrl);
  await settle(kp, 500);
  r.mark("404");
  await sleep(3200);
  await r.stop();
  await sok.close();
}

// ---------- Тёмная тема и офлайн (Орлов).
{
  const r = await record(op, "07-dark-offline", P);
  await sleep(500);
  r.mark("profile");
  await tap(op, op.getByRole("navigation").getByRole("link", { name: "Профиль" }), { post: 0 });
  await op.waitForURL(/\/profile/);
  await settle(op, 700);
  await bring(op, op.getByTestId("theme-switcher"), 330, 1300);
  r.mark("dark");
  await tap(op, op.getByRole("radio", { name: "Тёмная" }), { post: 1500 });
  await tap(op, op.getByRole("navigation").getByRole("link", { name: "Сегодня" }), { post: 0 });
  await op.waitForURL(/\/today/);
  await settle(op, 400);
  r.mark("today-dark");
  await op.locator("html[data-offline-ready='1']").waitFor({ timeout: 20000 }).catch(() => {});
  await sleep(1600);
  await orlov.setOffline(true);
  r.mark("offline");
  await tap(op, op.getByRole("navigation").getByRole("link", { name: "Учёба" }), { post: 0 });
  await op.getByTestId("offline-banner").waitFor({ timeout: 10000 }).catch(() => {});
  await sleep(300);
  r.mark("offline-banner");
  await sleep(3400);
  await r.stop();
  await orlov.setOffline(false);
  // Вернуть светлую тему, чтобы не мешать следующей съёмке.
  await op.goto(BASE + "/profile");
  await op.getByRole("radio", { name: "Светлая" }).click();
}

await browser.close();
fs.writeFileSync(path.join(CLIPS, "clips.json"), JSON.stringify({ ...meta, requestNo }, null, 2));
console.log("Готово:", CLIPS);
