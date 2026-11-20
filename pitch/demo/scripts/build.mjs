// Собирает index.html демо-видео из записей (assets/clips/clips.json): сцены, титры, тайминг по меткам записи.
// Запуск: node pitch/demo/scripts/build.mjs  →  pitch/demo/index.html
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const clips = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/clips/clips.json"), "utf8"));
const mark = (clip, label) => {
  const m = clips[clip].marks.find((x) => x.label === label);
  if (!m) throw new Error(`нет метки ${clip}/${label}`);
  return m.t;
};
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (t) => `${Math.floor(Math.round(t) / 60)}:${String(Math.round(t) % 60).padStart(2, "0")}`;

// Стоп-кадры: последний кадр сцены, чтобы держать экран без видео.
function still(clip, out, at = null) {
  const src = path.join(ROOT, "assets/clips", `${clip}.mp4`);
  const dst = path.join(ROOT, "assets/clips", out);
  const args = at == null ? ["-sseof", "-0.2", "-i", src] : ["-ss", String(at), "-i", src];
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args, "-frames:v", "1", "-q:v", "2", dst]);
  return `assets/clips/${out}`;
}
const LOGIN_STILL = still("01-login-today", "01-first.jpg", 0.3);
const RATING_LAST = still("03-rating", "03-last.jpg");
const SEC_LAST = still("06-security", "06-last.jpg");
const OFF_LAST = still("07-dark-offline", "07-last.jpg");

// ---------- Таймлайн
let T = 0;
const scenes = [];
const videos = []; // {id, src, start, mediaStart, dur, slot: 'phone'|'desk'}
const images = []; // {id, src, start, dur, slot}
const cues = []; // {scene, at, text}

function scene(id, dur, data) {
  scenes.push({ id, start: r2(T), dur: r2(dur), ...data });
  const s = T;
  T += dur;
  return s;
}

// S0: заставка, на телефоне — экран входа.
const INTRO = 8;
images.push({ id: "img-login", src: LOGIN_STILL, start: 0, dur: INTRO + 0.6, slot: "phone" });
scene("intro", INTRO, { kind: "intro" });

// S1: вход и «Сегодня».
{
  const ms = 0.6, end = clips["01-login-today"].duration - 0.3;
  const s = scene("today", end - ms, {
    kicker: "01 · Сегодня",
    title: "Деканат пишет первым",
    lead: "Максим Орлов, 2 курс, входит одной кнопкой. Главный экран собирает то, что важно сегодня.",
  });
  videos.push({ id: "v-today", src: "assets/clips/01-login-today.mp4", start: s, mediaStart: ms, dur: end - ms, slot: "phone" });
  const at = (l) => r2(s + mark("01-login-today", l) - ms);
  cues.push({ scene: "today", at: at("today") + 0.3, text: "Карточки по правилам: перенос пары, возвращённая заявка, пересдача" });
  cues.push({ scene: "today", at: at("retake-card"), text: "Пересдача через 12 дней и срок заявления — в одной карточке" });
  cues.push({ scene: "today", at: at("retake-card") + 4.2, text: "Ниже — пары на сегодня, рейтинг и новости деканата" });
}

// S2: расписание.
{
  const c = "02-schedule", ms = 0.35, end = clips[c].duration - 0.3;
  const s = scene("schedule", end - ms, {
    kicker: "02 · Расписание",
    title: "Перенос видно сразу",
    lead: "День, неделя и месяц. Изменения выделены цветом, с причиной и «было → стало».",
  });
  videos.push({ id: "v-schedule", src: `assets/clips/${c}.mp4`, start: s, mediaStart: ms, dur: end - ms, slot: "phone" });
  const at = (l) => r2(s + mark(c, l) - ms);
  cues.push({ scene: "schedule", at: at("day"), text: "Семинар перенесли: 10:40 → 16:00, по просьбе кафедры" });
  cues.push({ scene: "schedule", at: at("week"), text: "Неделя целиком, сводка изменений сверху" });
  cues.push({ scene: "schedule", at: at("month"), text: "Месяц: пары, экзамены, пересдача и всё, что поменялось" });
}

