import { describe, expect, it } from "vitest";
import { buildServer } from "./server.js";
import { AuthStore } from "./authStore.js";
import type { GooglePlayVerifier } from "./googlePlay.js";
import type { PurchaseStore } from "./store.js";

const auth = {
  enabled: true,
  sessionDays: 30
};

function createApp() {
  const authStore = new AuthStore(":memory:", 60 * 60 * 1000);
  const app = buildServer(
    {} as GooglePlayVerifier,
    {} as PurchaseStore,
    {
      packageName: "com.linkqr",
      proProductId: "linkqr_pro",
      auth,
      authStore
    }
  );
  return { app, authStore };
}

describe("User authentication API", () => {
  it("registers, authenticates, reads the session and logs out", async () => {
    const { app, authStore } = createApp();

    const register = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: " User@example.com ",
        password: "correct-horse-battery-staple",
        name: "Demo User"
      }
    });

    expect(register.statusCode).toBe(201);
    expect(register.json().user).toMatchObject({
      email: "user@example.com",
      name: "Demo User"
    });

    const token = register.json().session.token as string;
    expect(token).toBeTruthy();

    const me = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      authenticated: true,
      user: {
        email: "user@example.com"
      }
    });

    const logout = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toEqual({ loggedOut: true });

    const afterLogout = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(afterLogout.statusCode).toBe(401);
    expect(authStore.findUserByEmail("user@example.com")?.id).toBeTruthy();

    await app.close();
    authStore.close();
  });

  it("rejects invalid credentials and duplicate registration", async () => {
    const { app, authStore } = createApp();

    const register = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "user@example.com",
        password: "correct-password"
      }
    });

    expect(register.statusCode).toBe(201);

    const wrongPassword = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "USER@example.com",
        password: "wrong-password"
      }
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(wrongPassword.json()).toEqual({
      authenticated: false,
      error: "INVALID_CREDENTIALS"
    });

    const duplicate = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "USER@example.com",
        password: "another-password"
      }
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({
      created: false,
      error: "EMAIL_ALREADY_REGISTERED"
    });

    await app.close();
    authStore.close();
  });

  it("rejects missing authentication for the current-user endpoint", async () => {
    const { app, authStore } = createApp();

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/me"
    });

    expect(response.statusCode).toBe(401);

    await app.close();
    authStore.close();
  });
});
