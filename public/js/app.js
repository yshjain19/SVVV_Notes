/**
 * SVVV_Notes - Core Frontend Script
 * Modern Theme Switcher, Mobile Optimizations & Fluid Micro-Interactions
 */

// ── 1. Theme Management (Light / Dark Mode with Persistence & Meta Color Sync) ──
(function initThemeEngine() {
  const THEME_STORAGE_KEY = 'svvv_theme';

  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme, animate = false) {
    if (animate) {
      document.documentElement.classList.add('theme-transitioning');
      setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 350);
    }
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    // Update browser UI meta color (Chrome Android, Safari status bar)
    const metaThemeColor = document.getElementById('metaThemeColor') || document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0B0F19' : '#2F80ED');
    }

    // Update aria labels on theme toggles
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      btn.setAttribute('title', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
  }

  // Toggle Theme handler
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme, true);
  }

  // Bind clicks to all toggle buttons (desktop + mobile)
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleTheme();
      });
    });

    // Sync with OS theme if user hasn't explicitly set a custom theme preference
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          applyTheme(e.matches ? 'dark' : 'light', true);
        }
      });
    }
  });

  // Ensure current theme meta matches immediately
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme, false);
})();

// ── 2. Mobile Bottom Navigation Active Route Highlighting ──
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;
  const mobileNavItems = document.querySelectorAll('.mobile-bottom-nav .mobile-nav-item');

  let matched = false;
  mobileNavItems.forEach((item) => {
    const routeRegexStr = item.getAttribute('data-route');
    if (routeRegexStr) {
      try {
        const regex = new RegExp(routeRegexStr);
        if (regex.test(currentPath)) {
          item.classList.add('active');
          matched = true;
        } else {
          item.classList.remove('active');
        }
      } catch (err) {
        // Fallback exact match
        if (item.getAttribute('href') === currentPath) {
          item.classList.add('active');
          matched = true;
        }
      }
    }
  });

  // Default to home if nothing matched on root
  if (!matched && currentPath === '/') {
    const homeItem = document.querySelector('.mobile-bottom-nav .mobile-nav-item[data-route="^/$"]');
    if (homeItem) homeItem.classList.add('active');
  }
});

// ── 3. High Performance Smooth Scroll Animations (IntersectionObserver) ──
document.addEventListener('DOMContentLoaded', () => {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animated-in');
            obs.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: '0px 0px -40px 0px', threshold: 0.08 }
    );

    // Stagger animation on cards
    const animElements = document.querySelectorAll('.note-card, .feature-card, .step-card, .faq-card, .request-card');
    animElements.forEach((el, index) => {
      el.classList.add('animate-card');
      el.style.setProperty('--card-delay', `${(index % 6) * 0.06}s`);
      observer.observe(el);
    });
  }
});

// ── 4. Form Validation & Double-Submit Protection ──
document.querySelectorAll('.needs-validation').forEach((form) =>
  form.addEventListener('submit', (event) => {
    if (!form.checkValidity()) {
      event.preventDefault();
      event.stopPropagation();
    } else {
      const submitButtons = form.querySelectorAll('button[type="submit"], input[type="submit"]');
      submitButtons.forEach((btn) => {
        setTimeout(() => {
          btn.disabled = true;
          const btnText = btn.textContent ? btn.textContent.trim() : '';
          if (btnText === 'Create Account') {
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Creating Account...`;
          } else if (btnText === 'Sign In') {
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Signing In...`;
          } else if (btnText.includes('Upload') || btnText.includes('Publish') || btnText.includes('Save')) {
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Uploading...`;
          }
        }, 10);
      });
    }
    form.classList.add('was-validated');
  })
);

// ── 5. Client-Side File Validation (Size & Extension) ──
document.querySelectorAll('input[type="file"][name="pdf"]').forEach((input) => {
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg'];

    if (file) {
      const fileName = file.name.toLowerCase();
      const isValidExt = allowedExts.some((ext) => fileName.endsWith(ext));

      if (!isValidExt) {
        alert('Invalid file format. Please choose a PDF or image (.pdf, .png, .jpg, .jpeg).');
        input.value = '';
        return;
      }

      if (file.size > maxSizeBytes) {
        const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
        alert(`File is too large (${sizeInMb} MB). Maximum allowed size is 10 MB.`);
        input.value = '';
        return;
      }
    }
  });
});

// ── 6. Explicit Delete Confirmation ──
document.querySelectorAll('form[data-confirm]').forEach((form) =>
  form.addEventListener('submit', (event) => {
    if (!confirm(form.dataset.confirm)) event.preventDefault();
  })
);

// ── 7. Flash Toast Auto-Dismiss ──
setTimeout(() => {
  document.querySelectorAll('.toast-stack .alert').forEach((alert) => {
    if (window.bootstrap && bootstrap.Alert) {
      bootstrap.Alert.getOrCreateInstance(alert).close();
    }
  });
}, 5000);
