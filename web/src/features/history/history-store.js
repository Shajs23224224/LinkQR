export const HISTORY_STORAGE_KEY = "linkqr.history.v1";
export const HISTORY_SCHEMA_VERSION = 1;
export const MAX_HISTORY_ITEMS = 200;
export const MAX_HISTORY_CONTENT_LENGTH = 8192;
export const HISTORY_BACKUP_FORMAT = "linkqr-history-backup";
export const HISTORY_BACKUP_VERSION = 1;
export const MAX_HISTORY_BACKUP_BYTES = 8 * 1024 * 1024;

const VALID_SOURCES = new Set(["generated", "scanned"]);
const VALID_KINDS = new Set(["url", "text"]);

function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function createId() {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  } catch {}
  return "qr-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
}

function isValidRecord(item) {
  return Boolean(item && typeof item === "object" &&
    typeof item.id === "string" && item.id.length > 0 &&
    VALID_SOURCES.has(item.source) && VALID_KINDS.has(item.kind) &&
    typeof item.content === "string" && item.content.length > 0 &&
    item.content.length <= MAX_HISTORY_CONTENT_LENGTH &&
    typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.favorite === "boolean");
}

function failure(reason, error) { return { ok: false, items: [], reason, error }; }

export function loadHistory(storageOverride) {
  const storage = resolveStorage(storageOverride);
  if (!storage) return failure("unavailable", "El almacenamiento local no está disponible en este navegador o para este sitio.");

  let raw;
  try { raw = storage.getItem(HISTORY_STORAGE_KEY); }
  catch { return failure("unavailable", "No se pudo leer el almacenamiento local. Comprueba los permisos del navegador."); }
  if (raw === null || raw === "") return { ok: true, items: [], warning: "" };

  let data;
  try { data = JSON.parse(raw); }
  catch { return failure("corrupt", "Los datos del historial no tienen un formato válido. Al guardar un nuevo registro se intentará reconstruir el historial."); }
  if (!data || typeof data !== "object" || data.version !== HISTORY_SCHEMA_VERSION || !Array.isArray(data.items)) {
    return failure("corrupt", "La versión de los datos guardados no es compatible. Al guardar un nuevo registro se intentará reconstruir el historial.");
  }

  const items = data.items.filter(isValidRecord);
  return {
    ok: true,
    items: items.slice(0, MAX_HISTORY_ITEMS),
    warning: items.length !== data.items.length ? "Se omitieron algunos registros incompletos." : "",
  };
}

function persist(items, storage) {
  try {
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({
      version: HISTORY_SCHEMA_VERSION,
      items: items.slice(0, MAX_HISTORY_ITEMS),
    }));
    try {
      if (typeof globalThis.window?.dispatchEvent === "function" && typeof globalThis.CustomEvent === "function") {
        globalThis.window.dispatchEvent(new CustomEvent("linkqr:history-updated"));
      }
    } catch {}
    return { ok: true, items: items.slice(0, MAX_HISTORY_ITEMS) };
  } catch {
    return { ok: false, items: [], error: "No se pudo guardar el historial. El almacenamiento del navegador podría estar lleno o bloqueado." };
  }
}

export function addHistoryRecord({ source, kind, content } = {}, storageOverride) {
  if (!VALID_SOURCES.has(source) || !VALID_KINDS.has(kind)) return { ok: false, error: "El tipo de registro no es válido." };
  if (typeof content !== "string" || !content.trim() || content.length > MAX_HISTORY_CONTENT_LENGTH) {
    return { ok: false, error: "El contenido está vacío o supera el límite permitido para guardarlo." };
  }

  const storage = resolveStorage(storageOverride);
  if (!storage) return { ok: false, error: "El almacenamiento local no está disponible; el resultado no se guardó." };
  const current = loadHistory(storage);
  if (!current.ok && current.reason !== "corrupt") return { ok: false, error: current.error };

  const record = {
    id: createId(), source, kind, content,
    createdAt: new Date().toISOString(),
    favorite: false,
  };
  const result = persist([record, ...(current.ok ? current.items : [])], storage);
  return { ...result, record: result.ok ? record : null, warning: !current.ok ? current.error : current.warning || "" };
}

