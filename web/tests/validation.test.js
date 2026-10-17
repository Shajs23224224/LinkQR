import test from "node:test";
import assert from "node:assert/strict";
import { MAX_QR_PAYLOAD_BYTES, MIN_QR_CONTRAST_RATIO, getContrastRatio, validateQrInput, validateQrOptions } from "../src/features/generator/validation.js";
import { MAX_SCANNER_IMAGE_BYTES, classifyScannedValue, validateScannerImage } from "../src/features/scanner/scanner-validation.js";
import {
  HISTORY_STORAGE_KEY,
  MAX_HISTORY_ITEMS,
  addHistoryRecord,
  clearHistory,
  createHistoryBackup,
  deleteHistoryRecord,
  deleteHistoryRecords,
  importHistoryBackup,
  loadHistory,
  toggleHistoryFavorite,
  setHistoryFavorites,
  validateHistoryBackup,
  HISTORY_BACKUP_FORMAT,
  MAX_HISTORY_BACKUP_BYTES,
  MAX_HISTORY_TAG_LENGTH,
  MAX_HISTORY_TAGS_PER_RECORD,
  updateHistoryTags,
  updateHistoryTagsForRecords,
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


test("exports a portable, versioned backup of local history", () => {
  const storage = new MemoryStorage();
  addHistoryRecord({ source: "generated", kind: "url", content: "https://example.com" }, storage);
  const exported = createHistoryBackup(storage);
  assert.equal(exported.ok, true);
  assert.equal(exported.backup.format, HISTORY_BACKUP_FORMAT);
  assert.equal(exported.backup.version, 1);
  assert.equal(exported.backup.items.length, 1);
  assert.equal(exported.backup.items[0].content, "https://example.com");
});

test("merges backup records by unique ID and keeps local conflicts", () => {
  const storage = new MemoryStorage();
  const local = addHistoryRecord({ source: "generated", kind: "text", content: "local value" }, storage).record;
  const imported = {
    format: HISTORY_BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    items: [
      { ...local, content: "incoming conflicting content" },
      { id: "from-backup", source: "scanned", kind: "text", content: "new record", createdAt: new Date().toISOString(), favorite: true },
    ],
  };
  const result = importHistoryBackup(imported, { mode: "merge" }, storage);
  assert.equal(result.ok, true);
  assert.equal(result.importedCount, 1);
  const state = loadHistory(storage);
  assert.equal(state.items.length, 2);
  assert.ok(state.items.some((item) => item.id === local.id && item.content === "local value"));
  assert.ok(state.items.some((item) => item.id === "from-backup" && item.favorite === true));
});

test("replaces history only when explicitly requested and accepts empty backups", () => {
  const storage = new MemoryStorage();
  addHistoryRecord({ source: "generated", kind: "text", content: "old record" }, storage);
  const emptyBackup = { format: HISTORY_BACKUP_FORMAT, version: 1, items: [] };
  assert.equal(importHistoryBackup(emptyBackup, { mode: "merge" }, storage).ok, true);
  assert.equal(loadHistory(storage).items.length, 1);
  const replaced = importHistoryBackup(emptyBackup, { mode: "replace" }, storage);
  assert.equal(replaced.ok, true);
  assert.equal(replaced.importedCount, 0);
  assert.equal(loadHistory(storage).items.length, 0);
});

test("rejects malformed, unsupported, duplicate, oversized and invalid backups atomically", () => {
  const storage = new MemoryStorage();
  addHistoryRecord({ source: "generated", kind: "text", content: "keep me" }, storage);
  const before = storage.getItem(HISTORY_STORAGE_KEY);
  assert.equal(validateHistoryBackup("{").ok, false);
  assert.equal(validateHistoryBackup({ format: "other", version: 1, items: [] }).ok, false);
  assert.equal(validateHistoryBackup({ format: HISTORY_BACKUP_FORMAT, version: 99, items: [] }).ok, false);
  assert.equal(validateHistoryBackup("x".repeat(MAX_HISTORY_BACKUP_BYTES + 1)).ok, false);
  const invalidRecord = { id: "bad", source: "generated", kind: "text", content: "", createdAt: new Date().toISOString(), favorite: false };
  assert.equal(importHistoryBackup({ format: HISTORY_BACKUP_FORMAT, version: 1, items: [invalidRecord] }, { mode: "replace" }, storage).ok, false);
  const duplicate = { id: "same-id", source: "generated", kind: "text", content: "x", createdAt: new Date().toISOString(), favorite: false };
  assert.equal(validateHistoryBackup({ format: HISTORY_BACKUP_FORMAT, version: 1, items: [duplicate, duplicate] }).ok, false);
  assert.equal(storage.getItem(HISTORY_STORAGE_KEY), before);
});

test("fails safe when merging into an unreadable local history", () => {
  const storage = new MemoryStorage();
  storage.setItem(HISTORY_STORAGE_KEY, "{");
  const backup = { format: HISTORY_BACKUP_FORMAT, version: 1, items: [] };
  const merged = importHistoryBackup(backup, { mode: "merge" }, storage);
  assert.equal(merged.ok, false);
  assert.equal(storage.getItem(HISTORY_STORAGE_KEY), "{");
  assert.equal(importHistoryBackup(backup, { mode: "replace" }, storage).ok, true);
});


test("counts merged records correctly when a full history evicts an older item", () => {
  const storage = new MemoryStorage();
  for (let i = 0; i < MAX_HISTORY_ITEMS; i += 1) {
    assert.equal(addHistoryRecord({ source: "generated", kind: "text", content: "local-" + i }, storage).ok, true);
  }
  const newerRecord = {
    id: "newer-imported-record",
    source: "scanned",
    kind: "text",
    content: "keep this imported record",
    createdAt: new Date(Date.now() + 86400000).toISOString(),
    favorite: false,
  };
  const result = importHistoryBackup({
    format: HISTORY_BACKUP_FORMAT,
    version: 1,
    items: [newerRecord],
  }, { mode: "merge" }, storage);
  assert.equal(result.ok, true);
  assert.equal(result.importedCount, 1);
  const finalItems = loadHistory(storage).items;
  assert.equal(finalItems.length, MAX_HISTORY_ITEMS);
  assert.ok(finalItems.some((item) => item.id === newerRecord.id));
});


test("marks multiple history records as favorites in one bulk operation", () => {
  const storage = new MemoryStorage();
  const one = addHistoryRecord({ source: "generated", kind: "text", content: "uno" }, storage).record;
  const two = addHistoryRecord({ source: "scanned", kind: "text", content: "dos" }, storage).record;
  const three = addHistoryRecord({ source: "generated", kind: "text", content: "tres" }, storage).record;

  const result = setHistoryFavorites([one.id, two.id, two.id], true, storage);
  assert.equal(result.ok, true);
  assert.equal(result.updatedCount, 2);
  const rows = loadHistory(storage).items;
  assert.equal(rows.find((item) => item.id === one.id).favorite, true);
  assert.equal(rows.find((item) => item.id === two.id).favorite, true);
  assert.equal(rows.find((item) => item.id === three.id).favorite, false);
  assert.equal(setHistoryFavorites([one.id, two.id], true, storage).updatedCount, 0);
  assert.equal(setHistoryFavorites([one.id], false, storage).updatedCount, 1);
});

test("deletes multiple selected history records without affecting unselected records", () => {
  const storage = new MemoryStorage();
  const one = addHistoryRecord({ source: "generated", kind: "text", content: "uno" }, storage).record;
  const two = addHistoryRecord({ source: "scanned", kind: "text", content: "dos" }, storage).record;
  const three = addHistoryRecord({ source: "generated", kind: "text", content: "tres" }, storage).record;

  const result = deleteHistoryRecords([one.id, three.id, three.id], storage);
  assert.equal(result.ok, true);
  assert.equal(result.deletedCount, 2);
  assert.deepEqual(loadHistory(storage).items.map((item) => item.id), [two.id]);
});

test("bulk history operations reject empty selections and preserve corrupt storage", () => {
  const storage = new MemoryStorage();
  const emptyFavorite = setHistoryFavorites([], true, storage);
  const emptyDelete = deleteHistoryRecords([], storage);
  assert.equal(emptyFavorite.ok, false);
  assert.equal(emptyDelete.ok, false);
  storage.setItem(HISTORY_STORAGE_KEY, "{");
  assert.equal(setHistoryFavorites(["id"], true, storage).ok, false);
  assert.equal(deleteHistoryRecords(["id"], storage).ok, false);
  assert.equal(storage.getItem(HISTORY_STORAGE_KEY), "{");
});


test("custom tags are normalized, deduplicated and persisted on history records", () => {
  const storage = new MemoryStorage();
  const record = addHistoryRecord({ source: "generated", kind: "text", content: "etiquetado" }, storage).record;
  assert.deepEqual(record.tags, []);
  const updated = updateHistoryTags(record.id, [" Trabajo ", "trabajo", "Personal"], storage);
  assert.equal(updated.ok, true);
  assert.equal(updated.updatedCount, 1);
  assert.deepEqual(loadHistory(storage).items.find((item) => item.id === record.id).tags, ["trabajo", "personal"]);
  assert.equal(updateHistoryTags(record.id, ["x".repeat(MAX_HISTORY_TAG_LENGTH + 1)], storage).ok, false);
  assert.deepEqual(loadHistory(storage).items.find((item) => item.id === record.id).tags, ["trabajo", "personal"]);
});

test("bulk tag operations add and remove tags atomically", () => {
  const storage = new MemoryStorage();
  const one = addHistoryRecord({ source: "generated", kind: "text", content: "uno" }, storage).record;
  const two = addHistoryRecord({ source: "scanned", kind: "text", content: "dos" }, storage).record;
  const added = updateHistoryTagsForRecords([one.id, two.id, two.id], { mode: "add", tags: ["Trabajo", "personal"] }, storage);
  assert.equal(added.ok, true);
  assert.equal(added.updatedCount, 2);
  assert.deepEqual(loadHistory(storage).items.map((item) => item.tags), [["trabajo", "personal"], ["trabajo", "personal"]]);
  const removed = updateHistoryTagsForRecords([one.id, two.id], { mode: "remove", tags: ["PERSONAL"] }, storage);
  assert.equal(removed.ok, true);
  assert.equal(removed.updatedCount, 2);
  assert.deepEqual(loadHistory(storage).items.map((item) => item.tags), [["trabajo"], ["trabajo"]]);
  assert.equal(updateHistoryTagsForRecords([], { mode: "add", tags: ["x"] }, storage).ok, false);
});

test("bulk tag limits fail atomically", () => {
  const storage = new MemoryStorage();
  const one = addHistoryRecord({ source: "generated", kind: "text", content: "uno" }, storage).record;
  const two = addHistoryRecord({ source: "generated", kind: "text", content: "dos" }, storage).record;
  const many = Array.from({ length: MAX_HISTORY_TAGS_PER_RECORD }, (_, index) => "tag" + index);
  assert.equal(updateHistoryTags(one.id, many, storage).ok, true);
  const before = storage.getItem(HISTORY_STORAGE_KEY);
  const result = updateHistoryTagsForRecords([one.id, two.id], { mode: "add", tags: ["exceso"] }, storage);
  assert.equal(result.ok, false);
  assert.equal(storage.getItem(HISTORY_STORAGE_KEY), before);
  assert.deepEqual(loadHistory(storage).items.find((item) => item.id === two.id).tags, []);
});

test("older backup files without tags restore with an empty tag list", () => {
  const storage = new MemoryStorage();
  const legacyRecord = {
    id: "legacy-no-tags",
    source: "generated",
    kind: "text",
    content: "legacy",
    createdAt: new Date().toISOString(),
    favorite: false,
  };
  const validated = validateHistoryBackup({ format: HISTORY_BACKUP_FORMAT, version: 1, items: [legacyRecord] });
  assert.equal(validated.ok, true);
  assert.deepEqual(validated.backup.items[0].tags, []);
  assert.equal(importHistoryBackup(validated.backup, { mode: "replace" }, storage).ok, true);
  assert.deepEqual(loadHistory(storage).items[0].tags, []);
});
