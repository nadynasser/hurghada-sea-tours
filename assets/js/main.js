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
  const input = document.getElementById(inputId) || document.querySelector('input[name*="hotel"], input[name*="location"], #bookHotel');
  const btn = btnElement || (event ? event.currentTarget : null);

  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser. Please type your hotel name or area.");
    return;
  }

  const origText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<span>⏳ Detecting GPS...</span>';
    btn.disabled = true;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(5);
      const lng = pos.coords.longitude.toFixed(5);
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
      if (input) {
        const curVal = input.value.trim();
        if (curVal && !curVal.includes('maps.google.com')) {
          input.value = `${curVal} (📍 Maps: ${mapsUrl})`;
        } else {
          input.value = `📍 GPS Location: ${mapsUrl}`;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (btn) {
        btn.innerHTML = '<span>✅ Location Pinned!</span>';
        btn.disabled = false;
        setTimeout(() => {
          btn.innerHTML = origText || '<span>📍 Pin GPS</span>';
        }, 3500);
      }
    },
    (err) => {
      console.warn('Geolocation error:', err);
      if (btn) {
        btn.innerHTML = '<span>⚠️ GPS Permission Denied</span>';
        btn.disabled = false;
        setTimeout(() => {
          btn.innerHTML = origText || '<span>📍 Pin GPS</span>';
        }, 3000);
      }
      alert('Could not access current location. Please type your hotel name or paste your Google Maps link.');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
};

