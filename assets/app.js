/* v190825 → режим D: Story/Live, перенос «Новостей» в #story-now с реальными карточками из /.netlify/functions/news,
   заглушки для Live, минимальная i18n (RU/EN). */

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // --- i18n ---
  const i18n = {
    dict: {},
    lang: "RU",
    async load(lang) {
      const code = (lang || "").toUpperCase();
      const url = code === "EN" ? "assets/i18n/en.json" : "assets/i18n/ru.json";
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) throw new Error("i18n fetch failed");
        this.dict = await res.json();
        this.lang = code === "EN" ? "EN" : "RU";
        this.apply();
      } catch (e) {
        console.warn("i18n load error:", e);
      }
    },
    t(key) {
      return key.split(".").reduce((acc, k) => (acc && acc[k] != null ? acc[k] : null), this.dict) ?? key;
    },
    apply() {
      $$("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        const val = i18n.t(key);
        if (val && typeof val === "string") el.textContent = val;
      });
    }
  };

  // --- Router ---
  const MODES = { STORY: "story", LIVE: "live" };

  function setActiveTab(route) {
    $$(".tab-link").forEach((a) => a.classList.toggle("active", a.dataset.route === route));
  }

  function showMode(mode) {
    const story = $('#story');
    const live = $('#live');
    if (!story || !live) return;
    if (mode === MODES.LIVE) {
      story.classList.add("hidden"); live.classList.remove("hidden");
      setActiveTab(MODES.LIVE);
      localStorage.setItem("trus:lastMode", MODES.LIVE);
    } else {
      live.classList.add("hidden"); story.classList.remove("hidden");
      setActiveTab(MODES.STORY);
      localStorage.setItem("trus:lastMode", MODES.STORY);
    }
  }

  function navigateFromHash() {
    const hash = (location.hash || "#story").toLowerCase();
    if (hash.startsWith("#live")) {
      showMode(MODES.LIVE);
      const id = hash.replace("#", "");
      if (id !== "live") setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 40);
    } else {
      showMode(MODES.STORY);
      const id = hash.replace("#", "");
      if (id && id !== "story") setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 40);
    }
  }

  function applyStickyDonateText() {
    const el = $("#stickyDonate");
    if (el) el.textContent = i18n.t("nav.donate") || "Donate";
  }

  // Music placeholder
  function setupMusicBtn() {
    $("#musicBtn")?.addEventListener("click", () => {
      alert(i18n.t("hero.musicToast") || "Music preview: coming soon");
    });
  }

  // Hearts carousel
  function setupHearts() {
    const el = $("#heartsSplide");
    if (!el || !window.Splide) return;
    try {
      new Splide(el, { type: "loop", autoplay: true, interval: 4000, arrows: false, pagination: true }).mount();
    } catch (e) { console.warn("Splide init failed:", e); }
  }

  // Leaflet map
  function setupMap() {
    const mapEl = $("#map");
    if (!mapEl || !window.L) return;
    const map = L.map(mapEl).setView([51.1657, 10.4515], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(map);
    [{name:"Berlin",coords:[52.52,13.405]},{name:"Warsaw",coords:[52.2297,21.0122]},{name:"Paris",coords:[48.8566,2.3522]}]
      .forEach(p => L.circleMarker(p.coords, { radius: 6 }).addTo(map).bindPopup(`❤️ ${p.name}`));
  }

  // Donate UI (placeholder)
  function setupDonate() {
    const presets = $$("#donate-presets .pill");
    const recurring = $("#donate-recurring");
    const btn = $("#donateNowBtn");
    let selected = null;
    presets.forEach(p => p.addEventListener("click", () => {
      presets.forEach(x => x.classList.remove("pill--active"));
      p.classList.add("pill--active");
      selected = Number(p.dataset.amount || 0);
    }));
    btn?.addEventListener("click", () => {
      const isRec = !!recurring?.checked;
      const amount = selected || 25;
      alert(`${i18n.t("donate.alertPrefix") || "Donation"}: ${amount}€ ${isRec ? "(monthly)" : ""}`);
    });
  }

  // AMA (localStorage placeholder)
  function setupAMA() {
    const form = $("#amaForm"), feed = $("#amaFeed");
    if (!form || !feed) return;
    const KEY = "trus:ama";
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    const render = () => {
      feed.innerHTML = "";
      list.slice().reverse().forEach(item => {
        const el = document.createElement("article");
        el.className = "card";
        el.innerHTML = `<div class="card-head"><time>${item.date}</time><span class="badge">Q</span></div>
                        <p class="opacity-90"><strong>${item.name || "Anon"}:</strong> ${item.question}</p>`;
        feed.appendChild(el);
      });
    };
    render();
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = (fd.get("name") || "").toString().trim();
      const question = (fd.get("question") || "").toString().trim();
      if (!question) return;
      const now = new Date();
      list.push({ name, question, date: now.toISOString().slice(0,10) });
      localStorage.setItem(KEY, JSON.stringify(list));
      form.reset(); render();
    });
  }

  // === Перенос «Новостей» в STORY: подгружаем реальные карточки ===
  async function renderStoryNow() {
    const box = $("#storyNowFeed");
    if (!box) return;
    try {
      box.innerHTML = `<div class="text-sm text-gray-300">${i18n.t("feed.loading") || "Loading…"}</div>`;
      // используем ваш уже существующий news-эндпоинт
      const res = await fetch('/.netlify/functions/news?limit=30', { cache: 'no-store' });
      if (!res.ok) throw new Error('news API ' + res.status);
      const arr = await res.json();
      if (!Array.isArray(arr) || !arr.length) {
        box.innerHTML = `<div class="text-sm text-gray-300">${i18n.t("feed.empty") || "No posts yet."}</div>`;
        return;
      }
      box.innerHTML = arr.map(p => {
        const dt = p.date ? new Date(p.date) : null;
        const time = dt ? dt.toLocaleString() : '';
        const link = p.link ? `<a href="${p.link}" target="_blank" rel="noreferrer" class="text-sky-400 hover:underline">source</a>` : '';
        const title = p.title ? `<h4>${p.title}</h4>` : '';
        const text = p.text ? `<p>${p.text}</p>` : '';
        return `<article class="card">
                  <div class="card-head"><time>${time}</time><span class="badge">update</span></div>
                  ${title}
                  ${text}
                  <div class="mt-2 flex items-center gap-3">
                    <a href="#story-donate" class="text-indigo-400 hover:underline">${i18n.t("cta.donateInline") || "Donate"}</a>
                    ${link}
                  </div>
                </article>`;
      }).join("");
    } catch (e) {
      console.warn("story-now feed error:", e);
      box.innerHTML = `<div class="text-sm text-rose-300">Feed error</div>`;
    }
  }

  // --- Заглушки-загрузчики на будущее (пока ничего не делают) ---
  async function loadLiveUpdates() { return true; }
  async function loadReports() { return true; }
  async function loadNicoThoughts() { return true; }

  // --- Init ---
  async function init() {
    // Язык
    const urlLang = new URLSearchParams(location.search).get("lang");
    const savedLang = localStorage.getItem("trus:lang");
    const lang = (urlLang || savedLang || "RU").toUpperCase();
    await i18n.load(lang);
    localStorage.setItem("trus:lang", i18n.lang);
    applyStickyDonateText();

    // Маршрутизация
    const lastMode = localStorage.getItem("trus:lastMode");
    if (!location.hash && lastMode) location.hash = `#${lastMode}`;
    navigateFromHash();
    window.addEventListener("hashchange", navigateFromHash);

    // UI
    setupMusicBtn();
    setupHearts();
    setupMap();
    setupDonate();
    setupAMA();

    // Реальные карточки «История продолжается сейчас»
    await renderStoryNow();

    // Заглушки Live
    await Promise.all([loadLiveUpdates(), loadReports(), loadNicoThoughts()]);

    // Подсветка активных табов и языка
    setActiveTab((location.hash || "#story").replace("#","") || "story");
    $$(".lang-link").forEach(a => a.classList.toggle("active", a.dataset.lang?.toUpperCase() === i18n.lang));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
