// Запись экранов для демо-видео: локальная прод-сборка на свежем демо (npm run db:reset && npx next start -p 3100).
// Запуск: node pitch/demo/scripts/record.mjs <папка-для-кадров>
// Результат: pitch/demo/assets/clips/<сцена>.mp4 (60 к/с) и clips.json: длительности, метки и траектория курсора.
//
// Как снимаем, чтобы ничего не дёргалось:
// - Прокрутка и перетаскивание ползунка — покадрово: ставим положение, снимаем кадр, и так 60 раз на секунду
//   ролика. Время ролика не зависит от того, сколько браузер рендерил кадр, поэтому шаг всегда ровный.
// - Остальное время (загрузка страниц, ожидание) снимаем «вживую» скриншотами CDP с отметкой времени.
// - Курсор в странице не рисуем. Пишем его траекторию (куда, когда, сколько ехал, когда нажал) в clips.json,
//   а рисует его композиция HyperFrames поверх видео — он плавный при любой частоте записи.
import { chromium } from "../../../node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const BASE = "http://localhost:3100";
const FPS = 60;
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
const r3 = (n) => Math.round(n * 1000) / 1000;
// Кривые: та же функция стоит в композиции (GSAP "sine.inOut"), поэтому курсор при перетаскивании
// идёт ровно вместе с ползунком.
const sineInOut = (k) => -(Math.cos(Math.PI * k) - 1) / 2;
const smooth = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2); // cubic in-out, для прокрутки

async function newCtx(browser, kind) {
  return browser.newContext({ ...(kind === "phone" ? PHONE : DESKTOP), locale: "ru-RU", timezoneId: "Europe/Moscow", bypassCSP: true, extraHTTPHeaders: { "X-Forwarded-For": IP } });
}

// Положение курсора живёт между сценами одной вкладки.
const cursorOf = new WeakMap();

