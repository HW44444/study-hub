/* ============================================================
   Study Hub — class schedule engine.

   Three things make this non-trivial:

   1. The bell schedule changes by DAY OF WEEK (Mon–Wed, Thu, Fri
      are all different), so one fixed list of times isn't enough.
   2. Classes alternate A/B. Rather than a hardcoded calendar we
      store one known day and count school days from it, so a
      holiday only needs a single re-tap to re-sync.
   3. Some days are just different (assembly, testing). A one-day
      override can replace the whole schedule without touching
      the normal templates.

   Period labels like "Period 1 (5)" mean slot 1 is A1 on an A day
   and B5 on a B day — that's what `periodCode` encodes.
   ============================================================ */

const SCHED_KEY = "sh_schedule";

/* ---------- The real bell schedules ---------- */
const DEFAULT_TEMPLATES = {
  standard: {
    name: "Mon–Wed (Support Seminar)",
    blocks: [
      { label: "Period 1",         start: "08:25", end: "09:48", slot: 1 },
      { label: "Support Seminar",  start: "09:58", end: "10:31", slot: null },
      { label: "Period 2",         start: "10:36", end: "11:59", slot: 2 },
      { label: "Lunch",            start: "11:59", end: "12:34", slot: null },
      { label: "Period 3",         start: "12:39", end: "14:02", slot: 3 },
      { label: "Period 4",         start: "14:07", end: "15:30", slot: 4 }
    ]
  },
  thursday: {
    name: "Thursday (Early Release + TSCT)",
    blocks: [
      { label: "Period 1",                     start: "08:25", end: "09:50", slot: 1 },
      { label: "Teacher Student Contact Time", start: "09:50", end: "10:00", slot: null },
      { label: "Period 2",                     start: "10:05", end: "11:30", slot: 2 },
      { label: "Lunch",                        start: "11:30", end: "12:05", slot: null },
      { label: "Period 3",                     start: "12:10", end: "13:35", slot: 3 },
      { label: "Period 4",                     start: "13:40", end: "15:05", slot: 4 },
      { label: "PLC",                          start: "15:15", end: "16:00", slot: null }
    ]
  },
  friday: {
    name: "Friday (TSCT)",
    blocks: [
      { label: "Period 1",                     start: "08:25", end: "09:55", slot: 1 },
      { label: "Teacher Student Contact Time", start: "09:55", end: "10:10", slot: null },
      { label: "Period 2",                     start: "10:15", end: "11:45", slot: 2 },
      { label: "Lunch",                        start: "11:45", end: "12:20", slot: null },
      { label: "Period 3",                     start: "12:25", end: "13:55", slot: 3 },
      { label: "Period 4",                     start: "14:00", end: "15:30", slot: 4 }
    ]
  }
};

/* getDay(): 0=Sun … 6=Sat. Which template each weekday uses. */
const DEFAULT_WEEKMAP = { 1: "standard", 2: "standard", 3: "standard", 4: "thursday", 5: "friday" };

function defaultSchedule() {
  return {
    enabled: true,
    templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
    weekMap: { ...DEFAULT_WEEKMAP },
    anchorDate: "",
    anchorType: "A",
    override: null      // { date:"YYYY-MM-DD", name, blocks:[...] }
  };
}

function loadSchedule() {
  const s = load(SCHED_KEY, null);
  if (!s || !s.templates) {
    // Fresh, or an older saved shape — rebuild but keep the anchor.
    const fresh = defaultSchedule();
    if (s && s.anchorDate) { fresh.anchorDate = s.anchorDate; fresh.anchorType = s.anchorType || "A"; }
    return fresh;
  }
  if (s.enabled === undefined) s.enabled = true;
  if (!s.weekMap) s.weekMap = { ...DEFAULT_WEEKMAP };
  return s;
}
function saveSchedule(s) { save(SCHED_KEY, s); }

