# Study Hub

A study and organization web app I built for myself — assignment tracking, GPA, two kinds of study timers, and a session runner that walks me through a plan I set in advance.

## Why I built it
I wanted one place that matched how I actually study, instead of juggling a notes app, a timer, and a grade calculator. The part I couldn't find elsewhere is the **session runner**: I queue up what I'm going to work on, in order, with a time for each, hit start, and it runs me through the whole thing.

## Features

### Study session (`planner.html`)
A three-panel planner:
- **Left — quick add.** One-tap break chips (1 / 3 / 5 / 10 min), plus a dropdown that pulls in the classes from my Grades page so I can add "AP Physics · 25 min" in two clicks.
- **Center — the plan.** Reorder tasks with the arrows, remove them, see the running total, then start.
- **Right — my assignments.** Everything open from the assignments page, each with a minutes box and an add button, so an assignment becomes a timed task directly.

When the session ends, any assignments I ran study time for come back in a dialog asking if I want to check them off — so the two pages stay in sync.

The timer counts each task down, plays a tone, and auto-advances. Pause, skip, or end early; time studied is logged.

### Test Time (`testtime.html`)
A plain interval timer for when I don't want to plan anything: set study time, break time, and how many times to repeat — or check "keep going until I stop it" and it cycles indefinitely. Study phases count toward my weekly total; breaks don't.

### Assignments (`assignments.html`)
Add assignments with a class and due date, auto-sorted by what's due soonest, with color-coded urgency (overdue / due today / due soon).

**Schedule importer** — paste the text of a homework schedule (from a Google Doc, a syllabus, anywhere) and it pulls out the dates and descriptions, shows a preview, and imports the ones I pick. It understands `10/20`, `10/20/26`, `Oct 20`, `October 20`, and `2026-10-20`, ignores weekday names, infers the year, and skips duplicates on re-import.

### Grades (`grades.html`)
GPA stays pinned at the top; the add form sits at the bottom. Grades and course types are **editable inline** in the class list — change a dropdown and the GPA updates instantly. Full +/- precision (A- = 3.7) with AP (+1.0) and Honors (+0.5) weighting.

### Dashboard (`index.html`)
What's due this week, time studied, current GPA, and the next five assignments. The study total **resets automatically every Friday night**, with a manual reset button too.

## How to run
Open `index.html` in a browser. No install, no build step, no account.

Data is saved in the browser's `localStorage`, so it persists between visits and stays on your device — nothing is uploaded anywhere.

## Project structure
- `index.html` — dashboard
- `planner.html` — session planner and runner
- `testtime.html` — repeating study/break timer
- `assignments.html` — assignments + schedule importer
- `grades.html` — grades and GPA
- `style.css` — shared styling
- `storage.js` — save/load, date math, HTML escaping, weekly reset
- `ui.js` — in-app dialogs and toasts

## Deploying to Cloudflare Pages (free)
Static site, so it hosts free on Cloudflare Pages with a `*.pages.dev` subdomain — no domain purchase needed.

**Option A — connect GitHub (auto-deploys on every push):**
1. Push this folder to a GitHub repository.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Pick the repository.
4. Build settings: **Framework preset: None**, **Build command: leave empty**, **Build output directory: `/`**. There's no build step — files are served as-is.
5. **Save and Deploy.**

**Option B — direct upload (no GitHub):**
**Workers & Pages → Create → Pages → Upload assets**, drag the folder in, name it, deploy.

The project name becomes the subdomain: `your-project-name.pages.dev`.

## What I learned
- **Escaping user input.** My first version dropped typed text straight into `innerHTML`, so a title containing `<img src=x onerror=...>` would *run* instead of display — a cross-site scripting (XSS) bug. Every user value now goes through `escapeHtml()`. This mattered specifically because the site is public.
- **Timers should trust the clock, not a counter.** Subtracting 1 from a variable each second drifts and stalls in background tabs. Storing the *end timestamp* and recomputing from `Date.now()` every tick stays accurate regardless.
- **Async dialogs.** Replacing `alert()`/`confirm()` meant learning why they can't be swapped one-for-one: the browser versions block everything, while a custom dialog has to let the page keep running. Mine return Promises, so call sites use `await`.
- **A weekly reset with no scheduled job.** Rather than running something Friday night, the code computes the most recent Saturday and only counts entries since then — the reset happens on its own just by asking the right question.
- **Event delegation.** One listener per list reads a `data-` attribute off whatever was clicked, instead of binding to every button (which breaks for rows added later).
- **Verifying instead of assuming.** I wrote a checker that syntax-tests every inline script, confirms every `getElementById` has a matching element, flags duplicate IDs and attributes, verifies each page loads the shared files whose functions it calls, and unit-tests the schedule parser against real schedule lines. It caught a genuine bug — a tag with two `style` attributes where the second was silently ignored.

## Ideas for next versions
- A weekly study-time chart
- Repeating assignments
- Export/import data as a file for backup
- Flashcards (removed for now — the first version didn't work the way I wanted)