class Rec {
  constructor(page, name, size, { cursor = true } = {}) {
    this.page = page;
    this.name = name;
    this.size = size;
    this.vt = 0; // время ролика, с
    this.frames = []; // {f, t}
    this.marks = [];
    this.events = [];
    this.dir = path.join(RAW, name);
    this.n = 0;
    const vp = page.viewportSize();
    this.vp = vp;
    const c = cursorOf.get(page) ?? { x: Math.round(vp.width * 0.72), y: Math.round(vp.height * 0.62), shape: "arrow" };
    cursorOf.set(page, c);
    this.cur = c;
    this.cursorStart = { x: c.x, y: c.y, shape: c.shape, visible: cursor };
  }
  async start() {
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    await this.shot(0);
    return this;
  }
  async shot(t) {
    let data;
    try {
      const r = await Promise.race([this.cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92 }), sleep(4000).then(() => null)]);
      data = r?.data;
    } catch {
      data = null; // страница в момент навигации — пропускаем кадр, держим предыдущий
    }
    if (!data) return;
    const f = path.join(this.dir, `${String(this.n++).padStart(5, "0")}.jpg`);
    fs.writeFileSync(f, Buffer.from(data, "base64"));
    this.frames.push({ f, t });
  }
  // Живая съёмка: кадры с настоящими отметками времени.
  async live(ms, until = null) {
    const base = this.vt;
    const t0 = performance.now();
    let done = !until;
    if (until) until.then(() => (done = true), () => (done = true));
    for (;;) {
      const e = performance.now() - t0;
      if (e >= ms && done) break;
      if (e > 20000) break;
      await this.shot(base + e / 1000);
    }
    this.vt = base + (performance.now() - t0) / 1000;
    if (!until) this.vt = base + Math.max(ms, 0) / 1000; // чистая пауза — ровно столько, сколько заказали
  }
  // Покадровая съёмка: fn(k) ставит состояние для доли k∈(0,1], затем кадр ровно через 1/FPS.
  async steps(sec, fn) {
    const n = Math.max(1, Math.round(sec * FPS));
    for (let i = 1; i <= n; i++) {
      await fn(i / n);
      await this.shot(this.vt + i / FPS);
    }
    this.vt += n / FPS;
  }
  mark(label) {
    this.marks.push({ label, t: r3(this.vt) });
    console.log(`  [${this.name}] ${label} @ ${this.vt.toFixed(2)}s`);
  }
  ev(e) {
    this.events.push({ t: r3(this.vt), ...e });
  }

  // --- прокрутка
  async scrollTo(y, sec = null) {
    const [y0, max] = await this.page.evaluate(() => [scrollY, document.documentElement.scrollHeight - innerHeight]);
    const to = Math.max(0, Math.min(max, Math.round(y)));
    const d = Math.abs(to - y0);
    if (d < 2) return;
    const dur = sec ?? Math.min(2.2, Math.max(1.1, 0.7 + d / 450));
    await this.steps(dur, (k) => this.page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y0 + (to - y0) * smooth(k)));
    await this.live(120);
  }
  async scrollBy(dy, sec) {
    const y = await this.page.evaluate(() => scrollY);
    return this.scrollTo(y + dy, sec);
  }
  // Прокрутить так, чтобы элемент оказался на высоте `at` от верха окна.
  async bring(loc, at = 180, sec) {
    await loc.waitFor();
    const top = await loc.evaluate((e) => e.getBoundingClientRect().top + scrollY);
    await this.scrollTo(top - at, sec);
  }
  async inView(loc) {
    const fixed = await loc.evaluate((e) => {
      for (let n = e; n && n !== document.body; n = n.parentElement) {
        const p = getComputedStyle(n).position;
        if (p === "fixed" || p === "sticky") return true;
      }
      return false;
    });
    if (fixed) return true;
    const b = await loc.boundingBox();
    const vh = this.vp.height;
    return b && b.y > 70 && b.y + b.height < vh - 90;
  }

  // --- курсор
  async moveTo(x, y, { shape = "hand", dwell = 0 } = {}) {
    const c = this.cur;
    const dist = Math.hypot(x - c.x, y - c.y);
    if (dist > 2) {
      const scale = this.vp.width / 390; // на десктопе путь длиннее в css px
      const dur = r3(Math.min(1.0, Math.max(0.55, 0.42 + dist / (900 * Math.sqrt(scale)))));
      this.ev({ type: "move", x: r3(x), y: r3(y), dur, shape });
      await this.live(dur * 1000);
    } else if (shape !== c.shape) {
      this.ev({ type: "shape", shape });
    }
    await this.page.mouse.move(x, y);
    Object.assign(c, { x, y, shape });
    if (dwell) await this.live(dwell);
  }
  async press() {
    this.ev({ type: "down" });
    await this.page.mouse.down();
    await this.live(140);
    this.ev({ type: "up" });
    await this.page.mouse.up();
  }
  // Подвести курсор к элементу и нажать. Перед нажатием курсор стоит на кнопке ~0,35 с.
  async click(loc, { at = null, left = false, dwell = 380 } = {}) {
    await loc.waitFor();
    if (!(await this.inView(loc))) await this.bring(loc, at ?? Math.round(this.vp.height * 0.4));
    const b = await loc.boundingBox();
    const x = b.x + (left ? Math.min(b.width / 2, 60) : b.width / 2), y = b.y + b.height / 2;
    await this.moveTo(x, y, { shape: "hand", dwell });
    await this.press();
  }
  async settle(ms = 900) {
    await this.live(ms, this.page.waitForLoadState("networkidle").catch(() => {}));
  }
  // Ждём условие и снимаем, пока ждём.
  async wait(promise, min = 0) {
    await this.live(min, promise);
  }

  async stop() {
    await this.live(250);
    await this.cdp.detach().catch(() => {});
    const end = this.vt;
    // Раскладываем кадры по слотам 1/FPS: пустой слот держит предыдущий кадр.
    const slots = Math.round(end * FPS);
    const bySlot = new Array(slots).fill(null);
    for (const fr of this.frames) {
      const s = Math.min(slots - 1, Math.max(0, Math.round(fr.t * FPS)));
      bySlot[s] = fr.f;
    }
    const seq = path.join(this.dir, "seq");
    fs.mkdirSync(seq, { recursive: true });
    let last = this.frames[0].f;
    for (let i = 0; i < slots; i++) {
      if (bySlot[i]) last = bySlot[i];
      fs.symlinkSync(last, path.join(seq, `${String(i).padStart(6, "0")}.jpg`));
    }
    const out = path.join(CLIPS, `${this.name}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(seq, "%06d.jpg"), "-vf", `scale=${this.size[0]}:${this.size[1]}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-r", String(FPS), "-g", String(FPS), out]);
    meta[this.name] = {
      duration: r3(slots / FPS),
      size: this.size,
      viewport: [this.vp.width, this.vp.height],
      fps: FPS,
      marks: this.marks,
      cursor: { start: this.cursorStart, events: this.events },
    };
    fs.writeFileSync(path.join(CLIPS, "clips.json"), JSON.stringify(meta, null, 2));
    console.log(`  ✓ ${this.name}.mp4 ${end.toFixed(1)} c, кадров снято ${this.frames.length}, в ролике ${slots}`);
  }
}

