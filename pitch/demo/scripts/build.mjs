// Собирает index.html демо-видео из записей (assets/clips/clips.json): сцены, титры, курсор, тайминг по меткам записи.
// Запуск: node pitch/demo/scripts/build.mjs  →  pitch/demo/index.html
//
// Курсор рисуется здесь, а не в записи: record.mjs пишет траекторию (move/drag/down/up) в секундах клипа,
// а мы переводим её во время композиции и анимируем GSAP. Поэтому он плавный на любом фреймрейте.
// Все кривые из одного семейства: появление — power2.out, перемещение — power2.inOut / sine.inOut,
// без bounce и overshoot. Переходы и титры — 0,3–0,6 с.
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
const evs = (clip) => clips[clip].cursor.events;
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const fmt = (t) => `${Math.floor(Math.round(t) / 60)}:${String(Math.round(t) % 60).padStart(2, "0")}`;

// Стоп-кадры: последний кадр сцены, чтобы держать экран без видео.
function still(clip, out, at = null) {
  const src = path.join(ROOT, "assets/clips", `${clip}.mp4`);
  const dst = path.join(ROOT, "assets/clips", out);
  const args = at == null ? ["-sseof", "-0.1", "-i", src] : ["-ss", String(at), "-i", src];
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args, "-frames:v", "1", "-q:v", "2", dst]);
  return `assets/clips/${out}`;
}
const LOGIN_STILL = still("01-login-today", "01-first.jpg", 0.2);
const RATING_LAST = still("03-rating", "03-last.jpg");
const SEC_LAST = still("06-security", "06-last.jpg");
const OFF_LAST = still("07-dark-offline", "07-last.jpg");

// ---------- Таймлайн
let T = 0;
const scenes = [];
const videos = []; // {id, clip, src, start, mediaStart, dur, slot: 'phone'|'desk'}
const images = []; // {id, src, start, dur, slot}
const cues = []; // {scene, at, text}

function scene(id, dur, data) {
  scenes.push({ id, start: r2(T), dur: r2(dur), ...data });
  const s = T;
  T += dur;
  return s;
}
const vid = (id, clip, start, mediaStart, dur, slot = "phone") =>
  videos.push({ id, clip, src: `assets/clips/${clip}.mp4`, start: r3(start), mediaStart: r3(mediaStart), dur: r3(dur), slot });

// S0: заставка, на телефоне — экран входа.
const INTRO = 7;
images.push({ id: "img-login", src: LOGIN_STILL, start: 0, dur: INTRO + 0.5, slot: "phone" });
scene("intro", INTRO, { kind: "intro" });

// S1: вход и «Сегодня».
{
  const c = "01-login-today", ms = 0.5, end = clips[c].duration - 0.3;
  const s = scene("today", end - ms, {
    kicker: "01 · Сегодня",
    title: "Утро студента",
    lead: "Максим Орлов, 2 курс. Входит по кнопке и сразу видит, что изменилось.",
  });
  vid("v-today", c, s, ms, end - ms);
  const at = (l) => r2(s + mark(c, l) - ms);
  cues.push({ scene: "today", at: at("today") + 0.4, text: "Пару перенесли. Это первое, что Максим видит утром" });
  cues.push({ scene: "today", at: at("retake-card"), text: "Пересдача через 12 дней. В той же карточке срок заявления" });
  cues.push({ scene: "today", at: at("retake-card") + 4.4, text: "Ниже пары на сегодня и рейтинг" });
}

// S2: расписание.
{
  const c = "02-schedule", ms = 0.3, end = clips[c].duration - 0.3;
  const s = scene("schedule", end - ms, {
    kicker: "02 · Расписание",
    title: "Перенос видно сразу",
    lead: "Изменённая пара выделена цветом. Рядом причина и старое время.",
  });
  vid("v-schedule", c, s, ms, end - ms);
  const at = (l) => r2(s + mark(c, l) - ms);
  cues.push({ scene: "schedule", at: at("day") - 0.9, text: "Семинар перенесли с 10:40 на 16:00 по просьбе кафедры" });
  cues.push({ scene: "schedule", at: at("week") + 1.2, text: "На неделе сверху сводка, что поменялось" });
  cues.push({ scene: "schedule", at: at("month") + 1.2, text: "В месяце видны экзамены и пересдача" });
}

