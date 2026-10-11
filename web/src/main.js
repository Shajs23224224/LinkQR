import { appConfig } from "./config.js";

const view = document.querySelector("#page-view");
const breadcrumbCurrent = document.querySelector("#breadcrumb-current");
const sidebar = document.querySelector("#sidebar");
const sidebarOverlay = document.querySelector("#sidebar-overlay");
const menuToggle = document.querySelector("#menu-toggle");

const routeDefinitions = {
  home: {
    label: "Inicio",
    title: "Tu espacio QR",
    render: renderHome,
  },
  generator: {
    label: "Crear QR",
    title: "Generador QR",
    phase: "Fase 5",
    description: "Aquí estará el flujo para crear códigos QR, validar contenido y mostrar una vista previa.",
  },
  scanner: {
    label: "Escáner",
    title: "Escáner QR",
    phase: "Fase 7",
    description: "Esta sección incorporará la lectura de códigos QR mediante la cámara o una imagen compatible.",
  },
  history: {
    label: "Historial",
    title: "Historial de códigos",
    phase: "Fase 8",
    description: "Aquí podrás consultar los códigos guardados, revisar detalles y gestionar registros locales.",
  },
  favorites: {
    label: "Favoritos",
    title: "Tus favoritos",
    phase: "Fase 8",
    description: "Esta vista reunirá los códigos que marques como favoritos cuando el almacenamiento esté implementado.",
  },
  settings: {
    label: "Ajustes",
    title: "Ajustes de LinkQR",
    phase: "Fase 11",
    description: "Esta sección reunirá las preferencias de la aplicación y, más adelante, las opciones de cuenta y sincronización.",
  },
};

function renderHome() {
  return `
    <div class="page-heading-row">
      <div>
        <p class="eyebrow"><span class="eyebrow-dot"></span> ESPACIO DE TRABAJO</p>
        <h1 tabindex="-1">Tu espacio QR</h1>
        <p class="page-description">Crea, consulta y organiza tus códigos QR desde un solo lugar.</p>
      </div>
      <span class="local-pill"><span aria-hidden="true"></span> Espacio local</span>
    </div>

    <section class="welcome-card" aria-labelledby="welcome-title">
      <div class="welcome-copy">
        <span class="welcome-kicker">BIENVENIDO A LINKQR</span>
        <h2 id="welcome-title">Tus ideas, listas<br />para convertirse en QR.</h2>
        <p>Empieza con una dirección web, un texto o la información que quieras compartir. Las herramientas se habilitarán fase por fase.</p>
        <a class="button button-primary" href="#/generator">Preparar un código QR <span aria-hidden="true">→</span></a>
      </div>
      <div class="welcome-art" aria-hidden="true">
        <div class="art-orbit art-orbit-one"></div>
        <div class="art-orbit art-orbit-two"></div>
        <div class="art-qr">
          <span class="art-finder finder-top-left"></span><span class="art-finder finder-top-right"></span><span class="art-finder finder-bottom-left"></span>
          <span class="art-pixel pixel-one"></span><span class="art-pixel pixel-two"></span><span class="art-pixel pixel-three"></span><span class="art-pixel pixel-four"></span><span class="art-pixel pixel-five"></span><span class="art-pixel pixel-six"></span><span class="art-pixel pixel-seven"></span><span class="art-pixel pixel-eight"></span><span class="art-pixel pixel-nine"></span><span class="art-pixel pixel-ten"></span>
          <span class="art-center">+</span>
        </div>
        <span class="art-float art-float-one">Link</span><span class="art-float art-float-two">↗</span>
      </div>
    </section>

    <section class="section-block" aria-labelledby="tools-title">
      <div class="section-heading">
        <div><p class="section-index">TU CAJA DE HERRAMIENTAS</p><h2 id="tools-title">Accesos rápidos</h2></div>
        <span class="section-note">Funciones en preparación</span>
      </div>
      <div class="quick-grid">
        <a class="quick-card quick-card-primary" href="#/generator">
          <span class="quick-icon quick-icon-brand" aria-hidden="true">▦</span>
          <span class="quick-card-copy"><strong>Crear un QR</strong><small>Prepara un nuevo código</small></span>
          <span class="quick-arrow" aria-hidden="true">↗</span>
          <span class="quick-card-state">Siguiente fase</span>
        </a>
        <a class="quick-card" href="#/scanner">
          <span class="quick-icon" aria-hidden="true">⌗</span>
          <span class="quick-card-copy"><strong>Escanear un QR</strong><small>Abre la herramienta de lectura</small></span>
          <span class="quick-arrow" aria-hidden="true">↗</span>
          <span class="quick-card-state">Fase 7</span>
        </a>
        <a class="quick-card" href="#/history">
          <span class="quick-icon" aria-hidden="true">◷</span>
          <span class="quick-card-copy"><strong>Ver historial</strong><small>Consulta códigos guardados</small></span>
          <span class="quick-arrow" aria-hidden="true">↗</span>
          <span class="quick-card-state">Fase 8</span>
        </a>
      </div>
    </section>

    <section class="section-block" aria-labelledby="status-title">
      <div class="section-heading">
        <div><p class="section-index">ESTADO DEL ESPACIO</p><h2 id="status-title">Todo bajo control</h2></div>
      </div>
      <div class="overview-grid">
        <article class="overview-card">
          <span class="overview-icon" aria-hidden="true">▦</span>
          <span class="overview-label">Códigos QR</span>
          <strong class="overview-value">En preparación</strong>
          <span class="overview-foot">Generación prevista en Fase 5</span>
        </article>
        <article class="overview-card">
          <span class="overview-icon overview-icon-green" aria-hidden="true">◉</span>
          <span class="overview-label">Almacenamiento</span>
          <strong class="overview-value">No conectado</strong>
          <span class="overview-foot">Persistencia local en Fase 8</span>
        </article>
        <article class="overview-card">
          <span class="overview-icon overview-icon-amber" aria-hidden="true">↗</span>
          <span class="overview-label">Sincronización</span>
          <strong class="overview-value">No configurada</strong>
          <span class="overview-foot">Integración backend en fases posteriores</span>
        </article>
      </div>
    </section>
    <p class="page-footnote"><span aria-hidden="true">ⓘ</span> Esta versión muestra la estructura de navegación. La creación, lectura y guardado real de QR todavía no están activados.</p>
  `;
}

