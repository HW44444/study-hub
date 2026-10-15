/* ============================================================
   Study Hub — in-app dialogs and toasts.

   Replaces the browser's alert() / confirm(), which are ugly,
   can't be styled, and freeze the whole page.

   The key difference: alert() is SYNCHRONOUS (code stops until
   you click OK). These can't be, because the page has to keep
   running to show the dialog. So they return a Promise and you
   use `await`:

       await uiAlert("Saved.");
       if (await uiConfirm("Delete it?")) { ... }
   ============================================================ */

/* ---------- Toast: a brief message that fades on its own ---------- */
function uiToast(message, type) {
  let holder = document.querySelector(".toasts");
  if (!holder) {
    holder = document.createElement("div");
    holder.className = "toasts";
    document.body.appendChild(holder);
  }
  const el = document.createElement("div");
  el.className = "toast" + (type ? " " + type : "");
  el.setAttribute("role", "status");
  el.textContent = message;
  holder.appendChild(el);

  // Fade out, then remove from the DOM so they don't pile up.
  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

/* ---------- The shared dialog builder ----------
   `build` fills in the body and returns a function that reads
   the result when OK is pressed. */
function openDialog({ title, bodyHTML, okLabel = "OK", cancelLabel = null, build = null, onOk = null, danger = false }) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
        <h3 id="dlgTitle">${escapeHtml(title)}</h3>
        <div class="dialog-body">${bodyHTML || ""}</div>
        <div class="dialog-actions">
          ${cancelLabel ? `<button class="ghost" data-act="cancel">${escapeHtml(cancelLabel)}</button>` : ""}
          <button data-act="ok" class="${danger ? "danger-solid" : ""}">${escapeHtml(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    if (build) build(overlay);

    const close = value => {
      document.removeEventListener("keydown", onKey);
      overlay.classList.add("leaving");
      setTimeout(() => overlay.remove(), 150);
      resolve(value);
    };

    const onKey = e => {
      if (e.key === "Escape") close(cancelLabel ? false : true);
      if (e.key === "Enter" && !e.shiftKey && e.target.tagName !== "TEXTAREA") {
        const ok = overlay.querySelector('[data-act="ok"]');
        if (ok) ok.click();
      }
    };
    document.addEventListener("keydown", onKey);

    overlay.addEventListener("click", e => {
      // Clicking the dark backdrop cancels.
      if (e.target === overlay) { close(cancelLabel ? false : true); return; }
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      if (btn.dataset.act === "cancel") close(false);
      if (btn.dataset.act === "ok") close(onOk ? onOk(overlay) : true);
    });

    // Focus the primary button so Enter/Escape work immediately.
    const first = overlay.querySelector("input, textarea, select") ||
                  overlay.querySelector('[data-act="ok"]');
    if (first) first.focus();
  });
}

/* ---------- The three everyday dialogs ---------- */

function uiAlert(message, title = "Heads up") {
  return openDialog({
    title,
    bodyHTML: `<p>${escapeHtml(message)}</p>`,
    okLabel: "OK"
  });
}

function uiConfirm(message, title = "Are you sure?", okLabel = "Confirm") {
  return openDialog({
    title,
    bodyHTML: `<p>${escapeHtml(message)}</p>`,
    okLabel,
    cancelLabel: "Cancel",
    danger: true
  });
}

/* Checklist dialog. items = [{id, label, sub}]
   Resolves to an array of checked ids, or false if cancelled. */
function uiChoose(title, items, okLabel = "Done", intro = "") {
  const rows = items.map(it => `
    <label class="choose-row">
      <input type="checkbox" value="${escapeHtml(it.id)}" checked>
      <span>
        <span class="choose-label">${escapeHtml(it.label)}</span>
        ${it.sub ? `<span class="choose-sub">${escapeHtml(it.sub)}</span>` : ""}
      </span>
    </label>`).join("");

  return openDialog({
    title,
    bodyHTML: (intro ? `<p>${escapeHtml(intro)}</p>` : "") + rows,
    okLabel,
    cancelLabel: "Skip",
    onOk: overlay =>
      [...overlay.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value)
  });
}
