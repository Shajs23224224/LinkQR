import "./history.css";
import { MAX_QR_PAYLOAD_BYTES } from "../generator/validation.js";
import { saveGeneratorDraft } from "../generator/generator-draft.js";
import {
  clearHistory,
  createHistoryBackup,
  deleteHistoryRecord,
  deleteHistoryRecords,
  HISTORY_BACKUP_FORMAT,
  HISTORY_BACKUP_VERSION,
  importHistoryBackup,
  loadHistory,
  MAX_HISTORY_BACKUP_BYTES,
  MAX_HISTORY_TAG_LENGTH,
  MAX_HISTORY_TAGS_PER_RECORD,
  setHistoryFavorites,
  updateHistoryTags,
  updateHistoryTagsForRecords,
  toggleHistoryFavorite,
  validateHistoryBackup,
} from "./history-store.js";

let controller = null;

export function renderHistoryPage({ favoritesOnly = false } = {}) {
  const title = favoritesOnly ? "Tus favoritos" : "Historial de códigos";
  const description = favoritesOnly
    ? "Accede rápidamente a los códigos que has marcado como favoritos."
    : "Consulta y organiza los QR generados o escaneados en este navegador.";
  const filter = (favoritesOnly ? "" : '<div class="form-field history-filter-field"><label for="history-source-filter">Origen</label><select id="history-source-filter" class="history-source-filter"><option value="all">Todos</option><option value="generated">Generados</option><option value="scanned">Escaneados</option></select></div>') + '<div class="form-field history-filter-field"><label for="history-tag-filter">Etiqueta</label><select id="history-tag-filter" class="history-source-filter"><option value="all">Todas las etiquetas</option></select></div>';
  const clear = favoritesOnly ? "" : '<button class="button button-secondary history-clear-button" id="history-clear-button" type="button">Borrar todo</button>';
  const backupTools = favoritesOnly ? "" : '<section class="history-backup-panel" aria-label="Copias de seguridad"><div class="history-backup-copy"><h2>Copias de seguridad</h2><p>Guarda una copia JSON o restaura registros desde un archivo exportado por LinkQR.</p></div><div class="history-backup-actions"><button class="button button-secondary" id="history-export-button" type="button">Exportar JSON</button><label class="button button-secondary history-import-label" for="history-import-file">Importar JSON<input id="history-import-file" type="file" accept=".json,application/json" hidden /></label><div class="form-field history-import-mode-field"><label for="history-import-mode">Al importar</label><select id="history-import-mode" class="history-source-filter"><option value="merge">Combinar con historial</option><option value="replace">Reemplazar historial</option></select></div></div></section>';

  return [
    '<div class="page-heading-row"><div><p class="eyebrow"><span class="eyebrow-dot"></span> TU ESPACIO LOCAL</p><h1 tabindex="-1">' + title + '</h1><p class="page-description">' + description + '</p></div><span class="local-pill"><span aria-hidden="true"></span> Solo este navegador</span></div>',
    backupTools,
    '<section class="history-page-panel" aria-label="' + title + '"><div class="history-toolbar">',
    '<div class="form-field history-search-field"><label for="history-search">Buscar por contenido</label><input id="history-search" class="history-search" type="search" placeholder="Buscar URL o texto…" autocomplete="off" /></div>',
    filter, clear, '</div>',
    '<p class="history-storage-message" id="history-storage-message" role="status" aria-live="polite" hidden></p>',
    '<div class="history-summary-row"><p id="history-summary" class="history-summary" aria-live="polite"></p><span class="history-local-label">Guardado local</span></div>',
    '<section class="history-bulk-panel" aria-label="Selección múltiple y acciones masivas">',
    '<label class="history-select-all"><input id="history-select-all" type="checkbox" /> <span>Seleccionar resultados visibles</span></label>',
    '<p class="history-selection-count" id="history-selection-count" aria-live="polite">0 seleccionados</p>',
    '<div class="history-bulk-actions">',
    '<button class="button button-secondary" id="history-bulk-favorite" type="button" disabled>Marcar favoritos</button>',
    '<button class="button button-secondary" id="history-bulk-unfavorite" type="button" disabled>Quitar favoritos</button>',
    '<button class="button button-secondary" id="history-bulk-copy" type="button" disabled>Copiar contenido</button>',
    '<button class="button button-secondary" id="history-bulk-export" type="button" disabled>Exportar selección JSON</button>',
    '<button class="button button-secondary history-delete-button" id="history-bulk-delete" type="button" disabled>Eliminar selección</button>',
    '</div><div class="history-bulk-tag-tools"><div class="form-field"><label for="history-bulk-tags">Etiquetas para la selección (separadas por comas)</label><input id="history-bulk-tags" type="text" maxlength="' + (MAX_HISTORY_TAGS_PER_RECORD * (MAX_HISTORY_TAG_LENGTH + 1) - 1) + '" placeholder="trabajo, personal, compartir" autocomplete="off" /></div><button class="button button-secondary" id="history-bulk-tags-add" type="button" disabled>Añadir etiquetas</button><button class="button button-secondary" id="history-bulk-tags-remove" type="button" disabled>Quitar etiquetas</button></div></section>',
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

function renderRecord(record, selected = false) {
  const card = document.createElement("article");
  card.className = "history-record";
  card.dataset.recordId = record.id;
  card.classList.toggle("is-selected", selected);

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
  for (const tag of record.tags ?? []) {
    const customTag = document.createElement("span");
    customTag.className = "history-record-tag tag-custom";
    customTag.textContent = tag;
    tags.append(customTag);
  }

  const date = document.createElement("time");
  date.className = "history-record-date";
  date.dateTime = record.createdAt;
  const parsedDate = new Date(record.createdAt);
  date.textContent = Number.isNaN(parsedDate.getTime())
    ? "Fecha desconocida"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsedDate);
  const selectLabel = document.createElement("label");
  selectLabel.className = "history-record-select";
  const selectInput = document.createElement("input");
  selectInput.type = "checkbox";
  selectInput.checked = selected;
  selectInput.dataset.recordSelect = "true";
  selectInput.dataset.recordId = record.id;
  selectInput.setAttribute("aria-label", "Seleccionar registro: " + record.content.slice(0, 80));
  const selectText = document.createElement("span");
  selectText.textContent = "Seleccionar";
  selectLabel.append(selectInput, selectText);
  header.append(selectLabel, tags, date);

  const content = document.createElement("p");
  content.className = "history-record-content";
  content.textContent = record.content;
  content.title = record.content;

  const editor = document.createElement("form");
  editor.className = "history-tag-editor";
  editor.hidden = true;
  editor.dataset.tagEditor = "true";
  editor.dataset.recordId = record.id;
  const editorLabel = document.createElement("label");
  editorLabel.htmlFor = "history-tags-" + record.id;
  editorLabel.textContent = "Etiquetas (separadas por comas)";
  const editorInput = document.createElement("input");
  editorInput.id = editorLabel.htmlFor;
  editorInput.type = "text";
  editorInput.value = (record.tags ?? []).join(", ");
  editorInput.maxLength = MAX_HISTORY_TAGS_PER_RECORD * (MAX_HISTORY_TAG_LENGTH + 1) - 1;
  editorInput.placeholder = "trabajo, personal, compartir";
  editorInput.autocomplete = "off";
  editorInput.dataset.tagInput = "true";
  const editorHelp = document.createElement("p");
  editorHelp.textContent = "Hasta " + MAX_HISTORY_TAGS_PER_RECORD + " etiquetas de " + MAX_HISTORY_TAG_LENGTH + " caracteres. No distingue mayúsculas.";
  const editorActions = document.createElement("div");
  editorActions.className = "history-tag-editor-actions";
  const saveTags = document.createElement("button");
  saveTags.type = "submit";
  saveTags.className = "button button-secondary";
  saveTags.textContent = "Guardar etiquetas";
  const cancelTags = actionButton("Cancelar", "cancel-tags", record.id);
  editorActions.append(saveTags, cancelTags);
  editor.append(editorLabel, editorInput, editorHelp, editorActions);

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
  actions.append(actionButton("Etiquetas", "edit-tags", record.id), favorite, actionButton("Copiar", "copy", record.id));
  if (new TextEncoder().encode(record.content).byteLength <= MAX_QR_PAYLOAD_BYTES) {
    actions.append(actionButton("Recrear QR", "regenerate", record.id, "history-regenerate-button"));
  }

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
  card.append(header, content, editor, actions);
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
  const tagFilter = document.querySelector("#history-tag-filter");
  const clear = document.querySelector("#history-clear-button");
  const exportButton = document.querySelector("#history-export-button");
  const importFile = document.querySelector("#history-import-file");
  const importMode = document.querySelector("#history-import-mode");
  const selectAll = document.querySelector("#history-select-all");
  const selectionCount = document.querySelector("#history-selection-count");
  const bulkFavorite = document.querySelector("#history-bulk-favorite");
  const bulkUnfavorite = document.querySelector("#history-bulk-unfavorite");
  const bulkCopy = document.querySelector("#history-bulk-copy");
  const bulkExport = document.querySelector("#history-bulk-export");
  const bulkDelete = document.querySelector("#history-bulk-delete");
  const bulkTagsInput = document.querySelector("#history-bulk-tags");
  const bulkTagsAdd = document.querySelector("#history-bulk-tags-add");
  const bulkTagsRemove = document.querySelector("#history-bulk-tags-remove");
  const storageMessage = document.querySelector("#history-storage-message");
  const summary = document.querySelector("#history-summary");
  const status = document.querySelector("#history-action-status");
  const selectedIds = new Set();
  let visibleRecords = [];
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
      (!favoritesOnly && !(filter instanceof HTMLSelectElement)) ||
      !(tagFilter instanceof HTMLSelectElement)) return;

  function render() {
    const data = loadHistory();
    storageMessage.hidden = data.ok;
    storageMessage.textContent = data.ok ? "" : (data.error || "No se pudo leer el historial local.");
    storageMessage.classList.toggle("is-error", !data.ok);

    const all = data.ok ? data.items : [];
    const previousTag = tagFilter.value;
    const availableTags = [...new Set(all.flatMap((item) => item.tags ?? []))].sort((a, b) => a.localeCompare(b));
    tagFilter.replaceChildren(new Option("Todas las etiquetas", "all"), ...availableTags.map((tag) => new Option(tag, tag)));
    tagFilter.value = availableTags.includes(previousTag) ? previousTag : "all";
    const availableIds = new Set(all.map((item) => item.id));
    for (const id of selectedIds) if (!availableIds.has(id)) selectedIds.delete(id);
    const query = search.value.trim().toLocaleLowerCase();
    const origin = favoritesOnly ? "all" : filter.value;
    const selectedTag = tagFilter.value;
    const records = all
      .filter((item) => !favoritesOnly || item.favorite)
      .filter((item) => origin === "all" || item.source === origin)
      .filter((item) => selectedTag === "all" || (item.tags ?? []).includes(selectedTag))
      .filter((item) => !query || item.content.toLocaleLowerCase().includes(query));

    visibleRecords = records;
    list.replaceChildren(...records.map((item) => renderRecord(item, selectedIds.has(item.id))));
    const selectedVisibleCount = records.filter((item) => selectedIds.has(item.id)).length;
    if (selectAll) {
      selectAll.checked = records.length > 0 && selectedVisibleCount === records.length;
      selectAll.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < records.length;
      selectAll.disabled = records.length === 0;
    }
    if (selectionCount) {
      selectionCount.textContent = selectedIds.size + " seleccionado" + (selectedIds.size === 1 ? "" : "s");
    }
    [bulkFavorite, bulkUnfavorite, bulkCopy, bulkExport, bulkDelete, bulkTagsAdd, bulkTagsRemove].forEach((button) => {
      if (button instanceof HTMLButtonElement) button.disabled = selectedIds.size === 0;
    });
    summary.textContent = favoritesOnly
      ? records.length + " favorito" + (records.length === 1 ? "" : "s")
      : records.length + " de " + all.length + " registros";
    empty.hidden = records.length > 0;

    if (!records.length) {
      if (query || origin !== "all" || selectedTag !== "all") {
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
  tagFilter.addEventListener("change", render, { signal });
  selectAll?.addEventListener("change", () => {
    for (const record of visibleRecords) {
      if (selectAll.checked) selectedIds.add(record.id);
      else selectedIds.delete(record.id);
    }
    render();
  }, { signal });
  list.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.recordSelect !== "true") return;
    const id = target.dataset.recordId;
    if (!id) return;
    if (target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    render();
  }, { signal });
  bulkFavorite?.addEventListener("click", () => {
    const result = setHistoryFavorites([...selectedIds], true);
    say(result.ok ? result.updatedCount + " registro(s) marcado(s) como favorito." : result.error);
    render();
  }, { signal });
  bulkUnfavorite?.addEventListener("click", () => {
    const result = setHistoryFavorites([...selectedIds], false);
    say(result.ok ? result.updatedCount + " registro(s) retirado(s) de favoritos." : result.error);
    render();
  }, { signal });
  const applyBulkTags = (mode) => {
    if (!selectedIds.size) { say("Selecciona al menos un registro."); return; }
    const tags = bulkTagsInput instanceof HTMLInputElement ? bulkTagsInput.value.split(",").map((tag) => tag.trim()) : [];
    if (!tags.some(Boolean)) { say("Escribe al menos una etiqueta separada por comas."); return; }
    const result = updateHistoryTagsForRecords([...selectedIds], { mode, tags });
    say(result.ok ? result.updatedCount + " registro(s) actualizado(s) con etiquetas." : result.error);
    if (result.ok && bulkTagsInput instanceof HTMLInputElement) bulkTagsInput.value = "";
    render();
  };
  bulkTagsAdd?.addEventListener("click", () => applyBulkTags("add"), { signal });
  bulkTagsRemove?.addEventListener("click", () => applyBulkTags("remove"), { signal });
  bulkCopy?.addEventListener("click", async () => {
    const data = loadHistory();
    if (!data.ok) { say(data.error); return; }
    const chosen = data.items.filter((item) => selectedIds.has(item.id));
    if (!chosen.length) { say("No hay registros seleccionados."); render(); return; }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(chosen.map((item) => item.content).join("\\n\\n"));
      say("Contenido de " + chosen.length + " registro(s) copiado.");
    } catch {
      say("No se pudo copiar la selección automáticamente. Usa Exportar selección JSON para guardarla.");
    }
  }, { signal });
  bulkExport?.addEventListener("click", () => {
    const data = loadHistory();
    if (!data.ok) { say(data.error); return; }
    const items = data.items.filter((item) => selectedIds.has(item.id));
    if (!items.length) { say("No hay registros seleccionados."); render(); return; }
    try {
      const backup = {
        format: HISTORY_BACKUP_FORMAT,
        version: HISTORY_BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        items,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "linkqr-seleccion-" + new Date().toISOString().slice(0, 10) + ".json";
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      say("Selección exportada: " + items.length + " registro(s).");
    } catch {
      say("No se pudo generar el archivo JSON de la selección.");
    }
  }, { signal });
  bulkDelete?.addEventListener("click", () => {
    const ids = [...selectedIds];
    if (!ids.length) { say("Selecciona al menos un registro."); return; }
    if (!window.confirm("¿Eliminar " + ids.length + " registro(s) seleccionado(s)? Esta acción no se puede deshacer.")) return;
    const result = deleteHistoryRecords(ids);
    if (result.ok) {
      selectedIds.clear();
      say("Se eliminaron " + result.deletedCount + " registro(s).");
    } else {
      say(result.error);
    }
    render();
  }, { signal });
  window.addEventListener("linkqr:history-updated", render, { signal });
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === "linkqr.history.v1") render();
  }, { signal });

  exportButton?.addEventListener("click", () => {
    const result = createHistoryBackup();
    if (!result.ok) { say(result.error); return; }
    try {
      const blob = new Blob([JSON.stringify(result.backup, null, 2)], { type: "application/json;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = "linkqr-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      say("Copia JSON descargada. Guárdala en un lugar seguro.");
    } catch {
      say("No se pudo generar la descarga de la copia JSON.");
    }
  }, { signal });

  importFile?.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_HISTORY_BACKUP_BYTES) {
        say("El archivo supera el límite de 8 MB.");
        return;
      }
      const raw = await file.text();
      const validation = validateHistoryBackup(raw);
      if (!validation.ok) { say(validation.error); return; }
      const mode = importMode?.value === "replace" ? "replace" : "merge";
      if (mode === "replace" && !window.confirm("¿Reemplazar todo el historial local por esta copia? Esta acción no se puede deshacer.")) {
        say("Importación cancelada; el historial no cambió.");
        return;
      }
      const result = importHistoryBackup(validation.backup, { mode });
      if (!result.ok) { say(result.error); return; }
      say(mode === "replace"
        ? "Copia restaurada: " + result.importedCount + " registros."
        : "Importación completada: " + result.importedCount + " registros nuevos añadidos.");
      render();
    } catch {
      say("No se pudo leer o importar el archivo. El historial no cambió.");
    } finally {
      importFile.value = "";
    }
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

  list.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.dataset.tagEditor !== "true") return;
    event.preventDefault();
    const id = form.dataset.recordId;
    const input = form.querySelector("input[data-tag-input]");
    if (!id || !(input instanceof HTMLInputElement)) return;
    const result = updateHistoryTags(id, input.value.split(",").map((tag) => tag.trim()));
    if (!result.ok) { say(result.error); return; }
    say("Etiquetas guardadas para el registro.");
    render();
  }, { signal });

  list.addEventListener("click", async (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("button[data-action][data-record-id]");
    if (!(button instanceof HTMLButtonElement)) return;
    const id = button.dataset.recordId;
    const action = button.dataset.action;
    if (!id) return;

    if (action === "edit-tags") {
      const card = button.closest(".history-record");
      const editor = card?.querySelector('form[data-tag-editor="true"]');
      const input = editor?.querySelector("input[data-tag-input]");
      if (editor instanceof HTMLFormElement && input instanceof HTMLInputElement) {
        editor.hidden = false;
        input.focus();
      }
      return;
    }
    if (action === "cancel-tags") {
      const editor = button.closest('form[data-tag-editor="true"]');
      if (editor instanceof HTMLFormElement) editor.hidden = true;
      return;
    }
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
    if (action === "regenerate") {
      const data = loadHistory();
      const record = data.ok ? data.items.find((item) => item.id === id) : null;
      if (!record) { say("El registro ya no está disponible."); render(); return; }
      const draft = saveGeneratorDraft({ kind: record.kind, content: record.content });
      if (!draft.ok) { say(draft.error); return; }
      window.location.hash = "/generator";
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
