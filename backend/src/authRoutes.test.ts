import { describe, expect, it, vi } from "vitest";
import { buildServer } from "./server.js";
import { AuthStore } from "./authStore.js";
import type { AuthEmailMessage } from "./authEmail.js";
import type { GooglePlayVerifier } from "./googlePlay.js";
import type { PurchaseStore } from "./store.js";

const auth = {
  enabled: true,
  sessionDays: 30
};

function createApp() {
  const authStore = new AuthStore(":memory:", 60 * 60 * 1000, 60 * 60 * 1000, 30 * 60 * 1000);
  const emails: AuthEmailMessage[] = [];
  const emailSender = {
    send: vi.fn(async (message: AuthEmailMessage) => {
      emails.push(message);
    })
  };

  const app = buildServer(
    {} as GooglePlayVerifier,
    {} as PurchaseStore,
    {
      packageName: "com.linkqr",
      proProductId: "linkqr_pro",
      auth,
      authStore,
      authEmailSender: emailSender
    }
  );

  return { app, authStore, emails, emailSender };
}

async function registerAndVerify(
  app: Awaited<ReturnType<typeof buildServer>>,
  emails: AuthEmailMessage[]
) {
  const register = await app.inject({
    method: "POST",
    url: "/v1/auth/register",
    payload: {
      email: "user@example.com",
      password: "correct-password",
      name: "Demo User"
    }
  });

  expect(register.statusCode).toBe(201);
  const verification = emails.find((message) => message.type === "VERIFY_EMAIL");
  expect(verification).toBeTruthy();

  const verified = await app.inject({
    method: "POST",
    url: "/v1/auth/verify-email",
    payload: {
      token: verification!.token
    }
  });

  expect(verified.statusCode).toBe(200);
  expect(verified.json().verified).toBe(true);
}

