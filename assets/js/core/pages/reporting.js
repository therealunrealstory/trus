// /assets/js/core/pages/reporting.js
// Page container for "Reporting" with 4 toggleable blocks.
// Conforms to existing router/init({root,data,i18n}) pattern.

import { el } from "../dom.js";
import { renderFunds } from "../../features/reportingFunds.js";

let rootEl = null;

export async function init({ root, data }) {
  rootEl = root;

  // If page is disabled in partials, render nothing
  if (!data?.page?.enabled) {
    rootEl.innerHTML = "";
    return;
  }

  const page = el("section", { class: "container-section" }, [
    el("h1", { class: "h1 mb-4", "data-i18n": "reporting.title" }, "Reporting"),
    el("p",  { class: "muted mb-8", "data-i18n": "reporting.desc"  }, "Transparency hub for funding, campaigns, updates, and documents.")
  ]);

  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];

  // helper to mount a block card; afterMount(card) can inject dynamic content
  const mountBlock = (id, titleKey, descKey, placeholderKey, afterMount) => {
    const cfg = blocks.find(b => b.id === id);
    if (cfg?.enabled === false) return;

    const card = el("section", { class: "card mb-6", id: `reporting-${id}` }, [
      el("h2", { class: "h2 mb-2", "data-i18n": titleKey }, ""),
      el("p",  { class: "muted mb-4", "data-i18n": descKey  }, ""),
      el("div", { class: "text-sm text-gray-300", "data-i18n": placeholderKey }, "Content will appear here.")
    ]);

    page.appendChild(card);

    if (typeof afterMount === "function") {
      // use the placeholder area as a mount slot for the feature renderer
      const slot = card.querySelector("[data-i18n='reporting.placeholder']");
      if (slot) { slot.removeAttribute("data-i18n"); slot.textContent = ""; }
      afterMount(card);
    }
  };

  // 1) Financial overview (wired up to /data/funds.json via reportingFunds)
  mountBlock(
    "funds",
    "reporting.blocks.funds.title",
    "reporting.blocks.funds.desc",
    "reporting.placeholder",
    (card) => {
      const slot = document.createElement("div");
      card.appendChild(slot);
      renderFunds(slot);
    }
  );

  // 2) Fundraising campaigns (placeholder for now)
  mountBlock(
    "campaigns",
    "reporting.blocks.campaigns.title",
    "reporting.blocks.campaigns.desc",
    "reporting.placeholder"
  );

  // 3) Accountability feed / Telegram (placeholder for now)
  mountBlock(
    "updates",
    "reporting.blocks.updates.title",
    "reporting.blocks.updates.desc",
    "reporting.placeholder"
  );

  // 4) Documents & proofs (placeholder for now)
  mountBlock(
    "documents",
    "reporting.blocks.documents.title",
    "reporting.blocks.documents.desc",
    "reporting.placeholder"
  );

  rootEl.replaceChildren(page);
}

export function destroy() {
  // No timers/listeners to clean; keep symmetrical API
  rootEl = null;
}
