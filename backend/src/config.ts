import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  GOOGLE_PLAY_PACKAGE_NAME: z.string().min(1),
  GOOGLE_PLAY_PRO_PRODUCT_ID: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_JSON_B64: z.string().min(1),
  DATABASE_PATH: z.string().min(1).default("./linkqr-billing.db"),
  LINKQR_SAAS_ENABLED: z.enum(["true", "false"]).default("false"),
  LINKQR_SAAS_API_KEY: z.string().min(1).optional(),
  LINKQR_SAAS_FREE_QR_LIMIT: z.coerce.number().int().positive().default(100),
  LINKQR_SAAS_PRO_QR_LIMIT: z.coerce.number().int().positive().default(10000)
});

export function loadConfig() {
  const parsed = schema.parse(process.env);
  const enabled = parsed.LINKQR_SAAS_ENABLED === "true";

  if (enabled && !parsed.LINKQR_SAAS_API_KEY) {
    throw new Error(
      "LINKQR_SAAS_API_KEY is required when LINKQR_SAAS_ENABLED=true."
    );
  }

  return {
    ...parsed,
    SAAS: {
      enabled,
      apiKey: parsed.LINKQR_SAAS_API_KEY ?? "disabled",
      freeQrLimit: parsed.LINKQR_SAAS_FREE_QR_LIMIT,
      proQrLimit: parsed.LINKQR_SAAS_PRO_QR_LIMIT
    }
  };
}
