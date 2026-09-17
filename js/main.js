/* ==========================================================================
   Main script
   - Renders the filter bar + project grid from data.js
   - Handles filtering
   - Builds and controls the case-study modal
   - Small UI niceties (header shadow, year)
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

  let activeFilter = "All";
  let lastFocused = null;

  /* ---------- Render: filters ---------- */
  function renderFilters() {
    filtersEl.innerHTML = FILTERS.map((name) => {
      const count =
        name === "All"
          ? PROJECTS.length
          : PROJECTS.filter((p) => p.categories.includes(name)).length;
      return `<button type="button" class="filter-btn${name === activeFilter ? " is-active" : ""}"
                data-filter="${name}" aria-pressed="${name === activeFilter}">
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

        return `
          <article class="project-card"
                   role="button"
                   tabindex="0"
                   data-id="${p.id}"
                   aria-label="Open case study: ${p.title}"
                   style="animation-delay:${i * 55}ms">
            <div class="card-media">
              <img class="card-media__img" src="${p.image}" alt="${p.title} preview" loading="lazy" />
              <span class="card-media__tag">${p.category}</span>
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
        (shot) => `
          <figure class="case-shot">
            <img class="case-shot__img" src="${shot.src}" alt="${shot.label} — ${p.title}" loading="lazy" />
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

    return `
      <div class="case-cover">
        <img class="case-cover__img" src="${p.coverImage}" alt="${p.title} cover" loading="lazy" />
      </div>

      <header class="case-head">
        <span class="case-pill">${p.category}</span>
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

    lastFocused = document.activeElement;
    modalContentEl.innerHTML = buildCaseStudy(project);
    modalContentEl.scrollTop = 0;

    modalEl.classList.add("is-open");
    modalEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    modalPanelEl.focus({ preventScroll: true });
  }

  function closeModal() {
    modalEl.classList.remove("is-open");
    modalEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus({ preventScroll: true });
    }
  }

  /* ---------- Focus trap ---------- */
  function trapFocus(e) {
    if (e.key !== "Tab" || !modalEl.classList.contains("is-open")) return;

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

    // Escape closes
    document.addEventListener("keydown", (e) => {
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