// S3: рейтинг-навигатор и заявление.
let ratingEnd;
{
  const c = "03-rating", ms = Math.max(0, mark(c, "rating-684") - 1.2), end = clips[c].duration - 0.2;
  const s = scene("rating", end - ms, {
    kicker: "03 · Рейтинг",
    title: "Сколько нужно на пересдаче",
    lead: "Максим двигает ползунок и видит свой рейтинг после пересдачи.",
  });
  vid("v-rating", c, s, ms, end - ms);
  const at = (l) => r2(s + mark(c, l) - ms);
  cues.push({ scene: "rating", at: at("rating-684"), text: "Сейчас 68,4 из 100. Из-за долга по макроэкономике стипендии нет" });
  cues.push({ scene: "rating", at: at("drag"), text: "Ставим «пересдам на 70». Пересчёт сразу, без перезагрузки" });
  cues.push({ scene: "rating", at: at("rating-717"), text: "Выходит 71,7. Этого хватает на академическую стипендию", big: "68,4 → 71,7" });
  cues.push({ scene: "rating", at: at("apply"), text: "Отсюда же можно подать заявление на пересдачу" });
  cues.push({ scene: "rating", at: at("queue-position"), text: "В заявке статус, обычный срок и место в очереди" });
  ratingEnd = T;
}

// S4: сплит — методист на компьютере, студент на телефоне.
let switchAt;
{
  const c = "04-staff", ms = 0.4, end = mark(c, "ready") + 3.0;
  // Вырезаем кусок после «Взять в работу»: строка ушла из «Новых», а раскрытие осталось у соседних
  // заявок (баг интерфейса, записан в отчёт). Склейка сразу на переход в «В работе».
  const cutA = mark(c, "take") + 1.55, cutB = mark(c, "filter-work") - 0.05;
  const gap = cutB - cutA;
  const s = scene("split", end - ms - gap, {
    kind: "split",
    kicker: "04 · Учебный офис",
    title: "Методист меняет статус, студент видит это у себя",
  });
  vid("v-staff", c, s, ms, cutA - ms, "desk");
  vid("v-staff-b", c, s + cutA - ms, cutB, end - cutB, "desk");
  const at = (l) => {
    const t = mark(c, l);
    if (t < cutA) return r2(s + t - ms);
    return r2(s + cutA - ms + Math.max(0, t - cutB));
  };
  switchAt = at("filter-ready") - 0.2;
  images.push({ id: "img-rating-last", src: RATING_LAST, start: r2(ratingEnd - 0.1), dur: r2(switchAt - ratingEnd + 0.5), slot: "phone" });
  cues.push({ scene: "split", at: at("queue") + 0.4, text: "Заявка Максима пришла в «Новые»" });
  cues.push({ scene: "split", at: at("take"), text: "Методист берёт её в работу" });
  cues.push({ scene: "split", at: at("filter-work") + 0.6, text: "Теперь она «В работе», ведёт Ирина Сафонова" });
  cues.push({ scene: "split", at: at("done"), text: "«Готово»: Максиму приходит уведомление" });
}

// S5: снова телефон — статус обновился (видео стартует ещё в сплите).
{
  const c = "05-student-ready", ms = Math.max(0, mark(c, "ready") - 1.3), end = clips[c].duration - 0.2;
  const vStart = switchAt;
  const vDur = end - ms;
  const sceneStart = T;
  const s = scene("ready", vStart + vDur - sceneStart, {
    kicker: "05 · Статус",
    title: "Заявка готова",
    lead: "История заявки как у посылки: когда подана, кто взял, когда готово.",
  });
  vid("v-ready", c, vStart, ms, vDur);
  const at = (l) => r2(vStart + mark(c, l) - ms);
  cues.push({ scene: "split", at: at("ready"), text: "У Максима статус «Готова»" });
  cues.push({ scene: "ready", at: Math.max(s + 0.6, at("ready") + 3), text: "Каждый шаг с датой и именем методиста" });
  cues.push({ scene: "ready", at: at("notifications"), text: "В уведомлениях оба сообщения: взяли в работу и готово" });
  cues.push({ scene: "ready", at: at("accepted"), text: "На главном экране отметка: заявление принято" });
}