async function prep(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(400);
}

const browser = await chromium.launch({ channel: "chrome" });
const P = [780, 1688];
const D = [2160, 1350];

// ---------- Сцены телефона Орлова: вход, «Сегодня», расписание, рейтинг, заявление.
const orlov = await newCtx(browser, "phone");
const op = await orlov.newPage();
await op.goto(BASE + "/login");
await prep(op);
const nav = (name) => op.getByRole("navigation").getByRole("link", { name });

{
  const r = await new Rec(op, "01-login-today", P).start();
  await r.live(1000);
  r.mark("tap-login");
  await r.click(op.locator('[data-login="orlov"]'));
  await r.wait(op.waitForURL(/\/today/), 300);
  await r.settle(400);
  r.mark("today");
  await r.live(2400);
  await r.scrollBy(330, 1.8);
  r.mark("retake-card");
  await r.live(2600);
  await r.scrollBy(330, 1.8);
  await r.live(1800);
  await r.scrollTo(0, 1.6);
  await r.live(700);
  await r.stop();
}

let requestUrl, requestNo;
{
  const r = await new Rec(op, "02-schedule", P).start();
  await r.live(400);
  r.mark("tab");
  await r.click(nav("Расписание"));
  await r.wait(op.waitForURL(/\/schedule/));
  await r.settle(1600);
  r.mark("day");
  await r.scrollBy(260, 1.6);
  await r.live(1800);
  await r.scrollTo(0, 1.3);
  r.mark("week");
  await r.click(op.getByRole("tab", { name: "Неделя" }));
  await r.settle(1500);
  await r.scrollBy(420, 2.0);
  await r.live(1500);
  await r.scrollBy(420, 2.0);
  await r.live(1300);
  await r.scrollTo(0, 1.8);
  r.mark("month");
  await r.click(op.getByRole("tab", { name: "Месяц" }));
  await r.settle(1800);
  await r.scrollBy(380, 1.8);
  await r.live(2400);
  await r.stop();
}