function renderPlaceholder(route) {
  return `
    <div class="page-heading-row">
      <div>
        <p class="eyebrow"><span class="eyebrow-dot"></span> LINKQR · HERRAMIENTAS</p>
        <h1 tabindex="-1">${route.title}</h1>
        <p class="page-description">${route.description}</p>
      </div>
      <span class="phase-pill">${route.phase}</span>
    </div>
    <section class="placeholder-panel">
      <div class="placeholder-illustration" aria-hidden="true">
        <span class="placeholder-shape shape-one"></span><span class="placeholder-shape shape-two"></span><span class="placeholder-symbol">${route.label === "Ajustes" ? "⚙" : route.label === "Escáner" ? "⌗" : route.label === "Historial" ? "◷" : route.label === "Favoritos" ? "♡" : "▦"}</span>
      </div>
      <div class="placeholder-copy">
        <span class="status-pill status-neutral">Vista preparada</span>
        <h2>Esta herramienta llegará en la ${route.phase.toLowerCase()}.</h2>
        <p>La navegación ya está conectada. La funcionalidad se añadirá en su fase correspondiente para evitar mostrar acciones que todavía no funcionan.</p>
        <a class="button button-primary" href="#/home">Volver al inicio <span aria-hidden="true">→</span></a>
      </div>
    </section>
  `;
}

function getCurrentRoute() {
  const routeName = window.location.hash.replace(/^#\/?/, "").trim() || "home";
  return Object.hasOwn(routeDefinitions, routeName) ? routeName : "home";
}

function closeMobileNavigation() {
  sidebar?.classList.remove("is-open");
  if (sidebarOverlay) sidebarOverlay.hidden = true;
  menuToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-label", "Abrir menú");
  document.body.classList.remove("menu-open");
}

function renderRoute({ moveFocus = false } = {}) {
  if (!view) return;

  const routeName = getCurrentRoute();
  const route = routeDefinitions[routeName];
  view.innerHTML = routeName === "home" ? route.render() : renderPlaceholder(route);

  document.querySelectorAll("[data-route]").forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    if (link.dataset.route === routeName) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    } else {
      link.classList.remove("is-active");
      link.removeAttribute("aria-current");
    }
  });

  if (breadcrumbCurrent) breadcrumbCurrent.textContent = route.label;
  document.title = `${route.label} · ${appConfig.appName}`;
  closeMobileNavigation();

  if (moveFocus) {
    view.querySelector("h1")?.focus({ preventScroll: true });
  }
}

function openMobileNavigation() {
  if (!sidebar || !sidebarOverlay || !menuToggle) return;
  sidebar.classList.add("is-open");
  sidebarOverlay.hidden = false;
  menuToggle.setAttribute("aria-expanded", "true");
  menuToggle.setAttribute("aria-label", "Cerrar menú");
  document.body.classList.add("menu-open");
  sidebar.querySelector(".is-active")?.focus({ preventScroll: true });
}

menuToggle?.addEventListener("click", () => {
  if (sidebar?.classList.contains("is-open")) closeMobileNavigation();
  else openMobileNavigation();
});

sidebarOverlay?.addEventListener("click", closeMobileNavigation);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobileNavigation();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const routeLink = target.closest("[data-route-link]");
  if (routeLink instanceof HTMLElement && routeLink.dataset.routeLink) {
    window.location.hash = `/${routeLink.dataset.routeLink}`;
  }
});

window.addEventListener("hashchange", () => renderRoute({ moveFocus: true }));

document.documentElement.dataset.app = "linkqr";
document.documentElement.dataset.version = appConfig.appVersion;

if (!window.location.hash) {
  window.history.replaceState(null, "", "#/home");
}
renderRoute();