// S6: безопасность.
{
  const c = "06-security", ms = 0.6, vd = clips[c].duration - 0.3 - ms, hold = 7.6;
  const s = scene("security", vd + hold, {
    kicker: "06 · Доступ",
    title: "Чужую заявку не открыть",
    lead: "Анна Соколова вставляет адрес заявки Максима и получает 404.",
  });
  vid("v-security", c, s, ms, vd);
  images.push({ id: "img-sec-last", src: SEC_LAST, start: r2(s + vd - 0.05), dur: r2(hold + 0.6), slot: "phone" });
  const a404 = s + mark(c, "404") - ms;
  cues.push({ scene: "security", at: r2(a404 + 0.3), text: "Для неё этой заявки нет: проверка стоит в самом запросе к базе" });
  cues.push({ scene: "security", at: r2(a404 + 3.4), text: "Пароли хранятся в argon2id, роль методиста проверяет сервер" });
  cues.push({ scene: "security", at: r2(a404 + 6.5), text: "83 браузерных теста на экране 360 px и 69 юнит-тестов" });
}

// S7: тёмная тема и офлайн. Ожидание офлайн-страницы (~3 с) вырезаем склейкой.
{
  const c = "07-dark-offline", ms = 0.3, end = clips[c].duration - 0.2;
  const up = evs(c).filter((e) => e.type === "up").at(-1).t;
  const cutA = up + 0.7, cutB = Math.max(cutA, mark(c, "offline-banner") - 0.35);
  const gap = cutB - cutA;
  const s = scene("offline", end - ms - gap + 0.8, {
    kicker: "07 · Каждый день",
    title: "Тёмная тема и работа без сети",
    lead: "Кабинет ставится на главный экран телефона как приложение.",
  });
  vid("v-offline", c, s, ms, cutA - ms);
  vid("v-offline-b", c, s + cutA - ms, cutB, end - cutB);
  images.push({ id: "img-off-last", src: OFF_LAST, start: r2(s + end - ms - gap - 0.05), dur: 1.6, slot: "phone" });
  const at = (l) => {
    const t = mark(c, l);
    return r2(s + (t < cutA ? t - ms : cutA - ms + Math.max(0, t - cutB)));
  };
  cues.push({ scene: "offline", at: at("dark"), text: "Тема светлая, тёмная или как в системе" });
  cues.push({ scene: "offline", at: at("offline-banner") - 0.4, text: "Без сети расписание и оценки открываются из кэша. Сверху видно, когда они обновлены" });
}

// S8: финал.
scene("final", 8, { kind: "final" });
const DURATION = r2(T);

// Наплыв нового видео идёт поверх старого: предыдущий кадр держим ещё 0,3 с, иначе сквозь
// полупрозрачное видео мелькает пустой экран.
const FADE = 0.3;
for (const v of videos.filter((v) => !v.id.endsWith("-b"))) {
  const prev = [...images, ...videos].find((m) => m !== v && m.slot === v.slot && Math.abs(m.start + m.dur - v.start) < 0.06);
  if (!prev) continue;
  const room = prev.clip ? clips[prev.clip].duration - (prev.mediaStart + prev.dur) - 0.02 : FADE;
  prev.dur = r3(prev.dur + Math.max(0, Math.min(FADE, room)));
}

// ---------- Курсор
// Экраны в композиции: телефон 416×900 для окна 390×844, окно браузера 1120×700 для окна 1440×900.
const SLOT = {
  phone: { k: 416 / 390, size: 44 },
  desk: { k: 1120 / 1440, size: 36 },
};
// Хотспоты курсоров из configs/x.build.toml набора apple_cursor (холст 256 и 257 px).
const HOT = { arrow: [79, 36, 256], hand: [92, 53, 257] };

const js = [];
const add = (line) => js.push(line);
const P = (n) => r2(n);

