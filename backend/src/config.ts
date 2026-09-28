import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  GOOGLE_PLAY_PACKAGE_NAME: z.string().min(1),
  GOOGLE_PLAY_PRO_PRODUCT_ID: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_JSON_B64: z.string().min(1),
  DATABASE_PATH: z.string().min(1).default("./linkqr-billing.db")
});

export const config = schema.parse(process.env);
