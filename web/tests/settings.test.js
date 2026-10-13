import test from "node:test";
import assert from "node:assert/strict";
import {
  getDefaultSettings,
  loadSettings,
  resetSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
} from "../src/features/settings/settings-store.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test("returns safe defaults when no local settings exist", () => {
  const result = loadSettings(new MemoryStorage());
  assert.equal(result.ok, true);
  assert.equal(result.stored, false);
  assert.deepEqual(result.settings, getDefaultSettings());
});

test("saves and reloads custom QR defaults and local-history preferences", () => {
  const storage = new MemoryStorage();
  const settings = {
    qr: { kind: "text", dark: "#123456", light: "#FFFFFF", width: 512, margin: 6 },
    history: { saveGenerated: false, saveScanned: true },
  };
  const saved = saveSettings(settings, storage);
  assert.equal(saved.ok, true);
  const loaded = loadSettings(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.stored, true);
  assert.deepEqual(loaded.settings, {
    qr: { kind: "text", dark: "#123456", light: "#FFFFFF", width: 512, margin: 6 },
    history: { saveGenerated: false, saveScanned: true },
  });
  assert.ok(storage.getItem(SETTINGS_STORAGE_KEY));
});

test("rejects invalid colors, low contrast, unsupported sizes and malformed preferences", () => {
  const storage = new MemoryStorage();
  const before = storage.getItem(SETTINGS_STORAGE_KEY);
  const base = getDefaultSettings();
  assert.equal(saveSettings({ ...base, qr: { ...base.qr, dark: "#777777" } }, storage).ok, false);
  assert.equal(saveSettings({ ...base, qr: { ...base.qr, width: 300 } }, storage).ok, false);
  assert.equal(saveSettings({ ...base, qr: { ...base.qr, kind: "email" } }, storage).ok, false);
  assert.equal(saveSettings({ ...base, history: { saveGenerated: "yes", saveScanned: true } }, storage).ok, false);
  assert.equal(storage.getItem(SETTINGS_STORAGE_KEY), before);
});

test("recovers gracefully from corrupt or incompatible stored settings", () => {
  const storage = new MemoryStorage();
  storage.setItem(SETTINGS_STORAGE_KEY, "{");
  const corrupt = loadSettings(storage);
  assert.equal(corrupt.ok, true);
  assert.deepEqual(corrupt.settings, getDefaultSettings());
  assert.match(corrupt.warning, /dañados/i);
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ version: 99, settings: {} }));
  assert.match(loadSettings(storage).warning, /no es compatible/i);
});

test("reset restores application defaults without touching history storage keys", () => {
  const storage = new MemoryStorage();
  const custom = getDefaultSettings();
  custom.qr.width = 768;
  assert.equal(saveSettings(custom, storage).ok, true);
  assert.equal(resetSettings(storage).ok, true);
  assert.deepEqual(loadSettings(storage).settings, getDefaultSettings());
});