// Состояние курсора на момент t клипа (без анимации): позиция и форма после всех событий до t.
function stateAt(clip, t) {
  const st = { ...clips[clip].cursor.start };
  for (const e of evs(clip)) {
    if (e.t > t) break;
    if (e.type === "move" || e.type === "drag") Object.assign(st, { x: e.x, y: e.y }, e.shape ? { shape: e.shape } : {});
    if (e.type === "shape") st.shape = e.shape;
  }
  return st;
}

// Окна видимости: курсор виден вокруг действий и прячется, если без дела дольше 3 с (как в Screen Studio).
function cursorWindows(slot) {
  const spans = [];
  for (const v of videos.filter((v) => v.slot === slot)) {
    const cur = clips[v.clip].cursor;
    if (!cur.start.visible) continue;
    const toComp = (t) => v.start + t - v.mediaStart;
    const vEnd = v.start + v.dur;
    for (const e of cur.events) {
      const a = toComp(e.t), b = toComp(e.t + (e.dur ?? 0.2));
      if (b < v.start || a >= vEnd) continue;
      spans.push([Math.max(v.start, a - 0.45), Math.min(vEnd, b + 1.4)]);
    }
  }
  spans.sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const s of spans) {
    const last = out.at(-1);
    if (last && s[0] - last[1] < 3) last[1] = Math.max(last[1], s[1]);
    else out.push([...s]);
  }
  return out;
}

function cursorJs(slot) {
  const { k } = SLOT[slot];
  const id = `#cur-${slot}`;
  const X = (x) => P(x * k), Y = (y) => P(y * k);
  const list = videos.filter((v) => v.slot === slot).sort((a, b) => a.start - b.start);
  let shape = null;
  const setShape = (sh, at) => {
    if (sh === shape) return;
    shape = sh;
    add(`tl.set("${id} .cur-arrow", { opacity: ${sh === "arrow" ? 1 : 0} }, ${P(at)}); tl.set("${id} .cur-hand", { opacity: ${sh === "hand" ? 1 : 0} }, ${P(at)});`);
  };
  for (const v of list) {
    const cur = clips[v.clip].cursor;
    if (!cur.start.visible) continue;
    const toComp = (t) => v.start + t - v.mediaStart;
    const st = stateAt(v.clip, v.mediaStart);
    add(`tl.set("${id}", { x: ${X(st.x)}, y: ${Y(st.y)} }, ${P(v.start)});`);
    setShape(st.shape, v.start);
    let pos = { x: st.x, y: st.y };
    let down = null;
    for (const e of cur.events) {
      if (e.t < v.mediaStart || e.t >= v.mediaStart + v.dur) continue;
      const at = toComp(e.t);
      if (e.type === "move") {
        // Чуть разные кривые по осям дают мягкую дугу вместо линейки.
        add(`tl.fromTo("${id}", { x: ${X(pos.x)} }, { x: ${X(e.x)}, duration: ${e.dur}, ease: "power2.inOut" }, ${P(at)});`);
        add(`tl.fromTo("${id}", { y: ${Y(pos.y)} }, { y: ${Y(e.y)}, duration: ${e.dur}, ease: "power1.inOut" }, ${P(at)});`);
        setShape(e.shape ?? shape, at + e.dur * 0.75);
        pos = { x: e.x, y: e.y };
      } else if (e.type === "drag") {
        add(`tl.fromTo("${id}", { x: ${X(pos.x)}, y: ${Y(pos.y)} }, { x: ${X(e.x)}, y: ${Y(e.y)}, duration: ${e.dur}, ease: "${e.ease}" }, ${P(at)});`);
        pos = { x: e.x, y: e.y };
      } else if (e.type === "shape") {
        setShape(e.shape, at);
      } else if (e.type === "down") {
        down = at;
        add(`tl.fromTo("${id} .cur-press", { scale: 1 }, { scale: 0.85, duration: 0.07, ease: "power2.out" }, ${P(at)});`);
      } else if (e.type === "up") {
        const t = Math.max(at, (down ?? at) + 0.08);
        add(`tl.fromTo("${id} .cur-press", { scale: 0.85 }, { scale: 1, duration: 0.1, ease: "power2.out" }, ${P(t)});`);
        down = null;
      }
    }
  }
  for (const [a, b] of cursorWindows(slot)) {
    add(`tl.fromTo("${id}", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" }, ${P(a)});`);
    add(`tl.fromTo("${id}", { opacity: 1 }, { opacity: 0, duration: 0.35, ease: "power2.inOut" }, ${P(b - 0.35)});`);
  }
}

