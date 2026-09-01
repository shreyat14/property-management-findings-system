const assert = require("node:assert/strict");
const test = require("node:test");
const { UserRole } = require("@prisma/client");
const express = require("express");

const { authenticate } = require("../src/middleware/authenticate");
const { authorizeRoles } = require("../src/middleware/authorizeRoles");
const { generateToken } = require("../src/utils/jwt");

const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;
let baseUrl;
let server;

test.before(async () => {
  process.env.JWT_SECRET = "authorization-test-secret-not-used-outside-tests";
  process.env.JWT_EXPIRES_IN = "1h";

  const app = express();

  app.get(
    "/admin-only",
    authenticate,
    authorizeRoles(UserRole.ADMIN),
    (_req, res) => res.json({ allowed: true }),
  );
  app.get(
    "/inspection-review",
    authenticate,
    authorizeRoles(UserRole.INSPECTOR, UserRole.REVIEWER),
    (_req, res) => res.json({ allowed: true }),
  );

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }

  if (originalExpiration === undefined) {
    delete process.env.JWT_EXPIRES_IN;
  } else {
    process.env.JWT_EXPIRES_IN = originalExpiration;
  }
});

function authorizationHeader(role) {
  const token = generateToken({
    id: `${role.toLowerCase()}-user`,
    role,
  });

  return { authorization: `Bearer ${token}` };
}

test("ADMIN can access an ADMIN-only route", async () => {
  const response = await fetch(`${baseUrl}/admin-only`, {
    headers: authorizationHeader(UserRole.ADMIN),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { allowed: true });
});

test("INSPECTOR receives 403 from an ADMIN-only route", async () => {
  const response = await fetch(`${baseUrl}/admin-only`, {
    headers: authorizationHeader(UserRole.INSPECTOR),
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: { message: "Forbidden" },
  });
});

test("REVIEWER receives 403 from an ADMIN-only route", async () => {
  const response = await fetch(`${baseUrl}/admin-only`, {
    headers: authorizationHeader(UserRole.REVIEWER),
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: { message: "Forbidden" },
  });
});

test("missing authentication receives 401 before role authorization", async () => {
  const response = await fetch(`${baseUrl}/admin-only`);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: { message: "Authentication required" },
  });
});

test("invalid authentication receives 401 before role authorization", async () => {
  const response = await fetch(`${baseUrl}/admin-only`, {
    headers: { authorization: "Bearer invalid.token.value" },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: { message: "Authentication required" },
  });
});

test("multiple configured roles are allowed", async () => {
  for (const role of [UserRole.INSPECTOR, UserRole.REVIEWER]) {
    const response = await fetch(`${baseUrl}/inspection-review`, {
      headers: authorizationHeader(role),
    });

    assert.equal(response.status, 200);
  }
});
