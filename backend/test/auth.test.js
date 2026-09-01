const assert = require("node:assert/strict");
const test = require("node:test");

const { createApp } = require("../src/app");
const { generateToken } = require("../src/utils/jwt");
const { hashPassword } = require("../src/utils/password");

const credentials = [
  {
    id: "admin-user",
    email: "admin.demo@property-findings.local",
    password: "AdminDemo123!",
    role: "ADMIN",
  },
  {
    id: "inspector-user",
    email: "inspector.demo@property-findings.local",
    password: "InspectorDemo123!",
    role: "INSPECTOR",
  },
  {
    id: "reviewer-user",
    email: "reviewer.demo@property-findings.local",
    password: "ReviewerDemo123!",
    role: "REVIEWER",
  },
];

const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;
let baseUrl;
let server;
let users;

test.before(async () => {
  process.env.JWT_SECRET = "auth-flow-test-secret-that-is-not-used-outside-tests";
  process.env.JWT_EXPIRES_IN = "1h";

  users = await Promise.all(
    credentials.map(async ({ password, ...user }) => ({
      ...user,
      passwordHash: await hashPassword(password),
    })),
  );

  const prisma = {
    user: {
      findUnique: async ({ where }) => {
        if (where.email) {
          return users.find((user) => user.email === where.email) || null;
        }

        if (where.id) {
          return users.find((user) => user.id === where.id) || null;
        }

        return null;
      },
    },
  };
  const app = createApp({
    checkDatabase: async () => {},
    prisma,
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
});

test.beforeEach(() => {
  process.env.JWT_EXPIRES_IN = "1h";
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

async function login(email, password) {
  const response = await fetch(`${baseUrl}/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return { response, body: await response.json() };
}

test("valid login returns a JWT and safe user information", async () => {
  const admin = credentials[0];
  const { response, body } = await login(admin.email, admin.password);

  assert.equal(response.status, 200);
  assert.equal(typeof body.token, "string");
  assert.deepEqual(body.user, {
    id: admin.id,
    email: admin.email,
    role: admin.role,
  });
  assert.equal("passwordHash" in body.user, false);
  assert.equal(JSON.stringify(body).includes("passwordHash"), false);
});

test("incorrect password and unknown user return the same generic 401", async () => {
  const incorrectPassword = await login(
    credentials[0].email,
    "IncorrectPassword123!",
  );
  const unknownUser = await login(
    "unknown.user@property-findings.local",
    "IncorrectPassword123!",
  );

  assert.equal(incorrectPassword.response.status, 401);
  assert.equal(unknownUser.response.status, 401);
  assert.deepEqual(incorrectPassword.body, unknownUser.body);
  assert.deepEqual(unknownUser.body, {
    error: { message: "Invalid email or password" },
  });
});

test("missing Authorization header returns 401", async () => {
  const response = await fetch(`${baseUrl}/me`);

  assert.equal(response.status, 401);
});

test("invalid and tampered JWTs return 401", async () => {
  const token = generateToken(users[0]);
  const [header, payload, signature] = token.split(".");
  const replacement = signature[0] === "a" ? "b" : "a";
  const tokens = [
    "not-a-jwt",
    [header, payload, replacement + signature.slice(1)].join("."),
  ];

  for (const invalidToken of tokens) {
    const response = await fetch(`${baseUrl}/me`, {
      headers: { authorization: `Bearer ${invalidToken}` },
    });

    assert.equal(response.status, 401);
  }
});

test("expired JWT returns 401", async () => {
  process.env.JWT_EXPIRES_IN = "-1s";
  const token = generateToken(users[0]);
  const response = await fetch(`${baseUrl}/me`, {
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.status, 401);
});

test("ADMIN, INSPECTOR, and REVIEWER tokens return the correct /auth/me identity", async () => {
  for (const expectedUser of credentials) {
    const loginResult = await login(expectedUser.email, expectedUser.password);
    assert.equal(loginResult.response.status, 200);

    const response = await fetch(`${baseUrl}/me`, {
      headers: { authorization: `Bearer ${loginResult.body.token}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.user, {
      id: expectedUser.id,
      email: expectedUser.email,
      role: expectedUser.role,
    });
    assert.equal("passwordHash" in body.user, false);
  }
});
