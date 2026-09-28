import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  GOOGLE_PLAY_PACKAGE_NAME: z.string().min(1),
  GOOGLE_PLAY_PRO_PRODUCT_ID: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_JSON_B64: z.string().min(1),
  DATABASE_PATH: z.string().min(1).default("./linkqr-billing.db"),
  DATABASE_BACKUP_DIR: z.string().min(1).optional(),
  DATABASE_BACKUP_INTERVAL_HOURS: z.coerce.number().nonnegative().max(168).default(24),
  LINKQR_AUTH_ENABLED: z.enum(["true", "false"]).default("false"),
  LINKQR_AUTH_SESSION_DAYS: z.coerce.number().int().positive().max(365).default(30),
  LINKQR_AUTH_EMAIL_WEBHOOK_URL: z.string().url().optional(),
  LINKQR_AUTH_EMAIL_WEBHOOK_TOKEN: z.string().min(32).optional(),
  LINKQR_AUTH_EMAIL_VERIFICATION_HOURS: z.coerce.number().positive().max(168).default(24),
  LINKQR_AUTH_PASSWORD_RESET_MINUTES: z.coerce.number().positive().max(120).default(30),
  LINKQR_SAAS_ENABLED: z.enum(["true", "false"]).default("false"),
  LINKQR_SAAS_API_KEY: z.string().min(32).optional(),
  LINKQR_SAAS_FREE_QR_LIMIT: z.coerce.number().int().positive().default(100),
  LINKQR_SAAS_PRO_QR_LIMIT: z.coerce.number().int().positive().default(10000),
  LINKQR_OBSERVABILITY_TOKEN: z.string().min(32).optional()
});

export function loadConfig() {
  const parsed = schema.parse(process.env);
  const authEnabled = parsed.LINKQR_AUTH_ENABLED === "true";
  const saasEnabled = parsed.LINKQR_SAAS_ENABLED === "true";

  if (saasEnabled && !parsed.LINKQR_SAAS_API_KEY) {
    throw new Error(
      "LINKQR_SAAS_API_KEY is required when LINKQR_SAAS_ENABLED=true."
    );
  }

  if (authEnabled) {
    if (!parsed.LINKQR_AUTH_EMAIL_WEBHOOK_URL) {
      throw new Error(
        "LINKQR_AUTH_EMAIL_WEBHOOK_URL is required when LINKQR_AUTH_ENABLED=true."
      );
    }
    if (!parsed.LINKQR_AUTH_EMAIL_WEBHOOK_TOKEN) {
      throw new Error(
        "LINKQR_AUTH_EMAIL_WEBHOOK_TOKEN is required when LINKQR_AUTH_ENABLED=true."
      );
    }
  }

  return {
    ...parsed,
    AUTH: {
      enabled: authEnabled,
      sessionDays: parsed.LINKQR_AUTH_SESSION_DAYS,
      verificationLifetimeMs: parsed.LINKQR_AUTH_EMAIL_VERIFICATION_HOURS * 60 * 60 * 1000,
      passwordResetLifetimeMs: parsed.LINKQR_AUTH_PASSWORD_RESET_MINUTES * 60 * 1000
    },
    SAAS: {
      enabled: saasEnabled,
      apiKey: parsed.LINKQR_SAAS_API_KEY ?? "disabled",
      freeQrLimit: parsed.LINKQR_SAAS_FREE_QR_LIMIT,
      proQrLimit: parsed.LINKQR_SAAS_PRO_QR_LIMIT
    },
    OBSERVABILITY_TOKEN: parsed.LINKQR_OBSERVABILITY_TOKEN,
    DATABASE_BACKUP: {
      enabled:
        Boolean(parsed.DATABASE_BACKUP_DIR) &&
        parsed.DATABASE_BACKUP_INTERVAL_HOURS > 0,
      directory: parsed.DATABASE_BACKUP_DIR,
      intervalMs: parsed.DATABASE_BACKUP_INTERVAL_HOURS * 60 * 60 * 1000
    }
  };
}
