const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

const toastWrap = document.querySelector("[data-toast-wrap]");

function showToast(message, type = "success") {
  if (!toastWrap) return;
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  toastWrap.appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

function applyTheme() {
  const theme = storage.get("mf_theme", "light");
  document.body.classList.toggle("dark", theme === "dark");
}

function toggleTheme() {
  const current = storage.get("mf_theme", "light");
  const next = current === "dark" ? "light" : "dark";
  storage.set("mf_theme", next);
  applyTheme();
  showToast(`Switched to ${next} mode`, "success");
}

function setupLoader() {
  const loader = document.querySelector(".loader");
  if (!loader) return;
  setTimeout(() => loader.classList.add("hidden"), 550);
}

function setupScrollReveal() {
  const nodes = document.querySelectorAll(".reveal");
  if (!nodes.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
      }
    });
  }, { threshold: 0.16 });

  nodes.forEach((node) => observer.observe(node));
}

function setupActiveNav() {
  const links = document.querySelectorAll("[data-nav-link]");
  const sections = Array.from(document.querySelectorAll("section[id]"));
  if (!links.length || !sections.length) return;

  const onScroll = () => {
    const offset = window.scrollY + 120;
    let current = sections[0].id;
    sections.forEach((section) => {
      if (offset >= section.offsetTop) current = section.id;
    });
    links.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
    });
  };

  onScroll();
  window.addEventListener("scroll", onScroll);
}

function setupMobileSidebar() {
  const openBtn = document.querySelector("[data-open-sidebar]");
  const closeBtn = document.querySelector("[data-close-sidebar]");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".overlay");
  if (!openBtn || !closeBtn || !sidebar || !overlay) return;

  const close = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  };
  const open = () => {
    sidebar.classList.add("open");
    overlay.classList.add("show");
  };
  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", close);
}

function setupThemeButtons() {
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", toggleTheme);
  });
}

function setupPage() {
  applyTheme();
  setupLoader();
  setupScrollReveal();
  setupActiveNav();
  setupThemeButtons();
  setupMobileSidebar();
}

document.addEventListener("DOMContentLoaded", setupPage);
