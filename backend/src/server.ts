import Fastify from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import { GooglePlayVerifier } from "./googlePlay.js";
import { PurchaseStore } from "./store.js";

const requestSchema = z.object({
  purchaseToken: z.string().min(1).max(4096),
  productId: z.string().min(1),
  userId: z.string().min(1).max(256).nullable().optional()
});

export function buildServer(
  verifier: GooglePlayVerifier,
  store: PurchaseStore
) {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({
    ok: true,
    service: "linkqr-billing-backend"
  }));

  app.post("/v1/google-play/verify", async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        verified: false,
        error: "INVALID_REQUEST"
      });
    }

    const { purchaseToken, productId, userId = null } = parsed.data;

    if (productId !== config.GOOGLE_PLAY_PRO_PRODUCT_ID) {
      return reply.code(400).send({
        verified: false,
        error: "UNKNOWN_PRODUCT"
      });
    }

    try {
      const alreadyKnown = store.hasPurchaseToken(purchaseToken);

      const purchase = await verifier.verifyOneTimeProduct(
        config.GOOGLE_PLAY_PACKAGE_NAME,
        productId,
        purchaseToken
      );

      if (purchase.purchaseState !== 0) {
        return reply.code(409).send({
          verified: false,
          pro: false,
          pending: purchase.purchaseState === 2,
          error: "PURCHASE_NOT_COMPLETED"
        });
      }

      if (purchase.acknowledgementState !== 1) {
        await verifier.acknowledgeOneTimeProduct(
          config.GOOGLE_PLAY_PACKAGE_NAME,
          productId,
          purchaseToken
        );
      }

      store.save({
        purchaseToken,
        productId,
        userId,
        verifiedAt: Date.now()
      });

      return {
        verified: true,
        pro: true,
        alreadyKnown
      };
    } catch (error) {
      request.log.error(error);

      return reply.code(502).send({
        verified: false,
        error: "GOOGLE_PLAY_VERIFICATION_FAILED"
      });
    }
  });

  return app;
}

async function main() {
  const verifier = new GooglePlayVerifier(
    config.GOOGLE_SERVICE_ACCOUNT_JSON_B64
  );
  const store = new PurchaseStore(config.DATABASE_PATH);
  const app = buildServer(verifier, store);

  const close = async () => {
    await app.close();
    store.close();
  };

  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  await app.listen({
    host: "0.0.0.0",
    port: config.PORT
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