// S3: рейтинг-навигатор и заявление.
let ratingEnd;
{
  const c = "03-rating", ms = Math.max(0, mark(c, "rating-684") - 1.2), end = clips[c].duration - 0.2;
  const s = scene("rating", end - ms, {
    kicker: "03 · Рейтинг-навигатор",
    title: "Что будет, если…",
    lead: "Кабинет показывает не только «что было». Ползунок считает рейтинг после пересдачи.",
  });
  videos.push({ id: "v-rating", src: `assets/clips/${c}.mp4`, start: s, mediaStart: ms, dur: end - ms, slot: "phone" });
  const at = (l) => r2(s + mark(c, l) - ms);
  cues.push({ scene: "rating", at: at("rating-684"), text: "Сейчас 68,4 из 100: долг по макроэкономике блокирует стипендию" });
  cues.push({ scene: "rating", at: at("drag"), text: "«Если пересдам на 70» — пересчёт сразу, без перезагрузки" });
  cues.push({ scene: "rating", at: at("rating-717"), text: "Прогноз 71,7 — академическая стипендия открывается", big: "68,4 → 71,7" });
  cues.push({ scene: "rating", at: at("apply"), text: "«Подать заявление» создаёт настоящую заявку в учебный офис" });
  cues.push({ scene: "rating", at: at("queue-position"), text: "Статус «Подана», обычный срок и место в очереди" });
  ratingEnd = T;
}

// S4: сплит — методист на компьютере, студент на телефоне.
let switchAt;
{
  const c = "04-staff", ms = 0.4, end = mark(c, "ready") + 3.0;
  // Вырезаем ~2 с после «Взять в работу»: строка ушла из «Новых», а раскрытие осталось у соседних
  // заявок (баг интерфейса, записан в отчёт). Склейка сразу на переход в «В работе».
  const cutA = mark(c, "take") + 1.55, cutB = mark(c, "filter-work") + 1.6;
  const gap = cutB - cutA;
  const s = scene("split", end - ms - gap, {
    kind: "split",
    kicker: "04 · Учебный офис",
    title: "Методист меняет статус — студент видит сразу",
  });
  videos.push({ id: "v-staff", src: `assets/clips/${c}.mp4`, start: s, mediaStart: ms, dur: r2(cutA - ms), slot: "desk" });
  videos.push({ id: "v-staff-b", src: `assets/clips/${c}.mp4`, start: r2(s + cutA - ms), mediaStart: r2(cutB), dur: r2(end - cutB), slot: "desk" });
  const at = (l) => {
    const t = mark(c, l);
    if (t < cutA) return r2(s + t - ms);
    return r2(s + cutA - ms + Math.max(0, t - cutB)); // вырезанный кусок схлопывается в точку склейки
  };
  switchAt = at("filter-ready") - 0.2;
  images.push({ id: "img-rating-last", src: RATING_LAST, start: r2(ratingEnd - 0.1), dur: r2(switchAt - ratingEnd + 0.5), slot: "phone" });
  cues.push({ scene: "split", at: at("queue") + 0.4, text: "Заявка Орлова в «Новых»" });
  cues.push({ scene: "split", at: at("take"), text: "«Взять в работу»" });
  cues.push({ scene: "split", at: at("filter-work") + 0.6, text: "Заявка «В работе», ведёт Ирина Сафонова" });
  cues.push({ scene: "split", at: at("done"), text: "«Готово» — студенту уходит уведомление" });
}

