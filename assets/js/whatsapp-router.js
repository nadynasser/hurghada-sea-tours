/**
 * Hurghada Sea Tours - Dynamic Multi-Language WhatsApp Routing Engine
 * Implements strict hierarchical routing rules:
 * 1. Single-number mode fallback
 * 2. Multi-number language-based routing
 * 3. Default fallback for unassigned languages
 * 4. Product-specific overrides (e.g. VIP Charters)
 * 5. Safe fallback for disabled or invalid numbers
 * 6. Dynamic updating on language switch
 * 7. Context-aware pre-filled localized messages with tour & booking details
 */

(function (window, document) {
  'use strict';

  // Tour catalog mapping with localized names, pricing, and details
  const TOUR_CATALOG = {
    'orange-bay': {
      productId: 'orange-bay',
      price: '€30',
      names: {
        en: 'Orange Bay Island & Snorkeling Boat Cruise',
        de: 'Orange Bay Insel & Schnorchelausflug',
        ru: 'Остров Оранж Бей и снорклинг',
        pl: 'Wyspa Orange Bay & Snorkeling',
        ar: 'جزيرة أورانج باي وسنوركلينج اليخت'
      }
    },
    'hula-hula': {
      productId: 'hula-hula',
      price: '€32',
      names: {
        en: 'Hula Hula Island & Snorkeling Cruise',
        de: 'Hula Hula Insel & Schnorchelausflug',
        ru: 'Остров Хула Хула и снорклинг',
        pl: 'Wyspa Hula Hula & Snorkeling',
        ar: 'رحلة جزيرة هولا هولا وسنوركلينج'
      }
    },
    'dolphin-house': {
      productId: 'dolphin-house',
      price: '€25',
      names: {
        en: 'Dolphin House Swimming & Snorkeling Adventure',
        de: 'Dolphin House Schwimmen & Schnorcheln',
        ru: 'Дом Дельфинов: плавание и снорклинг',
        pl: 'Dolphin House: Pływanie z delfinami',
        ar: 'مغامرة بيت الدلافين والسباحة المفتوحة'
      }
    },
    'snorkeling-coral-reef': {
      productId: 'snorkeling-coral-reef',
      price: '€35',
      names: {
        en: 'Living Coral Reef Snorkeling & Marine Sanctuary',
        de: 'Korallenriff & Meeres-Schutzgebiet Schnorcheln',
        ru: 'Коралловые рифы и заповедник: снорклинг',
        pl: 'Rafy koralowe & Park Narodowy: Snorkeling',
        ar: 'سنوركلينج المحميات والشعاب المرجانية'
      }
    },
    'semi-submarine': {
      productId: 'semi-submarine',
      price: '€20',
      names: {
        en: 'Semi-Submarine Underwater Observatory Tour',
        de: 'Semi-U-Boot Unterwasser-Observatorium',
        ru: 'Полуподводная лодка (Батискаф)',
        pl: 'Łódź podwodna (Semi-Submarine)',
        ar: 'المرصد البحري والغواصة (سيمي سبمارين)'
      }
    },
    'private-yacht': {
      productId: 'private-yacht',
      price: '€150',
      names: {
        en: 'VIP Private Yacht & Speedboat Charter',
        de: 'VIP Private Yacht & Schnellboot Charter',
        ru: 'Индивидуальная аренда яхт и катеров VIP',
        pl: 'Prywatny jacht i rejsy na wyłączność VIP',
        ar: 'تأجير اليخوت واللانشات السريعة الخاصة VIP'
      }
    }
  };

  // Hardcoded fallback settings with current WhatsApp number
  const DEFAULT_FALLBACK_SETTINGS = {
    version: 2,
    defaultNumber: "201091705805",
    numbers: [
      { id: "main", number: "201091705805", label: "Hurghada Central Dispatch & Bookings", enabled: true },
      { id: "de_rep", number: "201091705805", label: "German Guest Relations", enabled: true },
      { id: "ru_rep", number: "201091705805", label: "Russian Support Desk", enabled: true },
      { id: "pl_rep", number: "201091705805", label: "Polish Customer Desk", enabled: true },
      { id: "ar_rep", number: "201091705805", label: "Arabic & Local Operations", enabled: true },
      { id: "vip_charter", number: "201091705805", label: "VIP Yacht & Private Charter Specialist", enabled: true }
    ],
    languageRouting: {
      en: "main",
      de: "de_rep",
      ru: "ru_rep",
      pl: "pl_rep",
      ar: "ar_rep"
    },
    productRouting: {
      "private-yacht": "vip_charter",
      "orange-bay": null,
      "dolphin-house": null,
      "snorkeling-coral-reef": null,
      "semi-submarine": null
    },
    messageTemplates: {
      en: {
        general: "Hi Hurghada Sea Tours! I would like to inquire about booking a sea excursion.",
        product: "Hi Hurghada Sea Tours! I would like to inquire about booking the \"{productName}\" ({productPrice}). Please check availability for my dates. We need hotel pickup in Hurghada."
      },
      de: {
        general: "Hallo Hurghada Sea Tours! Ich möchte mich über Bootsausflüge im Roten Meer informieren.",
        product: "Hallo Hurghada Sea Tours! Ich interessiere mich für den Ausflug \"{productName}\" ({productPrice}). Bitte prüfen Sie die Verfügbarkeit für unsere Reisedaten. Hotelabholung in Hurghada erwünscht."
      },
      ru: {
        general: "Здравствуйте, Hurghada Sea Tours! Я хочу узнать о морских экскурсиях в Хургаде.",
        product: "Здравствуйте, Hurghada Sea Tours! Я хочу забронировать экскурсию \"{productName}\" ({productPrice}). Пожалуйста, проверьте наличие мест на наши даты. Нужен трансфер из отеля."
      },
      pl: {
        general: "Cześć Hurghada Sea Tours! Chciałbym zapytać o rejsy morskie i wycieczki w Hurghadzie.",
        product: "Cześć Hurghada Sea Tours! Chciałbym zarezerwować wycieczkę \"{productName}\" ({productPrice}). Proszę o sprawdzenie dostępności na wybrane terminy. Potrzebny transfer z hotelu w Hurghadzie."
      },
      ar: {
        general: "مرحباً Hurghada Sea Tours! أود الاستفسار عن حجز رحلة بحرية في الغردقة.",
        product: "مرحباً Hurghada Sea Tours! أود حجز رحلة \"{productName}\" ({productPrice}). يرجى تأكيد الإتاحة لموعدنا مع خدمة التوصيل من الفندق."
      }
    }
  };

  const STORAGE_KEY = 'hst_whatsapp_settings';

  class WhatsAppRouter {
    constructor() {
      this.settings = this.loadLocalSettings() || DEFAULT_FALLBACK_SETTINGS;
      this.activeLanguage = this.detectLanguage();
      this.pageTour = this.detectPageTour();
      this.initAsyncFetch();
    }

    // Detect language from HTML lang attribute, URL path, or default to 'en'
    detectLanguage() {
      const htmlLang = (document.documentElement.lang || 'en').toLowerCase().substring(0, 2);
      if (['en', 'de', 'ru', 'pl', 'ar'].includes(htmlLang)) {
        return htmlLang;
      }
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/de/') || path.endsWith('/de')) return 'de';
      if (path.includes('/ru/') || path.endsWith('/ru')) return 'ru';
      if (path.includes('/pl/') || path.endsWith('/pl')) return 'pl';
      if (path.includes('/ar/') || path.endsWith('/ar')) return 'ar';
      return 'en';
    }

    // Detect if the current page is a dedicated tour landing page
    detectPageTour() {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('orange-bay')) return 'orange-bay';
      if (path.includes('hula-hula')) return 'hula-hula';
      if (path.includes('dolphin-house')) return 'dolphin-house';
      if (path.includes('snorkeling-coral-reef')) return 'snorkeling-coral-reef';
      if (path.includes('semi-submarine')) return 'semi-submarine';
      if (path.includes('private-yacht')) return 'private-yacht';
      return null;
    }

    setLanguage(lang) {
      if (['en', 'de', 'ru', 'pl', 'ar'].includes(lang)) {
        this.activeLanguage = lang;
        this.bindAllElements();
      }
    }

    loadLocalSettings() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Auto-migrate if older cache has old phone number or outdated version
          if (parsed && (parsed.defaultNumber === '201008684777' || !parsed.version || parsed.version < 2)) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
          }
          return parsed;
        }
      } catch (e) {
        console.warn('[WhatsAppRouter] LocalStorage read failed:', e);
      }
      return null;
    }

    saveSettings(newSettings) {
      this.settings = Object.assign({}, this.settings, newSettings, { version: 2 });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch (e) {
        console.warn('[WhatsAppRouter] LocalStorage save failed:', e);
      }
      this.bindAllElements();
    }

    async initAsyncFetch() {
      const isSubdir = window.location.pathname.includes('/tours/') ||
                       window.location.pathname.includes('/de/') ||
                       window.location.pathname.includes('/ru/') ||
                       window.location.pathname.includes('/pl/') ||
                       window.location.pathname.includes('/ar/');
      const basePath = isSubdir ? '../assets/data/whatsapp-settings.json' : 'assets/data/whatsapp-settings.json';

      try {
        const res = await fetch(basePath);
        if (res.ok) {
          const remoteSettings = await res.json();
          if (!localStorage.getItem(STORAGE_KEY) || (remoteSettings && remoteSettings.version >= 2)) {
            this.settings = remoteSettings;
          }
          this.bindAllElements();
        }
      } catch (e) {
        // Fallback already loaded
      }
    }

    // Sanitize phone number to international WhatsApp format (digits only)
    cleanNumber(raw) {
      if (!raw) return '';
      return String(raw).replace(/[^0-9]/g, '');
    }

    isValidNumber(num) {
      const cleaned = this.cleanNumber(num);
      return cleaned.length >= 8 && cleaned.length <= 15;
    }

    /**
     * Resolves WhatsApp number according to the 7 strict rules:
     * @param {string|null} productId
     * @param {string|null} lang
     * @returns {string} Sanitized WhatsApp phone number
     */
    resolveNumber(productId = null, lang = null) {
      const currentLang = lang || this.activeLanguage || 'en';
      const activeNumbers = (this.settings.numbers || []).filter(n => n.enabled && this.isValidNumber(n.number));

      // Rule 1: If only one valid enabled number is configured, use it for all languages and products
      if (activeNumbers.length === 1) {
        return this.cleanNumber(activeNumbers[0].number);
      }

      // Rule 4: If product has a specific number configured, check it first
      if (productId && this.settings.productRouting && this.settings.productRouting[productId]) {
        const productNumId = this.settings.productRouting[productId];
        const productObj = this.settings.numbers.find(n => n.id === productNumId);
        // Rule 5: If assigned number is valid and enabled, use it
        if (productObj && productObj.enabled && this.isValidNumber(productObj.number)) {
          return this.cleanNumber(productObj.number);
        }
      }

      // Rule 2: If language has an assigned number, use it
      if (currentLang && this.settings.languageRouting && this.settings.languageRouting[currentLang]) {
        const langNumId = this.settings.languageRouting[currentLang];
        const langObj = this.settings.numbers.find(n => n.id === langNumId);
        // Rule 5: Validate number is enabled & valid
        if (langObj && langObj.enabled && this.isValidNumber(langObj.number)) {
          return this.cleanNumber(langObj.number);
        }
      }

      // Rule 3 & Rule 5 fallback: Primary default number
      const defaultObj = this.settings.numbers.find(n => n.id === 'main' || n.number === this.settings.defaultNumber);
      if (defaultObj && defaultObj.enabled && this.isValidNumber(defaultObj.number)) {
        return this.cleanNumber(defaultObj.number);
      }

      // Extreme fallback
      return this.cleanNumber(this.settings.defaultNumber || "201091705805");
    }

    /**
     * Reads booking form fields if available on page
     */
    getBookingFormDetails() {
      const dateEl = document.querySelector('input[type="date"], #bookDate, #bookDateDe, #bookDateRu, #bookDatePl, #bookDateAr');
      const adultsEl = document.querySelector('#bookAdults, #bookAdultsDe, #bookAdultsRu, #bookAdultsPl, #bookAdultsAr, #bAdults, #snorkAdults, #subAdults');
      const kidsEl = document.querySelector('#bookChildren, #bookChildrenDe, #bookKidsRu, #bookKidsPl, #bookKidsAr, #bKids, #snorkKids, #subKids');
      const hotelEl = document.querySelector('#bookHotel, #bookHotelDe, #bookHotelRu, #bookHotelPl, #bookHotelAr, #bHotel, #snorkHotel, #subHotel, input[name*="hotel"], input[name*="location"], #bookLocation');

      const locVal = hotelEl && hotelEl.value ? hotelEl.value.trim() : null;

      return {
        date: dateEl && dateEl.value ? dateEl.value.trim() : null,
        adults: adultsEl ? adultsEl.options[adultsEl.selectedIndex]?.text || adultsEl.value : null,
        kids: kidsEl && kidsEl.value !== '0' ? kidsEl.options[kidsEl.selectedIndex]?.text || kidsEl.value : null,
        hotel: locVal,
        location: locVal
      };
    }

    /**
     * Constructs pre-filled WhatsApp message preserving product, price, and visitor's language (Rule 7)
     */
    buildMessage(productName = null, productPrice = null, lang = null, formData = null) {
      const currentLang = lang || this.activeLanguage || 'en';
      const form = formData || {};

      // If no product is given, check if we're on a tour landing page
      let targetProduct = productName;
      let targetPrice = productPrice;
      const detectedTourKey = this.pageTour;

      if (!targetProduct && detectedTourKey && TOUR_CATALOG[detectedTourKey]) {
        const item = TOUR_CATALOG[detectedTourKey];
        targetProduct = item.names[currentLang] || item.names.en;
        targetPrice = targetPrice || item.price;
      }

      // 1. Detailed booking message if form fields or specific tour are present
      if (targetProduct) {
        const hasFormInputs = Boolean(form.date || form.hotel || form.location);
        const loc = form.location || form.hotel || '';

        if (currentLang === 'ar') {
          if (hasFormInputs) {
            let msg = `مرحباً Hurghada Sea Tours! أود حجز رحلة:\n🏖️ الرحلة: ${targetProduct} (${targetPrice || ''})\n`;
            if (form.date) msg += `📅 تاريخ الرحلة: ${form.date}\n`;
            if (form.adults) msg += `👥 عدد الأفراد: ${form.adults}${form.kids ? '، ' + form.kids : ''}\n`;
            if (loc) msg += `📍 موقع الاستقبال / الفندق: ${loc}\n`;
            msg += `يرجى تأكيد الحجز وميعاد التوصيل.`;
            return msg;
          }
          return `مرحباً Hurghada Sea Tours! أود حجز رحلة "${targetProduct}" (${targetPrice || ''}). يرجى تأكيد الإتاحة لموعدنا مع خدمة التوصيل.`;
        }

        if (currentLang === 'de') {
          if (hasFormInputs) {
            let msg = `Hallo Hurghada Sea Tours! Ich möchte folgenden Ausflug buchen:\n🏖️ Ausflug: ${targetProduct} (${targetPrice || ''})\n`;
            if (form.date) msg += `📅 Reisedatum: ${form.date}\n`;
            if (form.adults) msg += `👥 Personen: ${form.adults}${form.kids ? ', ' + form.kids : ''}\n`;
            if (loc) msg += `📍 Abholort / Hotel: ${loc}\n`;
            msg += `Bitte prüfen Sie die Verfügbarkeit für unsere Reisedaten und bestätigen Sie die Abholung.`;
            return msg;
          }
          return `Hallo Hurghada Sea Tours! Ich interessiere mich für den Ausflug "${targetProduct}" (${targetPrice || ''}). Bitte prüfen Sie die Verfügbarkeit für unsere Reisedaten. Hotelabholung in Hurghada erwünscht.`;
        }

        if (currentLang === 'ru') {
          if (hasFormInputs) {
            let msg = `Здравствуйте, Hurghada Sea Tours! Я хочу забронировать:\n🏖️ Экскурсия: ${targetProduct} (${targetPrice || ''})\n`;
            if (form.date) msg += `📅 Дата поездки: ${form.date}\n`;
            if (form.adults) msg += `👥 Гости: ${form.adults}${form.kids ? ', ' + form.kids : ''}\n`;
            if (loc) msg += `📍 Отель / Локация: ${loc}\n`;
            msg += `Пожалуйста, проверьте наличие мест на наши даты и подтвердите трансфер из отеля.`;
            return msg;
          }
          return `Здравствуйте, Hurghada Sea Tours! Я хочу забронировать экскурсию "${targetProduct}" (${targetPrice || ''}). Пожалуйста, проверьте наличие мест на наши даты. Нужен трансфер из отеля.`;
        }

        if (currentLang === 'pl') {
          if (hasFormInputs) {
            let msg = `Cześć Hurghada Sea Tours! Chciałbym zarezerwować wycieczkę:\n🏖️ Wycieczka: ${targetProduct} (${targetPrice || ''})\n`;
            if (form.date) msg += `📅 Data rejsu: ${form.date}\n`;
            if (form.adults) msg += `👥 Uczestnicy: ${form.adults}${form.kids ? ', ' + form.kids : ''}\n`;
            if (loc) msg += `📍 Hotel / Lokalizacja: ${loc}\n`;
            msg += `Proszę o sprawdzenie dostępności na wybrane terminy i potwierdzenie transferu.`;
            return msg;
          }
          return `Cześć Hurghada Sea Tours! Chciałbym zarezerwować wycieczkę "${targetProduct}" (${targetPrice || ''}). Proszę o sprawdzenie dostępności na wybrane terminy. Potrzebny transfer z hotelu w Hurghadzie.`;
        }

        // English default
        if (hasFormInputs) {
          let msg = `Hi Hurghada Sea Tours! I would like to book:\n🏖️ Tour: ${targetProduct} (${targetPrice || ''})\n`;
          if (form.date) msg += `📅 Travel Date: ${form.date}\n`;
          if (form.adults) msg += `👥 Guests: ${form.adults}${form.kids ? ', ' + form.kids : ''}\n`;
          if (loc) msg += `📍 Pickup Location / Hotel: ${loc}\n`;
          msg += `Please check availability and confirm booking details with hotel pickup.`;
          return msg;
        }
        return `Hi Hurghada Sea Tours! I would like to inquire about booking the "${targetProduct}" (${targetPrice || ''}). Please check availability for my dates. We need hotel pickup in Hurghada.`;
      }

      // 2. General inquiry message
      const langTemplates = (this.settings.messageTemplates && this.settings.messageTemplates[currentLang]) 
                            || DEFAULT_FALLBACK_SETTINGS.messageTemplates[currentLang]
                            || DEFAULT_FALLBACK_SETTINGS.messageTemplates.en;

      return langTemplates.general || DEFAULT_FALLBACK_SETTINGS.messageTemplates.en.general;
    }

    /**
     * Generates the complete wa.me link
     */
    generateLink(productName = null, productPrice = null, productId = null, lang = null, formData = null) {
      const pid = productId || this.pageTour || (productName ? productName.toLowerCase().replace(/[^a-z0-9]/g, '-') : null);
      const number = this.resolveNumber(pid, lang);
      const text = this.buildMessage(productName, productPrice, lang, formData);
      return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    }

    /**
     * Dynamically binds and updates all WhatsApp buttons and links on the page (Rule 6)
     */
    bindAllElements() {
      const waButtons = document.querySelectorAll('[data-wa-tour], [data-wa-product], .btn-whatsapp, a[href*="wa.me"]');

      waButtons.forEach(btn => {
        // Resolve tour and product identity
        let productName = btn.getAttribute('data-wa-tour') || btn.getAttribute('data-product-name') || null;
        let productPrice = btn.getAttribute('data-wa-price') || btn.getAttribute('data-product-price') || null;
        let productId = btn.getAttribute('data-product-id');

        // On tour landing pages, if the button does not have an explicit product, attach the page tour!
        if (!productName && this.pageTour && TOUR_CATALOG[this.pageTour]) {
          const pInfo = TOUR_CATALOG[this.pageTour];
          productName = pInfo.names[this.activeLanguage] || pInfo.names.en;
          productPrice = productPrice || pInfo.price;
          productId = productId || this.pageTour;
        }

        // Set static href for preview/hover
        const staticUrl = this.generateLink(productName, productPrice, productId, this.activeLanguage, null);
        if (btn.tagName.toLowerCase() === 'a') {
          btn.href = staticUrl;
          btn.target = "_blank";
          btn.rel = "noopener noreferrer";
        }

        // Click handler: evaluates latest form state live at the exact moment of click
        btn.onclick = (e) => {
          e.preventDefault();
          const formInputs = this.getBookingFormDetails();
          const liveUrl = this.generateLink(productName, productPrice, productId, this.activeLanguage, formInputs);
          window.open(liveUrl, '_blank', 'noopener,noreferrer');
        };
      });

      // Intercept booking forms to open WhatsApp with form details
      const bookingForms = document.querySelectorAll('form[action*="wa.me"], .booking-sidebar form');
      bookingForms.forEach(form => {
        form.onsubmit = (e) => {
          e.preventDefault();
          const formInputs = this.getBookingFormDetails();
          let pName = null;
          let pPrice = null;
          let pId = this.pageTour;

          if (this.pageTour && TOUR_CATALOG[this.pageTour]) {
            const pInfo = TOUR_CATALOG[this.pageTour];
            pName = pInfo.names[this.activeLanguage] || pInfo.names.en;
            pPrice = pInfo.price;
          }

          const liveUrl = this.generateLink(pName, pPrice, pId, this.activeLanguage, formInputs);
          window.open(liveUrl, '_blank', 'noopener,noreferrer');
        };
      });
    }
  }

  // Instantiate and expose globally
  window.HSTWhatsAppRouter = new WhatsAppRouter();

  // Auto-bind on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.HSTWhatsAppRouter.bindAllElements());
  } else {
    window.HSTWhatsAppRouter.bindAllElements();
  }

})(window, document);
