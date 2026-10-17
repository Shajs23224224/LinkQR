import "./history-analytics.css";
import { HISTORY_STORAGE_KEY, loadHistory } from "./history-store.js";
import { summarizeHistory } from "./history-analytics.js";

let controller = null;

export function renderAnalyticsPage() {
  return `
    <div class="page-heading-row">
      <div>
        <p class="eyebrow"><span class="eyebrow-dot"></span> ANÁLISIS LOCAL</p>
        <h1 tabindex="-1">Estadísticas del historial</h1>
        <p class="page-description">Conoce la composición de tus códigos QR y la actividad reciente de este navegador.</p>
      </div>
      <span class="local-pill"><span aria-hidden="true"></span> Datos locales</span>
    </div>
    <div class="analytics-page-toolbar">
      <p class="analytics-updated-note">Las métricas se calculan a partir del historial local disponible.</p>
      <button class="button button-secondary" id="analytics-refresh" type="button">Actualizar estadísticas</button>
    </div>
    <p class="analytics-status" id="analytics-status" role="status" aria-live="polite" hidden></p>
    <div id="analytics-empty" class="analytics-empty" hidden>
      <span class="analytics-empty-icon" aria-hidden="true">▥</span>
      <h2>Aún no hay actividad para analizar</h2>
      <p>Genera o escanea un código QR y aparecerá aquí cuando el historial esté guardado.</p>
      <a class="button button-primary" href="#/generator">Crear un QR</a>
    </div>
    <div id="analytics-dashboard" class="analytics-dashboard">
      <section class="analytics-metric-grid" id="analytics-metrics" aria-label="Indicadores principales"></section>
      <section class="analytics-secondary-metrics" id="analytics-secondary" aria-label="Otros indicadores"></section>
      <div class="analytics-chart-grid">
        <section class="analytics-panel" aria-labelledby="analytics-source-title">
          <div class="analytics-panel-heading"><div><p class="section-index">COMPOSICIÓN</p><h2 id="analytics-source-title">Origen de los códigos</h2></div><span class="analytics-panel-icon" aria-hidden="true">⇄</span></div>
          <div class="analytics-bar-list" id="analytics-source-bars"></div>
        </section>
        <section class="analytics-panel" aria-labelledby="analytics-kind-title">
          <div class="analytics-panel-heading"><div><p class="section-index">CONTENIDO</p><h2 id="analytics-kind-title">Tipo de QR</h2></div><span class="analytics-panel-icon" aria-hidden="true">▦</span></div>
          <div class="analytics-bar-list" id="analytics-kind-bars"></div>
        </section>
        <section class="analytics-panel analytics-panel-wide" aria-labelledby="analytics-activity-title">
          <div class="analytics-panel-heading"><div><p class="section-index">ÚLTIMOS SIETE DÍAS</p><h2 id="analytics-activity-title">Actividad diaria</h2></div><span class="analytics-panel-aside" id="analytics-activity-total"></span></div>
          <div class="analytics-bar-list analytics-activity-bars" id="analytics-activity-bars"></div>
        </section>
        <section class="analytics-panel analytics-panel-wide" aria-labelledby="analytics-tags-title">
          <div class="analytics-panel-heading"><div><p class="section-index">ORGANIZACIÓN</p><h2 id="analytics-tags-title">Etiquetas más utilizadas</h2></div><a class="analytics-text-link" href="#/history">Gestionar historial ↗</a></div>
          <div class="analytics-bar-list" id="analytics-tag-bars"></div>
          <p class="analytics-no-tags" id="analytics-no-tags" hidden>Todavía no hay etiquetas. Añádelas desde el historial para organizar tus QR.</p>
        </section>
      </div>
      <p class="analytics-footnote">Las estadísticas se calculan únicamente con los registros guardados en este navegador (máximo actual: 200). No se envían a ningún servicio externo.</p>
    </div>
  `;
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}

function metricCard(label, value, note, tone = "") {
  const card = node("article", "analytics-metric-card" + (tone ? " " + tone : ""));
  card.append(node("span", "analytics-metric-label", label));
  card.append(node("strong", "analytics-metric-value", value));
  card.append(node("span", "analytics-metric-note", note));
  return card;
}

