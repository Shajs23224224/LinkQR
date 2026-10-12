import test from "node:test";
import assert from "node:assert/strict";
import { MAX_QR_PAYLOAD_BYTES, MIN_QR_CONTRAST_RATIO, getContrastRatio, validateQrInput, validateQrOptions } from "../src/features/generator/validation.js";
import { MAX_SCANNER_IMAGE_BYTES, classifyScannedValue, validateScannerImage } from "../src/features/scanner/scanner-validation.js";
import {
  HISTORY_STORAGE_KEY,
  MAX_HISTORY_ITEMS,
  addHistoryRecord,
  clearHistory,
  deleteHistoryRecord,
  loadHistory,
  toggleHistoryFavorite,
} from "../src/features/history/history-store.js";
import {
  GENERATOR_DRAFT_STORAGE_KEY,
  consumeGeneratorDraft,
  saveGeneratorDraft,
} from "../src/features/generator/generator-draft.js";


test("rejects empty text", () => {
  const result = validateQrInput("   ", "text");
  assert.equal(result.ok, false);
  assert.match(result.error, /Escribe el contenido/);
});

test("accepts ordinary text and preserves leading/trailing whitespace", () => {
  const result = validateQrInput("  LinkQR\n listo  ", "text");
  assert.equal(result.ok, true);
  assert.equal(result.payload, "  LinkQR\n listo  ");
  assert.equal(result.bytes, new TextEncoder().encode("  LinkQR\n listo  ").byteLength);
});

test("accepts HTTPS and trims surrounding whitespace from URLs", () => {
  const result = validateQrInput("  https://example.com/path?q=qr  ", "url");
  assert.equal(result.ok, true);
  assert.equal(result.payload, "https://example.com/path?q=qr");
});

test("rejects incomplete and unsafe URLs", () => {
  assert.equal(validateQrInput("example.com", "url").ok, false);
  assert.equal(validateQrInput("javascript:alert(1)", "url").ok, false);
  assert.equal(validateQrInput("data:text/plain,hello", "url").ok, false);
  assert.equal(validateQrInput("https://user:pass@example.com", "url").ok, false);
});

test("enforces the 2048-byte UTF-8 payload boundary", () => {
  const accepted = validateQrInput("a".repeat(MAX_QR_PAYLOAD_BYTES), "text");
  const rejected = validateQrInput("a".repeat(MAX_QR_PAYLOAD_BYTES + 1), "text");
  assert.equal(accepted.ok, true);
  assert.equal(accepted.bytes, MAX_QR_PAYLOAD_BYTES);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.bytes, MAX_QR_PAYLOAD_BYTES + 1);
});

test("counts multibyte text as UTF-8 bytes rather than JavaScript characters", () => {
  const result = validateQrInput("😀".repeat(512), "text");
  assert.equal(result.ok, true);
  assert.equal(result.bytes, MAX_QR_PAYLOAD_BYTES);
  assert.equal(validateQrInput("😀".repeat(513), "text").ok, false);
});

test("rejects unknown content types", () => {
  const result = validateQrInput("anything", "email");
  assert.equal(result.ok, false);
});

test("normalizes spaces inside a URL path before encoding", () => {
  const result = validateQrInput("https://example.com/a b", "url");
  assert.equal(result.ok, true);
  assert.equal(result.payload, "https://example.com/a%20b");
});


test("computes WCAG-style contrast ratios for valid hex colors", () => {
  assert.ok(getContrastRatio("#111827", "#FFFFFF") > MIN_QR_CONTRAST_RATIO);
  assert.ok(getContrastRatio("#777777", "#FFFFFF") < MIN_QR_CONTRAST_RATIO);
  assert.equal(getContrastRatio("red", "#FFFFFF"), null);
});

test("accepts default QR appearance with scanner-friendly contrast", () => {
  const result = validateQrOptions();
  assert.equal(result.ok, true);
  assert.equal(result.dark, "#111827");
  assert.equal(result.light, "#FFFFFF");
  assert.equal(result.width, 320);
  assert.equal(result.margin, 4);
  assert.ok(result.contrastRatio >= MIN_QR_CONTRAST_RATIO);
});

test("normalizes custom colors and numeric display options", () => {
  const result = validateQrOptions({
    dark: "#123456",
    light: "#FFFFFF",
    width: "512",
    margin: "8",
  });
  assert.equal(result.ok, true);
  assert.equal(result.dark, "#123456");
  assert.equal(result.width, 512);
  assert.equal(result.margin, 8);
});

test("rejects low contrast and reversed light/dark colors", () => {
  const lowContrast = validateQrOptions({ dark: "#777777", light: "#FFFFFF" });
  assert.equal(lowContrast.ok, false);
  assert.equal(lowContrast.field, "light");
  assert.match(lowContrast.error, /contraste/i);

  const reversed = validateQrOptions({ dark: "#FFFFFF", light: "#000000" });
  assert.equal(reversed.ok, false);
  assert.equal(reversed.field, "dark");
  assert.match(reversed.error, /más oscuro/i);
});

test("rejects invalid colors, sizes, and margins", () => {
  assert.equal(validateQrOptions({ dark: "rebeccapurple" }).ok, false);
  assert.equal(validateQrOptions({ light: "#FFFFF" }).ok, false);
  assert.equal(validateQrOptions({ width: 333 }).field, "width");
  assert.equal(validateQrOptions({ margin: 0 }).field, "margin");
});


test("accepts supported raster images up to 10 MB", () => {
  const result = validateScannerImage({ type: "image/png", size: MAX_SCANNER_IMAGE_BYTES, name: "qr.png" });
  assert.equal(result.ok, true);
});

