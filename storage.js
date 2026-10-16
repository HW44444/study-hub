/* ============================================================
   Study Hub — shared storage + helpers used by every page.

   Data lives in localStorage, a small database built into the
   browser. It survives closing the tab, so your work is still
   there tomorrow. It is per-browser and per-device: nothing is
   uploaded anywhere, and nobody else can see it.
   ============================================================ */

/* ---------- Saving and loading ----------
   localStorage can only hold TEXT. So anything structured (a
   list of assignments, a deck of cards) gets converted to a
   JSON string going in, and parsed back into real JavaScript
   coming out. */

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;      // nothing saved yet
    const parsed = JSON.parse(raw);
    // Guard against a saved value of the wrong shape.
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed;
  } catch (e) {
    console.warn("Couldn't read " + key + ", using default.", e);
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    // Storage can be full, or blocked in private-browsing mode.
    console.warn("Couldn't save " + key + ".", e);
    alert("Couldn't save your data. Your browser storage may be full or disabled.");
    return false;
  }
}

/* ---------- Security: never trust text when building HTML ----------
   These pages build rows with innerHTML. If a user typed
   something like <img onerror=...> into an assignment title,
   the browser would RUN it instead of showing it. That is a
   cross-site scripting (XSS) bug. Escaping turns those
   characters into harmless display-only versions.
   Rule: any value a person typed must pass through this before
   it goes into innerHTML. */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- Unique ids ----------
   Every saved item needs an id so we can find, update, or
   delete exactly one of them later. Timestamp + randomness. */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Where each kind of data is stored ---------- */
const KEYS = {
  assignments: "sh_assignments", // [{id, title, className, due, done}]
  classes:     "sh_classes",     // [{id, name, grade, type}]
  plan:        "sh_plan",        // [{name, minutes, assignmentId?}]  session queue
  log:         "sh_log"          // [{date, minutes}]                 study history
};

/* ---------- Dates ---------- */

// "2026-10-14" -> "Oct 14"
function prettyDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Whole days from today until a date. Negative means overdue.
function daysUntil(iso) {
  if (!iso) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + "T00:00:00");
  if (isNaN(target)) return Infinity;
  return Math.round((target - today) / 86400000);
}

/* Always build date strings from LOCAL parts.
   toISOString() converts to UTC first, so in Oregon anything
   after about 5pm would come out as tomorrow's date — which
   would log evening study time to the wrong day. */
function localISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayISO() {
  return localISO(new Date());
}

/* ---------- Study time log ---------- */

function logStudyTime(minutes) {
  if (!minutes || minutes <= 0) return;
  const log = load(KEYS.log, []);
  const today = todayISO();
  const entry = log.find(e => e.date === today);
  if (entry) entry.minutes += minutes;
  else log.push({ date: today, minutes: minutes });
  save(KEYS.log, log);
}

/* The study week starts Saturday 00:00 — meaning the counter
   resets on Friday night. We find the most recent Saturday and
   only count log entries on or after it, so the reset happens
   automatically with no scheduled job. */
function weekStartISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // getDay(): Sun=0 … Sat=6.  This gives days since last Saturday.
  const daysSinceSaturday = (d.getDay() + 1) % 7;
  d.setDate(d.getDate() - daysSinceSaturday);
  return localISO(d);
}

// Minutes studied since the week started (Saturday).
function minutesThisWeek() {
  const start = weekStartISO();
  return load(KEYS.log, [])
    .filter(e => e.date >= start)          // ISO dates compare correctly as text
    .reduce((total, e) => total + (e.minutes || 0), 0);
}

// Manual reset: drop this week's entries, keep older history.
function resetThisWeek() {
  const start = weekStartISO();
  const kept = load(KEYS.log, []).filter(e => e.date < start);
  save(KEYS.log, kept);
}

// "95" -> "1h 35m"
function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return h + "h " + m + "m";
  if (h) return h + "h";
  return m + "m";
}

/* ---------- Nav: mark the page you're on ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const page = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav .links a").forEach(a => {
    if (a.getAttribute("href") === page) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
  });
});