function renderBars(container, entries, maximum, { labelKey = "label", valueKey = "count", formatLabel = (value) => value, itemClass = "" } = {}) {
  container.replaceChildren();
  for (const entry of entries) {
    const row = node("div", "analytics-bar-row" + (itemClass ? " " + itemClass : ""));
    const heading = node("div", "analytics-bar-heading");
    heading.append(node("span", "analytics-bar-label", formatLabel(entry[labelKey])));
    heading.append(node("strong", "analytics-bar-value", entry[valueKey]));
    const track = node("div", "analytics-bar-track");
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", String(maximum || 0));
    track.setAttribute("aria-valuenow", String(entry[valueKey]));
    track.setAttribute("aria-label", formatLabel(entry[labelKey]) + ": " + entry[valueKey]);
    const fill = node("span", "analytics-bar-fill");
    const percent = maximum > 0 ? Math.max(0, Math.min(100, (entry[valueKey] / maximum) * 100)) : 0;
    fill.style.width = percent + "%";
    track.append(fill);
    row.append(heading, track);
    container.append(row);
  }
}

export function destroyAnalyticsPage() {
  controller?.abort();
  controller = null;
}

export function initAnalyticsPage() {
  destroyAnalyticsPage();
  controller = new AbortController();
  const { signal } = controller;
  const dashboard = document.querySelector("#analytics-dashboard");
  const metrics = document.querySelector("#analytics-metrics");
  const secondary = document.querySelector("#analytics-secondary");
  const status = document.querySelector("#analytics-status");
  const empty = document.querySelector("#analytics-empty");
  const refresh = document.querySelector("#analytics-refresh");
  const sourceBars = document.querySelector("#analytics-source-bars");
  const kindBars = document.querySelector("#analytics-kind-bars");
  const activityBars = document.querySelector("#analytics-activity-bars");
  const activityTotal = document.querySelector("#analytics-activity-total");
  const tagBars = document.querySelector("#analytics-tag-bars");
  const noTags = document.querySelector("#analytics-no-tags");
  if (!(dashboard instanceof HTMLElement) || !(metrics instanceof HTMLElement) ||
      !(secondary instanceof HTMLElement) || !(status instanceof HTMLParagraphElement) ||
      !(empty instanceof HTMLElement) || !(refresh instanceof HTMLButtonElement) ||
      !(sourceBars instanceof HTMLElement) || !(kindBars instanceof HTMLElement) ||
      !(activityBars instanceof HTMLElement) || !(activityTotal instanceof HTMLElement) ||
      !(tagBars instanceof HTMLElement) || !(noTags instanceof HTMLParagraphElement)) return;

  function render() {
    const result = loadHistory();
    status.hidden = result.ok;
    status.textContent = result.ok ? "" : (result.error || "No se pudo cargar el historial local.");
    status.classList.toggle("is-error", !result.ok);
    const summary = summarizeHistory(result.ok ? result.items : []);
    dashboard.hidden = !result.ok;
    empty.hidden = !result.ok || summary.total > 0;
    if (!result.ok) return;

    metrics.replaceChildren(
      metricCard("Registros guardados", summary.total, "Elementos del historial", "analytics-metric-brand"),
      metricCard("Generados", summary.generated, "Creados en LinkQR", "analytics-metric-blue"),
      metricCard("Escaneados", summary.scanned, "Leídos desde cámara o imagen", "analytics-metric-green"),
      metricCard("Favoritos", summary.favorites, summary.favoriteRate + "% del historial", "analytics-metric-amber")
    );
    secondary.replaceChildren(
      metricCard("URLs", summary.urls, "QR con direcciones web"),
      metricCard("Textos", summary.texts, "QR con texto libre"),
      metricCard("Etiquetados", summary.tagged, "Registros con al menos una etiqueta"),
      metricCard("Etiquetas distintas", summary.distinctTagCount, summary.untagged + " registros sin etiquetas")
    );
    renderBars(sourceBars, [
      { label: "Generados", count: summary.generated },
      { label: "Escaneados", count: summary.scanned },
    ], Math.max(summary.generated, summary.scanned));
    renderBars(kindBars, [
      { label: "Direcciones URL", count: summary.urls },
      { label: "Texto libre", count: summary.texts },
    ], Math.max(summary.urls, summary.texts));
    renderBars(activityBars, summary.activity.map((day) => ({ label: day.label, count: day.count, date: day.date })), summary.maxDailyActivity);
    activityTotal.textContent = summary.activity.reduce((total, day) => total + day.count, 0) + " registros en el período";
    renderBars(tagBars, summary.topTags, Math.max(0, ...summary.topTags.map((tag) => tag.count)), {
      labelKey: "tag",
      formatLabel: (value) => "#" + value,
    });
    noTags.hidden = summary.topTags.length > 0;
  }

  refresh.addEventListener("click", render, { signal });
  window.addEventListener("linkqr:history-updated", render, { signal });
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === HISTORY_STORAGE_KEY) render();
  }, { signal });
  render();
}
