const DEFAULT_API_BASE_URL = "http://localhost:8080";

function normalizeBaseUrl(value) {
  return String(value ?? DEFAULT_API_BASE_URL).trim().replace(/\/+$/, "");
}

export const appConfig = Object.freeze({
  appName: "LinkQR",
  appVersion: "0.1.0",
  apiBaseUrl: normalizeBaseUrl(
    globalThis.LINKQR_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  ),
  requestTimeoutMs: 15_000,
});

export function getApiUrl(path) {
  const normalizedPath = String(path ?? "").replace(/^\/+/, "");
  return new URL(normalizedPath, `${appConfig.apiBaseUrl}/`).toString();
}