// S5: снова телефон — статус обновился (видео стартует ещё в сплите).
{
  const c = "05-student-ready", ms = Math.max(0, mark(c, "reload") - 0.25), end = clips[c].duration - 0.2;
  const vStart = switchAt;
  const vDur = end - ms;
  const sceneStart = T;
  const s = scene("ready", vStart + vDur - sceneStart, {
    kicker: "05 · Статус и уведомление",
    title: "Заявка готова",
    lead: "Таймлайн как у посылки: кто ведёт, когда взяли, когда готово.",
  });
  videos.push({ id: "v-ready", src: `assets/clips/${c}.mp4`, start: r2(vStart), mediaStart: ms, dur: r2(vDur), slot: "phone" });
  const at = (l) => r2(vStart + mark(c, l) - ms);
  cues.push({ scene: "split", at: at("ready"), text: "У студента: «Готова», ведёт Ирина Сафонова" });
  cues.push({ scene: "ready", at: Math.max(s + 0.6, at("ready") + 3), text: "История: подана → в работе → готова" });
  cues.push({ scene: "ready", at: at("notifications"), text: "Уведомления: «Взяли в работу», «Готово»" });
  cues.push({ scene: "ready", at: at("accepted"), text: "«Сегодня» уже знает: заявление принято, вы в ведомости" });
}

// S6: безопасность.
{
  const c = "06-security", ms = 0.6, vd = clips[c].duration - 0.3 - ms, hold = 5.2;
  const s = scene("security", vd + hold, {
    kicker: "06 · Безопасность",
    title: "Каждый видит только своё",
    lead: "Анна Соколова вставляет адрес заявки Максима — и получает 404.",
  });
  videos.push({ id: "v-security", src: `assets/clips/${c}.mp4`, start: s, mediaStart: ms, dur: vd, slot: "phone" });
  images.push({ id: "img-sec-last", src: SEC_LAST, start: r2(s + vd - 0.05), dur: r2(hold + 0.6), slot: "phone" });
  cues.push({ scene: "security", at: r2(s + mark(c, "404") - ms + 0.3), text: "Чужая заявка = несуществующая: 404, проверка в запросе к базе" });
  cues.push({ scene: "security", at: r2(s + mark(c, "404") - ms + 2.6), text: "Пароли — argon2id, роль методиста проверяет сервер" });
  cues.push({ scene: "security", at: r2(s + mark(c, "404") - ms + 4.9), text: "Автотесты: 80 сценариев в браузере на 360 px и 69 юнит-тестов" });
}

// S7: тёмная тема и офлайн.
{
  const c = "07-dark-offline", ms = 0.4, end = clips[c].duration - 0.2;
  const s = scene("offline", end - ms + 0.8, {
    kicker: "07 · Каждый день",
    title: "Тёмная тема и работа без сети",
    lead: "Кабинет ставится на главный экран телефона как приложение.",
  });
  videos.push({ id: "v-offline", src: `assets/clips/${c}.mp4`, start: s, mediaStart: ms, dur: end - ms, slot: "phone" });
  images.push({ id: "img-off-last", src: OFF_LAST, start: r2(s + end - ms - 0.05), dur: 1.6, slot: "phone" });
  const at = (l) => r2(s + mark(c, l) - ms);
  cues.push({ scene: "offline", at: at("dark"), text: "Светлая, тёмная или как в системе — без вспышки при загрузке" });
  cues.push({ scene: "offline", at: at("offline-banner") - 0.6, text: "Нет сети: «Сегодня», расписание и учёба открываются из кэша с пометкой времени" });
}

// S8: финал.
scene("final", 9, { kind: "final" });
const DURATION = r2(T);

