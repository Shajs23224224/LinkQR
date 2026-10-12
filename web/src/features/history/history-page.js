import "./history.css";
import {
  clearHistory,
  deleteHistoryRecord,
  loadHistory,
  toggleHistoryFavorite,
} from "./history-store.js";

let controller = null;

export function renderHistoryPage({ favoritesOnly = false } = {}) {
  const title = favoritesOnly ? "Tus favoritos" : "Historial de códigos";
  const description = favoritesOnly
    ? "Accede rápidamente a los códigos que has marcado como favoritos."
    : "Consulta y organiza los QR generados o escaneados en este navegador.";
  const filter = favoritesOnly ? "" : '<div class="form-field history-filter-field"><label for="history-source-filter">Origen</label><select id="history-source-filter" class="history-source-filter"><option value="all">Todos</option><option value="generated">Generados</option><option value="scanned">Escaneados</option></select></div>';
  const clear = favoritesOnly ? "" : '<button class="button button-secondary history-clear-button" id="history-clear-button" type="button">Borrar todo</button>';

  return [
    '<div class="page-heading-row"><div><p class="eyebrow"><span class="eyebrow-dot"></span> TU ESPACIO LOCAL</p><h1 tabindex="-1">' + title + '</h1><p class="page-description">' + description + '</p></div><span class="local-pill"><span aria-hidden="true"></span> Solo este navegador</span></div>',
    '<section class="history-page-panel" aria-label="' + title + '"><div class="history-toolbar">',
    '<div class="form-field history-search-field"><label for="history-search">Buscar por contenido</label><input id="history-search" class="history-search" type="search" placeholder="Buscar URL o texto…" autocomplete="off" /></div>',
    filter, clear, '</div>',
    '<p class="history-storage-message" id="history-storage-message" role="status" aria-live="polite" hidden></p>',
    '<div class="history-summary-row"><p id="history-summary" class="history-summary" aria-live="polite"></p><span class="history-local-label">Guardado local</span></div>',
    '<p class="history-action-status" id="history-action-status" role="status" aria-live="polite"></p><div class="history-record-list" id="history-record-list"></div>',
    '<div class="history-empty-state" id="history-empty-state" hidden><span class="history-empty-icon" aria-hidden="true">' + (favoritesOnly ? "♡" : "◷") + '</span><h2 id="history-empty-title"></h2><p id="history-empty-description"></p>',
    favoritesOnly ? '<a class="button button-primary" href="#/history">Ver historial completo</a>' : '<a class="button button-primary" href="#/generator">Crear un QR</a>',
    '</div></section>',
  ].filter(Boolean).join("\n");
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value.trim());
    if (["http:", "https:"].includes(url.protocol) && url.hostname && !url.username && !url.password) return url.href;
  } catch {}
  return null;
}

function actionButton(label, action, id, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-secondary " + extraClass;
  button.dataset.action = action;
  button.dataset.recordId = id;
  button.textContent = label;
  return button;
}

function renderRecord(record) {
  const card = document.createElement("article");
  card.className = "history-record";
  card.dataset.recordId = record.id;

  const header = document.createElement("div");
  header.className = "history-record-header";
  const tags = document.createElement("div");
  tags.className = "history-record-tags";

  const source = document.createElement("span");
  source.className = "history-record-tag " + (record.source === "generated" ? "tag-generated" : "tag-scanned");
  source.textContent = record.source === "generated" ? "Generado" : "Escaneado";
  const kind = document.createElement("span");
  kind.className = "history-record-tag";
  kind.textContent = record.kind === "url" ? "URL" : "Texto";
  tags.append(source, kind);

  const date = document.createElement("time");
  date.className = "history-record-date";
  date.dateTime = record.createdAt;
  const parsedDate = new Date(record.createdAt);
  date.textContent = Number.isNaN(parsedDate.getTime())
    ? "Fecha desconocida"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsedDate);
  header.append(tags, date);

  const content = document.createElement("p");
  content.className = "history-record-content";
  content.textContent = record.content;
  content.title = record.content;

  const actions = document.createElement("div");
  actions.className = "history-record-actions";
  const favorite = actionButton(
    record.favorite ? "★ Favorito" : "☆ Favorito",
    "favorite",
    record.id,
    "history-favorite-button" + (record.favorite ? " is-favorite" : "")
  );
  favorite.setAttribute("aria-pressed", String(record.favorite));
  favorite.setAttribute("aria-label", record.favorite ? "Quitar de favoritos" : "Añadir a favoritos");
  actions.append(favorite, actionButton("Copiar", "copy", record.id));

  const url = safeHttpUrl(record.content);
  if (url) {
    const link = document.createElement("a");
    link.className = "button button-secondary";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Abrir enlace ↗";
    actions.append(link);
  }
  actions.append(actionButton("Eliminar", "delete", record.id, "history-delete-button"));
  card.append(header, content, actions);
  return card;
}

