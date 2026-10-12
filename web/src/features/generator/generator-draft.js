import { validateQrInput } from "./validation.js";

export const GENERATOR_DRAFT_STORAGE_KEY = "linkqr.generator-draft.v1";
const GENERATOR_DRAFT_VERSION = 1;

function resolveSessionStorage(storageOverride) {
  if (storageOverride !== undefined) return storageOverride;
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function saveGeneratorDraft({ kind, content } = {}, storageOverride) {
  const validation = validateQrInput(content, kind);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const storage = resolveSessionStorage(storageOverride);
  if (!storage) {
    return { ok: false, error: "El almacenamiento temporal no está disponible en este navegador." };
  }

  const draft = { version: GENERATOR_DRAFT_VERSION, kind: validation.kind, content: validation.payload };
  try {
    storage.setItem(GENERATOR_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return { ok: true, draft: { kind: draft.kind, content: draft.content } };
  } catch {
    return { ok: false, error: "No se pudo preparar el contenido para el generador." };
  }
}

export function consumeGeneratorDraft(storageOverride) {
  const storage = resolveSessionStorage(storageOverride);
  if (!storage) {
    return { ok: false, draft: null, error: "El almacenamiento temporal no está disponible." };
  }

  let raw;
  try {
    raw = storage.getItem(GENERATOR_DRAFT_STORAGE_KEY);
    if (raw === null) return { ok: true, draft: null };
    storage.removeItem(GENERATOR_DRAFT_STORAGE_KEY);
  } catch {
    return { ok: false, draft: null, error: "No se pudo leer el contenido temporal guardado." };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, draft: null, error: "El contenido temporal tenía un formato inválido." };
  }

  if (!data || data.version !== GENERATOR_DRAFT_VERSION) {
    return { ok: false, draft: null, error: "La versión del contenido temporal no es compatible." };
  }

  const validation = validateQrInput(data.content, data.kind);
  if (!validation.ok) {
    return { ok: false, draft: null, error: validation.error };
  }

  return {
    ok: true,
    draft: { kind: validation.kind, content: validation.payload },
  };
}
