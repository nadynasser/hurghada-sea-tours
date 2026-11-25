/**
 * Hurghada Sea Tours - Client Interactions & Language Switcher
 * Integrates with window.HSTWhatsAppRouter
 */

/**
 * Safely forwards client interaction telemetry to Google Analytics (gtag).
 */
function trackAnalyticsEvent(eventName, params = {}) {
  if (typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', eventName, params);
  } catch (_) {}
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Drawer Toggle (auto-creates drawer & button if missing on subpages)
  const siteHeader = document.querySelector('.site-header');
  const headerActions = document.querySelector('.header-actions');
  let menuToggle = document.getElementById('menuToggle');
  let mobileDrawer = document.getElementById('mobileDrawer');

  if (!menuToggle && headerActions && document.querySelector('.main-nav .nav-list')) {
    menuToggle = document.createElement('button');
    menuToggle.className = 'menu-toggle';
    menuToggle.id = 'menuToggle';
    menuToggle.type = 'button';
    menuToggle.setAttribute('aria-label', 'Toggle Navigation Menu');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.textContent = '☰';
    headerActions.appendChild(menuToggle);
  }

  if (siteHeader && menuToggle && !mobileDrawer) {
    mobileDrawer = document.createElement('nav');
    mobileDrawer.id = 'mobileDrawer';
    mobileDrawer.className = 'mobile-drawer';
    mobileDrawer.setAttribute('aria-label', 'Mobile Navigation');

    const navList = document.querySelector('.main-nav .nav-list');
    if (navList) {
      const linksUl = document.createElement('ul');
      linksUl.className = 'mobile-drawer-links';
      linksUl.innerHTML = navList.innerHTML;
      mobileDrawer.appendChild(linksUl);
    }

    const topLangSwitch = document.querySelector('.top-bar .lang-switch');
    if (topLangSwitch) {
      const langRow = document.createElement('div');
      langRow.className = 'mobile-drawer-langs';
      const label = document.createElement('span');
      label.style.fontSize = '0.82rem';
      label.style.fontWeight = '700';
      label.style.color = 'var(--text-muted)';
      const htmlLang = (document.documentElement.lang || 'en').substring(0, 2);
      const langLabels = { ar: 'اللغة:', de: 'Sprache:', ru: 'Язык:', pl: 'Język:', en: 'Language:' };
      label.textContent = langLabels[htmlLang] || 'Language:';
      const clonedLang = topLangSwitch.cloneNode(true);
      langRow.appendChild(label);
      langRow.appendChild(clonedLang);
      mobileDrawer.appendChild(langRow);
    }

    siteHeader.appendChild(mobileDrawer);
  }

  if (menuToggle && mobileDrawer) {
    const closeDrawer = () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.textContent = '☰';
      mobileDrawer.classList.remove('is-open');
    };

    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!isExpanded));
      menuToggle.textContent = isExpanded ? '☰' : '✕';
      mobileDrawer.classList.toggle('is-open');
    });

    mobileDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeDrawer);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });
  }

  // 2. Category Filter Pills for Tours
  const filterPills = document.querySelectorAll('.pill-btn');
  const tourCards = document.querySelectorAll('.tour-card');

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const filterValue = pill.getAttribute('data-filter');
      trackAnalyticsEvent('tour_filter', {
        filter_category: filterValue || 'all',
        page_language: document.documentElement.lang || 'en'
      });

      tourCards.forEach(card => {
        const cardCategory = card.getAttribute('data-category');
        if (filterValue === 'all' || cardCategory === filterValue) {
          card.style.display = 'flex';
          card.style.animation = 'fadeIn 0.3s ease forwards';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // 3. Language Switch Event Notification to WhatsApp Router (Rule 6)
  document.querySelectorAll('.lang-switch a').forEach(link => {
    link.addEventListener('click', (e) => {
      const lang = link.getAttribute('data-lang') || link.innerText.toLowerCase().trim();
      if (['en', 'de', 'ru', 'pl', 'ar'].includes(lang)) {
        trackAnalyticsEvent('language_switch', {
          target_language: lang,
          source_language: document.documentElement.lang || 'en',
          transport_type: 'beacon'
        });
      }
      if (window.HSTWhatsAppRouter && ['en', 'de', 'ru', 'pl', 'ar'].includes(lang)) {
        window.HSTWhatsAppRouter.setLanguage(lang);
      }
    });
  });

  // 4. Header Shadow on Scroll
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // 5. Ensure WhatsApp routing triggers on all elements
  if (window.HSTWhatsAppRouter) {
    window.HSTWhatsAppRouter.bindAllElements();
  }
});

/**
 * Interactive Location & GPS Map Picker for Bookings
 * Supports auto GPS, interactive draggable map, and one-click Hurghada area chips.
 * Works seamlessly across Mobile, Tablets, Laptops & Desktop PCs.
 */
(function() {
  let leafletLoaded = false;
  let activeMap = null;
  let activeMarker = null;
  let selectedCoords = { lat: 27.1850, lng: 33.8250, label: 'Hurghada / الممشى السياحي' };

  const AREAS = [
    { nameAr: 'الممشى السياحي', nameEn: 'El Mamsha', lat: 27.1850, lng: 33.8250 },
    { nameAr: 'طريق القرى والريزورتس', nameEn: 'Village Road Resorts', lat: 27.1150, lng: 33.8320 },
    { nameAr: 'سهل حشيش', nameEn: 'Sahl Hasheesh', lat: 27.0500, lng: 33.8900 },
    { nameAr: 'مكادي باي', nameEn: 'Makadi Bay', lat: 26.9850, lng: 33.9000 },
    { nameAr: 'الجونة', nameEn: 'El Gouna', lat: 27.3950, lng: 33.6800 },
    { nameAr: 'الدهار ووسط البلد', nameEn: 'El Dahar (Downtown)', lat: 27.2450, lng: 33.8150 },
    { nameAr: 'الأحياء وهاواي', nameEn: 'Al Ahyaa', lat: 27.3100, lng: 33.7400 },
    { nameAr: 'سوما باي وسفاجا', nameEn: 'Soma Bay & Safaga', lat: 26.8500, lng: 33.9900 }
  ];

  function ensureLeaflet(callback) {
    if (window.L && window.L.map) {
      callback();
      return;
    }
    if (leafletLoaded) {
      const checkInterval = setInterval(() => {
        if (window.L && window.L.map) {
          clearInterval(checkInterval);
          callback();
        }
      }, 100);
      return;
    }
    leafletLoaded = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => callback();
    document.head.appendChild(script);
  }

  window.HSTShareLocation = function(inputId, btnElement) {
    const input = document.getElementById(inputId) || document.querySelector('#bookHotel, #bookHotelAr, #bookHotelDe, #bookHotelRu, #bookHotelPl, #dHotelRu, #subHotelRu, #snHotelRu, #dHotelPl, #subHotelPl, #snHotelPl, input[name*="hotel"], input[name*="location"]');
    const isAr = document.documentElement.lang === 'ar' || window.location.pathname.includes('/ar/');
    const isDe = document.documentElement.lang === 'de' || window.location.pathname.includes('/de/');
    const isRu = document.documentElement.lang === 'ru' || window.location.pathname.includes('/ru/');
    const isPl = document.documentElement.lang === 'pl' || window.location.pathname.includes('/pl/');
    const langKey = isAr ? 'ar' : isDe ? 'de' : isRu ? 'ru' : isPl ? 'pl' : 'en';

    const I18N_LOC = {
      en: {
        title: '📍 Select Your Hotel or Pickup Location',
        chips: 'Or tap your resort area:',
        hint: '👆 Tap map or drag pin to your exact resort',
        gpsBtn: '📡 Detect My GPS Location',
        confirmBtn: '✅ Confirm This Location',
        close: 'Close',
        pinnedLabel: 'Pinned Location',
        noGps: 'GPS not supported',
        detecting: 'Detecting...',
        gpsLabel: 'Current GPS Location',
        gpsOk: '✅ GPS Location detected',
        pickMap: '⚠️ Please pick location on map',
        mapsPrefix: '📍 Maps:',
        pinnedDone: 'Location Pinned!',
        resetBtn: '<span>📍 Pin GPS</span>'
      },
      ar: {
        title: '📍 حدد موقع فندقك أو مكان إقامتك',
        chips: 'أو اختر منطقتك بنقرة واحدة:',
        hint: '👆 اضغط على الخريطة أو حرك الدبوس لأي مكان تريده',
        gpsBtn: '📡 تحديد موقعي التلقائي (GPS)',
        confirmBtn: '✅ تأكيد هذا الموقع واختياره',
        close: 'إغلاق',
        pinnedLabel: 'موقع محدد على الخريطة',
        noGps: 'المتصفح لا يدعم GPS',
        detecting: 'جاري البحث...',
        gpsLabel: 'موقعي الحالي (GPS)',
        gpsOk: '✅ تم التقاط موقعك بنجاح',
        pickMap: '⚠️ يرجى تحريك الدبوس على الخريطة',
        mapsPrefix: '📍 خريطة جوجل:',
        pinnedDone: 'تم تحديد اللوكيشن',
        resetBtn: '<span>📍 تحديد موقعي</span>'
      },
      de: {
        title: '📍 Hotel oder Abholort auf der Karte wählen',
        chips: 'Oder wählen Sie Ihre Urlaubsregion:',
        hint: '👆 Auf die Karte tippen oder Stecknadel zum Hotel ziehen',
        gpsBtn: '📡 Meinen GPS-Standort ermitteln',
        confirmBtn: '✅ Diesen Standort bestätigen',
        close: 'Schließen',
        pinnedLabel: 'Gewählter Kartenstandort',
        noGps: 'GPS wird nicht unterstützt',
        detecting: 'Suche läuft...',
        gpsLabel: 'Aktueller GPS-Standort',
        gpsOk: '✅ GPS-Standort erkannt',
        pickMap: '⚠️ Bitte Ort auf der Karte wählen',
        mapsPrefix: '📍 Karte:',
        pinnedDone: 'Standort markiert!',
        resetBtn: '<span>📍 GPS-Pin</span>'
      },
      ru: {
        title: '📍 Укажите ваш отель или точку трансфера',
        chips: 'Или выберите курортный район:',
        hint: '👆 Нажмите на карту или перетащите маркер к вашему отелю',
        gpsBtn: '📡 Определить мою геопозицию GPS',
        confirmBtn: '✅ Подтвердить это местоположение',
        close: 'Закрыть',
        pinnedLabel: 'Точка на карте',
        noGps: 'GPS не поддерживается',
        detecting: 'Поиск GPS...',
        gpsLabel: 'Текущая геопозиция (GPS)',
        gpsOk: '✅ Геопозиция определена',
        pickMap: '⚠️ Выберите место на карте вручную',
        mapsPrefix: '📍 Карта:',
        pinnedDone: 'Локация выбрана!',
        resetBtn: '<span>📍 Моя геопозиция GPS</span>'
      },
      pl: {
        title: '📍 Wybierz swój hotel lub miejsce odbioru',
        chips: 'Lub wybierz dzielnicę wypoczynkową:',
        hint: '👆 Kliknij mapę lub przeciągnij pinezkę na swój hotel',
        gpsBtn: '📡 Wykryj moją lokalizację GPS',
        confirmBtn: '✅ Potwierdź tę lokalizację',
        close: 'Zamknij',
        pinnedLabel: 'Wybrana pinezka na mapie',
        noGps: 'GPS nie jest obsługiwany',
        detecting: 'Wykrywanie...',
        gpsLabel: 'Aktualna lokalizacja GPS',
        gpsOk: '✅ Wykryto lokalizację GPS',
        pickMap: '⚠️ Proszę wskazać miejsce na mapie',
        mapsPrefix: '📍 Mapa:',
        pinnedDone: 'Wybrano lokalizację!',
        resetBtn: '<span>📍 Pin GPS</span>'
      }
    };
    const L_TXT = I18N_LOC[langKey] || I18N_LOC.en;

    // Remove existing modal if any
    const oldOverlay = document.getElementById('hstLocModalOverlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.className = 'hst-loc-overlay';
    overlay.id = 'hstLocModalOverlay';

    overlay.innerHTML = `
      <div class="hst-loc-modal" role="dialog" aria-modal="true" dir="${isAr ? 'rtl' : 'ltr'}">
        <div class="hst-loc-header">
          <h3>${L_TXT.title}</h3>
          <button type="button" class="hst-loc-close" title="${L_TXT.close}" id="hstLocCloseBtn">&times;</button>
        </div>
        <div class="hst-loc-body">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <button type="button" class="hst-loc-btn-gps" id="hstLocAutoGpsBtn">
              <span>${L_TXT.gpsBtn}</span>
            </button>
            <span id="hstLocStatusMsg" style="font-size:0.78rem; font-weight:600; color:#0369A1;"></span>
          </div>

          <div>
            <div class="hst-loc-chips-title">${L_TXT.chips}</div>
            <div class="hst-loc-chips" id="hstLocChipsContainer" style="margin-top:6px;">
              ${AREAS.map(a => `<button type="button" class="hst-loc-chip" data-lat="${a.lat}" data-lng="${a.lng}" data-name="${isAr ? a.nameAr : a.nameEn}">${isAr ? a.nameAr : a.nameEn}</button>`).join('')}
            </div>
          </div>

          <div class="hst-loc-map-box" id="hstLocMap"></div>
          <div class="hst-loc-map-hint">
            <span>${L_TXT.hint}</span>
          </div>
        </div>
        <div class="hst-loc-footer">
          <button type="button" class="hst-loc-btn-confirm" id="hstLocConfirmBtn">
            <span>${L_TXT.confirmBtn}</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('hstLocCloseBtn');
    const confirmBtn = document.getElementById('hstLocConfirmBtn');
    const autoGpsBtn = document.getElementById('hstLocAutoGpsBtn');
    const statusMsg = document.getElementById('hstLocStatusMsg');

    const closeModal = () => {
      overlay.remove();
      if (activeMap) {
        try { activeMap.remove(); } catch(e) {}
        activeMap = null;
        activeMarker = null;
      }
    };

    closeBtn.onclick = closeModal;
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };

    // Initialize Map with Leaflet
    ensureLeaflet(() => {
      const mapEl = document.getElementById('hstLocMap');
      if (!mapEl) return;

      activeMap = L.map(mapEl, {
        center: [selectedCoords.lat, selectedCoords.lng],
        zoom: 12,
        zoomControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap'
      }).addTo(activeMap);

      activeMarker = L.marker([selectedCoords.lat, selectedCoords.lng], {
        draggable: true
      }).addTo(activeMap);

      activeMarker.on('dragend', function(e) {
        const pos = e.target.getLatLng();
        selectedCoords.lat = Number(pos.lat.toFixed(5));
        selectedCoords.lng = Number(pos.lng.toFixed(5));
        selectedCoords.label = L_TXT.pinnedLabel;
        if (statusMsg) statusMsg.textContent = `${selectedCoords.lat}, ${selectedCoords.lng}`;
      });

      activeMap.on('click', function(e) {
        const lat = Number(e.latlng.lat.toFixed(5));
        const lng = Number(e.latlng.lng.toFixed(5));
        selectedCoords.lat = lat;
        selectedCoords.lng = lng;
        selectedCoords.label = L_TXT.pinnedLabel;
        activeMarker.setLatLng([lat, lng]);
        if (statusMsg) statusMsg.textContent = `${lat}, ${lng}`;
      });

      // Fix render sizing bug in Leaflet when inside modal
      setTimeout(() => {
        if (activeMap) activeMap.invalidateSize();
      }, 250);
    });

    // Area chips click handlers
    const chips = overlay.querySelectorAll('.hst-loc-chip');
    chips.forEach(chip => {
      chip.onclick = () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const lat = parseFloat(chip.getAttribute('data-lat'));
        const lng = parseFloat(chip.getAttribute('data-lng'));
        const name = chip.getAttribute('data-name');
        selectedCoords = { lat, lng, label: name };
        if (activeMap && activeMarker) {
          activeMap.flyTo([lat, lng], 13);
          activeMarker.setLatLng([lat, lng]);
        }
        if (statusMsg) statusMsg.textContent = name;
      };
    });

    // Auto GPS button handler
    autoGpsBtn.onclick = () => {
      if (!navigator.geolocation) {
        if (statusMsg) statusMsg.textContent = L_TXT.noGps;
        return;
      }
      autoGpsBtn.disabled = true;
      const oldBtnHTML = autoGpsBtn.innerHTML;
      autoGpsBtn.innerHTML = `<span>⏳ ${L_TXT.detecting}</span>`;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          autoGpsBtn.disabled = false;
          autoGpsBtn.innerHTML = oldBtnHTML;
          const lat = Number(pos.coords.latitude.toFixed(5));
          const lng = Number(pos.coords.longitude.toFixed(5));
          selectedCoords = { lat, lng, label: L_TXT.gpsLabel };
          trackAnalyticsEvent('location_gps_detected', { page_language: langKey });
          if (activeMap && activeMarker) {
            activeMap.flyTo([lat, lng], 15);
            activeMarker.setLatLng([lat, lng]);
          }
          if (statusMsg) {
            statusMsg.textContent = L_TXT.gpsOk;
            statusMsg.style.color = '#15803D';
          }
        },
        (err) => {
          autoGpsBtn.disabled = false;
          autoGpsBtn.innerHTML = oldBtnHTML;
          if (statusMsg) {
            statusMsg.textContent = L_TXT.pickMap;
            statusMsg.style.color = '#B91C1C';
          }
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    };

    // Confirm button handler
    confirmBtn.onclick = () => {
      const mapsUrl = `https://maps.google.com/?q=${selectedCoords.lat},${selectedCoords.lng}`;
      if (input) {
        const curVal = input.value.trim();
        const baseHotel = curVal.includes('maps.google.com') ? '' : curVal;
        if (baseHotel) {
          input.value = `${baseHotel} - ${selectedCoords.label} (${L_TXT.mapsPrefix} ${mapsUrl})`;
        } else {
          input.value = `${selectedCoords.label} (${L_TXT.mapsPrefix} ${mapsUrl})`;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (btnElement) {
        const prevHtml = btnElement.innerHTML;
        btnElement.innerHTML = `<span>✅ ${L_TXT.pinnedDone}</span>`;
        setTimeout(() => {
          btnElement.innerHTML = prevHtml || L_TXT.resetBtn;
        }, 4000);
      }

      trackAnalyticsEvent('location_pinned', {
        method: selectedCoords.label === L_TXT.gpsLabel ? 'gps' : 'map_or_area',
        page_language: langKey
      });

      closeModal();
    };
  };
})();