export function destroyHistoryPage() {
  controller?.abort();
  controller = null;
}

export function initHistoryPage({ favoritesOnly = false } = {}) {
  destroyHistoryPage();
  controller = new AbortController();
  const { signal } = controller;

  const search = document.querySelector("#history-search");
  const filter = document.querySelector("#history-source-filter");
  const clear = document.querySelector("#history-clear-button");
  const storageMessage = document.querySelector("#history-storage-message");
  const summary = document.querySelector("#history-summary");
  const status = document.querySelector("#history-action-status");
  const list = document.querySelector("#history-record-list");
  const empty = document.querySelector("#history-empty-state");
  const emptyTitle = document.querySelector("#history-empty-title");
  const emptyDescription = document.querySelector("#history-empty-description");

  if (!(search instanceof HTMLInputElement) ||
      !(storageMessage instanceof HTMLParagraphElement) ||
      !(summary instanceof HTMLParagraphElement) ||
      !(status instanceof HTMLParagraphElement) ||
      !(list instanceof HTMLElement) ||
      !(empty instanceof HTMLElement) ||
      !(emptyTitle instanceof HTMLHeadingElement) ||
      !(emptyDescription instanceof HTMLParagraphElement) ||
      (!favoritesOnly && !(filter instanceof HTMLSelectElement))) return;

  function render() {
    const data = loadHistory();
    storageMessage.hidden = data.ok;
    storageMessage.textContent = data.ok ? "" : (data.error || "No se pudo leer el historial local.");
    storageMessage.classList.toggle("is-error", !data.ok);

    const all = data.ok ? data.items : [];
    const query = search.value.trim().toLocaleLowerCase();
    const origin = favoritesOnly ? "all" : filter.value;
    const records = all
      .filter((item) => !favoritesOnly || item.favorite)
      .filter((item) => origin === "all" || item.source === origin)
      .filter((item) => !query || item.content.toLocaleLowerCase().includes(query));

    list.replaceChildren(...records.map(renderRecord));
    summary.textContent = favoritesOnly
      ? records.length + " favorito" + (records.length === 1 ? "" : "s")
      : records.length + " de " + all.length + " registros";
    empty.hidden = records.length > 0;

    if (!records.length) {
      if (query || origin !== "all") {
        emptyTitle.textContent = "No se encontraron coincidencias";
        emptyDescription.textContent = "Prueba con otra búsqueda o cambia el filtro.";
      } else if (favoritesOnly) {
        emptyTitle.textContent = "Todavía no tienes favoritos";
        emptyDescription.textContent = "Marca como favorito cualquier registro para encontrarlo aquí.";
      } else {
        emptyTitle.textContent = "El historial está vacío";
        emptyDescription.textContent = "Los QR generados y escaneados se guardarán automáticamente en este navegador.";
      }
    }
  }

  const say = (message) => { status.textContent = message; };
  search.addEventListener("input", render, { signal });
  filter?.addEventListener("change", render, { signal });
  window.addEventListener("linkqr:history-updated", render, { signal });
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === "linkqr.history.v1") render();
  }, { signal });

  clear?.addEventListener("click", () => {
    const data = loadHistory();
    if (!data.ok) { say(data.error); return; }
    if (!data.items.length) { say("No hay registros que borrar."); return; }
    if (!window.confirm("¿Borrar todo el historial de este navegador? Los favoritos también se eliminarán.")) return;
    const result = clearHistory();
    say(result.ok ? "Se borró el historial local." : result.error);
    render();
  }, { signal });

  list.addEventListener("click", async (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button[data-action][data-record-id]");
    if (!(button instanceof HTMLButtonElement)) return;
    const id = button.dataset.recordId;
    const action = button.dataset.action;
    if (!id) return;

    if (action === "favorite") {
      const result = toggleHistoryFavorite(id);
      say(result.ok ? (result.favorite ? "Añadido a favoritos." : "Quitado de favoritos.") : result.error);
      render();
      return;
    }
    if (action === "delete") {
      const result = deleteHistoryRecord(id);
      say(result.ok ? "Registro eliminado." : result.error);
      render();
      return;
    }
    if (action === "copy") {
      const data = loadHistory();
      const record = data.ok ? data.items.find((item) => item.id === id) : null;
      if (!record) { say("El registro ya no está disponible."); render(); return; }
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(record.content);
        say("Contenido copiado al portapapeles.");
      } catch {
        say("No se pudo copiar automáticamente; selecciona el texto del registro para copiarlo.");
      }
    }
  }, { signal });

  render();
}
