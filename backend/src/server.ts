import Fastify from "fastify";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { GooglePlayVerifier } from "./googlePlay.js";
import { PurchaseStore } from "./store.js";
import { SaaSStore } from "./saasStore.js";
import { registerSaaSRoutes } from "./saasRoutes.js";
import type { SaaSStoreLike } from "./saasRoutes.js";
import type { SaaSConfig } from "./saas.js";
import { AuthStore } from "./authStore.js";
import { registerAuthRoutes } from "./authRoutes.js";
import type { AuthConfig } from "./auth.js";
import { getAuthenticatedUser } from "./authRoutes.js";
import type { AuthStoreLike } from "./authRoutes.js";

const requestSchema = z.object({
  purchaseToken: z.string().min(1).max(4096),
  productId: z.string().min(1)
});

export type BillingServerOptions = {
  packageName: string;
  proProductId: string;
  auth?: AuthConfig;
  authStore?: AuthStoreLike;
  saas?: SaaSConfig;
  saasStore?: SaaSStoreLike;
};

export function buildServer(
  verifier: Pick<
    GooglePlayVerifier,
    "verifyOneTimeProduct" | "acknowledgeOneTimeProduct"
  >,
  store: Pick<PurchaseStore, "hasPurchaseToken" | "save">,
  options: BillingServerOptions
) {
  const app = Fastify({
    logger: true,
    bodyLimit: 64 * 1024
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    return payload;
  });

  if (options.auth?.enabled && options.authStore) {
    registerAuthRoutes(app, options.authStore, options.auth);
  }

  if (options.saas?.enabled && options.saasStore) {
    registerSaaSRoutes(
      app,
      options.saasStore,
      options.saas,
      options.auth?.enabled ? options.authStore : undefined
    );
  }

  app.get("/health", async () => ({
    ok: true,
    service: "linkqr-billing-backend"
  }));

  app.get("/ready", async () => ({
    ready: true,
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

    const { purchaseToken, productId } = parsed.data;

    if (productId !== options.proProductId) {
      return reply.code(400).send({
        verified: false,
        error: "UNKNOWN_PRODUCT"
      });
    }

    let authenticatedUserId: string | null = null;
    if (options.auth?.enabled && options.authStore) {
      const user = getAuthenticatedUser(request, options.authStore);
      if (!user) {
        return reply.code(401).send({
          verified: false,
          error: "UNAUTHORIZED"
        });
      }
      authenticatedUserId = user.id;
    }

    try {
      const alreadyKnown = store.hasPurchaseToken(purchaseToken);

      const purchase = await verifier.verifyOneTimeProduct(
        options.packageName,
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
          options.packageName,
          productId,
          purchaseToken
        );
      }

      store.save({
        purchaseToken,
        productId,
        userId: authenticatedUserId,
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
  const config = loadConfig();

  const verifier = new GooglePlayVerifier(
    config.GOOGLE_SERVICE_ACCOUNT_JSON_B64
  );
  const store = new PurchaseStore(config.DATABASE_PATH);
  const saasStore = new SaaSStore(config.DATABASE_PATH);
  const authStore = new AuthStore(
    config.DATABASE_PATH,
    config.AUTH.sessionDays * 24 * 60 * 60 * 1000
  );

  const app = buildServer(verifier, store, {
    packageName: config.GOOGLE_PLAY_PACKAGE_NAME,
    proProductId: config.GOOGLE_PLAY_PRO_PRODUCT_ID,
    auth: config.AUTH,
    authStore,
    saas: config.SAAS,
    saasStore
  });

  const close = async () => {
    await app.close();
    store.close();
    saasStore.close();
    authStore.close();
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
