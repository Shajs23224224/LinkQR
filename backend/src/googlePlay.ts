import { google, androidpublisher_v3 } from "googleapis";

export type VerifiedPurchase = {
  purchaseToken: string;
  productId: string;
  purchaseState: number | null;
  acknowledgementState: number | null;
};

export class GooglePlayVerifier {
  private readonly publisher: androidpublisher_v3.Androidpublisher;

  constructor(serviceAccountJsonBase64: string) {
    const json = Buffer.from(serviceAccountJsonBase64, "base64").toString("utf8");
    const credentials = JSON.parse(json) as Record<string, unknown>;

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"]
    });

    this.publisher = google.androidpublisher({
      version: "v3",
      auth
    });
  }

  async verifyOneTimeProduct(
    packageName: string,
    productId: string,
    purchaseToken: string
  ): Promise<VerifiedPurchase> {
    const response = await this.publisher.purchases.products.get({
      packageName,
      productId,
      token: purchaseToken
    });

    return {
      purchaseToken,
      productId,
      purchaseState: response.data.purchaseState ?? null,
      acknowledgementState: response.data.acknowledgementState ?? null
    };
  }

  async acknowledgeOneTimeProduct(
    packageName: string,
    productId: string,
    purchaseToken: string
  ): Promise<void> {
    await this.publisher.purchases.products.acknowledge({
      packageName,
      productId,
      token: purchaseToken,
      requestBody: {}
    });
  }
}
