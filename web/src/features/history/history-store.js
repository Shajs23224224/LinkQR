export const HISTORY_STORAGE_KEY = "linkqr.history.v1";
export const HISTORY_SCHEMA_VERSION = 1;
export const MAX_HISTORY_ITEMS = 200;
export const MAX_HISTORY_CONTENT_LENGTH = 8192;

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