{
  const r = await new Rec(op, "03-rating", P).start();
  await r.live(300);
  r.mark("tab");
  await r.click(nav("Сегодня"));
  await r.wait(op.waitForURL(/\/today/));
  await r.settle(700);
  await r.click(op.getByTestId("rating-teaser"));
  await r.wait(op.waitForURL(/\/rating/));
  await r.settle(700);
  r.mark("rating-684");
  await r.live(2200);
  await r.bring(op.getByTestId("retake-mode"), 110, 2.0);
  await r.live(1200);
  // Ползунок «Если пересдам на»: тянем до 70.
  const slider = op.getByTestId("retake-mode").locator('[role="slider"]').first();
  if (!(await r.inView(slider))) await r.bring(slider, 420, 1.2);
  const thumb = await slider.boundingBox();
  const track = await op.getByTestId("retake-mode").locator('[data-slot="slider-track"]').first().boundingBox();
  const sx = thumb.x + thumb.width / 2, sy = thumb.y + thumb.height / 2;
  const target = track.x + ((70 - 30) / 70) * track.width;
  r.mark("drag");
  await r.moveTo(sx, sy, { shape: "hand", dwell: 300 });
  r.ev({ type: "down" });
  await op.mouse.down();
  await r.live(120);
  const dragSec = 1.5;
  r.ev({ type: "drag", x: r3(target), y: r3(sy), dur: dragSec, ease: "sine.inOut" });
  await r.steps(dragSec, (k) => op.mouse.move(sx + (target - sx) * sineInOut(k), sy));
  r.cur.x = target;
  await r.live(150);
  r.ev({ type: "up" });
  await op.mouse.up();
  // Добиваем ровно до 70 стрелками, если промахнулись на балл.
  for (let i = 0; i < 6; i++) {
    const v = parseInt((await op.getByTestId("retake-value").textContent()).replace(/\D/g, ""), 10);
    if (v === 70) break;
    await slider.focus();
    await op.keyboard.press(v < 70 ? "ArrowRight" : "ArrowLeft");
  }
  await op.evaluate(() => document.activeElement?.blur());
  r.mark("at-70");
  await r.live(1800);
  await r.scrollTo(0, 1.8);
  r.mark("rating-717");
  await r.live(3200);
  await r.bring(op.getByTestId("thresholds"), 150, 1.6);
  r.mark("scholarship-opens");
  await r.live(2400);
  r.mark("apply");
  await r.click(op.getByRole("button", { name: "Подать заявление" }));
  await r.wait(op.waitForURL(/\/requests\/[0-9a-f-]{36}/));
  await r.settle(800);
  requestUrl = op.url().split("?")[0];
  requestNo = (await op.getByText(/№ \d{4}-\d{5}/).first().textContent()).match(/\d{4}-\d{5}/)[0];
  r.mark("request-submitted");
  await r.live(2400);
  await r.bring(op.getByTestId("transparency"), 160, 1.7);
  r.mark("queue-position");
  await r.live(3000);
  await r.stop();
}
console.log("Заявка", requestNo, requestUrl);

// ---------- Методист на компьютере: очередь, «Взять в работу» → «Готово».
const staff = await newCtx(browser, "desktop");
const sp = await staff.newPage();
await sp.goto(BASE + "/login");
await prep(sp);
{
  const r = await new Rec(sp, "04-staff", D).start();
  const click = (loc, o = {}) => r.click(loc, { left: true, ...o });
  await r.live(900);
  r.mark("login");
  await r.click(sp.locator('[data-login="metodist"]'));
  await r.wait(sp.waitForURL(/\/staff/));
  await r.settle(1300);
  r.mark("queue");
  await r.click(sp.getByRole("link", { name: /^Новые/ }));
  await r.settle(1100);
  const item = sp.getByTestId("queue-item").filter({ hasText: requestNo });
  r.mark("open-item");
  await click(item.locator("summary"), { at: 300 });
  await r.live(1400);
  r.mark("take");
  await r.click(item.getByRole("button", { name: "Взять в работу" }));
  // Заявка уходит из «Новых». Сразу переходим в «В работе»: после ухода строки раскрытие
  // соседних заявок остаётся по позиции (находка в docs/decisions.md), в кадре это лишнее — build.mjs вырезает.
  await r.wait(sp.getByTestId("queue-item").filter({ hasText: requestNo }).waitFor({ state: "detached", timeout: 8000 }).catch(() => {}));
  await r.live(500);
  r.mark("filter-work");
  await r.click(sp.getByRole("link", { name: /^В работе/ }));
  await r.settle(1100);
  const item2 = sp.getByTestId("queue-item").filter({ hasText: requestNo });
  await click(item2.locator("summary"), { at: 300 });
  await r.live(1400);
  r.mark("done");
  await r.click(item2.getByRole("button", { name: "Готово" }));
  await r.wait(sp.getByTestId("queue-item").filter({ hasText: requestNo }).waitFor({ state: "detached", timeout: 8000 }).catch(() => {}));
  await r.live(500);
  r.mark("filter-ready");
  await r.click(sp.getByRole("link", { name: /^Готовы/ }));
  await r.settle(800);
  const item3 = sp.getByTestId("queue-item").filter({ hasText: requestNo });
  await item3.waitFor({ timeout: 8000 });
  const box = await item3.boundingBox();
  await r.moveTo(box.x + box.width - 260, box.y + box.height / 2, { shape: "arrow" });
  r.mark("ready");
  await r.live(3000);
  await r.stop();
}
await staff.close();