// ---------- Разметка
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const PH = { left: 300, top: 78 }; // телефон в соло-кадре
const sceneHtml = scenes
  .map((sc) => {
    const attrs = `id="s-${sc.id}" class="clip scene scene-${sc.kind ?? "solo"}" data-start="${sc.start}" data-duration="${sc.dur}" data-track-index="2"`;
    if (sc.kind === "intro") {
      return `<div ${attrs}>
        <div class="col">
          <div class="brand"><img id="intro-icon" src="assets/app-icon.png" alt="" /><span id="intro-name">Ориентир</span></div>
          <h1 id="intro-title">Цифровой деканат, который пишет первым</h1>
          <p id="intro-lead">Расписание, оценки, рейтинг, заявки и объявления деканата — в одном кабинете на телефоне. И не только «что было», но и «что будет, если…».</p>
          <p id="intro-meta">Демо прототипа · __LEN__ · без звука</p>
        </div>
      </div>`;
    }
    if (sc.kind === "final") {
      return `<div ${attrs}>
        <div class="final">
          <div class="brand"><img id="final-icon" src="assets/app-icon.png" alt="" /><span id="final-name">Ориентир</span></div>
          <p id="final-kicker">Попробуйте сами</p>
          <p id="final-url">orientir.rapira-cloud.ru</p>
          <div id="final-logins">
            <div class="login"><b>orlov</b><span>студент с долгом и пересдачей</span></div>
            <div class="login"><b>sokolova</b><span>отличница без долгов</span></div>
            <div class="login"><b>metodist</b><span>очередь учебного офиса</span></div>
          </div>
          <p id="final-pass">Пароль <b>demo2026</b> · на странице входа — кнопки «Войти как…» и копии 2, 3 для независимой проверки</p>
          <p id="final-disc">Концепт для MGIMO×AI CHALLENGE, кейс «Цифровой деканат будущего». Не официальный сервис, все данные вымышлены.</p>
        </div>
      </div>`;
    }
    const sceneCues = cues.filter((c) => c.scene === sc.id);
    const cueHtml = sceneCues
      .map((c, i) => `<li id="cue-${sc.id}-${i}" class="cue"><span class="dot"></span><span class="t">${esc(c.text)}</span></li>`)
      .join("");
    const big = sceneCues.find((c) => c.big);
    if (sc.kind === "split") {
      return `<div ${attrs}>
        <div class="split-head"><p class="kicker" id="k-${sc.id}">${esc(sc.kicker)}</p><h2 class="title" id="h-${sc.id}">${esc(sc.title)}</h2></div>
        <ul class="cues split-cues">${cueHtml}</ul>
        <p class="tag tag-phone" id="tag-phone" data-layout-ignore>Студент · телефон</p>
        <p class="tag tag-desk" id="tag-desk" data-layout-ignore>Методист · компьютер</p>
      </div>`;
    }
    return `<div ${attrs}>
      <div class="col">
        <p class="kicker" id="k-${sc.id}">${esc(sc.kicker)}</p>
        <h2 class="title" id="h-${sc.id}">${esc(sc.title)}</h2>
        <p class="lead" id="l-${sc.id}">${esc(sc.lead)}</p>
        <ul class="cues">${cueHtml}</ul>
        ${big ? `<p class="big" id="big-${sc.id}">${esc(big.big)}</p>` : ""}
      </div>
    </div>`;
  })
  .join("\n      ");

const media = (slot) =>
  [
    ...images.filter((m) => m.slot === slot).map((m) => `<img id="${m.id}" class="clip media" src="${m.src}" alt="" data-start="${r2(m.start)}" data-duration="${r2(m.dur)}" data-track-index="1" />`),
    ...videos.filter((m) => m.slot === slot).map((m) => `<video id="${m.id}" class="clip media" src="${m.src}" muted playsinline data-start="${r2(m.start)}" data-duration="${r2(m.dur)}" data-media-start="${r2(m.mediaStart)}" data-track-index="0"></video>`),
  ].join("\n          ");

