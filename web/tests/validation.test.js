import test from "node:test";
import assert from "node:assert/strict";
import { MAX_QR_PAYLOAD_BYTES, validateQrInput } from "../src/features/generator/validation.js";

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