// ---------- Снова телефон Орлова: статус обновился, уведомление, «Сегодня».
{
  const r = await new Rec(op, "05-student-ready", P).start();
  await r.live(500);
  await r.scrollTo(0, 1.0);
  r.mark("reload");
  await r.wait(op.reload());
  await r.settle(800);
  r.mark("ready");
  await r.live(2600);
  await r.bring(op.getByTestId("timeline"), 150, 1.7);
  await r.live(2200);
  await r.scrollTo(0, 1.4);
  r.mark("bell");
  await r.click(op.getByTestId("bell"));
  await r.wait(op.waitForURL(/\/notifications/));
  await r.settle(800);
  r.mark("notifications");
  await r.live(2800);
  r.mark("today");
  await r.click(nav("Сегодня"));
  await r.wait(op.waitForURL(/\/today/));
  await r.settle(700);
  // Карточка пересдачи может оказаться ниже первых трёх — тогда раскрываем список, как сделал бы студент.
  const retakeCard = op.locator('[data-testid="today-card"][data-kind="retake"]');
  if (await retakeCard.isHidden()) {
    const more = op.getByRole("button", { name: /Показать ещё/ });
    await r.bring(more, 420, 1.2);
    await r.click(more);
    await r.settle(500);
  }
  await r.bring(retakeCard, 200, 1.6);
  r.mark("accepted");
  await r.live(3200);
  await r.stop();
}

// ---------- Безопасность: Соколова открывает адрес заявки Орлова → 404. Курсора нет: адрес вставляют в строку.
{
  const sok = await newCtx(browser, "phone");
  const kp = await sok.newPage();
  await kp.goto(BASE + "/login");
  await kp.locator('[data-login="sokolova"]').click();
  await kp.waitForURL(/\/today/);
  await prep(kp);
  await sleep(800);
  const r = await new Rec(kp, "06-security", P, { cursor: false }).start();
  await r.live(1500);
  r.mark("goto");
  await r.wait(kp.goto(requestUrl));
  await r.settle(400);
  r.mark("404");
  await r.live(3200);
  await r.stop();
  await sok.close();
}

// ---------- Тёмная тема и офлайн (Орлов).
{
  const r = await new Rec(op, "07-dark-offline", P).start();
  await r.live(400);
  r.mark("profile");
  await r.click(nav("Профиль"));
  await r.wait(op.waitForURL(/\/profile/));
  await r.settle(600);
  await r.bring(op.getByTestId("theme-switcher"), 330, 1.5);
  r.mark("dark");
  await r.click(op.getByRole("radio", { name: "Тёмная" }));
  await r.live(1500);
  await r.click(nav("Сегодня"));
  await r.wait(op.waitForURL(/\/today/));
  await r.settle(400);
  r.mark("today-dark");
  await r.wait(op.locator("html[data-offline-ready='1']").waitFor({ timeout: 20000 }).catch(() => {}), 1600);
  await orlov.setOffline(true);
  r.mark("offline");
  await r.click(nav("Учёба"));
  await r.wait(op.getByTestId("offline-banner").waitFor({ timeout: 10000 }).catch(() => {}), 300);
  r.mark("offline-banner");
  await r.live(3400);
  await r.stop();
  await orlov.setOffline(false);
  // Вернуть светлую тему, чтобы не мешать следующей съёмке.
  await op.goto(BASE + "/profile");
  await op.getByRole("radio", { name: "Светлая" }).click();
}

await browser.close();
fs.writeFileSync(path.join(CLIPS, "clips.json"), JSON.stringify({ ...meta, requestNo }, null, 2));
console.log("Готово:", CLIPS);