export function toggleHistoryFavorite(recordId, storageOverride) {
  const storage = resolveStorage(storageOverride);
  if (!storage) return { ok: false, error: "El almacenamiento local no está disponible." };
  const current = loadHistory(storage);
  if (!current.ok) return { ok: false, error: current.error };

  let found = false;
  const items = current.items.map((item) => {
    if (item.id !== recordId) return item;
    found = true;
    return { ...item, favorite: !item.favorite };
  });
  if (!found) return { ok: false, error: "El registro ya no existe en el historial." };
  const favorite = items.find((item) => item.id === recordId).favorite;
  const result = persist(items, storage);
  return { ...result, favorite: result.ok ? favorite : false };
}

export function deleteHistoryRecord(recordId, storageOverride) {
  const storage = resolveStorage(storageOverride);
  if (!storage) return { ok: false, error: "El almacenamiento local no está disponible." };
  const current = loadHistory(storage);
  if (!current.ok) return { ok: false, error: current.error };
  const items = current.items.filter((item) => item.id !== recordId);
  if (items.length === current.items.length) return { ok: false, error: "El registro ya no existe en el historial." };
  return persist(items, storage);
}

export function clearHistory(storageOverride) {
  const storage = resolveStorage(storageOverride);
  if (!storage) return { ok: false, error: "El almacenamiento local no está disponible." };
  return persist([], storage);
}


/**
 * Builds a portable, versioned JSON backup from the current local history.
 */
export function createHistoryBackup(storageOverride) {
  const current = loadHistory(storageOverride);
  if (!current.ok) return { ok: false, error: current.error || "No se pudo leer el historial para crear la copia." };
  return {
    ok: true,
    backup: {
      format: HISTORY_BACKUP_FORMAT,
      version: HISTORY_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      items: current.items,
    },
  };
}

/**
 * Parses and validates a backup completely before allowing any storage changes.
 * The returned records contain only the fields understood by this schema.
 */
export function validateHistoryBackup(input) {
  let raw;
  try {
    raw = typeof input === "string" ? input : JSON.stringify(input);
  } catch {
    return { ok: false, error: "La copia no se puede convertir a JSON." };
  }
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "El archivo de copia está vacío." };
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_HISTORY_BACKUP_BYTES) {
    return { ok: false, error: "La copia supera el límite de 8 MB." };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "El archivo no contiene JSON válido." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      parsed.format !== HISTORY_BACKUP_FORMAT || parsed.version !== HISTORY_BACKUP_VERSION ||
      !Array.isArray(parsed.items)) {
    return { ok: false, error: "El formato o la versión de la copia no son compatibles con LinkQR." };
  }
  if (parsed.items.length > MAX_HISTORY_ITEMS) {
    return { ok: false, error: "La copia contiene más de " + MAX_HISTORY_ITEMS + " registros." };
  }

  const ids = new Set();
  const items = [];
  for (const item of parsed.items) {
    if (!isValidRecord(item) || item.id.length > 128 || !item.content.trim()) {
      return { ok: false, error: "La copia contiene un registro inválido. No se importó ningún dato." };
    }
    if (ids.has(item.id)) {
      return { ok: false, error: "La copia contiene identificadores duplicados. No se importó ningún dato." };
    }
    ids.add(item.id);
    items.push({
      id: item.id,
      source: item.source,
      kind: item.kind,
      content: item.content,
      createdAt: item.createdAt,
      favorite: item.favorite,
    });
  }
  return { ok: true, backup: { format: HISTORY_BACKUP_FORMAT, version: HISTORY_BACKUP_VERSION, exportedAt: parsed.exportedAt, items } };
}

