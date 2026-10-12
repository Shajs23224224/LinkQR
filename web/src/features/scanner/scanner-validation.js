export const MAX_SCANNER_IMAGE_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
]);

export function validateScannerImage(file) {
  if (!file || typeof file !== "object") {
    return { ok: false, error: "Selecciona una imagen para buscar el código QR." };
  }

  if (!ALLOWED_IMAGE_TYPES.has(String(file.type || "").toLowerCase())) {
    return {
      ok: false,
      error: "Formato no compatible. Usa una imagen PNG, JPEG, WebP, GIF, BMP o AVIF.",
    };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: "El archivo está vacío o no se puede leer." };
  }

  if (file.size > MAX_SCANNER_IMAGE_BYTES) {
    return {
      ok: false,
      error: "La imagen supera el límite de 10 MB. Reduce el archivo e inténtalo de nuevo.",
    };
  }

  return { ok: true, file };
}

export function classifyScannedValue(value) {
  if (typeof value !== "string") {
    return { text: "", isHttpUrl: false, url: null };
  }

  const candidate = value.trim();
  try {
    const parsed = new URL(candidate);
    if (
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.hostname &&
      !parsed.username &&
      !parsed.password
    ) {
      return { text: value, isHttpUrl: true, url: parsed.href };
    }
  } catch {
    // Any content that isn't a valid HTTP(S) URL stays inert text.
  }

  return { text: value, isHttpUrl: false, url: null };
}
