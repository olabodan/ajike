(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const showToast = (message) => {
    const toast = $("[data-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
  };

  const setCurrentYear = () => {
    const yearEl = $("[data-year]");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  };

  const setStickyHeaderState = () => {
    const header = $("[data-header]");
    if (!header) return;
    const update = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 10);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
  };

  const setupMobileNav = () => {
    const header = $("[data-header]");
    const toggle = $("[data-nav-toggle]");
    const nav = $("[data-nav]");
    if (!header || !toggle || !nav) return;

    const setOpen = (open) => {
      header.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

    toggle.addEventListener("click", () => setOpen(!header.classList.contains("nav-open")));

    $$("a[href^='#']", nav).forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("click", (e) => {
      if (!header.classList.contains("nav-open")) return;
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (header.contains(target)) return;
      setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!header.classList.contains("nav-open")) return;
      setOpen(false);
      toggle.focus();
    });
  };

  const setupAnchorsWithOffset = () => {
    const header = $("[data-header]");
    const headerOffset = () => (header ? header.getBoundingClientRect().height : 0) + 8;

    $$("a[href^='#']").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.length < 2) return;
      const target = $(href);
      if (!target) return;

      link.addEventListener("click", (e) => {
        if (e.defaultPrevented) return;
        e.preventDefault();
        const top = window.scrollY + target.getBoundingClientRect().top - headerOffset();
        window.scrollTo({ top, behavior: "smooth" });
        history.pushState(null, "", href);
      });
    });
  };

  const setupRevealOnScroll = () => {
    const items = $$(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -10% 0px" }
    );

    items.forEach((el) => io.observe(el));
  };

  const setupTiltCard = () => {
    const card = $("[data-tilt]");
    if (!card) return;
    const isTouch = window.matchMedia?.("(hover: none)").matches;
    if (isTouch) return;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const onMove = (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      const rotateY = clamp(x * 8, -8, 8);
      const rotateX = clamp(-y * 8, -8, 8);
      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
    };

    const onLeave = () => {
      card.style.transform = "";
    };

    card.addEventListener("mousemove", onMove);
    card.addEventListener("mouseleave", onLeave);
  };

  const setupContactFormWhatsApp = () => {
    const form = $("[data-contact-form]");
    const status = $("[data-form-status]");
    if (!form) return;

    const setStatus = (message) => {
      if (status) status.textContent = message;
    };

    const buildWhatsAppUrl = ({ name, email, service, date, message }) => {
      const phone = "2349090080006";
      const lines = [
        "Hello Ajike Kitchen,",
        "",
        "Here are my details:",
        `Name: ${name}`,
        `Email: ${email}`,
        `Service: ${service}`,
        date ? `Event date: ${date}` : "Event date: (not provided)",
        "",
        "Message:",
        message,
        "",
        "Thank you."
      ];
      const text = lines.join("\n");
      return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      setStatus("");

      const formData = new FormData(form);
      const name = String(formData.get("name") || "").trim();
      const email = String(formData.get("email") || "").trim();
      const service = String(formData.get("service") || "").trim();
      const date = String(formData.get("date") || "").trim();
      const message = String(formData.get("message") || "").trim();

      if (!name || !email || !service || !message) {
        setStatus("Please complete all required fields.");
        showToast("Please complete the form first.");
        return;
      }

      const url = buildWhatsAppUrl({ name, email, service, date, message });
      showToast("Opening WhatsApp…");
      setStatus("Opening WhatsApp…");
      window.location.href = url;
      form.reset();
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    setCurrentYear();
    setStickyHeaderState();
    setupMobileNav();
    setupAnchorsWithOffset();
    setupRevealOnScroll();
    setupTiltCard();
    setupContactFormWhatsApp();
  });
})();