// ---------- Анимация (GSAP, на корневом таймлайне)
const S = Object.fromEntries(scenes.map((s) => [s.id, s]));
const js = [];
const add = (line) => js.push(line);
// Фон: медленное дыхание пятен.
add(`tl.fromTo("#glow-a", { x: -40, y: 0, scale: 1 }, { x: 60, y: 30, scale: 1.12, duration: ${DURATION / 2}, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0);`);
add(`tl.fromTo("#glow-b", { x: 30, y: 0, scale: 1.05 }, { x: -50, y: -40, scale: 0.95, duration: ${DURATION / 2}, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0);`);
// Телефон появляется в заставке.
add(`tl.fromTo("#phone", { y: 24 }, { y: 0, duration: 1.4, ease: "power2.out" }, 0);`);
// Заставка.
add(`tl.from("#intro-icon", { scale: 0.6, opacity: 0, duration: 0.6, ease: "back.out(1.6)" }, 0.3);`);
add(`tl.from("#intro-name", { x: -20, opacity: 0, duration: 0.6, ease: "power3.out" }, 0.45);`);
add(`tl.from("#intro-title", { y: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, 0.8);`);
add(`tl.from("#intro-lead", { y: 20, opacity: 0, duration: 0.7, ease: "power2.out" }, 1.4);`);
add(`tl.from("#intro-meta", { opacity: 0, duration: 0.6 }, 2.0);`);
add(`tl.to("#s-intro .col", { opacity: 0, y: -16, duration: 0.45, ease: "power2.in" }, ${INTRO - 0.5});`);
// Соло-сцены: заголовок, подводка, реплики.
for (const sc of scenes.filter((s) => !s.kind)) {
  const st = sc.start;
  add(`tl.from("#k-${sc.id}", { y: 14, opacity: 0, duration: 0.5, ease: "power3.out" }, ${r2(st + 0.15)});`);
  add(`tl.from("#h-${sc.id}", { y: 26, opacity: 0, duration: 0.7, ease: "power3.out" }, ${r2(st + 0.25)});`);
  add(`tl.from("#l-${sc.id}", { y: 18, opacity: 0, duration: 0.6, ease: "power2.out" }, ${r2(st + 0.5)});`);
  add(`tl.to("#s-${sc.id} .col", { opacity: 0, y: -14, duration: 0.4, ease: "power2.in" }, ${r2(st + sc.dur - 0.45)});`);
}
// Реплики: появляются по меткам записи, прошлые приглушаются.
for (const sc of scenes) {
  const list = cues.filter((c) => c.scene === sc.id);
  list.forEach((c, i) => {
    const at = Math.max(c.at, sc.start + 0.6);
    add(`tl.fromTo("#cue-${sc.id}-${i}", { x: -18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, ${r2(at)});`);
    if (i > 0) add(`tl.to("#cue-${sc.id}-${i - 1}", { opacity: ${sc.kind === "split" ? 0 : 0.42}, duration: ${sc.kind === "split" ? 0.25 : 0.4} }, ${r2(at)});`);
    if (c.big) {
      add(`tl.fromTo("#big-${sc.id}", { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.7)" }, ${r2(at + 0.2)});`);
      add(`tl.to("#big-${sc.id}", { opacity: 0, y: -10, duration: 0.4 }, ${r2(at + 6.2)});`);
    }
  });
}
// Смена видео на телефоне: короткий наплыв.
for (const v of videos) add(`tl.fromTo("#${v.id}", { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "none" }, ${r2(v.start)});`);
// Сплит: телефон уезжает влево и уменьшается, справа появляется окно браузера.
const sp = S.split;
const PS = { left: 195, top: 236, scale: 0.8 };
add(`tl.to("#phone", { x: ${PS.left - PH.left}, y: ${PS.top - PH.top}, scale: ${PS.scale}, duration: 0.9, ease: "power3.inOut" }, ${r2(sp.start - 0.3)});`);
add(`tl.fromTo("#desk", { x: 160, opacity: 0 }, { x: 0, opacity: 1, duration: 0.9, ease: "power3.out" }, ${r2(sp.start + 0.1)});`);
add(`tl.from("#k-split", { y: 14, opacity: 0, duration: 0.5, ease: "power3.out" }, ${r2(sp.start + 0.3)});`);
add(`tl.from("#h-split", { y: 22, opacity: 0, duration: 0.6, ease: "power3.out" }, ${r2(sp.start + 0.4)});`);
add(`tl.from(["#tag-phone", "#tag-desk"], { opacity: 0, y: 8, duration: 0.5, stagger: 0.1 }, ${r2(sp.start + 0.8)});`);
const spEnd = sp.start + sp.dur;
add(`tl.to("#s-split > *", { opacity: 0, duration: 0.4 }, ${r2(spEnd - 0.4)});`);
add(`tl.to("#desk", { x: 160, opacity: 0, duration: 0.8, ease: "power3.in" }, ${r2(spEnd - 0.6)});`);
add(`tl.to("#phone", { x: 0, y: 0, scale: 1, duration: 0.9, ease: "power3.inOut" }, ${r2(spEnd - 0.3)});`);
// Финал: телефон уходит, текст по центру.
const fi = S.final;
add(`tl.to("#phone", { y: 60, opacity: 0, duration: 0.7, ease: "power2.in" }, ${r2(fi.start - 0.3)});`);
add(`tl.from("#final-icon", { scale: 0.6, opacity: 0, duration: 0.6, ease: "back.out(1.6)" }, ${r2(fi.start + 0.3)});`);
add(`tl.from("#final-name", { x: -16, opacity: 0, duration: 0.6 }, ${r2(fi.start + 0.4)});`);
add(`tl.from("#final-kicker", { y: 14, opacity: 0, duration: 0.5 }, ${r2(fi.start + 0.6)});`);
add(`tl.from("#final-url", { y: 24, opacity: 0, duration: 0.7, ease: "power3.out" }, ${r2(fi.start + 0.75)});`);
add(`tl.from("#final-logins .login", { y: 16, opacity: 0, duration: 0.5, stagger: 0.15, ease: "power2.out" }, ${r2(fi.start + 1.3)});`);
add(`tl.from("#final-pass", { opacity: 0, duration: 0.5 }, ${r2(fi.start + 2.0)});`);
add(`tl.from("#final-disc", { opacity: 0, duration: 0.5 }, ${r2(fi.start + 2.3)});`);
// Прогресс по главам.
add(`tl.fromTo("#progress-fill", { scaleX: 0 }, { scaleX: 1, duration: ${DURATION}, ease: "none" }, 0);`);

