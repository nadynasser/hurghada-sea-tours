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
 * Smart Geolocation Pinning for Bookings
 * Automatically detects tourist's GPS location and fills the hotel/location input
 */
window.HSTShareLocation = function(inputId, btnElement) {
  const input = document.getElementById(inputId) || document.querySelector('input[name*="hotel"], input[name*="location"], #bookHotel, #bookHotelAr, #bookHotelDe, #bookHotelRu, #bookHotelPl');
  const btn = btnElement || (typeof event !== 'undefined' && event ? event.currentTarget : null);

  const isAr = document.documentElement.lang === 'ar' || window.location.pathname.includes('/ar/');
  const isDe = document.documentElement.lang === 'de' || window.location.pathname.includes('/de/');
  const isRu = document.documentElement.lang === 'ru' || window.location.pathname.includes('/ru/');
  const isPl = document.documentElement.lang === 'pl' || window.location.pathname.includes('/pl/');

  const msgLoading = isAr ? '⏳ جاري تحديد موقعك...' : isDe ? '⏳ GPS ermitteln...' : isRu ? '⏳ Поиск GPS...' : isPl ? '⏳ Ustalanie GPS...' : '⏳ Detecting GPS...';
  const msgSuccess = isAr ? '✅ تم حفظ موقعك!' : isDe ? '✅ Standort erfasst!' : isRu ? '✅ Координаты готовы!' : isPl ? '✅ Zapisano!' : '✅ Location Pinned!';
  const msgError = isAr ? '⚠️ تعذر التقاط GPS' : isDe ? '⚠️ GPS nicht verfügbar' : isRu ? '⚠️ GPS недоступен' : isPl ? '⚠️ Błąd GPS' : '⚠️ GPS Unavailable';
  const msgPromptError = isAr 
    ? 'تعذر الوصول للموقع التلقائي. يرجى كتابة اسم الفندق أو إرسال الموقع عبر علامة الدبوس 📎 داخل الواتساب.' 
    : 'Could not access GPS. Please type your hotel name or share your location inside WhatsApp via the 📎 attachment icon.';

  if (!navigator.geolocation) {
    alert(msgPromptError);
    return;
  }

  const origHTML = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = `<span>${msgLoading}</span>`;
    btn.disabled = true;
  }

  const handleSuccess = (pos) => {
    const lat = pos.coords.latitude.toFixed(5);
    const lng = pos.coords.longitude.toFixed(5);
    const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
    if (input) {
      const curVal = input.value.trim();
      const mapLabel = isAr ? '📍 خريطة جوجل:' : '📍 Google Maps:';
      if (curVal && !curVal.includes('maps.google.com')) {
        input.value = `${curVal} (${mapLabel} ${mapsUrl})`;
      } else {
        input.value = `${mapLabel} ${mapsUrl}`;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (btn) {
      btn.innerHTML = `<span>${msgSuccess}</span>`;
      btn.disabled = false;
      setTimeout(() => {
        btn.innerHTML = origHTML || (isAr ? '<span>📍 تحديد موقعي</span>' : '<span>📍 Pin GPS</span>');
      }, 3500);
    }
  };

  const handleError = (err) => {
    console.warn('Geolocation error:', err);
    if (btn) {
      btn.innerHTML = `<span>${msgError}</span>`;
      btn.disabled = false;
      setTimeout(() => {
        btn.innerHTML = origHTML || (isAr ? '<span>📍 تحديد موقعي</span>' : '<span>📍 Pin GPS</span>');
      }, 3000);
    }
    // Try lower accuracy fallback if timed out or failed initially
    if (err.code === err.TIMEOUT && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(handleSuccess, () => alert(msgPromptError), { enableHighAccuracy: false, timeout: 10000 });
      return;
    }
    alert(msgPromptError);
  };

  navigator.geolocation.getCurrentPosition(
    handleSuccess,
    handleError,
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
  );
};

