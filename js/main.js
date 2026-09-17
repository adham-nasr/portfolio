/* ==========================================================================
   Main script
   - Renders the filter bar + project grid from data.js
   - Handles filtering
   - Builds and controls the case-study modal
   - Lightbox for enlarging screenshots (with prev/next navigation)
   - Small UI niceties (header shadow, year, image fade-in on load)
   ========================================================================== */

(function () {
  "use strict";

  const ARROW = `<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
  const EXTERNAL = `<svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>`;

  /* ---------- DOM refs ---------- */
  const gridEl = document.getElementById("project-grid");
  const filtersEl = document.getElementById("filters");
  const modalEl = document.getElementById("modal");
  const modalContentEl = document.getElementById("modal-content");
  const modalPanelEl = modalEl.querySelector(".modal__panel");

  const lightboxEl = document.getElementById("lightbox");
  const lightboxImgEl = document.getElementById("lightbox-img");
  const lightboxCaptionEl = document.getElementById("lightbox-caption");
  const lightboxPrevBtn = lightboxEl.querySelector(".lightbox__prev");
  const lightboxNextBtn = lightboxEl.querySelector(".lightbox__next");

  let activeFilter = "All";
  let lastFocused = null;
  let activeProject = null;   // project currently open in the modal
  let lightboxIndex = -1;     // index into activeProject.screenshots
  let lightboxLastFocused = null;

  /* ---------- Category color palette ----------
     Deterministic hash → color, so any category (including new ones added
     later through the admin tool) automatically gets a consistent,
     readable color with no CSS edits required. */
  const TAG_PALETTE = [
    { bg: "#F3E1D6", fg: "#9A4B2E" }, // clay
    { bg: "#E1E9E2", fg: "#3F6B52" }, // sage
    { bg: "#E6E1F2", fg: "#5A4B8C" }, // lavender
    { bg: "#FBE7C6", fg: "#95641A" }, // amber
    { bg: "#DCEAF2", fg: "#2F6C8C" }, // sky
    { bg: "#F2E1E6", fg: "#93425A" }, // rose
  ];
  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h;
  }
  function tagColor(category) {
    if (!category) return { bg: "var(--paper)", fg: "var(--muted)" };
    return TAG_PALETTE[hashStr(category) % TAG_PALETTE.length];
  }

  /* ---------- Image load fade-in ----------
     Each media container starts with a shimmer background and its <img>
     at opacity:0; once the image is actually ready we mark the container
     `.is-loaded`, which fades the image in and stops the shimmer. Avoids
     the abrupt "pop" (and the layout/paint jank that comes with it) when
     several images load close together. */
  function wireImageLoad(scope) {
    scope.querySelectorAll("[data-media] > img[data-media-img]").forEach((img) => {
      const holder = img.parentElement;
      const markLoaded = () => holder.classList.add("is-loaded");
      if (img.complete && img.naturalWidth > 0) {
        markLoaded();
      } else {
        img.addEventListener("load", markLoaded, { once: true });
        img.addEventListener("error", markLoaded, { once: true });
      }
    });
  }

  /* ---------- Render: filters ---------- */
  function renderFilters() {
    filtersEl.innerHTML = FILTERS.map((name) => {
      const count =
        name === "All"
          ? PROJECTS.length
          : PROJECTS.filter((p) => p.categories.includes(name)).length;
      const dotColor = name === "All" ? "var(--muted)" : tagColor(name).fg;
      return `<button type="button" class="filter-btn${name === activeFilter ? " is-active" : ""}"
                data-filter="${name}" aria-pressed="${name === activeFilter}">
                <span class="filter-dot" style="background:${dotColor}"></span>
                ${name} <span style="opacity:.55">${count}</span>
              </button>`;
    }).join("");
  }

  /* ---------- Render: grid ---------- */
  function renderGrid() {
    const list =
      activeFilter === "All"
        ? PROJECTS
        : PROJECTS.filter((p) => p.categories.includes(activeFilter));

    gridEl.innerHTML = list
      .map((p, i) => {
        const tools = p.cardTools
          .slice(0, 4)
          .map((t) => `<li>${t}</li>`)
          .join("");
        const c = tagColor(p.category);

        return `
          <article class="project-card"
                   role="button"
                   tabindex="0"
                   data-id="${p.id}"
                   aria-label="Open case study: ${p.title}"
                   style="animation-delay:${i * 55}ms">
            <div class="card-media" data-media>
              <img class="card-media__img" data-media-img src="${p.image}" alt="${p.title} preview" loading="lazy" decoding="async" />
              <span class="card-media__tag" style="background:${c.bg};color:${c.fg};border-color:transparent;">${p.category}</span>
            </div>

            <div class="card-body">
              <div class="card-meta">
                <span>${p.period}</span>
                <span aria-hidden="true">·</span>
                <span>${p.platforms}</span>
              </div>

              <h3 class="card-title">${p.title}</h3>
              <p class="card-desc">${p.tagline}</p>

              <ul class="card-tools">${tools}</ul>

              <span class="card-cta">Read case study ${ARROW}</span>
            </div>
          </article>`;
      })
      .join("");

    wireImageLoad(gridEl);
  }

  /* ---------- Build: modal content ---------- */
  function buildCaseStudy(p) {
    const meta = [
      ["Role", p.role],
      ["Context", p.org],
      ["Timeline", p.period],
      ["Platforms", p.platforms]
    ]
      .map(
        ([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`
      )
      .join("");

    const summary = p.summary.map((s) => `<p>${s}</p>`).join("");

    const decisions = p.decisions
      .map((d) => `<li>${d}</li>`)
      .join("");

    const shots = p.screenshots
      .map(
        (shot, i) => `
          <figure class="case-shot" data-media role="button" tabindex="0"
                  data-index="${i}" aria-label="Enlarge screenshot: ${shot.label}">
            <img class="case-shot__img" data-media-img src="${shot.src}" alt="${shot.label} — ${p.title}" loading="lazy" decoding="async" />
            <figcaption>${shot.label}</figcaption>
          </figure>`
      )
      .join("");

    const stack = p.stack
      .map(
        (group) => `
          <div class="case-stack__row">
            <span class="case-stack__label">${group.label}</span>
            ${group.items
              .map((item) => `<span class="case-stack__chip">${item}</span>`)
              .join("")}
          </div>`
      )
      .join("");

    const links = [];
    if (p.links.live)
      links.push(
        `<a class="btn btn--ink" href="${p.links.live}" target="_blank" rel="noopener">Live demo ${EXTERNAL}</a>`
      );
    if (p.links.store)
      links.push(
        `<a class="btn btn--ink" href="${p.links.store}" target="_blank" rel="noopener">App Store ${EXTERNAL}</a>`
      );
    if (p.links.source)
      links.push(
        `<a class="btn btn--outline" href="${p.links.source}" target="_blank" rel="noopener">Source code ${EXTERNAL}</a>`
      );

    const c = tagColor(p.category);

    return `
      <div class="case-cover" data-media>
        <img class="case-cover__img" data-media-img src="${p.coverImage}" alt="${p.title} cover" loading="lazy" decoding="async" />
      </div>

      <header class="case-head">
        <span class="case-pill" style="background:${c.bg};color:${c.fg};border-color:transparent;">${p.category}</span>
        <h2 class="case-title" id="modal-title">${p.title}</h2>
        <p class="case-tagline">${p.tagline}</p>
        <dl class="case-meta">${meta}</dl>
      </header>

      <div class="case-body">
        <section class="case-section">
          <h3>Overview</h3>
          ${summary}
        </section>

        <section class="case-section">
          <h3>Engineering decisions</h3>
          <ul class="case-decisions">${decisions}</ul>
        </section>

        <section class="case-section">
          <h3>Architecture</h3>
          <p>${p.architecture}</p>
          <div class="case-shots">${shots}</div>
        </section>

        <section class="case-section">
          <h3>Stack</h3>
          <div class="case-stack">${stack}</div>
        </section>

        ${
          links.length
            ? `<div class="case-links">${links.join("")}</div>`
            : ""
        }
      </div>`;
  }

  /* ---------- Modal controls ---------- */
  function openModal(id) {
    const project = PROJECTS.find((p) => p.id === id);
    if (!project) return;

    activeProject = project;
    lastFocused = document.activeElement;
    modalContentEl.innerHTML = buildCaseStudy(project);
    modalContentEl.scrollTop = 0;
    wireImageLoad(modalContentEl);

    modalEl.classList.add("is-open");
    modalEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    modalPanelEl.focus({ preventScroll: true });
  }

  function closeModal() {
    modalEl.classList.remove("is-open");
    modalEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    activeProject = null;

    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus({ preventScroll: true });
    }
  }

  /* ---------- Focus trap (modal) ---------- */
  function trapFocus(e) {
    if (e.key !== "Tab" || !modalEl.classList.contains("is-open") || lightboxEl.classList.contains("is-open")) return;

    const focusables = modalPanelEl.querySelectorAll(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ---------- Lightbox controls ---------- */
  function openLightbox(index) {
    if (!activeProject || !activeProject.screenshots.length) return;
    lightboxIndex = index;
    lightboxLastFocused = document.activeElement;
    renderLightbox();
    lightboxEl.classList.add("is-open");
    lightboxEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    lightboxEl.querySelector(".lightbox__close").focus({ preventScroll: true });
  }

  function renderLightbox() {
    const shots = activeProject.screenshots;
    const shot = shots[lightboxIndex];
    if (!shot) return;
    lightboxImgEl.src = shot.src;
    lightboxImgEl.alt = `${shot.label} — ${activeProject.title}`;
    lightboxCaptionEl.textContent = `${shot.label} · ${lightboxIndex + 1} / ${shots.length}`;
    lightboxPrevBtn.disabled = lightboxIndex <= 0;
    lightboxNextBtn.disabled = lightboxIndex >= shots.length - 1;
  }

  function stepLightbox(dir) {
    if (!activeProject) return;
    const shots = activeProject.screenshots;
    const next = lightboxIndex + dir;
    if (next < 0 || next >= shots.length) return;
    lightboxIndex = next;
    renderLightbox();
  }

  function closeLightbox() {
    lightboxEl.classList.remove("is-open");
    lightboxEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    lightboxImgEl.src = "";
    if (lightboxLastFocused && typeof lightboxLastFocused.focus === "function") {
      lightboxLastFocused.focus({ preventScroll: true });
    }
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    // Filter clicks
    filtersEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if (!btn) return;
      activeFilter = btn.dataset.filter;
      renderFilters();
      renderGrid();
    });

    // Card open — click
    gridEl.addEventListener("click", (e) => {
      const card = e.target.closest(".project-card");
      if (card) openModal(card.dataset.id);
    });

    // Card open — keyboard
    gridEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".project-card");
      if (!card) return;
      e.preventDefault();
      openModal(card.dataset.id);
    });

    // Modal close (backdrop + button)
    modalEl.addEventListener("click", (e) => {
      if (e.target.closest("[data-modal-close]")) closeModal();
    });

    // Screenshot click/keyboard → open lightbox
    modalContentEl.addEventListener("click", (e) => {
      const shot = e.target.closest(".case-shot");
      if (shot) openLightbox(Number(shot.dataset.index));
    });
    modalContentEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const shot = e.target.closest(".case-shot");
      if (!shot) return;
      e.preventDefault();
      openLightbox(Number(shot.dataset.index));
    });

    // Lightbox close (backdrop + button) and nav (arrows)
    lightboxEl.addEventListener("click", (e) => {
      if (e.target.closest("[data-lightbox-close]")) closeLightbox();
      if (e.target.closest(".lightbox__prev")) stepLightbox(-1);
      if (e.target.closest(".lightbox__next")) stepLightbox(1);
    });

    // Keyboard: lightbox takes priority over the case-study modal
    document.addEventListener("keydown", (e) => {
      if (lightboxEl.classList.contains("is-open")) {
        if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); stepLightbox(-1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); stepLightbox(1); }
        return;
      }
      if (e.key === "Escape" && modalEl.classList.contains("is-open")) {
        closeModal();
      }
    });

    document.addEventListener("keydown", trapFocus);

    // Header shadow on scroll
    const header = document.getElementById("site-header");
    const onScroll = () =>
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Init ---------- */
  function init() {
    renderFilters();
    renderGrid();
    bindEvents();

    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
