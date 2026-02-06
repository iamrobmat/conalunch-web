(() => {
  const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  const DAY_LABELS = {
    monday: "Poniedzialek",
    tuesday: "Wtorek",
    wednesday: "Sroda",
    thursday: "Czwartek",
    friday: "Piatek",
  };
  const DAY_SHORT = {
    monday: "Pon",
    tuesday: "Wt",
    wednesday: "Sr",
    thursday: "Czw",
    friday: "Pt",
  };
  const CITY_FALLBACK_CENTER = {
    Bialystok: [53.1325, 23.1688],
    "Białystok": [53.1325, 23.1688],
    Wroclaw: [51.1079, 17.0385],
    "Wrocław": [51.1079, 17.0385],
  };

  const STORAGE_KEYS = {
    city: "conalunch_city",
    day: "conalunch_day",
    pane: "conalunch_mobile_pane",
  };

  // SVG icons (Feather-style, 16×16)
  const ICONS = {
    phone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>',
    facebook: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>',
    mapPin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    navigate: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    navigation: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
  };

  const CITY_COATS = {
    "Białystok": "./assets/POL_Białystok_COA.svg.png",
    "Bialystok": "./assets/POL_Białystok_COA.svg.png",
    "Wrocław": "./assets/Herb_wroclaw.svg.png",
    "Wroclaw": "./assets/Herb_wroclaw.svg.png",
  };

  const state = {
    dataset: null,
    city: null,
    dayKey: null,
    map: null,
    markerLayer: null,
    markers: new Map(),
    mobilePane: "list",
    boundsKey: null,
  };

  const ui = {
    metaInfo: document.getElementById("metaInfo"),
    cityDropdown: document.getElementById("cityDropdown"),
    cityDropdownBtn: document.getElementById("cityDropdownBtn"),
    cityDropdownMenu: document.getElementById("cityDropdownMenu"),
    cityIcon: document.getElementById("cityIcon"),
    cityLabel: document.getElementById("cityLabel"),
    dayChips: document.getElementById("dayChips"),
    prevDay: document.getElementById("prevDay"),
    nextDay: document.getElementById("nextDay"),
    cards: document.getElementById("cards"),
    weekendNote: document.getElementById("weekendNote"),
    mobilePanes: document.getElementById("mobilePanes"),
    listPane: document.getElementById("listPane"),
    mapPane: document.getElementById("mapPane"),
    emptyStateTpl: document.getElementById("emptyStateTpl"),
  };

  init().catch((error) => {
    ui.metaInfo.textContent = "Blad ladowania";
    ui.cards.innerHTML = `<article class="empty-state"><h2>Nie mozna zaladowac danych</h2><p>${escapeHtml(String(error))}</p></article>`;
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
    state.city = savedCity && cities.includes(savedCity) ? savedCity : cities[0] || null;

    const savedDay = localStorage.getItem(STORAGE_KEYS.day);
    state.dayKey = savedDay && DAY_KEYS.includes(savedDay) ? savedDay : dayFromCurrentDate();

    const savedPane = localStorage.getItem(STORAGE_KEYS.pane);
    if (savedPane && ["list", "map"].includes(savedPane)) {
      state.mobilePane = savedPane;
    }

    renderCityDropdown(cities);
    setMobilePane(state.mobilePane);
  }

  function renderCityDropdown(cities) {
    // Update button with current city
    if (state.city) {
      const coatSrc = CITY_COATS[state.city] || "";
      ui.cityIcon.src = coatSrc;
      ui.cityIcon.alt = state.city;
      ui.cityLabel.textContent = state.city;
    }

    // Render dropdown menu items
    ui.cityDropdownMenu.innerHTML = cities
      .map((city) => {
        const coatSrc = CITY_COATS[city] || "";
        const selected = city === state.city ? "is-selected" : "";
        return `<button type="button" class="city-dropdown-item ${selected}" data-city="${escapeAttr(city)}">
          <img class="city-icon" src="${escapeAttr(coatSrc)}" alt="${escapeAttr(city)}">
          ${escapeHtml(city)}
        </button>`;
      })
      .join("");
  }

  function bindEvents() {
    // City dropdown
    ui.cityDropdownBtn.addEventListener("click", () => {
      const isOpen = ui.cityDropdown.classList.toggle("is-open");
      ui.cityDropdownMenu.hidden = !isOpen;
    });

    ui.cityDropdownMenu.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const item = target.closest("[data-city]");
      if (!(item instanceof HTMLElement)) return;
      const city = item.dataset.city;
      if (!city) return;
      
      state.city = city;
      persistState();
      
      // Update UI
      const cities = [...(state.dataset.cities || [])];
      renderCityDropdown(cities);
      
      // Close dropdown
      ui.cityDropdown.classList.remove("is-open");
      ui.cityDropdownMenu.hidden = true;
      
      render();
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (event) => {
      if (!ui.cityDropdown.contains(event.target)) {
        ui.cityDropdown.classList.remove("is-open");
        ui.cityDropdownMenu.hidden = true;
      }
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
      const chip = target.closest("[data-day]");
      if (!(chip instanceof HTMLElement)) return;
      const key = chip.dataset.day;
      if (!key || !DAY_KEYS.includes(key)) return;
      state.dayKey = key;
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

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
    }).addTo(state.map);

    state.markerLayer = L.layerGroup().addTo(state.map);
  }

  // ——— Rendering ———

  function render() {
    renderDayChips();
    renderMeta();
    renderWeekendNote();

    const cityRestaurants = getCityRestaurants();
    const sorted = sortRestaurants(cityRestaurants);

    renderCards(sorted);
    renderMap(sorted);
  }

  function renderMeta() {
    const meta = state.dataset.meta || {};
    const dayLabel = DAY_LABELS[state.dayKey] || state.dayKey;
    ui.metaInfo.textContent = `${dayLabel} · tydzien ${meta.week || "?"}/${meta.year || "?"}`;
  }

  function renderWeekendNote() {
    const isWeekend = [0, 6].includes(new Date().getDay());
    ui.weekendNote.hidden = !(isWeekend && state.dayKey === "friday");
  }

  function renderDayChips() {
    ui.dayChips.innerHTML = DAY_KEYS.map((key) => {
      const active = key === state.dayKey ? "is-active" : "";
      return `<button type="button" class="chip ${active}" data-day="${key}">${DAY_SHORT[key]}</button>`;
    }).join("");

    const idx = DAY_KEYS.indexOf(state.dayKey);
    ui.prevDay.disabled = idx <= 0;
    ui.nextDay.disabled = idx >= DAY_KEYS.length - 1;
  }

  function setMobilePane(pane) {
    state.mobilePane = pane;
    ui.listPane.classList.toggle("is-visible", pane === "list");
    ui.mapPane.classList.toggle("is-visible", pane === "map");
    for (const btn of ui.mobilePanes.querySelectorAll("button")) {
      btn.classList.toggle("is-active", btn.dataset.pane === pane);
    }
  }

  // ——— Cards with grouping ———

  function renderCards(restaurants) {
    if (!restaurants.length) {
      ui.cards.innerHTML = "";
      ui.cards.appendChild(ui.emptyStateTpl.content.cloneNode(true));
      return;
    }

    // Split into groups
    const withLunch = restaurants.filter((r) => getDayMenu(r).hasMenu);
    const withWeekLunch = restaurants.filter(
      (r) => !getDayMenu(r).hasMenu && Boolean(r.status && r.status.hasAnyLunch)
    );
    const noLunch = restaurants.filter(
      (r) => !getDayMenu(r).hasMenu && !(r.status && r.status.hasAnyLunch)
    );

    let html = "";
    let animIdx = 0;

    if (withLunch.length) {
      html += groupHeader("Lunch dnia", withLunch.length);
      for (const r of withLunch) {
        html += buildCardHtml(r, animIdx++);
      }
    }

    if (withWeekLunch.length) {
      html += groupHeader("Lunch tygodnia", withWeekLunch.length);
      for (const r of withWeekLunch) {
        html += buildCardHtml(r, animIdx++);
      }
    }

    if (noLunch.length) {
      html += groupHeader("Pozostale", noLunch.length);
      for (const r of noLunch) {
        html += buildCardHtml(r, animIdx++);
      }
    }

    ui.cards.innerHTML = html;
  }

  function groupHeader(label, count) {
    return `<div class="card-group-header">${escapeHtml(label)} <span class="card-group-count">${count}</span></div>`;
  }

  function buildCardHtml(restaurant, index) {
    const menu = getDayMenu(restaurant);
    const hasAnyLunch = Boolean(restaurant.status && restaurant.status.hasAnyLunch);

    // Card modifier
    const cardClass = menu.hasMenu ? "" : "card--muted";

    // Single badge with tooltip
    let badgeHtml = "";
    if (menu.hasMenu) {
      badgeHtml = `<span class="badge badge-today" title="Codziennie inna oferta lunchowa — menu na wybrany dzien">Lunch dnia</span>`;
    } else if (hasAnyLunch) {
      badgeHtml = `<span class="badge badge-week" title="Stala oferta lunchowa na caly tydzien — sprawdz inne dni">Lunch tygodnia</span>`;
    }

    // Price (prominent, top-right)
    const priceHtml = menu.hasMenu && menu.price != null
      ? `<span class="card-price">${formatPrice(menu.price)}</span>`
      : "";

    // Menu content
    let menuHtml = "";
    if (menu.hasMenu) {
      const dishCount = menu.lunch.length;
      const labelHtml = dishCount > 1 ? `<p class="menu-label">Do wyboru:</p>` : "";
      const dishesHtml = menu.lunch.map((dish) => `<p class="menu-dish">${escapeHtml(dish)}</p>`).join("");
      const includedHtml = menu.soup
        ? `<div class="menu-included"><p class="menu-included-label">W zestawie:</p><p class="menu-included-value">${escapeHtml(menu.soup)}</p></div>`
        : "";

      menuHtml = `
        <div class="menu-block">
          ${labelHtml}
          <div class="menu-dishes">${dishesHtml}</div>
          ${includedHtml}
        </div>
      `;
    } else if (hasAnyLunch) {
      menuHtml = `<p class="no-menu">Brak oferty na wybrany dzien — sprawdz inny dzien tygodnia.</p>`;
    } else {
      menuHtml = `<p class="no-menu">Brak aktualnego lunchu w tym tygodniu.</p>`;
    }

    // Actions
    const phoneBtn = restaurant.phone
      ? `<a class="btn-primary" href="tel:${sanitizePhone(restaurant.phone)}">${ICONS.phone} Zadzwon</a>`
      : `<button class="btn-primary" type="button" disabled>${ICONS.phone} Brak tel.</button>`;

    const fbBtn = restaurant.facebookUrl
      ? `<a class="btn-icon" href="${escapeAttr(restaurant.facebookUrl)}" target="_blank" rel="noopener noreferrer" title="Facebook">${ICONS.facebook}<span class="btn-icon-tooltip">Facebook</span></a>`
      : "";

    const mapBtn = `<button class="btn-icon" type="button" data-focus-id="${escapeAttr(restaurant.id)}" title="Pokaz na mapie">${ICONS.mapPin}<span class="btn-icon-tooltip">Na mapie</span></button>`;

    const navLink = buildNavigationLink(restaurant);

    return `
      <article class="card ${cardClass}" style="animation-delay:${Math.min(index * 35, 400)}ms">
        <div class="card-head">
          <div>
            <h3>${escapeHtml(restaurant.name)}</h3>
            <p class="card-meta">${escapeHtml(restaurant.address || "Brak adresu")} · ${escapeHtml(restaurant.city || "")}</p>
          </div>
          <div class="card-head-right">
            ${priceHtml}
            ${badgeHtml}
          </div>
        </div>

        ${menuHtml}

        <div class="card-actions">
          ${phoneBtn}
          ${fbBtn}
          ${mapBtn}
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
    return `<a class="btn-icon" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" title="Nawiguj">${ICONS.navigation}<span class="btn-icon-tooltip">Nawiguj</span></a>`;
  }

  // ——— Map ———

  function renderMap(restaurants) {
    if (!state.map || !state.markerLayer) return;

    state.markerLayer.clearLayers();
    state.markers.clear();

    const bounds = [];

    for (const restaurant of restaurants) {
      if (!Number.isFinite(restaurant.lat) || !Number.isFinite(restaurant.lng)) continue;

      const menu = getDayMenu(restaurant);
      const hasAnyLunch = Boolean(restaurant.status && restaurant.status.hasAnyLunch);
      const color = menu.hasMenu ? "#00b2ca" : hasAnyLunch ? "#d4c44e" : "#e9e3e6";

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

    const boundsKey = `${state.city}-${state.dayKey}-${bounds.length}`;
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
      : "<li style='color:#717171'>Brak lunchu na wybrany dzien</li>";

    return `
      <div style="min-width:190px;font-family:Inter,-apple-system,sans-serif">
        <strong style="font-size:14px">${escapeHtml(restaurant.name)}</strong><br/>
        <small style="color:#717171">${escapeHtml(restaurant.address || "")} · ${escapeHtml(restaurant.city || "")}</small>
        <ul style="margin:8px 0 4px 16px;padding:0;font-size:13px">${lines}</ul>
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

  // ——— Data helpers ———

  function getCityRestaurants() {
    return (state.dataset.restaurants || []).filter((r) => r.city === state.city);
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
    if (day >= 1 && day <= 5) return DAY_KEYS[day - 1];
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
    if (state.mobilePane) localStorage.setItem(STORAGE_KEYS.pane, state.mobilePane);
  }

  function sanitizePhone(raw) {
    return String(raw).replace(/[^+\d]/g, "");
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
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
