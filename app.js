(() => {
  const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const DAY_LABELS = {
    monday: "Pon",
    tuesday: "Wt",
    wednesday: "Sr",
    thursday: "Czw",
    friday: "Pt",
  };
  const CITY_FALLBACK_CENTER = {
    "Bialystok": [53.1325, 23.1688],
    "Białystok": [53.1325, 23.1688],
    "Wroclaw": [51.1079, 17.0385],
    "Wrocław": [51.1079, 17.0385],
  };

  const STORAGE_KEYS = {
    city: "conalunch_city",
    day: "conalunch_day",
    scope: "conalunch_scope",
    pane: "conalunch_mobile_pane",
  };

  const state = {
    dataset: null,
    city: null,
    dayKey: null,
    scope: "all",
    map: null,
    markerLayer: null,
    markers: new Map(),
    mobilePane: "list",
    boundsKey: null,
  };

  const ui = {
    metaInfo: document.getElementById("metaInfo"),
    citySelect: document.getElementById("citySelect"),
    dayChips: document.getElementById("dayChips"),
    prevDay: document.getElementById("prevDay"),
    nextDay: document.getElementById("nextDay"),
    scopeSwitch: document.getElementById("scopeSwitch"),
    kpiBar: document.getElementById("kpiBar"),
    cards: document.getElementById("cards"),
    weekendNote: document.getElementById("weekendNote"),
    mobilePanes: document.getElementById("mobilePanes"),
    listPane: document.getElementById("listPane"),
    mapPane: document.getElementById("mapPane"),
    emptyStateTpl: document.getElementById("emptyStateTpl"),
  };

  init().catch((error) => {
    ui.metaInfo.textContent = "Blad ladowania danych";
    ui.cards.innerHTML = `<article class="empty-state"><h2>Nie mozna zaladowac serwisu</h2><p>${escapeHtml(String(error))}</p></article>`;
  });

  async function init() {
    registerServiceWorker();

    const res = await fetch("./data/weekly_menu.json", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} - ${res.statusText}`);
    }
    state.dataset = await res.json();

    prepareInitialState();
    renderDayChips();
    bindEvents();
    initMap();
    render();
  }

  function prepareInitialState() {
    const cities = [...(state.dataset.cities || [])];
    const savedCity = localStorage.getItem(STORAGE_KEYS.city);
    state.city = savedCity && cities.includes(savedCity) ? savedCity : (cities[0] || null);

    const savedDay = localStorage.getItem(STORAGE_KEYS.day);
    const initialDay = savedDay && DAY_KEYS.includes(savedDay) ? savedDay : dayFromCurrentDate();
    state.dayKey = initialDay;

    const savedScope = localStorage.getItem(STORAGE_KEYS.scope);
    if (savedScope && ["all", "today", "week"].includes(savedScope)) {
      state.scope = savedScope;
    }

    const savedPane = localStorage.getItem(STORAGE_KEYS.pane);
    if (savedPane && ["list", "map"].includes(savedPane)) {
      state.mobilePane = savedPane;
    }

    ui.citySelect.innerHTML = cities
      .map((city) => `<option value="${escapeHtml(city)}">${escapeHtml(city)}</option>`)
      .join("");

    if (state.city) ui.citySelect.value = state.city;
    setActiveScopeButton();
    setMobilePane(state.mobilePane);
  }

  function bindEvents() {
    ui.citySelect.addEventListener("change", () => {
      state.city = ui.citySelect.value;
      persistState();
      render();
    });

    ui.prevDay.addEventListener("click", () => {
      const idx = DAY_KEYS.indexOf(state.dayKey);
      state.dayKey = DAY_KEYS[Math.max(0, idx - 1)];
      persistState();
      render();
    });

    ui.nextDay.addEventListener("click", () => {
      const idx = DAY_KEYS.indexOf(state.dayKey);
      state.dayKey = DAY_KEYS[Math.min(DAY_KEYS.length - 1, idx + 1)];
      persistState();
      render();
    });

    ui.dayChips.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const key = target.dataset.day;
      if (!key || !DAY_KEYS.includes(key)) return;
      state.dayKey = key;
      persistState();
      render();
    });

    ui.scopeSwitch.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const scope = target.dataset.scope;
      if (!scope || !["all", "today", "week"].includes(scope)) return;
      state.scope = scope;
      setActiveScopeButton();
      persistState();
      render();
    });

    ui.cards.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest("[data-focus-id]");
      if (!(btn instanceof HTMLElement)) return;
      focusRestaurant(btn.dataset.focusId || "");
    });

    ui.mobilePanes.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const pane = target.dataset.pane;
      if (!pane || !["list", "map"].includes(pane)) return;
      setMobilePane(pane);
      persistState();
    });
  }

  function initMap() {
    state.map = L.map("map", {
      zoomControl: true,
      attributionControl: true,
    }).setView([52.0, 19.0], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(state.map);

    state.markerLayer = L.layerGroup().addTo(state.map);
  }

  function render() {
    renderDayChips();
    setActiveScopeButton();
    renderMeta();
    renderWeekendNote();

    const cityRestaurants = getCityRestaurants();
    const visibleRestaurants = applyScope(sortRestaurants(cityRestaurants));

    renderKpis(cityRestaurants, visibleRestaurants);
    renderCards(visibleRestaurants);
    renderMap(visibleRestaurants);
  }

  function renderMeta() {
    const meta = state.dataset.meta || {};
    const label = DAY_LABELS[state.dayKey] || state.dayKey;
    ui.metaInfo.textContent = `Miasto: ${state.city || "-"} | Dzien: ${label} | Tydzien ${meta.week || "-"}/${meta.year || "-"}`;
  }

  function renderWeekendNote() {
    const isWeekend = [0, 6].includes(new Date().getDay());
    ui.weekendNote.hidden = !(isWeekend && state.dayKey === "friday");
  }

  function renderDayChips() {
    ui.dayChips.innerHTML = DAY_KEYS.map((key) => {
      const active = key === state.dayKey ? "is-active" : "";
      return `<button type="button" class="chip ${active}" data-day="${key}">${DAY_LABELS[key]}</button>`;
    }).join("");

    const idx = DAY_KEYS.indexOf(state.dayKey);
    ui.prevDay.disabled = idx <= 0;
    ui.nextDay.disabled = idx >= DAY_KEYS.length - 1;
  }

  function setActiveScopeButton() {
    for (const btn of ui.scopeSwitch.querySelectorAll("button")) {
      btn.classList.toggle("is-active", btn.dataset.scope === state.scope);
    }
  }

  function setMobilePane(pane) {
    state.mobilePane = pane;
    ui.listPane.classList.toggle("is-visible", pane === "list");
    ui.mapPane.classList.toggle("is-visible", pane === "map");
    for (const btn of ui.mobilePanes.querySelectorAll("button")) {
      btn.classList.toggle("is-active", btn.dataset.pane === pane);
    }
  }

  function renderKpis(cityRestaurants, visibleRestaurants) {
    const todayCount = cityRestaurants.filter((r) => getDayMenu(r).hasMenu).length;
    const weekCount = cityRestaurants.filter((r) => Boolean(r.status && r.status.hasAnyLunch)).length;
    const withoutWeek = cityRestaurants.length - weekCount;
    const dishesVisible = visibleRestaurants.reduce((sum, r) => sum + getDayMenu(r).lunch.length, 0);

    ui.kpiBar.innerHTML = [
      kpiHtml("Restauracje", cityRestaurants.length),
      kpiHtml("Z menu dnia", todayCount),
      kpiHtml("Bez lunchu tyg.", withoutWeek),
      kpiHtml("Dania (widok)", dishesVisible),
    ].join("");
  }

  function kpiHtml(label, value) {
    return `<article class="kpi"><span>${label}</span><strong>${value}</strong></article>`;
  }

  function renderCards(restaurants) {
    if (!restaurants.length) {
      ui.cards.innerHTML = "";
      ui.cards.appendChild(ui.emptyStateTpl.content.cloneNode(true));
      return;
    }

    ui.cards.innerHTML = restaurants
      .map((restaurant, index) => buildCardHtml(restaurant, index))
      .join("");
  }

  function buildCardHtml(restaurant, index) {
    const menu = getDayMenu(restaurant);
    const hasAnyLunch = Boolean(restaurant.status && restaurant.status.hasAnyLunch);
    const isMuted = menu.hasMenu ? "" : "card--muted";
    const isSleep = hasAnyLunch ? "" : "card--sleep";

    const badgeMenu = menu.hasMenu
      ? `<span class="badge badge-ok">Ma lunch dnia</span>`
      : `<span class="badge badge-flat">Brak lunchu dnia</span>`;

    const badgeWeek = hasAnyLunch
      ? `<span class="badge badge-warn">Ma lunch tyg.</span>`
      : `<span class="badge badge-flat">Brak lunchu tyg.</span>`;

    const menuHtml = menu.hasMenu
      ? `
        <div class="menu-block">
          <ul>${menu.lunch.map((dish) => `<li>${escapeHtml(dish)}</li>`).join("")}</ul>
          <div class="menu-extra">
            ${menu.soup ? `<span>Zupa: ${escapeHtml(menu.soup)}</span>` : ""}
            ${menu.price != null ? `<span>Cena: ${formatPrice(menu.price)}</span>` : ""}
          </div>
        </div>
      `
      : `<p class="no-menu">${hasAnyLunch ? "Brak oferty na wybrany dzien." : "Sledzimy restauracje, ale aktualnie nie ma lunchu w tygodniu."}</p>`;

    const phoneButton = restaurant.phone
      ? `<a class="btn btn-call" href="tel:${sanitizePhone(restaurant.phone)}">Zadzwon</a>`
      : `<button class="btn btn-link" type="button" disabled>Brak telefonu</button>`;

    const fbButton = restaurant.facebookUrl
      ? `<a class="btn btn-link" href="${escapeAttr(restaurant.facebookUrl)}" target="_blank" rel="noopener noreferrer">Facebook</a>`
      : `<button class="btn btn-link" type="button" disabled>Brak linku</button>`;

    const navLink = buildNavigationLink(restaurant);

    return `
      <article class="card ${isMuted} ${isSleep}" style="animation-delay:${Math.min(index * 40, 360)}ms">
        <div class="card-head">
          <div>
            <h3>${escapeHtml(restaurant.name)}</h3>
            <p class="card-meta">${escapeHtml(restaurant.address || "Brak adresu")} • ${escapeHtml(restaurant.city || "")}</p>
          </div>
          <div class="badges">${badgeMenu}${badgeWeek}</div>
        </div>

        ${menuHtml}

        <div class="card-actions">
          ${phoneButton}
          ${fbButton}
          <button class="btn btn-map" type="button" data-focus-id="${escapeAttr(restaurant.id)}">Pokaz na mapie</button>
          ${navLink}
        </div>
      </article>
    `;
  }

  function buildNavigationLink(restaurant) {
    const hasCoords = Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lng);
    const query = hasCoords
      ? `${restaurant.lat},${restaurant.lng}`
      : [restaurant.name, restaurant.address, restaurant.city].filter(Boolean).join(", ");
    if (!query) return "";
    const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    return `<a class="btn btn-link" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">Nawiguj</a>`;
  }

  function renderMap(restaurants) {
    if (!state.map || !state.markerLayer) return;

    state.markerLayer.clearLayers();
    state.markers.clear();

    const bounds = [];

    for (const restaurant of restaurants) {
      if (!Number.isFinite(restaurant.lat) || !Number.isFinite(restaurant.lng)) continue;

      const menu = getDayMenu(restaurant);
      const hasAnyLunch = Boolean(restaurant.status && restaurant.status.hasAnyLunch);
      const color = menu.hasMenu ? "#2f9e44" : hasAnyLunch ? "#c17a0f" : "#7b8480";

      const marker = L.circleMarker([restaurant.lat, restaurant.lng], {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.88,
        weight: 2,
      }).addTo(state.markerLayer);

      marker.bindPopup(buildPopupHtml(restaurant, menu));
      state.markers.set(restaurant.id, marker);
      bounds.push([restaurant.lat, restaurant.lng]);
    }

    const boundsKey = `${state.city}-${state.dayKey}-${state.scope}-${bounds.length}`;
    if (bounds.length && boundsKey !== state.boundsKey) {
      state.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      state.boundsKey = boundsKey;
      return;
    }

    if (!bounds.length && boundsKey !== state.boundsKey) {
      const fallback = CITY_FALLBACK_CENTER[state.city] || [52.0, 19.0];
      state.map.setView(fallback, 12);
      state.boundsKey = boundsKey;
    }
  }

  function buildPopupHtml(restaurant, menu) {
    const lines = menu.hasMenu
      ? menu.lunch.map((dish) => `<li>${escapeHtml(dish)}</li>`).join("")
      : "<li>Brak lunchu na wybrany dzien</li>";

    return `
      <div style="min-width:190px">
        <strong>${escapeHtml(restaurant.name)}</strong><br />
        <small>${escapeHtml(restaurant.city || "")}</small>
        <ul style="margin:8px 0 6px 16px;padding:0">${lines}</ul>
      </div>
    `;
  }

  function focusRestaurant(restaurantId) {
    const marker = state.markers.get(restaurantId);
    if (!marker || !state.map) return;

    const latLng = marker.getLatLng();
    state.map.setView(latLng, Math.max(state.map.getZoom(), 14), { animate: true });
    marker.openPopup();

    if (window.matchMedia("(max-width: 980px)").matches) {
      setMobilePane("map");
      persistState();
    }
  }

  function getCityRestaurants() {
    return (state.dataset.restaurants || []).filter((restaurant) => restaurant.city === state.city);
  }

  function applyScope(restaurants) {
    if (state.scope === "today") {
      return restaurants.filter((restaurant) => getDayMenu(restaurant).hasMenu);
    }
    if (state.scope === "week") {
      return restaurants.filter((restaurant) => Boolean(restaurant.status && restaurant.status.hasAnyLunch));
    }
    return restaurants;
  }

  function sortRestaurants(restaurants) {
    return [...restaurants].sort((a, b) => {
      const dayA = getDayMenu(a).hasMenu ? 1 : 0;
      const dayB = getDayMenu(b).hasMenu ? 1 : 0;
      if (dayA !== dayB) return dayB - dayA;

      const weekA = a.status && a.status.hasAnyLunch ? 1 : 0;
      const weekB = b.status && b.status.hasAnyLunch ? 1 : 0;
      if (weekA !== weekB) return weekB - weekA;

      return String(a.name).localeCompare(String(b.name), "pl");
    });
  }

  function getDayMenu(restaurant) {
    const day = restaurant.menus && restaurant.menus[state.dayKey];
    return day || { lunch: [], soup: null, price: null, hasMenu: false };
  }

  function dayFromCurrentDate() {
    const day = new Date().getDay();
    if (day >= 1 && day <= 5) {
      return DAY_KEYS[day - 1];
    }
    return "friday";
  }

  function formatPrice(value) {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      maximumFractionDigits: 2,
    }).format(value);
  }

  function persistState() {
    if (state.city) localStorage.setItem(STORAGE_KEYS.city, state.city);
    if (state.dayKey) localStorage.setItem(STORAGE_KEYS.day, state.dayKey);
    if (state.scope) localStorage.setItem(STORAGE_KEYS.scope, state.scope);
    if (state.mobilePane) localStorage.setItem(STORAGE_KEYS.pane, state.mobilePane);
  }

  function sanitizePhone(raw) {
    return String(raw).replace(/[^+\d]/g, "");
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline cache is optional for this static MVP.
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
