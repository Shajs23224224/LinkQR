import { QR_MARGIN_OPTIONS, QR_WIDTH_OPTIONS, validateQrOptions } from "../generator/validation.js";

export const SETTINGS_STORAGE_KEY = "linkqr.settings.v1";
export const SETTINGS_SCHEMA_VERSION = 1;

const DEFAULTS = Object.freeze({
  qr: Object.freeze({
    kind: "url",
    dark: "#111827",
    light: "#FFFFFF",
    width: 320,
    margin: 4,
  }),
  history: Object.freeze({
    saveGenerated: true,
    saveScanned: true,
  }),
});

function copyDefaults() {
  return {
    qr: { ...DEFAULTS.qr },
    history: { ...DEFAULTS.history },
  };
}

function resolveStorage(storageOverride) {
  if (storageOverride !== undefined) return storageOverride;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function normalizeSettings(input) {
  const raw = input && typeof input === "object" ? input : {};
  const rawQr = raw.qr && typeof raw.qr === "object" ? raw.qr : {};
  const rawHistory = raw.history && typeof raw.history === "object" ? raw.history : {};
  const candidate = {
    dark: typeof rawQr.dark === "string" ? rawQr.dark : DEFAULTS.qr.dark,
    light: typeof rawQr.light === "string" ? rawQr.light : DEFAULTS.qr.light,
    width: QR_WIDTH_OPTIONS.includes(Number(rawQr.width)) ? Number(rawQr.width) : DEFAULTS.qr.width,
    margin: QR_MARGIN_OPTIONS.includes(Number(rawQr.margin)) ? Number(rawQr.margin) : DEFAULTS.qr.margin,
  };
  const validated = validateQrOptions(candidate);
  const qr = validated.ok
    ? { kind: ["url", "text"].includes(rawQr.kind) ? rawQr.kind : DEFAULTS.qr.kind, ...validated }
    : { ...DEFAULTS.qr };
  delete qr.ok;
  delete qr.contrastRatio;
  const history = {
    saveGenerated: typeof rawHistory.saveGenerated === "boolean" ? rawHistory.saveGenerated : DEFAULTS.history.saveGenerated,
    saveScanned: typeof rawHistory.saveScanned === "boolean" ? rawHistory.saveScanned : DEFAULTS.history.saveScanned,
  };
  return { qr, history };
}

function dispatchSettingsUpdated() {
  try {
    if (typeof globalThis.window?.dispatchEvent === "function" && typeof globalThis.CustomEvent === "function") {
      globalThis.window.dispatchEvent(new CustomEvent("linkqr:settings-updated"));
    }
  } catch {}
}

export function getDefaultSettings() {
  return copyDefaults();
}

export function loadSettings(storageOverride) {
  const storage = resolveStorage(storageOverride);
  if (!storage) {
    return { ok: false, settings: copyDefaults(), warning: "El almacenamiento local no está disponible." };
  }

  let raw;
  try {
    raw = storage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return { ok: false, settings: copyDefaults(), warning: "No se pudieron leer los ajustes locales." };
  }
  if (raw === null || raw === "") {
    return { ok: true, settings: copyDefaults(), stored: false, warning: "" };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: true, settings: copyDefaults(), stored: false, warning: "Los ajustes guardados estaban dañados; se muestran los valores predeterminados. Guarda para reemplazarlos." };
  }
  if (!parsed || typeof parsed !== "object" || parsed.version !== SETTINGS_SCHEMA_VERSION || !parsed.settings) {
    return { ok: true, settings: copyDefaults(), stored: false, warning: "La versión de los ajustes no es compatible; se muestran los valores predeterminados." };
  }

  return {
    ok: true,
    settings: normalizeSettings(parsed.settings),
    stored: true,
    warning: "",
  };
}

export function saveSettings(input, storageOverride) {
  if (!input || typeof input !== "object" || !input.qr || !input.history) {
    return { ok: false, error: "La estructura de los ajustes no es válida." };
  }
  if (!["url", "text"].includes(input.qr.kind)) {
    return { ok: false, error: "El tipo de contenido predeterminado debe ser URL o texto." };
  }
  if (typeof input.history.saveGenerated !== "boolean" || typeof input.history.saveScanned !== "boolean") {
    return { ok: false, error: "Las preferencias de guardado automático no son válidas." };
  }

  const validation = validateQrOptions({
    dark: input.qr.dark,
    light: input.qr.light,
    width: input.qr.width,
    margin: input.qr.margin,
  });
  if (!validation.ok) return { ok: false, error: validation.error, field: validation.field };

  const settings = {
    qr: {
      kind: input.qr.kind,
      dark: validation.dark,
      light: validation.light,
      width: validation.width,
      margin: validation.margin,
    },
    history: {
      saveGenerated: input.history.saveGenerated,
      saveScanned: input.history.saveScanned,
    },
  };
  const storage = resolveStorage(storageOverride);
  if (!storage) return { ok: false, error: "El almacenamiento local no está disponible." };

  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      version: SETTINGS_SCHEMA_VERSION,
      settings,
    }));
    dispatchSettingsUpdated();
    return { ok: true, settings, warning: "" };
  } catch {
    return { ok: false, error: "No se pudieron guardar los ajustes. Comprueba el espacio o los permisos del navegador." };
  }
}

export function resetSettings(storageOverride) {
  return saveSettings(copyDefaults(), storageOverride);
}
