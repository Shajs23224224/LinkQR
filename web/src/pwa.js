/**
 * Progressive Web App helpers, isolated to keep browser state testable.
 */
export function registerPwaServiceWorker({
  navigatorObject = globalThis.navigator,
  windowObject = globalThis.window,
  scriptUrl,
  scope,
} = {}) {
  if (windowObject?.isSecureContext === false) {
    return Promise.resolve({ ok: false, reason: "insecure-context" });
  }
  if (!navigatorObject?.serviceWorker || typeof navigatorObject.serviceWorker.register !== "function") {
    return Promise.resolve({ ok: false, reason: "unsupported" });
  }
  if (typeof scriptUrl !== "string" || !scriptUrl || typeof scope !== "string" || !scope) {
    return Promise.resolve({ ok: false, reason: "invalid-path" });
  }
  return Promise.resolve()
    .then(() => navigatorObject.serviceWorker.register(scriptUrl, { scope }))
    .then((registration) => ({ ok: true, registration }))
    .catch((error) => ({ ok: false, reason: "registration-failed", error }));
}

export function setupInstallPrompt({
  windowObject = globalThis.window,
  documentObject = globalThis.document,
} = {}) {
  const button = documentObject?.querySelector?.("#install-app");
  if (!button || typeof windowObject?.addEventListener !== "function") return () => {};
  let deferredPrompt = null;

  const onBeforeInstallPrompt = (event) => {
    event.preventDefault?.();
    deferredPrompt = event;
    button.hidden = false;
  };
  const onInstallClick = async () => {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    button.disabled = true;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice?.outcome === "accepted") button.textContent = "App instalada";
      button.hidden = true;
    } catch {
      button.hidden = true;
    } finally {
      button.disabled = false;
    }
  };
  const onInstalled = () => {
    button.hidden = true;
    button.disabled = false;
  };

  windowObject.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  windowObject.addEventListener("appinstalled", onInstalled);
  button.addEventListener("click", onInstallClick);
  return () => {
    windowObject.removeEventListener?.("beforeinstallprompt", onBeforeInstallPrompt);
    windowObject.removeEventListener?.("appinstalled", onInstalled);
    button.removeEventListener?.("click", onInstallClick);
  };
}

export function setupConnectionStatus({
  windowObject = globalThis.window,
  navigatorObject = globalThis.navigator,
  documentObject = globalThis.document,
} = {}) {
  const container = documentObject?.querySelector?.("#connection-status");
  const label = documentObject?.querySelector?.("#connection-status-label");
  if (!container || !label || typeof windowObject?.addEventListener !== "function") return () => {};
  const update = () => {
    const online = navigatorObject?.onLine !== false;
    label.textContent = online ? "Local" : "Sin conexión";
    container.classList.toggle("is-offline", !online);
  };
  windowObject.addEventListener("online", update);
  windowObject.addEventListener("offline", update);
  update();
  return () => {
    windowObject.removeEventListener?.("online", update);
    windowObject.removeEventListener?.("offline", update);
  };
}

export function initializePwa({
  windowObject = globalThis.window,
  navigatorObject = globalThis.navigator,
  documentObject = globalThis.document,
} = {}) {
  let appBase = null;
  try {
    const manifest = documentObject?.querySelector?.('link[rel="manifest"]');
    appBase = new URL(".", manifest?.href || documentObject.baseURI);
  } catch {}
  const serviceWorker = appBase
    ? registerPwaServiceWorker({
        windowObject,
        navigatorObject,
        scriptUrl: new URL("sw.js", appBase).href,
        scope: appBase.pathname,
      })
    : Promise.resolve({ ok: false, reason: "base-url-unavailable" });
  const removeInstallListeners = setupInstallPrompt({ windowObject, documentObject });
  const removeConnectionListeners = setupConnectionStatus({ windowObject, navigatorObject, documentObject });
  return {
    serviceWorker,
    cleanup() {
      removeInstallListeners();
      removeConnectionListeners();
    },
  };
}
