// /assets/js/core/pages/reporting.js
// Works with router.init(mount); fetches /partials/reporting.json itself.

import { el } from "../dom.js";
import { renderFunds } from "../../features/reportingFunds.js";
import { renderCampaigns } from "../../features/reportingCampaigns.js";

let rootEl = null;

async function loadPartial() {
  try {
    const res = await fetch("/partials/reporting.json", { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch {}
  return { page: { enabled: true }, blocks: [] };
}

export async function init(root) {
  rootEl = root || document.getElementById("subpage");
  const data = await loadPartial();

  if (!data?.page?.enabled) { rootEl.innerHTML = ""; return; }

  const page = el("section", { class: "container-section" }, [
    el("h1", { class: "h1 mb-4", "data-i18n": "reporting.title" }, "Reporting"),
    el("p",  { class: "muted mb-8", "data-i18n": "reporting.desc"  }, "Transparency hub for funding, campaigns, updates, and documents.")
  ]);

  const blocks = Array.isArray(data.blocks) ? data.blocks : [];

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
      const slot = card.querySelector("[data-i18n='reporting.placeholder']");
      if (slot) { slot.removeAttribute("data-i18n"); slot.textContent = ""; }
      afterMount(card, cfg);
    }
  };

  // 1) Financial overview
  mountBlock("funds",
    "reporting.blocks.funds.title",
    "reporting.blocks.funds.desc",
    "reporting.placeholder",
    (card) => {
      const slot = document.createElement("div");
      card.appendChild(slot);
      renderFunds(slot);
    }
  );

  // 2) Campaigns
  mountBlock("campaigns",
    "reporting.blocks.campaigns.title",
    "reporting.blocks.campaigns.desc",
    "reporting.placeholder",
    (card) => {
      const slot = document.createElement("div");
      card.appendChild(slot);
      renderCampaigns(slot);
    }
  );

  // 3) Updates (placeholder)
  mountBlock("updates",
    "reporting.blocks.updates.title",
    "reporting.blocks.updates.desc",
    "reporting.placeholder"
  );

  // 4) Documents (placeholder)
  mountBlock("documents",
    "reporting.blocks.documents.title",
    "reporting.blocks.documents.desc",
    "reporting.placeholder"
  );

  rootEl.replaceChildren(page);
}

export function destroy(){ rootEl = null; }
