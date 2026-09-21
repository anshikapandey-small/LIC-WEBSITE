document.addEventListener('DOMContentLoaded', function () {

  /* ---------- Hero Iridescence background ---------- */
  var heroBg = document.getElementById('heroBg');

  if (heroBg && typeof createIridescence === 'function') {
    try {
      var iridescence = createIridescence(heroBg, {
        color: [0.29411764705882354, 0.5019607843137255, 0.9254901960784314],
        mouseReact: false,
        amplitude: 0.1,
        speed: 1.3
      });

      // Only animate while the hero is on screen.
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) iridescence.resume();
            else iridescence.pause();
          });
        }).observe(heroBg);
      }
    } catch (err) {
      // If WebGL fails, the CSS gradient on .hero-bg stays as the background.
      console.warn('Hero animation disabled:', err);
    }
  }

  /* ---------- Mobile nav toggle ---------- */
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close the mobile menu after a nav link is tapped
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Active nav link on scroll ---------- */
  var sections = document.querySelectorAll('main section[id]');
  var navAnchors = document.querySelectorAll('.nav-link');

  if (sections.length && navAnchors.length && 'IntersectionObserver' in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.getAttribute('id');
          navAnchors.forEach(function (a) {
            a.classList.toggle('active', a.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (section) { sectionObserver.observe(section); });
  }

  /* ---------- Scroll reveal for content blocks ---------- */
  var revealTargets = document.querySelectorAll(
    '.section-head, .about-panel, .about-body, .service-card, .step, .test-card, .contact-info-list, .office-hours, form'
  );
  revealTargets.forEach(function (el) { el.classList.add('reveal'); });

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('in-view'); });
  }

  /* ---------- Contact form validation ---------- */
  var form = document.getElementById('contactForm');
  var successMsg = document.getElementById('formSuccess');

  if (form) {
    var validators = {
      fname: function (v) { return v.trim().length >= 2 ? '' : 'Please enter your full name.'; },
      phone: function (v) { return /^[0-9+\-\s]{7,15}$/.test(v.trim()) ? '' : 'Enter a valid phone number.'; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address.'; }
    };

    function showError(field, message) {
      var input = form.elements[field];
      var errorEl = form.querySelector('.field-error[data-for="' + field + '"]');
      if (input) input.classList.toggle('invalid', !!message);
      if (errorEl) errorEl.textContent = message;
    }

    Object.keys(validators).forEach(function (field) {
      var input = form.elements[field];
      if (!input) return;
      input.addEventListener('blur', function () {
        showError(field, validators[field](input.value));
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;

      Object.keys(validators).forEach(function (field) {
        var input = form.elements[field];
        var message = validators[field](input.value);
        showError(field, message);
        if (message) valid = false;
      });

      if (!valid) {
        successMsg.textContent = '';
        return;
      }

      // No backend is wired up here — replace this block with a real submit
      // (fetch to your API, a mail service, etc.) when you deploy the site.
      var submitBtn = form.querySelector('.btn-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      setTimeout(function () {
        successMsg.textContent = 'Thanks! Your message has been noted — I\'ll get back to you within a day.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
        form.reset();
      }, 700);
    });
  }

});
