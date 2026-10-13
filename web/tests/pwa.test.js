import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerPwaServiceWorker, setupInstallPrompt } from "../src/pwa.js";

const publicFile = (name) => new URL("../public/" + name, import.meta.url);

test("registers the service worker with the subpath scope", async () => {
  const calls = [];
  const registration = { scope: "https://example.test/LinkQR/" };
  const result = await registerPwaServiceWorker({
    windowObject: { isSecureContext: true },
    navigatorObject: { serviceWorker: { register: async (...args) => { calls.push(args); return registration; } } },
    scriptUrl: "https://example.test/LinkQR/sw.js",
    scope: "/LinkQR/",
  });
  assert.equal(result.ok, true);
  assert.equal(result.registration, registration);
  assert.deepEqual(calls, [["https://example.test/LinkQR/sw.js", { scope: "/LinkQR/" }]]);
});

test("gracefully skips unsupported and insecure service worker contexts", async () => {
  const unsupported = await registerPwaServiceWorker({
    windowObject: { isSecureContext: true }, navigatorObject: {}, scriptUrl: "/sw.js", scope: "/",
  });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.reason, "unsupported");
  const insecure = await registerPwaServiceWorker({
    windowObject: { isSecureContext: false },
    navigatorObject: { serviceWorker: { register: async () => { throw new Error("must not be called"); } } },
    scriptUrl: "/sw.js", scope: "/",
  });
  assert.equal(insecure.ok, false);
  assert.equal(insecure.reason, "insecure-context");
});

test("shows an install button only after the browser prompt, then hides it after choice", async () => {
  const windowListeners = new Map();
  const buttonListeners = new Map();
  const removed = [];
  const button = {
    hidden: true, disabled: false, textContent: "↓ Instalar app",
    addEventListener: (type, handler) => buttonListeners.set(type, handler),
    removeEventListener: (type, handler) => { if (buttonListeners.get(type) === handler) buttonListeners.delete(type); },
  };
  const fakeWindow = {
    addEventListener: (type, handler) => windowListeners.set(type, handler),
    removeEventListener: (type, handler) => removed.push(type),
  };
  const cleanup = setupInstallPrompt({
    windowObject: fakeWindow,
    documentObject: { querySelector: (selector) => selector === "#install-app" ? button : null },
  });
  let prompted = false;
  windowListeners.get("beforeinstallprompt")({
    preventDefault() {},
    prompt: async () => { prompted = true; },
    userChoice: Promise.resolve({ outcome: "accepted" }),
  });
  assert.equal(button.hidden, false);
  await buttonListeners.get("click")();
  assert.equal(prompted, true);
  assert.equal(button.hidden, true);
  assert.match(button.textContent, /instalada/i);
  cleanup();
  assert.ok(removed.includes("beforeinstallprompt"));
});

test("manifest declares a standalone app with relative shortcuts and icons", async () => {
  const manifest = JSON.parse(await readFile(publicFile("manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "LinkQR — Códigos QR");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./#/home");
  assert.equal(manifest.scope, "./");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose.includes("maskable")));
  assert.ok(manifest.shortcuts.some((shortcut) => shortcut.url === "./#/generator"));
});

test("service worker implements versioned cache and offline navigation fallback", async () => {
  const worker = await readFile(publicFile("sw.js"), "utf8");
  assert.match(worker, /linkqr-pwa-v1/);
  assert.match(worker, /addEventListener\("install"/);
  assert.match(worker, /addEventListener\("activate"/);
  assert.match(worker, /addEventListener\("fetch"/);
  assert.match(worker, /caches\.match\(OFFLINE_URL\)/);
});
