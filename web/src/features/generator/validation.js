export const MAX_QR_PAYLOAD_BYTES = 2048;
export const MIN_QR_CONTRAST_RATIO = 4.5;
export const QR_WIDTH_OPTIONS = Object.freeze([192, 256, 320, 384, 512, 640, 768]);
export const QR_MARGIN_OPTIONS = Object.freeze([4, 6, 8]);

const EMPTY_ERROR = "Escribe el contenido que quieres convertir en código QR.";
const TOO_LARGE_ERROR = "El contenido supera el límite de " + MAX_QR_PAYLOAD_BYTES + " bytes en UTF-8.";

export function validateQrInput(value, kind = "text") {
  if (typeof value !== "string") {
    return { ok: false, error: EMPTY_ERROR };
  }

  if (kind !== "text" && kind !== "url") {
    return { ok: false, error: "Selecciona un tipo de contenido válido." };
  }

  let payload = kind === "url" ? value.trim() : value;

  if (!payload.trim()) {
    return { ok: false, error: EMPTY_ERROR };
  }

  if (kind === "url") {
    let parsedUrl;

    try {
      parsedUrl = new URL(payload);
    } catch {
      return {
        ok: false,
        error: "Introduce una dirección web completa, como https://ejemplo.com.",
      };
    }

    if (
      !["http:", "https:"].includes(parsedUrl.protocol) ||
      !parsedUrl.hostname ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return {
        ok: false,
        error: "La dirección debe usar HTTP o HTTPS y no puede contener credenciales.",
      };
    }

    payload = parsedUrl.href;
  }

  const bytes = new TextEncoder().encode(payload).byteLength;

  if (bytes > MAX_QR_PAYLOAD_BYTES) {
    return { ok: false, error: TOO_LARGE_ERROR, bytes };
  }

  return { ok: true, payload, bytes, kind };
}

function parseHexColor(value) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }

  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function channelToLinear(value) {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color) {
  const rgb = parseHexColor(color);
  if (!rgb) return null;
  return (
    0.2126 * channelToLinear(rgb[0]) +
    0.7152 * channelToLinear(rgb[1]) +
    0.0722 * channelToLinear(rgb[2])
  );
}

export function getContrastRatio(firstColor, secondColor) {
  const first = relativeLuminance(firstColor);
  const second = relativeLuminance(secondColor);
  if (first === null || second === null) return null;

  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function validateQrOptions({ dark = "#111827", light = "#FFFFFF", width = 320, margin = 4 } = {}) {
  if (!parseHexColor(dark)) {
    return { ok: false, field: "dark", error: "Selecciona un color válido para el patrón del QR." };
  }

  if (!parseHexColor(light)) {
    return { ok: false, field: "light", error: "Selecciona un color válido para el fondo del QR." };
  }

  const darkLuminance = relativeLuminance(dark);
  const lightLuminance = relativeLuminance(light);

  if (darkLuminance >= lightLuminance) {
    return {
      ok: false,
      field: "dark",
      error: "El patrón debe ser más oscuro que el fondo para facilitar el escaneo.",
    };
  }

  const contrastRatio = getContrastRatio(dark, light);
  if (contrastRatio < MIN_QR_CONTRAST_RATIO) {
    return {
      ok: false,
      field: "light",
      error: "El contraste es de " + contrastRatio.toFixed(2) +
        ":1. Elige colores con una relación de al menos " + MIN_QR_CONTRAST_RATIO + ":1.",
      contrastRatio,
    };
  }

  const numericWidth = Number(width);
  if (!QR_WIDTH_OPTIONS.includes(numericWidth)) {
    return {
      ok: false,
      field: "width",
      error: "Selecciona uno de los tamaños PNG disponibles.",
    };
  }

  const numericMargin = Number(margin);
  if (!QR_MARGIN_OPTIONS.includes(numericMargin)) {
    return {
      ok: false,
      field: "margin",
      error: "Selecciona un margen de 4, 6 u 8 módulos.",
    };
  }

  return {
    ok: true,
    dark: dark.toUpperCase(),
    light: light.toUpperCase(),
    width: numericWidth,
    margin: numericMargin,
    contrastRatio,
  };
}