describe("User authentication API", () => {
  it("requires email verification before login", async () => {
    const { app, authStore, emails, emailSender } = createApp();

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
    expect(register.json()).toMatchObject({
      created: true,
      emailVerified: false,
      verificationRequired: true,
      user: {
        email: "user@example.com",
        name: "Demo User",
        emailVerified: false
      }
    });
    expect(emailSender.send).toHaveBeenCalledOnce();

    const loginBeforeVerification = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "user@example.com",
        password: "correct-horse-battery-staple"
      }
    });

    expect(loginBeforeVerification.statusCode).toBe(403);
    expect(loginBeforeVerification.json()).toEqual({
      authenticated: false,
      error: "EMAIL_NOT_VERIFIED"
    });

    expect(emails[0].type).toBe("VERIFY_EMAIL");

    await app.close();
    authStore.close();
  });

  it("verifies email and then supports session lifecycle", async () => {
    const { app, authStore, emails } = createApp();

    await registerAndVerify(app, emails);

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "user@example.com",
        password: "correct-password"
      }
    });

    expect(login.statusCode).toBe(200);
    const token = login.json().session.token as string;

    const me = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      authenticated: true,
      user: {
        email: "user@example.com",
        emailVerified: true
      }
    });

    const sessions = await app.inject({
      method: "GET",
      url: "/v1/auth/sessions",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(sessions.statusCode).toBe(200);
    expect(sessions.json().sessions).toHaveLength(1);
    expect(sessions.json().sessions[0].current).toBe(true);

    const logout = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(logout.statusCode).toBe(200);

    const afterLogout = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${token}` }
    });

    expect(afterLogout.statusCode).toBe(401);
    expect(authStore.findUserByEmail("user@example.com")?.emailVerified).toBe(true);

    await app.close();
    authStore.close();
  });

  it("supports password reset and revokes existing sessions", async () => {
    const { app, authStore, emails } = createApp();

    await registerAndVerify(app, emails);

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "user@example.com",
        password: "correct-password"
      }
    });

    expect(login.statusCode).toBe(200);
    const oldToken = login.json().session.token as string;

    const request = await app.inject({
      method: "POST",
      url: "/v1/auth/password-reset/request",
      payload: { email: "USER@example.com" }
    });

    expect(request.statusCode).toBe(202);

    const resetEmail = emails.filter((message) => message.type === "PASSWORD_RESET").at(-1);
    expect(resetEmail).toBeTruthy();

    const reset = await app.inject({
      method: "POST",
      url: "/v1/auth/password-reset/confirm",
      payload: {
        token: resetEmail!.token,
        password: "new-password-123"
      }
    });

    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toEqual({ reset: true });

    const oldSession = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${oldToken}` }
    });

    expect(oldSession.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "user@example.com",
        password: "new-password-123"
      }
    });

    expect(newLogin.statusCode).toBe(200);

    await app.close();
    authStore.close();
  });

  it("changes password and creates a replacement session", async () => {
    const { app, authStore, emails } = createApp();

    await registerAndVerify(app, emails);

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "user@example.com",
        password: "correct-password"
      }
    });

    const token = login.json().session.token as string;

    const change = await app.inject({
      method: "POST",
      url: "/v1/auth/password/change",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        currentPassword: "correct-password",
        newPassword: "changed-password"
      }
    });

    expect(change.statusCode).toBe(200);
    expect(change.json().changed).toBe(true);

    const oldSession = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${token}` }
    });
    expect(oldSession.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "user@example.com",
        password: "changed-password"
      }
    });
    expect(newLogin.statusCode).toBe(200);

    await app.close();
    authStore.close();
  });

  it("resends verification without revealing whether an email exists", async () => {
    const { app, authStore, emails } = createApp();

    const register = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "user@example.com",
        password: "correct-password"
      }
    });
    expect(register.statusCode).toBe(201);

    const before = emails.length;

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/resend-verification",
      payload: { email: "missing@example.com" }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().sent).toBe(true);
    expect(emails.length).toBe(before);

    await app.close();
    authStore.close();
  });

  it("revokes another session without revoking the current session", async () => {
    const { app, authStore, emails } = createApp();

    await registerAndVerify(app, emails);

    const first = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "user@example.com",
        password: "correct-password"
      }
    });

    const second = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "user@example.com",
        password: "correct-password"
      }
    });

    const firstToken = first.json().session.token as string;
    const secondToken = second.json().session.token as string;
    const secondSessionId = second.json().session.sessionId as string;

    const sessions = await app.inject({
      method: "GET",
      url: "/v1/auth/sessions",
      headers: { authorization: `Bearer ${firstToken}` }
    });

    expect(sessions.json().sessions).toHaveLength(2);

    const revoke = await app.inject({
      method: "DELETE",
      url: `/v1/auth/sessions/${secondSessionId}`,
      headers: { authorization: `Bearer ${firstToken}` }
    });

    expect(revoke.statusCode).toBe(200);

    const revoked = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${secondToken}` }
    });
    expect(revoked.statusCode).toBe(401);

    const current = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${firstToken}` }
    });
    expect(current.statusCode).toBe(200);

    await app.close();
    authStore.close();
  });

  it("rejects invalid credentials and duplicate registration", async () => {
    const { app, authStore, emails } = createApp();

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

    const duplicate = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: "USER@example.com",
        password: "another-password"
      }
    });

    expect(duplicate.statusCode).toBe(409);

    expect(emails).toHaveLength(1);

    await app.close();
    authStore.close();
  });

  it("rate limits repeated login attempts", async () => {
    const { app, authStore, emails } = createApp();

    await registerAndVerify(app, emails);

    for (let i = 0; i < 10; i += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: {
          email: "user@example.com",
          password: "wrong-password"
        }
      });
      expect(response.statusCode).toBe(401);
    }

    const limited = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: {
        email: "user@example.com",
        password: "wrong-password"
      }
    });

    expect(limited.statusCode).toBe(429);
    expect(limited.json().error).toBe("RATE_LIMITED");

    await app.close();
    authStore.close();
  });

  it("rejects missing authentication for protected endpoints", async () => {
    const { app, authStore } = createApp();

    const response = await app.inject({
      method: "GET",
      url: "/v1/auth/sessions"
    });

    expect(response.statusCode).toBe(401);

    await app.close();
    authStore.close();
  });

  it("requires an authenticated user for the current-user endpoint", async () => {
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