// ---------- Автозум окна методиста: после загрузки очереди камера мягко приближается (×1,22) к рабочей зоне
// и дальше только чуть следует за курсором, если цель уходит из центральной части кадра.
function deskCameraJs() {
  const c = "04-staff";
  const W = 1440, H = 900, k = SLOT.desk.k, Z = 1.22;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const camFor = (z, cx, cy) => {
    const hw = W / (2 * z), hh = H / (2 * z);
    cx = clamp(cx, hw, W - hw);
    cy = clamp(cy, hh, H - hh);
    return { z, cx, cy, x: P(560 - cx * k * z), y: P(350 - cy * k * z), scale: z };
  };
  // Ключевые кадры камеры во времени клипа.
  const keys = [{ t: 0, dur: 0, ...camFor(1, W / 2, H / 2) }];
  const tq = mark(c, "queue");
  let cam = keys[0];
  for (const e of evs(c).filter((e) => e.type === "move" && e.t >= tq - 0.01)) {
    if (cam.z === 1) {
      cam = { t: e.t, dur: 0.9, ...camFor(Z, 720, 450) }; // вся таблица очереди помещается в кадр
      keys.push(cam);
      continue;
    }
    const hw = W / (2 * Z), hh = H / (2 * Z);
    const inside = Math.abs(e.x - cam.cx) < hw - 30 && Math.abs(e.y - cam.cy) < hh - 40;
    if (inside) continue;
    cam = { t: e.t, dur: 0.8, ...camFor(Z, e.x, e.y) };
    keys.push(cam);
  }
  const camAt = (t) => keys.filter((q) => q.t <= t).at(-1);
  for (const v of videos.filter((v) => v.slot === "desk")) {
    const s0 = camAt(v.mediaStart);
    add(`tl.set("#desk-zoom", { x: ${s0.x}, y: ${s0.y}, scale: ${s0.scale} }, ${P(v.start)});`);
    let prev = s0;
    for (const q of keys) {
      if (q.t <= v.mediaStart || q.t >= v.mediaStart + v.dur) continue;
      add(`tl.fromTo("#desk-zoom", { x: ${prev.x}, y: ${prev.y}, scale: ${prev.scale} }, { x: ${q.x}, y: ${q.y}, scale: ${q.scale}, duration: ${q.dur}, ease: "power2.inOut" }, ${P(v.start + q.t - v.mediaStart)});`);
      prev = q;
    }
  }
}

