// /assets/js/features/reportingFunds.js
// Financial overview + detail modals for Reporting page.
// Uses existing modal DOM (#modalBackdrop, #modalTitle, #modalBody, #modalOk)

import { el } from "../core/dom.js";

/* -------------------------- utils -------------------------- */

function sum(arr) {
  return (Array.isArray(arr) ? arr : []).reduce((a, x) => a + (Number(x.amount) || 0), 0);
}
function lastCollected(collected) {
  if (!Array.isArray(collected) || collected.length === 0) return 0;
  const last = collected[collected.length - 1];
  return Number(last.amount) || 0;
}
function fmtMoney(n, currency) {
  const v = Number(n || 0);
  const cur = currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${v.toLocaleString()} ${cur}`;
  }
}
function statusColorForSpentPlanned(total, collectedTotal) {
  if (total > collectedTotal) return "text-red-400";
  if (collectedTotal > 0 && total >= collectedTotal * 0.8) return "text-yellow-300";
  return "text-green-400";
}
function statusColorForAvailable(available, safetyMargin) {
  if (available <= 0) return "text-red-400";
  if (safetyMargin <= 50) return "text-yellow-300";
  return "text-green-400";
}
function openModal({ title, body }) {
  const backdrop = document.getElementById("modalBackdrop");
  const t = document.getElementById("modalTitle");
  const b = document.getElementById("modalBody");
  const ok = document.getElementById("modalOk");
  if (!backdrop || !t || !b || !ok) return;

  t.textContent = "";
  t.append(
    el("span", { "data-i18n": title.i18n || "" }, title.text || "")
  );

  b.innerHTML = "";
  b.append(body);

  backdrop.classList.add("open");
  ok.onclick = () => backdrop.classList.remove("open");
}

/* ---------------------- charts (pure DOM) ---------------------- */

// 1) Collected — vertical thin bars (heights by progress)
function renderCollectedBars(collected, currency) {
  const values = (collected || []).map(c => Number(c.amount) || 0);
  const max = values.length ? Math.max(...values) : 0;

  const wrap = el("div", {}, [
    el("div", { class: "text-xs text-white/70 mb-3", "data-i18n":"funds.collected.tip" },
      "Cumulative progress by date."),
    el("div", { class: "flex items-end gap-1 h-40 border-b border-white/10 pb-1 overflow-x-auto" },
      values.map((v, i) => {
        const h = max > 0 ? Math.max(2, Math.round((v / max) * 100)) : 2; // %
        const date = (collected[i]?.date || "");
        return el("div", { class: "group w-1 bg-cyan-400/80", style: `height:${h}%` }, [
          el("div", { class: "opacity-0 group-hover:opacity-100 transition text-[10px] text-white/80 mt-1 text-center" },
            `${date}`)
        ]);
      })
    )
  ]);
  return wrap;
}

// 2) Spent — horizontal bars list
function renderSpentList(spent, currency) {
  const total = sum(spent);
  const max = (spent || []).length ? Math.max(...spent.map(s => Number(s.amount) || 0)) : 0;

  const list = el("div", { class: "space-y-3" },
    (spent || []).map(item => {
      const v = Number(item.amount) || 0;
      const w = max > 0 ? Math.round((v / max) * 100) : 0;
      const note = (item.note && (item.note.EN || item.note.RU || item.note.FR || item.note.ES)) || "";
      const row = el("div", {}, [
        el("div", { class: "flex items-center justify-between text-xs text-white/70 mb-1" }, [
          el("div", {}, `${item.date || ""}`),
          el("div", { class: "font-medium" }, fmtMoney(v, currency))
        ]),
        el("div", { class: "h-2 bg-white/10 rounded" }, [
          el("div", { class: "h-2 rounded bg-white/60", style: `width:${w}%` })
        ])
      ]);

      if (note) {
        const btn = el("button", { class: "mt-1 text-[11px] underline text-white/80" , "data-i18n":"funds.showNote"}, "Show note");
        const n = el("div", { class: "hidden text-xs text-white/80 mt-1 whitespace-pre-wrap" }, note);
        btn.onclick = () => n.classList.toggle("hidden");
        row.append(btn, n);
      }
      return row;
    })
  );

  const wrap = el("div", {}, [
    list,
    el("div", { class: "mt-3 text-xs text-white/70" }, [
      el("span", { "data-i18n":"funds.total" }, "Total"),
      el("span", {}, `: ${fmtMoney(total, currency)}`)
    ])
  ]);

  return wrap;
}

// 3) Planned — horizontal bars list (no dates)
function renderPlannedList(planned, currency) {
  const total = sum(planned);
  const max = (planned || []).length ? Math.max(...planned.map(s => Number(s.amount) || 0)) : 0;

  const list = el("div", { class: "space-y-3" },
    (planned || []).map(item => {
      const v = Number(item.amount) || 0;
      const w = max > 0 ? Math.round((v / max) * 100) : 0;
      const note = (item.note && (item.note.EN || item.note.RU || item.note.FR || item.note.ES)) || "";
      const row = el("div", {}, [
        el("div", { class: "flex items-center justify-between text-xs text-white/70 mb-1" }, [
          el("div", {}, note ? note.slice(0, 80) + (note.length > 80 ? "…" : "") : ""),
          el("div", { class: "font-medium" }, fmtMoney(v, currency))
        ]),
        el("div", { class: "h-2 bg-white/10 rounded" }, [
          el("div", { class: "h-2 rounded bg-white/60", style: `width:${w}%` })
        ])
      ]);
      if (note && note.length > 80) {
        const btn = el("button", { class: "mt-1 text-[11px] underline text-white/80", "data-i18n":"funds.showFull" }, "Show full");
        const n = el("div", { class: "hidden text-xs text-white/80 mt-1 whitespace-pre-wrap" }, note);
        btn.onclick = () => n.classList.toggle("hidden");
        row.append(btn, n);
      }
      return row;
    })
  );

  const wrap = el("div", {}, [
    list,
    el("div", { class: "mt-3 text-xs text-white/70" }, [
      el("span", { "data-i18n":"funds.total" }, "Total"),
      el("span", {}, `: ${fmtMoney(total, currency)}`)
    ])
  ]);

  return wrap;
}

// 4) Available — number + safety scale
function renderAvailableView({ available, plannedTotal, safetyMargin, currency }) {
  const line = el("div", { class: "mt-3 h-2 bg-white/10 rounded overflow-hidden" }, [
    el("div", {
      class: "h-2 rounded",
      style: `width:${Math.max(0, Math.min(100, safetyMargin))}%; background:linear-gradient(90deg, rgba(255,255,255,0.7), rgba(255,255,255,0.5));`
    })
  ]);

  const info = el("div", { class: "text-sm mt-2" }, [
    el("div", {}, [
      el("span", { "data-i18n":"funds.safety" }, "Safety margin"),
      el("span", {}, `: ${Math.max(-999, Math.min(999, safetyMargin))}%`)
    ]),
    el("div", { class: "text-white/70 text-xs" }, [
      el("span", { "data-i18n":"funds.plannedTotal" }, "Planned total"),
      el("span", {}, `: ${fmtMoney(plannedTotal, currency)}`)
    ])
  ]);

  return el("div", {}, [
    el("div", { class: "text-2xl font-semibold mb-1" }, fmtMoney(available, currency)),
    line,
    info
  ]);
}

/* ----------------------- main renderer ----------------------- */

export async function renderFunds(container /*, i18n */) {
  container.innerHTML = "";

  // Load data
  let data = null;
  try {
    const res = await fetch("/data/funds.json", { cache: "no-store" });
    if (res.ok) data = await res.json();
  } catch {}
  data ||= { meta:{currency:"USD", lang_default:"EN", updated_at:""}, collected:[], spent:[], planned:[] };

  const currency = data?.meta?.currency || "USD";
  const updatedAt = data?.meta?.updated_at || "";

  const collectedTotal = lastCollected(data.collected);
  const spentTotal = sum(data.spent);
  const plannedTotal = sum(data.planned);
  const available = collectedTotal - spentTotal - plannedTotal;
  const safetyMargin = plannedTotal > 0 ? Math.round((available / plannedTotal) * 100) : 100;

  const collectedColor = "text-cyan-400";
  const spentColor = statusColorForSpentPlanned(spentTotal, collectedTotal);
  const plannedColor = statusColorForSpentPlanned(plannedTotal, collectedTotal);
  const availableColor = statusColorForAvailable(available, safetyMargin);

  // Grid
  const grid = el("div", { class: "grid grid-cols-1 sm:grid-cols-2 gap-4" });

  // Card: Collected
  const cardCollected = el("div", { class: "card p-4 cursor-pointer", role:"button", tabindex:"0" }, [
    el("div", { class: "text-sm uppercase tracking-wide text-white/60", "data-i18n":"funds.collected" }, "Collected"),
    el("div", { class: `text-2xl font-semibold ${collectedColor}` }, fmtMoney(collectedTotal, currency))
  ]);
  cardCollected.onclick = () => openModal({
    title: { i18n:"modal.collected.title", text:"Collected — details" },
    body: renderCollectedBars(data.collected, currency)
  });

  // Card: Spent
  const cardSpent = el("div", { class: "card p-4 cursor-pointer", role:"button", tabindex:"0" }, [
    el("div", { class: "text-sm uppercase tracking-wide text-white/60", "data-i18n":"funds.spent" }, "Spent"),
    el("div", { class: `text-2xl font-semibold ${spentColor}` }, fmtMoney(spentTotal, currency))
  ]);
  cardSpent.onclick = () => openModal({
    title: { i18n:"modal.spent.title", text:"Spending — details" },
    body: renderSpentList(data.spent, currency)
  });

  // Card: Planned
  const cardPlanned = el("div", { class: "card p-4 cursor-pointer", role:"button", tabindex:"0" }, [
    el("div", { class: "text-sm uppercase tracking-wide text-white/60", "data-i18n":"funds.planned" }, "Planned"),
    el("div", { class: `text-2xl font-semibold ${plannedColor}` }, fmtMoney(plannedTotal, currency))
  ]);
  cardPlanned.onclick = () => openModal({
    title: { i18n:"modal.planned.title", text:"Planned — details" },
    body: renderPlannedList(data.planned, currency)
  });

  // Card: Available
  const cardAvailable = el("div", { class: "card p-4 cursor-pointer", role:"button", tabindex:"0" }, [
    el("div", { class: "text-sm uppercase tracking-wide text-white/60", "data-i18n":"funds.available" }, "Available"),
    el("div", { class: `text-2xl font-semibold ${availableColor}` }, fmtMoney(available, currency)),
    available <= 0
      ? el("div", { class: "text-xs mt-1 text-red-300", "data-i18n":"funds.available.none" }, "No funds available.")
      : el("div", { class: "text-xs mt-1 text-white/70" }, [
          el("span", { "data-i18n":"funds.safety" }, "Safety margin"),
          el("span", {}, `: ${safetyMargin}%`)
        ])
  ]);
  cardAvailable.onclick = () => openModal({
    title: { i18n:"modal.available.title", text:"Available — details" },
    body: renderAvailableView({ available, plannedTotal, safetyMargin, currency })
  });

  grid.append(cardCollected, cardSpent, cardPlanned, cardAvailable);

  const metaLine = el("div", { class: "mt-2 text-xs text-white/50" }, [
    el("span", { "data-i18n":"funds.updatedAt" }, "Updated"),
    el("span", {}, updatedAt ? `: ${updatedAt}` : "")
  ]);

  container.appendChild(grid);
  container.appendChild(metaLine);
}
