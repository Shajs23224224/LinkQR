import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const ENV_KEYS = [
  "GOOGLE_PLAY_PACKAGE_NAME",
  "GOOGLE_PLAY_PRO_PRODUCT_ID",
  "GOOGLE_SERVICE_ACCOUNT_JSON_B64",
  "LINKQR_SAAS_ENABLED",
  "LINKQR_SAAS_API_KEY",
  "LINKQR_AUTH_ENABLED",
  "LINKQR_AUTH_EMAIL_WEBHOOK_URL",
  "LINKQR_AUTH_EMAIL_WEBHOOK_TOKEN"
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
);

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("production configuration", () => {
  it("rejects a weak SaaS API key", () => {
    Object.assign(process.env, {
      GOOGLE_PLAY_PACKAGE_NAME: "com.linkqr",
      GOOGLE_PLAY_PRO_PRODUCT_ID: "linkqr_pro",
      GOOGLE_SERVICE_ACCOUNT_JSON_B64: "test-service-account",
      LINKQR_SAAS_ENABLED: "true",
      LINKQR_SAAS_API_KEY: "x".repeat(31)
    });

    expect(() => loadConfig()).toThrow();
  });

  it("enables automated backups when a directory and interval are configured", () => {
    Object.assign(process.env, {
      GOOGLE_PLAY_PACKAGE_NAME: "com.linkqr",
      GOOGLE_PLAY_PRO_PRODUCT_ID: "linkqr_pro",
      GOOGLE_SERVICE_ACCOUNT_JSON_B64: "test-service-account",
      DATABASE_BACKUP_DIR: "./backups",
      DATABASE_BACKUP_INTERVAL_HOURS: "12"
    });

    const config = loadConfig();

    expect(config.DATABASE_BACKUP.enabled).toBe(true);
    expect(config.DATABASE_BACKUP.intervalMs).toBe(12 * 60 * 60 * 1000);
  });

  it("accepts a 32-character SaaS API key", () => {
    Object.assign(process.env, {
      GOOGLE_PLAY_PACKAGE_NAME: "com.linkqr",
      GOOGLE_PLAY_PRO_PRODUCT_ID: "linkqr_pro",
      GOOGLE_SERVICE_ACCOUNT_JSON_B64: "test-service-account",
      LINKQR_SAAS_ENABLED: "true",
      LINKQR_SAAS_API_KEY: "x".repeat(32)
    });

    const config = loadConfig();

    expect(config.SAAS.enabled).toBe(true);
    expect(config.SAAS.apiKey).toHaveLength(32);
  });
});