// ---------- Разметка
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const PH = { left: 312, top: 90 }; // экран телефона в соло-кадре (карточка 416×900 без корпуса)
const sceneHtml = scenes
  .map((sc) => {
    const attrs = `id="s-${sc.id}" class="clip scene scene-${sc.kind ?? "solo"}" data-start="${sc.start}" data-duration="${sc.dur}" data-track-index="2"`;
    if (sc.kind === "intro") {
      return `<div ${attrs}>
        <div class="col">
          <div class="brand"><img id="intro-icon" src="assets/app-icon.png" alt="" /><span id="intro-name">Ориентир</span></div>
          <h1 id="intro-title">Деканат, который пишет студенту первым</h1>
          <p id="intro-lead">Расписание, оценки, рейтинг и заявки в одном кабинете на телефоне. Покажем на одном студенте и одном методисте.</p>
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
            <div class="login"><b>sokolova</b><span>студентка без долгов</span></div>
            <div class="login"><b>metodist</b><span>очередь учебного офиса</span></div>
          </div>
          <p id="final-pass">Пароль <b>demo2026</b>. На странице входа есть кнопки «Войти как…» и копии 2 и 3 для проверки</p>
          <p id="final-disc">Концепт для MGIMO×AI CHALLENGE, кейс «Цифровой деканат будущего». Не официальный сервис, все данные вымышлены.<br />Курсоры: apple_cursor (ful1e5), GPL-3.0</p>
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
    ...videos.filter((m) => m.slot === slot).map((m) => `<video id="${m.id}" class="clip media" src="${m.src}" muted playsinline data-start="${r3(m.start)}" data-duration="${r3(m.dur)}" data-media-start="${r3(m.mediaStart)}" data-track-index="0"></video>`),
  ].join("\n          ");

const cursorHtml = (slot) => {
  const S = SLOT[slot].size;
  const img = (name, file) => {
    const [hx, hy, c] = HOT[name];
    const sz = (S * 256) / c;
    return `<img class="cur-${name}" src="assets/cursors/${file}" alt="" style="left:${P((-hx * S) / c)}px; top:${P((-hy * S) / c)}px; width:${P(sz)}px; height:${P(sz)}px" />`;
  };
  return `<div id="cur-${slot}" class="cursor" data-layout-ignore><div class="cur-press">${img("arrow", "arrow.svg")}${img("hand", "hand.svg")}</div></div>`;
};

// ---------- Анимация (GSAP, на корневом таймлайне)
const S = Object.fromEntries(scenes.map((s) => [s.id, s]));
const IN = "power2.out", MOVE = "power2.inOut";
// Фон: медленный дрейф пятен.
add(`tl.fromTo("#glow-a", { x: -40, y: 0 }, { x: 60, y: 30, duration: ${DURATION / 2}, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0);`);
add(`tl.fromTo("#glow-b", { x: 30, y: 0 }, { x: -50, y: -40, duration: ${DURATION / 2}, ease: "sine.inOut", yoyo: true, repeat: 1 }, 0);`);
// Заставка: по очереди, без отскоков.
add(`tl.from("#s-intro .brand", { y: 12, opacity: 0, duration: 0.5, ease: "${IN}" }, 0.35);`);
add(`tl.from("#intro-title", { y: 16, opacity: 0, duration: 0.6, ease: "${IN}" }, 0.55);`);
add(`tl.from("#intro-lead", { y: 12, opacity: 0, duration: 0.5, ease: "${IN}" }, 0.85);`);
add(`tl.from("#intro-meta", { opacity: 0, duration: 0.4, ease: "${IN}" }, 1.15);`);
add(`tl.to("#s-intro .col", { opacity: 0, duration: 0.35, ease: "${MOVE}" }, ${INTRO - 0.4});`);
// Соло-сцены: надзаголовок, заголовок, подводка по очереди; уход — только прозрачность.
for (const sc of scenes.filter((s) => !s.kind)) {
  const st = sc.start;
  add(`tl.from("#k-${sc.id}", { y: 10, opacity: 0, duration: 0.45, ease: "${IN}" }, ${r2(st + 0.1)});`);
  add(`tl.from("#h-${sc.id}", { y: 14, opacity: 0, duration: 0.55, ease: "${IN}" }, ${r2(st + 0.2)});`);
  add(`tl.from("#l-${sc.id}", { y: 10, opacity: 0, duration: 0.5, ease: "${IN}" }, ${r2(st + 0.4)});`);
  add(`tl.to("#s-${sc.id} .col", { opacity: 0, duration: 0.35, ease: "${MOVE}" }, ${r2(st + sc.dur - 0.4)});`);
}
// Реплики: появляются по меткам записи, прошлые приглушаются.
for (const sc of scenes) {
  const list = cues.filter((c) => c.scene === sc.id);
  const split = sc.kind === "split";
  list.forEach((c, i) => {
    let at = Math.max(c.at, sc.start + 0.9);
    if (split && i > 0) at += 0.15; // в сплите реплики сменяют друг друга на одном месте: сначала уходит старая
    if (i > 0) add(`tl.to("#cue-${sc.id}-${i - 1}", { opacity: ${split ? 0 : 0.42}, duration: ${split ? 0.3 : 0.4}, ease: "${MOVE}" }, ${r2(split ? at - 0.2 : at)});`);
    add(`tl.fromTo("#cue-${sc.id}-${i}", { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "${IN}" }, ${r2(at)});`);
    if (c.big) {
      add(`tl.fromTo("#big-${sc.id}", { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "${IN}" }, ${r2(at + 0.35)});`);
      add(`tl.to("#big-${sc.id}", { opacity: 0, duration: 0.4, ease: "${MOVE}" }, ${r2(at + 6.2)});`);
    }
  });
}
// Смена видео на экранах: короткий наплыв.
for (const v of videos) if (!v.id.endsWith("-b")) add(`tl.fromTo("#${v.id}", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none" }, ${r2(v.start)});`);
// Сплит: сначала уходит текст, потом телефон отъезжает влево, затем въезжает окно браузера.
const sp = S.split;
const PS = { left: 195, top: 236, scale: 740 / 900 }; // в сплите карточка по высоте равна окну браузера
add(`tl.to("#phone", { x: ${PS.left - PH.left}, y: ${PS.top - PH.top}, scale: ${PS.scale}, duration: 0.6, ease: "${MOVE}" }, ${r2(sp.start - 0.05)});`);
add(`tl.fromTo("#desk", { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "${IN}" }, ${r2(sp.start + 0.3)});`);
add(`tl.from("#k-split", { y: 10, opacity: 0, duration: 0.45, ease: "${IN}" }, ${r2(sp.start + 0.35)});`);
add(`tl.from("#h-split", { y: 14, opacity: 0, duration: 0.5, ease: "${IN}" }, ${r2(sp.start + 0.45)});`);
add(`tl.from(["#tag-phone", "#tag-desk"], { opacity: 0, duration: 0.4, ease: "${IN}", stagger: 0.1 }, ${r2(sp.start + 0.7)});`);
const spEnd = sp.start + sp.dur;
add(`tl.to("#s-split > *", { opacity: 0, duration: 0.35, ease: "${MOVE}" }, ${r2(spEnd - 0.6)});`);
add(`tl.to("#desk", { x: 60, opacity: 0, duration: 0.45, ease: "${MOVE}" }, ${r2(spEnd - 0.45)});`);
add(`tl.to("#phone", { x: 0, y: 0, scale: 1, duration: 0.6, ease: "${MOVE}" }, ${r2(spEnd - 0.1)});`);
// Финал: телефон уходит, текст по центру.
const fi = S.final;
add(`tl.to("#phone", { y: 30, opacity: 0, duration: 0.45, ease: "${MOVE}" }, ${r2(fi.start - 0.3)});`);
add(`tl.from("#s-final .brand", { y: 12, opacity: 0, duration: 0.5, ease: "${IN}" }, ${r2(fi.start + 0.25)});`);
add(`tl.from("#final-kicker", { y: 10, opacity: 0, duration: 0.45, ease: "${IN}" }, ${r2(fi.start + 0.45)});`);
add(`tl.from("#final-url", { y: 14, opacity: 0, duration: 0.55, ease: "${IN}" }, ${r2(fi.start + 0.6)});`);
add(`tl.from("#final-logins .login", { y: 12, opacity: 0, duration: 0.45, stagger: 0.12, ease: "${IN}" }, ${r2(fi.start + 1.0)});`);
add(`tl.from("#final-pass", { opacity: 0, duration: 0.45, ease: "${IN}" }, ${r2(fi.start + 1.6)});`);
add(`tl.from("#final-disc", { opacity: 0, duration: 0.45, ease: "${IN}" }, ${r2(fi.start + 1.9)});`);
// Курсоры и камера окна методиста. Базовые значения на 0 с, чтобы любой seek начинался с покоя.
for (const sl of ["phone", "desk"]) add(`tl.set("#cur-${sl}", { opacity: 0 }, 0); tl.set("#cur-${sl} .cur-press", { scale: 1 }, 0);`);
add(`tl.set("#desk-zoom", { x: 0, y: 0, scale: 1 }, 0);`);
cursorJs("phone");
cursorJs("desk");
deskCameraJs();
// Прогресс по главам.
add(`tl.fromTo("#progress-fill", { scaleX: 0 }, { scaleX: 1, duration: ${DURATION}, ease: "none" }, 0);`);

const chapters = scenes.filter((s) => s.kicker).map((s) => ({ at: s.start / DURATION }));
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
        /* Один визуальный язык для экрана телефона и окна браузера: тонкая обводка и мягкая тень в три слоя */
        --ring: 0 0 0 1px rgba(17,26,51,0.10);
        --shadow: 0 1px 2px rgba(17,26,51,0.06), 0 12px 28px -10px rgba(17,26,51,0.16), 0 40px 80px -32px rgba(17,26,51,0.30);
        --font: 'Golos Text', system-ui, sans-serif;
        --mono: 'IBM Plex Mono', monospace;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: var(--ground); }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--ground); color: var(--ink); font-family: var(--font); }
      .bg { position: absolute; inset: 0; }
      .glow { position: absolute; border-radius: 50%; }
      #glow-a { width: 1100px; height: 1100px; left: -260px; top: -320px; background: radial-gradient(circle, rgba(42,79,191,0.14), rgba(42,79,191,0) 62%); }
      #glow-b { width: 1200px; height: 1200px; right: -380px; bottom: -520px; background: radial-gradient(circle, rgba(232,163,58,0.11), rgba(232,163,58,0) 60%); }
      #grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(17,26,51,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(17,26,51,0.035) 1px, transparent 1px); background-size: 64px 64px; }

      /* Телефон: рамка и экран 390×844 css px (запись 780×1688) */
      /* Экран телефона без корпуса: скруглённая карточка, радиус как у дисплея iPhone (47,33 pt при ширине 390) */
      #phone { position: absolute; left: ${PH.left}px; top: ${PH.top}px; width: 416px; height: 900px; transform-origin: 0 0; border-radius: 52px; box-shadow: var(--ring), var(--shadow); }
      #phone .screen { position: absolute; left: 0; top: 0; width: 416px; height: 900px; border-radius: 52px; overflow: hidden; background: #f7f8fc; }
      .media { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; display: block; }

      /* Окно браузера методиста: экран 1120×700 (запись 2160×1350) */
      #desk { position: absolute; left: 605px; top: 236px; width: 1120px; height: 740px; border-radius: 16px; overflow: hidden; background: #fff; box-shadow: var(--ring), var(--shadow); opacity: 0; }
      #desk .chrome { position: absolute; left: 0; top: 0; right: 0; height: 40px; background: #e7ebf3; display: flex; align-items: center; gap: 8px; padding: 0 16px; z-index: 2; }
      #desk .chrome i { width: 12px; height: 12px; border-radius: 50%; background: #c3c9d6; display: block; }
      #desk .chrome .url { margin-left: 18px; height: 26px; padding: 0 14px; border-radius: 13px; background: #fff; font-family: var(--mono); font-size: 15px; line-height: 26px; color: var(--muted); }
      #desk .view { position: absolute; left: 0; top: 40px; width: 1120px; height: 700px; overflow: hidden; background: #f7f8fc; }
      #desk-zoom { position: absolute; left: 0; top: 0; width: 1120px; height: 700px; transform-origin: 0 0; }

      /* Курсор: внешний блок двигается (x/y = хотспот), внутренний нажимается вокруг хотспота */
      .cursor { position: absolute; left: 0; top: 0; width: 0; height: 0; z-index: 5; opacity: 0; pointer-events: none; }
      .cur-press { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; }
      .cur-press img { position: absolute; display: block; max-width: none; }
      .cur-hand { opacity: 0; }

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
      #intro-title { font-size: 80px; line-height: 1.04; font-weight: 780; letter-spacing: -0.025em; margin-bottom: 30px; max-width: 900px; }
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
      #final-disc { font-size: 23px; line-height: 1.5; color: var(--muted); max-width: 1200px; }

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
        <div class="screen">
          ${media("phone")}
          ${cursorHtml("phone")}
        </div>
      </div>

      <div id="desk">
        <div class="chrome"><i></i><i></i><i></i><span class="url" data-layout-ignore>orientir.rapira-cloud.ru/staff</span></div>
        <div class="view">
          <div id="desk-zoom">
          ${media("desk")}
          ${cursorHtml("desk")}
          </div>
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
