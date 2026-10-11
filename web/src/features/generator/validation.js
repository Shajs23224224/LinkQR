export const MAX_QR_PAYLOAD_BYTES = 2048;

const EMPTY_ERROR = "Escribe el contenido que quieres convertir en código QR.";
const TOO_LARGE_ERROR = `El contenido supera el límite de ${MAX_QR_PAYLOAD_BYTES} bytes en UTF-8.`;

export function validateQrInput(value, kind = "text") {
  if (typeof value !== "string") {
    return { ok: false, error: EMPTY_ERROR };
  }

  if (kind !== "text" && kind !== "url") {
    return { ok: false, error: "Selecciona un tipo de contenido válido." };
  }

  const payload = kind === "url" ? value.trim() : value;

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
  }

  const bytes = new TextEncoder().encode(payload).byteLength;

  if (bytes > MAX_QR_PAYLOAD_BYTES) {
    return { ok: false, error: TOO_LARGE_ERROR, bytes };
  }

  return { ok: true, payload, bytes, kind };
}
