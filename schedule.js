/* ============================================================
   Study Hub — class schedule engine.

   Two jobs:
     1. Work out whether today is an A day or a B day.
     2. Work out which block of the day we're in right now.

   The A/B part is the hard one. Schools alternate, but holidays
   and snow days break strict alternation. So instead of a
   hardcoded calendar we store ONE known day ("Oct 15 was an A
   day") and count school days forward from it. When the rotation
   slips, you re-anchor with one tap and everything after is
   correct again.
   ============================================================ */

const SCHED_KEY = "sh_schedule";

/* A block is one chunk of the day.
   slot 1-4 = a class period; slot null = lunch, passing, etc. */
const DEFAULT_SCHEDULE = {
  blocks: [
    { label: "Period 1", start: "08:30", end: "09:55", slot: 1 },
    { label: "Period 2", start: "10:05", end: "11:30", slot: 2 },
    { label: "Lunch",    start: "11:30", end: "12:10", slot: null },
    { label: "Period 3", start: "12:20", end: "13:45", slot: 3 },
    { label: "Period 4", start: "13:55", end: "15:20", slot: 4 }
  ],
  anchorDate: "",   // a date you KNOW the type of, e.g. "2026-10-15"
  anchorType: "A"   // what that date was
};

function loadSchedule() {
  const s = load(SCHED_KEY, null);
  if (!s || !Array.isArray(s.blocks) || s.blocks.length === 0) {
    return JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
  }
  return s;
}
function saveSchedule(s) { save(SCHED_KEY, s); }

/* ---------- Time helpers ---------- */

// "13:45" -> 825 (minutes since midnight)
function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// 825 -> "1:45 PM"
function toClockLabel(mins) {
  const h24 = Math.floor(mins / 60), m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/* Under 5 minutes shows seconds, because that's when you care. */
function countdownText(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m >= 5) return `${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ---------- A / B day ---------- */

function isWeekend(d) { return d.getDay() === 0 || d.getDay() === 6; }

/* Count weekdays between two dates, then flip the type for each
   one. Returns "A", "B", or null if we can't tell / no school. */
function dayTypeFor(dateISO) {
  const s = loadSchedule();
  if (!s.anchorDate) return null;

  const start = new Date(s.anchorDate + "T00:00:00");
  const end   = new Date(dateISO + "T00:00:00");
  if (isNaN(start) || isNaN(end)) return null;
  if (isWeekend(end)) return null;             // no school on weekends

  let weekdays = 0;
  const step = end >= start ? 1 : -1;
  const cur = new Date(start);
  let guard = 0;
  while (cur.getTime() !== end.getTime() && guard++ < 1000) {
    cur.setDate(cur.getDate() + step);
    if (!isWeekend(cur)) weekdays++;
  }

  const flipped = weekdays % 2 === 1;
  const base = s.anchorType === "B" ? "B" : "A";
  if (!flipped) return base;
  return base === "A" ? "B" : "A";
}

/* On an A day slot 1 is "A1"; on a B day slot 1 is "B5". */
function periodCode(dayType, slot) {
  if (!dayType || !slot) return null;
  return dayType === "A" ? "A" + slot : "B" + (slot + 4);
}

/* The class you entered on the Grades page for that period. */
function classForPeriod(code) {
  if (!code) return null;
  return load(KEYS.classes, []).find(c => c.period === code) || null;
}

/* ---------- Where are we right now? ---------- */
/*
  Returns one of:
    {state:"none"}                         weekend / not set up
    {state:"before", next, startsIn}
    {state:"in",     block, endsIn, next}
    {state:"passing", next, startsIn}
    {state:"after"}
*/
function scheduleStatus(now = new Date()) {
  const s = loadSchedule();
  const iso = now.toISOString().slice(0, 10);
  const dayType = dayTypeFor(iso);

  if (isWeekend(now)) return { state: "none", reason: "It's the weekend." };
  if (!s.anchorDate)  return { state: "none", reason: "Set up your schedule to start the clock." };

  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  // Decorate each block with its resolved class name for today.
  const blocks = s.blocks.map(b => {
    const code = periodCode(dayType, b.slot);
    const cls = classForPeriod(code);
    return {
      ...b,
      code,
      className: cls ? cls.name : null,
      title: cls ? cls.name : b.label,
      startSec: toMinutes(b.start) * 60,
      endSec: toMinutes(b.end) * 60
    };
  }).sort((a, b) => a.startSec - b.startSec);

  const current = blocks.find(b => nowSec >= b.startSec && nowSec < b.endSec);
  const next    = blocks.find(b => b.startSec > nowSec);

  if (current) {
    return { state: "in", dayType, blocks, block: current, next,
             endsIn: current.endSec - nowSec };
  }
  if (next && nowSec < blocks[0].startSec) {
    return { state: "before", dayType, blocks, next, startsIn: next.startSec - nowSec };
  }
  if (next) {
    return { state: "passing", dayType, blocks, next, startsIn: next.startSec - nowSec };
  }
  return { state: "after", dayType, blocks };
}

/* ---------- The little nav widget ---------- */

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
    el.textContent = classWidgetText(st);
    el.classList.toggle("urgent", st.state === "in" && st.endsIn <= 300);
  };
  paint();
  setInterval(paint, 1000);
}

document.addEventListener("DOMContentLoaded", mountClassWidget);