test("rejects empty, unsupported, and oversized scanner images", () => {
  assert.equal(validateScannerImage(null).ok, false);
  assert.equal(validateScannerImage({ type: "image/svg+xml", size: 250 }).ok, false);
  assert.equal(validateScannerImage({ type: "image/jpeg", size: 0 }).ok, false);
  const tooLarge = validateScannerImage({ type: "image/webp", size: MAX_SCANNER_IMAGE_BYTES + 1 });
  assert.equal(tooLarge.ok, false);
  assert.match(tooLarge.error, /10 MB/);
});

test("classifies HTTP and HTTPS QR contents as safe links", () => {
  assert.deepEqual(classifyScannedValue("https://example.com/path"), {
    text: "https://example.com/path",
    isHttpUrl: true,
    url: "https://example.com/path",
  });
  assert.equal(classifyScannedValue(" http://example.com ").isHttpUrl, true);
});

test("keeps non-HTTP protocols and embedded credentials as inert text", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,hello", "mailto:user@example.com", "https://user:pass@example.com", "ordinary text"]) {
    const result = classifyScannedValue(value);
    assert.equal(result.isHttpUrl, false);
    assert.equal(result.url, null);
    assert.equal(result.text, value);
  }
});


class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test("persists generated and scanned QR records", () => {
  const storage = new MemoryStorage();
  const generated = addHistoryRecord({ source: "generated", kind: "url", content: "https://example.com" }, storage);
  const scanned = addHistoryRecord({ source: "scanned", kind: "text", content: "texto desde cámara" }, storage);
  assert.equal(generated.ok, true);
  assert.equal(scanned.ok, true);
  const state = loadHistory(storage);
  assert.equal(state.ok, true);
  assert.equal(state.items.length, 2);
  assert.equal(state.items[0].id, scanned.record.id);
  assert.equal(state.items[1].id, generated.record.id);
  assert.ok(storage.getItem(HISTORY_STORAGE_KEY));
});

test("toggles favorites and deletes individual records", () => {
  const storage = new MemoryStorage();
  const record = addHistoryRecord({ source: "generated", kind: "text", content: "LinkQR" }, storage).record;
  const favorited = toggleHistoryFavorite(record.id, storage);
  assert.equal(favorited.ok, true);
  assert.equal(favorited.favorite, true);
  assert.equal(loadHistory(storage).items[0].favorite, true);
  const unfavorited = toggleHistoryFavorite(record.id, storage);
  assert.equal(unfavorited.favorite, false);
  assert.equal(deleteHistoryRecord(record.id, storage).ok, true);
  assert.equal(loadHistory(storage).items.length, 0);
});

test("caps history length and supports clearing all records", () => {
  const storage = new MemoryStorage();
  for (let i = 0; i < MAX_HISTORY_ITEMS + 4; i += 1) {
    assert.equal(addHistoryRecord({ source: "generated", kind: "text", content: "record-" + i }, storage).ok, true);
  }
  assert.equal(loadHistory(storage).items.length, MAX_HISTORY_ITEMS);
  assert.equal(clearHistory(storage).ok, true);
  assert.equal(loadHistory(storage).items.length, 0);
});

test("handles corrupt, unavailable, and invalid history data", () => {
  const storage = new MemoryStorage();
  storage.setItem(HISTORY_STORAGE_KEY, "{");
  assert.equal(loadHistory(storage).ok, false);
  const recovered = addHistoryRecord({ source: "scanned", kind: "text", content: "recovered" }, storage);
  assert.equal(recovered.ok, true);
  assert.match(recovered.warning, /formato válido/);
  assert.equal(loadHistory(storage).items.length, 1);
  assert.equal(loadHistory(null).ok, false);
  assert.equal(addHistoryRecord({ source: "invalid", kind: "text", content: "x" }, storage).ok, false);
  assert.equal(addHistoryRecord({ source: "generated", kind: "text", content: " " }, storage).ok, false);
});


test("sends a valid history record to the generator once", () => {
  const storage = new MemoryStorage();
  const saved = saveGeneratorDraft({ kind: "url", content: "https://example.com/a b" }, storage);
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.draft, { kind: "url", content: "https://example.com/a%20b" });
  const consumed = consumeGeneratorDraft(storage);
  assert.equal(consumed.ok, true);
  assert.deepEqual(consumed.draft, saved.draft);
  assert.equal(consumeGeneratorDraft(storage).draft, null);
  assert.equal(storage.getItem(GENERATOR_DRAFT_STORAGE_KEY), null);
});

test("rejects invalid or oversized generator drafts", () => {
  const storage = new MemoryStorage();
  assert.equal(saveGeneratorDraft({ kind: "url", content: "javascript:alert(1)" }, storage).ok, false);
  assert.equal(saveGeneratorDraft({ kind: "text", content: "x".repeat(MAX_QR_PAYLOAD_BYTES + 1) }, storage).ok, false);
  assert.equal(saveGeneratorDraft({ kind: "unknown", content: "hello" }, storage).ok, false);
  assert.equal(storage.getItem(GENERATOR_DRAFT_STORAGE_KEY), null);
});

test("discards corrupted generator drafts without repeatedly loading them", () => {
  const storage = new MemoryStorage();
  storage.setItem(GENERATOR_DRAFT_STORAGE_KEY, "{");
  const result = consumeGeneratorDraft(storage);
  assert.equal(result.ok, false);
  assert.equal(result.draft, null);
  assert.equal(storage.getItem(GENERATOR_DRAFT_STORAGE_KEY), null);
});