/**
 * Imports a validated backup using "merge" (default) or "replace" mode.
 * Merge preserves existing records on ID conflicts and appends only new IDs.
 */
export function importHistoryBackup(input, { mode = "merge" } = {}, storageOverride) {
  if (mode !== "merge" && mode !== "replace") {
    return { ok: false, error: "El modo de importación no es válido." };
  }
  const validation = validateHistoryBackup(input);
  if (!validation.ok) return validation;

  const storage = resolveStorage(storageOverride);
  if (!storage) return { ok: false, error: "El almacenamiento local no está disponible." };
  const current = loadHistory(storage);
  if (mode === "merge" && !current.ok) {
    return { ok: false, error: current.error || "No se pudo leer el historial actual. Elige reemplazarlo solo si deseas restaurar la copia." };
  }

  const incoming = validation.backup.items;
  let nextItems;
  let importedCount;
  if (mode === "replace") {
    nextItems = incoming;
    importedCount = incoming.length;
  } else {
    const existing = current.items;
    const existingIds = new Set(existing.map((item) => item.id));
    const additions = incoming.filter((item) => !existingIds.has(item.id));
    nextItems = [...existing, ...additions]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, MAX_HISTORY_ITEMS);
    const retainedIds = new Set(nextItems.map((item) => item.id));
    importedCount = additions.filter((item) => retainedIds.has(item.id)).length;
  }

  const result = persist(nextItems, storage);
  return { ...result, importedCount: result.ok ? importedCount : 0, mode };
}


/**
 * Set several records to a target favorite state with one localStorage write.
 * Duplicate IDs are ignored; the result reports how many records changed.
 */
export function setHistoryFavorites(recordIds, favorite, storageOverride) {
  if (!Array.isArray(recordIds) || typeof favorite !== "boolean") {
    return { ok: false, updatedCount: 0, error: "La selección de favoritos no es válida." };
  }
  const ids = [...new Set(recordIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (!ids.length) return { ok: false, updatedCount: 0, error: "Selecciona al menos un registro." };
  const storage = resolveStorage(storageOverride);
  if (!storage) return { ok: false, updatedCount: 0, error: "El almacenamiento local no está disponible." };
  const current = loadHistory(storage);
  if (!current.ok) return { ok: false, updatedCount: 0, error: current.error };

  const selected = new Set(ids);
  let updatedCount = 0;
  const items = current.items.map((item) => {
    if (!selected.has(item.id) || item.favorite === favorite) return item;
    updatedCount += 1;
    return { ...item, favorite };
  });
  if (!updatedCount) {
    const found = current.items.some((item) => selected.has(item.id));
    return found
      ? { ok: true, updatedCount: 0, items: current.items }
      : { ok: false, updatedCount: 0, error: "No se encontraron los registros seleccionados." };
  }
  const result = persist(items, storage);
  return { ...result, updatedCount: result.ok ? updatedCount : 0 };
}

/**
 * Deletes a group of history records in one storage transaction.
 */
export function deleteHistoryRecords(recordIds, storageOverride) {
  if (!Array.isArray(recordIds)) {
    return { ok: false, deletedCount: 0, error: "La selección de registros no es válida." };
  }
  const ids = [...new Set(recordIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (!ids.length) return { ok: false, deletedCount: 0, error: "Selecciona al menos un registro." };
  const storage = resolveStorage(storageOverride);
  if (!storage) return { ok: false, deletedCount: 0, error: "El almacenamiento local no está disponible." };
  const current = loadHistory(storage);
  if (!current.ok) return { ok: false, deletedCount: 0, error: current.error };

  const selected = new Set(ids);
  const items = current.items.filter((item) => !selected.has(item.id));
  const deletedCount = current.items.length - items.length;
  if (!deletedCount) return { ok: false, deletedCount: 0, error: "No se encontraron los registros seleccionados." };
  const result = persist(items, storage);
  return { ...result, deletedCount: result.ok ? deletedCount : 0 };
}
