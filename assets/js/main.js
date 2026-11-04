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