const chapters = scenes.filter((s) => s.kicker).map((s) => ({ at: s.start / DURATION, label: s.kicker.split("·")[1].trim() }));
const ticks = chapters.map((c, i) => `<span class="tick" id="tick-${i}" style="left:${(c.at * 100).toFixed(2)}%"></span>`).join("");

const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Ориентир — демо</title>
    <!-- Собрано scripts/build.mjs из записей scripts/record.mjs. Правки — в build.mjs. -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: 'Golos Text'; font-style: normal; font-weight: 400 900; font-display: block; src: url('assets/fonts/golos-text-cyrillic-wght-normal.woff2') format('woff2'); unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116; }
      @font-face { font-family: 'Golos Text'; font-style: normal; font-weight: 400 900; font-display: block; src: url('assets/fonts/golos-text-latin-wght-normal.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
      @font-face { font-family: 'IBM Plex Mono'; font-style: normal; font-weight: 400; font-display: block; src: url('assets/fonts/IBMPlexMono-400-cyrillic.woff2') format('woff2'); unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116; }
      @font-face { font-family: 'IBM Plex Mono'; font-style: normal; font-weight: 400; font-display: block; src: url('assets/fonts/IBMPlexMono-400-latin.woff2') format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
      :root {
        --ground: #edf1f8;
        --ink: #111a33;
        --muted: #4a5470;
        --accent: #2a4fbf;
        --accent-soft: #dde5f8;
        --bezel: #141a2c;
        --font: 'Golos Text', system-ui, sans-serif;
        --mono: 'IBM Plex Mono', monospace;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: var(--ground); }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--ground); color: var(--ink); font-family: var(--font); }
      .bg { position: absolute; inset: 0; }
      .glow { position: absolute; border-radius: 50%; filter: blur(10px); }
      #glow-a { width: 1100px; height: 1100px; left: -260px; top: -320px; background: radial-gradient(circle, rgba(42,79,191,0.16), rgba(42,79,191,0) 62%); }
      #glow-b { width: 1200px; height: 1200px; right: -380px; bottom: -520px; background: radial-gradient(circle, rgba(232,163,58,0.13), rgba(232,163,58,0) 60%); }
      #grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(17,26,51,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(17,26,51,0.035) 1px, transparent 1px); background-size: 64px 64px; }

      /* Телефон: рамка и экран 390×844 css px (запись 780×1688) */
      #phone { position: absolute; left: ${PH.left}px; top: ${PH.top}px; width: 440px; height: 924px; transform-origin: 0 0; }
      #phone .bezel { position: absolute; inset: 0; border-radius: 64px; background: var(--bezel); box-shadow: 0 40px 80px -30px rgba(17,26,51,0.45), 0 0 0 1.5px rgba(255,255,255,0.08) inset; }
      #phone .screen { position: absolute; left: 12px; top: 12px; width: 416px; height: 900px; border-radius: 52px; overflow: hidden; background: #f7f8fc; }
      .media { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; display: block; }

      /* Окно браузера методиста: экран 1200×750 (запись 2160×1350) */
      #desk { position: absolute; left: 605px; top: 236px; width: 1120px; height: 740px; border-radius: 18px; overflow: hidden; background: #fff; box-shadow: 0 40px 90px -36px rgba(17,26,51,0.45), 0 0 0 1px rgba(17,26,51,0.08); opacity: 0; }
      #desk .chrome { position: absolute; left: 0; top: 0; right: 0; height: 40px; background: #e7ebf3; display: flex; align-items: center; gap: 8px; padding: 0 16px; }
      #desk .chrome i { width: 12px; height: 12px; border-radius: 50%; background: #c3c9d6; display: block; }
      #desk .chrome .url { margin-left: 18px; height: 26px; padding: 0 14px; border-radius: 13px; background: #fff; font-family: var(--mono); font-size: 15px; line-height: 26px; color: var(--muted); }
      #desk .view { position: absolute; left: 0; top: 40px; width: 1120px; height: 700px; overflow: hidden; }

      .scene { position: absolute; inset: 0; }
      .col { position: absolute; left: 880px; top: 0; width: 900px; height: 100%; display: flex; flex-direction: column; justify-content: center; }
      .kicker { font-family: var(--mono); font-size: 24px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 18px; }
      .title { font-size: 72px; line-height: 1.04; font-weight: 750; letter-spacing: -0.02em; margin-bottom: 22px; }
      .lead { font-size: 32px; line-height: 1.35; color: var(--muted); max-width: 820px; margin-bottom: 44px; }
      .cues { list-style: none; display: flex; flex-direction: column; gap: 22px; max-width: 840px; }
      .cue { display: flex; gap: 18px; align-items: flex-start; font-size: 32px; line-height: 1.3; font-weight: 520; opacity: 0; }
      .cue .dot { flex: none; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); margin-top: 14px; box-shadow: 0 0 0 6px var(--accent-soft); }
      .big { margin-top: 36px; align-self: flex-start; padding: 14px 30px; border-radius: 22px; background: var(--accent); color: #fff; font-size: 64px; font-weight: 750; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; opacity: 0; }

      .split-head { position: absolute; left: 195px; top: 40px; width: 1530px; }
      .split-head .kicker { margin-bottom: 10px; }
      .split-head .title { font-size: 54px; margin: 0; }
      .split-cues { position: absolute; left: 605px; top: 994px; flex-direction: row; gap: 34px; max-width: none; }
      .split-cues .cue { position: absolute; left: 0; top: 0; white-space: nowrap; font-size: 30px; gap: 14px; }
      .split-cues .cue .dot { width: 11px; height: 11px; margin-top: 11px; box-shadow: 0 0 0 5px var(--accent-soft); }
      .tag { position: absolute; top: 196px; font-family: var(--mono); font-size: 22px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
      .tag-phone { left: 195px; }
      .tag-desk { left: 605px; }

      .brand { display: flex; align-items: center; gap: 22px; margin-bottom: 40px; }
      .brand img { width: 84px; height: 84px; border-radius: 22px; box-shadow: 0 14px 30px -14px rgba(42,79,191,0.6); }
      .brand span { font-size: 46px; font-weight: 750; letter-spacing: -0.01em; }
      #intro-title { font-size: 84px; line-height: 1.02; font-weight: 780; letter-spacing: -0.025em; margin-bottom: 30px; max-width: 900px; }
      #intro-lead { font-size: 34px; line-height: 1.38; color: var(--muted); max-width: 860px; margin-bottom: 40px; }
      #intro-meta { font-family: var(--mono); font-size: 22px; color: var(--muted); letter-spacing: 0.04em; }

      .final { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .final .brand { margin-bottom: 26px; }
      #final-kicker { font-family: var(--mono); font-size: 24px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 14px; }
      #final-url { font-size: 92px; font-weight: 780; letter-spacing: -0.02em; margin-bottom: 44px; }
      #final-logins { display: flex; gap: 22px; margin-bottom: 30px; }
      .login { display: flex; flex-direction: column; gap: 6px; padding: 20px 30px; border-radius: 22px; background: #fff; box-shadow: 0 0 0 1px rgba(17,26,51,0.07), 0 16px 30px -22px rgba(17,26,51,0.35); min-width: 330px; }
      .login b { font-family: var(--mono); font-weight: 400; font-size: 36px; color: var(--accent); }
      .login span { font-size: 24px; color: var(--muted); }
      #final-pass { font-size: 27px; color: var(--ink); margin-bottom: 40px; }
      #final-pass b { font-family: var(--mono); font-weight: 400; color: var(--accent); }
      #final-disc { font-size: 23px; color: var(--muted); max-width: 1200px; }

      #disc { position: absolute; right: 56px; bottom: 26px; font-family: var(--mono); font-size: 17px; letter-spacing: 0.03em; color: rgba(74,84,112,0.95); }
      #progress { position: absolute; left: 56px; bottom: 34px; width: 720px; height: 4px; border-radius: 2px; background: rgba(17,26,51,0.08); }
      #progress-fill { position: absolute; inset: 0; border-radius: 2px; background: var(--accent); transform-origin: 0 50%; }
      .tick { position: absolute; top: -4px; width: 2px; height: 12px; background: rgba(17,26,51,0.25); }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${DURATION}" data-width="1920" data-height="1080">
      <div id="bg" class="clip bg" data-start="0" data-duration="${DURATION}" data-track-index="5">
        <div id="grid"></div>
        <div id="glow-a" class="glow"></div>
        <div id="glow-b" class="glow"></div>
      </div>

      <div id="phone">
        <div class="bezel"></div>
        <div class="screen">
          ${media("phone")}
        </div>
      </div>

      <div id="desk">
        <div class="chrome"><i></i><i></i><i></i><span class="url" data-layout-ignore>orientir.rapira-cloud.ru/staff</span></div>
        <div class="view">
          ${media("desk")}
        </div>
      </div>

      ${sceneHtml}

      <div id="hud" class="clip" data-start="0" data-duration="${DURATION}" data-track-index="6" data-layout-ignore>
        <div id="progress"><div id="progress-fill"></div>${ticks}</div>
        <p id="disc" data-layout-ignore>Концепт для MGIMO×AI CHALLENGE · данные вымышлены</p>
      </div>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      ${js.join("\n      ")}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
fs.writeFileSync(path.join(ROOT, "index.html"), html.replace("__LEN__", fmt(DURATION)));
console.log(`index.html: ${DURATION} c, сцен ${scenes.length}, видео ${videos.length}`);
for (const s of scenes) console.log(`  ${fmt(s.start)}  ${s.id}  ${s.dur.toFixed(1)} c`);
