import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const ENV_KEYS = [
  "GOOGLE_PLAY_PACKAGE_NAME",
  "GOOGLE_PLAY_PRO_PRODUCT_ID",
  "GOOGLE_SERVICE_ACCOUNT_JSON_B64",
  "LINKQR_SAAS_ENABLED",
  "LINKQR_SAAS_API_KEY"
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
