/* ============================================================
   Study Hub — running-session state, shared by every page.

   A session used to live only in planner.html's variables, so
   leaving the page killed it. Now the whole state is written to
   localStorage on every change, which means:

     - you can browse to Assignments and come back mid-task
     - a widget in the nav shows it running from anywhere
     - the timer stays correct while you're away, because we
       store WHEN the chunk ends, not how much is left

   planner.html owns the state transitions. Everywhere else just
   reads it to draw the widget.
   ============================================================ */

const SESSION_KEY = "sh_session";

function loadSession()  { return load(SESSION_KEY, null); }
function saveSession(s) { save(SESSION_KEY, s); }
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
}

/* Seconds left in the current chunk.
   Paused sessions keep a frozen number; running ones are
   measured against the clock. */
function sessionRemaining(s) {
  if (!s) return 0;
  if (s.awaiting) return 0;
  if (s.paused) return Math.max(0, s.remaining || 0);
  return Math.max(0, Math.round((s.endTime - Date.now()) / 1000));
}

function sessionShortTime(secs) {
  const m = Math.floor(secs / 60), sec = secs % 60;
  return m >= 5 ? `${m}m` : `${m}:${String(sec).padStart(2, "0")}`;
}

function sessionWidgetText(s, plan) {
  const task = plan[s.index];
  const name = task ? task.name : "Session";
  if (s.awaiting) return `${name} · time's up`;
  const left = sessionRemaining(s);
  if (left <= 0) return `${name} · time's up`;
  return `${name} · ${sessionShortTime(left)}${s.paused ? " (paused)" : ""}`;
}

/* ---------- The nav widget ---------- */
function mountSessionWidget() {
  // No point showing it on the planner — the runner is right there.
  const page = location.pathname.split("/").pop();
  if (page === "planner.html" || page === "planner") return;

  const nav = document.querySelector("nav");
  if (!nav || document.getElementById("sessionWidget")) return;

  const el = document.createElement("a");
  el.id = "sessionWidget";
  el.className = "sessionwidget";
  el.href = "planner.html";
  el.title = "Back to your study session";
  nav.appendChild(el);

  const paint = () => {
    const s = loadSession();
    if (!s || !s.active) { el.style.display = "none"; return; }
    const plan = load(KEYS.plan, []);
    el.style.display = "";
    el.textContent = "▶ " + sessionWidgetText(s, plan);
    el.classList.toggle("urgent", !!s.awaiting || sessionRemaining(s) <= 60);
  };
  paint();
  setInterval(paint, 1000);
}

document.addEventListener("DOMContentLoaded", mountSessionWidget);
