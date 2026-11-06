/**
 * Hurghada Sea Tours - Client Interactions & Language Switcher
 * Integrates with window.HSTWhatsAppRouter
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Drawer Toggle
  const menuToggle = document.getElementById('menuToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');
  
  if (menuToggle && mobileDrawer) {
    menuToggle.addEventListener('click', () => {
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', !isExpanded);
      mobileDrawer.classList.toggle('is-open');
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
    const input = document.getElementById(inputId) || document.querySelector('input[name*="hotel"], input[name*="location"], #bookHotel, #bookHotelAr, #bookHotelDe, #bookHotelRu, #bookHotelPl');
    const isAr = document.documentElement.lang === 'ar' || window.location.pathname.includes('/ar/');
    const isDe = document.documentElement.lang === 'de' || window.location.pathname.includes('/de/');
    const isRu = document.documentElement.lang === 'ru' || window.location.pathname.includes('/ru/');
    const isPl = document.documentElement.lang === 'pl' || window.location.pathname.includes('/pl/');

    // Remove existing modal if any
    const oldOverlay = document.getElementById('hstLocModalOverlay');
    if (oldOverlay) oldOverlay.remove();

    const titleText = isAr ? '📍 حدد موقع فندقك أو مكان إقامتك' : '📍 Select Your Hotel or Pickup Location';
    const chipsTitle = isAr ? 'أو اختر منطقتك بنقرة واحدة:' : 'Or tap your resort area:';
    const mapHint = isAr ? '👆 اضغط على الخريطة أو حرك الدبوس لأي مكان تريده' : '👆 Tap map or drag pin to your exact resort';
    const btnGpsText = isAr ? '📡 تحديد موقعي التلقائي (GPS)' : '📡 Detect My GPS Location';
    const btnConfirmText = isAr ? '✅ تأكيد هذا الموقع واختياره' : '✅ Confirm This Location';
    const closeTitle = isAr ? 'إغلاق' : 'Close';

    const overlay = document.createElement('div');
    overlay.className = 'hst-loc-overlay';
    overlay.id = 'hstLocModalOverlay';

    overlay.innerHTML = `
      <div class="hst-loc-modal" role="dialog" aria-modal="true">
        <div class="hst-loc-header">
          <h3>${titleText}</h3>
          <button type="button" class="hst-loc-close" title="${closeTitle}" id="hstLocCloseBtn">&times;</button>
        </div>
        <div class="hst-loc-body">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <button type="button" class="hst-loc-btn-gps" id="hstLocAutoGpsBtn">
              <span>${btnGpsText}</span>
            </button>
            <span id="hstLocStatusMsg" style="font-size:0.78rem; font-weight:600; color:#0369A1;"></span>
          </div>

          <div>
            <div class="hst-loc-chips-title">${chipsTitle}</div>
            <div class="hst-loc-chips" id="hstLocChipsContainer" style="margin-top:6px;">
              ${AREAS.map(a => `<button type="button" class="hst-loc-chip" data-lat="${a.lat}" data-lng="${a.lng}" data-name="${isAr ? a.nameAr : a.nameEn}">${isAr ? a.nameAr : a.nameEn}</button>`).join('')}
            </div>
          </div>

          <div class="hst-loc-map-box" id="hstLocMap"></div>
          <div class="hst-loc-map-hint">
            <span>${mapHint}</span>
          </div>
        </div>
        <div class="hst-loc-footer">
          <button type="button" class="hst-loc-btn-confirm" id="hstLocConfirmBtn">
            <span>${btnConfirmText}</span>
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
        selectedCoords.label = isAr ? 'موقع محدد على الخريطة' : 'Pinned Location';
        if (statusMsg) statusMsg.textContent = `${selectedCoords.lat}, ${selectedCoords.lng}`;
      });

      activeMap.on('click', function(e) {
        const lat = Number(e.latlng.lat.toFixed(5));
        const lng = Number(e.latlng.lng.toFixed(5));
        selectedCoords.lat = lat;
        selectedCoords.lng = lng;
        selectedCoords.label = isAr ? 'موقع محدد على الخريطة' : 'Pinned Location';
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
        if (statusMsg) statusMsg.textContent = isAr ? 'المتصفح لا يدعم GPS' : 'GPS not supported';
        return;
      }
      autoGpsBtn.disabled = true;
      const oldBtnHTML = autoGpsBtn.innerHTML;
      autoGpsBtn.innerHTML = `<span>⏳ ${isAr ? 'جاري البحث...' : 'Detecting...'}</span>`;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          autoGpsBtn.disabled = false;
          autoGpsBtn.innerHTML = oldBtnHTML;
          const lat = Number(pos.coords.latitude.toFixed(5));
          const lng = Number(pos.coords.longitude.toFixed(5));
          selectedCoords = { lat, lng, label: isAr ? 'موقعي الحالي (GPS)' : 'Current GPS Location' };
          if (activeMap && activeMarker) {
            activeMap.flyTo([lat, lng], 15);
            activeMarker.setLatLng([lat, lng]);
          }
          if (statusMsg) {
            statusMsg.textContent = `✅ ${isAr ? 'تم التقاط موقعك بنجاح' : 'GPS Location detected'}`;
            statusMsg.style.color = '#15803D';
          }
        },
        (err) => {
          autoGpsBtn.disabled = false;
          autoGpsBtn.innerHTML = oldBtnHTML;
          if (statusMsg) {
            statusMsg.textContent = isAr ? '⚠️ يرجى تحريك الدبوس على الخريطة' : '⚠️ Please pick location on map';
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
        const mapPrefix = isAr ? '📍 خريطة جوجل:' : '📍 Maps:';
        if (curVal && !curVal.includes('maps.google.com')) {
          input.value = `${curVal} - ${selectedCoords.label} (${mapPrefix} ${mapsUrl})`;
        } else {
          input.value = `${selectedCoords.label} (${mapPrefix} ${mapsUrl})`;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (btnElement) {
        btnElement.innerHTML = `<span>✅ ${isAr ? 'تم تحديد اللوكيشن' : 'Location Pinned!'}</span>`;
        setTimeout(() => {
          btnElement.innerHTML = isAr ? '<span>📍 تحديد موقعي</span>' : '<span>📍 Pin GPS</span>';
        }, 4000);
      }

      closeModal();
    };
  };
})();


