// assets/js/core/pages/reporting.js
import { el } from "../../core/dom.js";

let rootEl = null;

export async function init({ root, data }) {
  rootEl = root;

  if (!data?.page?.enabled) {
    rootEl.innerHTML = "";
    return;
  }

  const page = el("section", { class: "container-section" }, [
    el("h1", { class: "h1 mb-4", "data-i18n": "reporting.title" }, "Reporting"),
    el("p",  { class: "muted mb-8", "data-i18n": "reporting.desc"  }, "Transparency hub for funding, campaigns, updates, and documents.")
  ]);

  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];

  const mountBlock = (id, titleKey, descKey, placeholderKey) => {
    const cfg = blocks.find(b => b.id === id);
    if (cfg?.enabled === false) return;

    const card = el("section", { class: "card mb-6", id: `reporting-${id}` }, [
      el("h2", { class: "h2 mb-2", "data-i18n": titleKey }, ""),
      el("p",  { class: "muted mb-4", "data-i18n": descKey  }, ""),
      el("div", { class: "text-sm text-gray-300", "data-i18n": placeholderKey }, "Content will appear here.")
    ]);

    page.appendChild(card);
  };

  // 1) Financial overview
  mountBlock("funds",
    "reporting.blocks.funds.title",
    "reporting.blocks.funds.desc",
    "reporting.placeholder");

  // 2) Fundraising campaigns history
  mountBlock("campaigns",
    "reporting.blocks.campaigns.title",
    "reporting.blocks.campaigns.desc",
    "reporting.placeholder");

  // 3) Accountability feed (Telegram)
  mountBlock("updates",
    "reporting.blocks.updates.title",
    "reporting.blocks.updates.desc",
    "reporting.placeholder");

  // 4) Documents & proofs
  mountBlock("documents",
    "reporting.blocks.documents.title",
    "reporting.blocks.documents.desc",
    "reporting.placeholder");

  rootEl.replaceChildren(page);
}

export function destroy() {
  rootEl = null;
}