/* ---------- Time helpers ---------- */

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function toClockLabel(mins) {
  const h24 = Math.floor(mins / 60), m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/* Under 5 minutes it switches to mm:ss, because that's when
   the exact seconds actually matter to you. */
function countdownText(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m >= 5) return `${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ---------- A / B rotation ---------- */

function isWeekend(d) { return d.getDay() === 0 || d.getDay() === 6; }

function dayTypeFor(dateISO) {
  const s = loadSchedule();
  if (!s.anchorDate) return null;

  const start = new Date(s.anchorDate + "T00:00:00");
  const end   = new Date(dateISO + "T00:00:00");
  if (isNaN(start) || isNaN(end)) return null;
  if (isWeekend(end)) return null;

  let weekdays = 0;
  const step = end >= start ? 1 : -1;
  const cur = new Date(start);
  let guard = 0;
  while (cur.getTime() !== end.getTime() && guard++ < 1000) {
    cur.setDate(cur.getDate() + step);
    if (!isWeekend(cur)) weekdays++;
  }

  const base = s.anchorType === "B" ? "B" : "A";
  if (weekdays % 2 === 0) return base;
  return base === "A" ? "B" : "A";
}

/* Slot 1 is A1 on an A day, B5 on a B day. */
function periodCode(dayType, slot) {
  if (!dayType || !slot) return null;
  return dayType === "A" ? "A" + slot : "B" + (slot + 4);
}

function classForPeriod(code) {
  if (!code) return null;
  return load(KEYS.classes, []).find(c => c.period === code) || null;
}

/* ---------- Which schedule applies on a given day? ---------- */

function templateKeyForDate(date) {
  const s = loadSchedule();
  return s.weekMap[date.getDay()] || null;   // null on weekends
}

/* A one-day override beats the weekly template. */
function blocksForDate(date) {
  const s = loadSchedule();
  const iso = localISO(date);
  if (s.override && s.override.date === iso) {
    return { blocks: s.override.blocks || [], name: s.override.name || "Custom schedule", custom: true };
  }
  const key = templateKeyForDate(date);
  if (!key || !s.templates[key]) return null;
  return { blocks: s.templates[key].blocks, name: s.templates[key].name, key };
}

/* localISO() lives in storage.js — it builds the date string from
   local parts so evening times don't roll over to tomorrow. */

/* ---------- Where are we right now? ---------- */
/*
  {state:"off"}                      clock switched off
  {state:"none", reason}             weekend / not set up
  {state:"before", next, startsIn}
  {state:"in", block, endsIn, next}
  {state:"passing", next, startsIn}
  {state:"after"}
*/
function scheduleStatus(now = new Date()) {
  const s = loadSchedule();
  if (!s.enabled) return { state: "off" };

  const iso = localISO(now);
  const dayType = dayTypeFor(iso);
  const day = blocksForDate(now);

  if (!day) return { state: "none", reason: "No school today.", dayType };
  if (!s.anchorDate) {
    return { state: "none", reason: "Set today as an A or B day to start the clock.",
             dayType: null, scheduleName: day.name };
  }

  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const blocks = day.blocks.map(b => {
    const code = periodCode(dayType, b.slot);
    const cls = classForPeriod(code);
    return {
      ...b,
      code,
      title: cls ? cls.name : b.label,
      startSec: toMinutes(b.start) * 60,
      endSec: toMinutes(b.end) * 60
    };
  }).sort((a, b) => a.startSec - b.startSec);

  const common = { dayType, blocks, scheduleName: day.name, custom: !!day.custom };
  if (blocks.length === 0) return { ...common, state: "none", reason: "No blocks in this schedule." };

  const current = blocks.find(b => nowSec >= b.startSec && nowSec < b.endSec);
  const next    = blocks.find(b => b.startSec > nowSec);

  if (current) return { ...common, state: "in", block: current, next, endsIn: current.endSec - nowSec };
  if (nowSec < blocks[0].startSec) return { ...common, state: "before", next, startsIn: next.startSec - nowSec };
  if (next) return { ...common, state: "passing", next, startsIn: next.startSec - nowSec };
  return { ...common, state: "after" };
}

/* ---------- Nav corner widget ---------- */

function classWidgetText(st) {
  if (st.state === "in")      return `${st.block.title} · ${countdownText(st.endsIn)} left`;
  if (st.state === "passing") return `${st.next.title} in ${countdownText(st.startsIn)}`;
  if (st.state === "before")  return `${st.next.title} in ${countdownText(st.startsIn)}`;
  if (st.state === "after")   return "School's out";
  return "No school";
}

function mountClassWidget() {
  const nav = document.querySelector("nav");
  if (!nav || document.getElementById("classWidget")) return;

  const el = document.createElement("a");
  el.id = "classWidget";
  el.className = "classwidget";
  el.href = "clock.html";
  nav.appendChild(el);

  const paint = () => {
    const st = scheduleStatus();
    if (st.state === "off") { el.style.display = "none"; return; }  // clock turned off
    el.style.display = "";
    el.textContent = classWidgetText(st);
    el.classList.toggle("urgent", st.state === "in" && st.endsIn <= 300);
  };
  paint();
  setInterval(paint, 1000);
}

document.addEventListener("DOMContentLoaded", mountClassWidget);
