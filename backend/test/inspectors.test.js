const assert = require("node:assert/strict");
const test = require("node:test");
const { UserRole } = require("@prisma/client");

const { createApp } = require("../src/app");
const { generateToken } = require("../src/utils/jwt");
const { verifyPassword } = require("../src/utils/password");

const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;
const timestamps = {
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
};

let baseUrl;
let createCalls;
let findManyCalls;
let server;
let users;

function resetUsers() {
  users = [
    {
      id: "admin-user",
      email: "admin@property-findings.local",
      passwordHash: "admin-hash",
      role: UserRole.ADMIN,
      ...timestamps,
    },
    {
      id: "inspector-b",
      email: "zeta.inspector@property-findings.local",
      passwordHash: "inspector-b-hash",
      role: UserRole.INSPECTOR,
      ...timestamps,
    },
    {
      id: "inspector-a",
      email: "alpha.inspector@property-findings.local",
      passwordHash: "inspector-a-hash",
      role: UserRole.INSPECTOR,
      ...timestamps,
    },
    {
      id: "reviewer-user",
      email: "reviewer@property-findings.local",
      passwordHash: "reviewer-hash",
      role: UserRole.REVIEWER,
      ...timestamps,
    },
  ];
  createCalls = [];
  findManyCalls = [];
}

function selectFields(record, select) {
  return Object.fromEntries(
    Object.keys(select).map((field) => [field, record[field]]),
  );
}

const prisma = {
  user: {
    findMany: async (query) => {
      findManyCalls.push(query);
      return users
        .filter((user) => user.role === query.where.role)
        .sort((left, right) => left.email.localeCompare(right.email))
        .map((user) => selectFields(user, query.select));
    },
    create: async (query) => {
      createCalls.push(query);

      if (users.some((user) => user.email === query.data.email)) {
        const error = new Error("Unique constraint failed");
        error.code = "P2002";
        throw error;
      }

      const user = {
        id: `created-user-${createCalls.length}`,
        ...query.data,
        ...timestamps,
      };
      users.push(user);
      return selectFields(user, query.select);
    },
  },
};

test.before(async () => {
  process.env.JWT_SECRET = "inspector-management-test-secret";
  process.env.JWT_EXPIRES_IN = "1h";

  const app = createApp({ checkDatabase: async () => {}, prisma });
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/users/inspectors`;
});

test.beforeEach(() => {
  resetUsers();
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
  const token = generateToken({ id: `${role.toLowerCase()}-caller`, role });
  return { authorization: `Bearer ${token}` };
}

async function request({
  role = UserRole.ADMIN,
  method = "GET",
  body,
  authenticated = true,
} = {}) {
  const headers = authenticated ? authorizationHeader(role) : {};

  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(baseUrl, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { response, body: await response.json() };
}

test("ADMIN lists only inspectors without password hashes", async () => {
  const result = await request();

  assert.equal(result.response.status, 200);
  assert.deepEqual(
    result.body.inspectors.map((inspector) => inspector.email),
    [
      "alpha.inspector@property-findings.local",
      "zeta.inspector@property-findings.local",
    ],
  );
  assert.ok(
    result.body.inspectors.every(
      (inspector) => inspector.role === UserRole.INSPECTOR,
    ),
  );
  assert.equal(JSON.stringify(result.body).includes("password"), false);
  assert.deepEqual(findManyCalls[0].where, { role: UserRole.INSPECTOR });
  assert.equal(findManyCalls[0].select.passwordHash, undefined);
});

test("ADMIN receives an empty inspector list when none exist", async () => {
  users = users.filter((user) => user.role !== UserRole.INSPECTOR);
  const result = await request();

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { inspectors: [] });
});

test("inspector endpoints require authentication", async () => {
  const list = await request({ authenticated: false });
  const create = await request({
    authenticated: false,
    method: "POST",
    body: {
      email: "new.inspector@property-findings.local",
      password: "InspectorPassword123!",
    },
  });

  assert.equal(list.response.status, 401);
  assert.equal(create.response.status, 401);
  assert.deepEqual(list.body, { error: { message: "Authentication required" } });
  assert.equal(createCalls.length, 0);
});

test("INSPECTOR and REVIEWER cannot list or create inspectors", async () => {
  for (const role of [UserRole.INSPECTOR, UserRole.REVIEWER]) {
    const list = await request({ role });
    const create = await request({
      role,
      method: "POST",
      body: {
        email: "new.inspector@property-findings.local",
        password: "InspectorPassword123!",
      },
    });

    assert.equal(list.response.status, 403);
    assert.equal(create.response.status, 403);
    assert.deepEqual(list.body, { error: { message: "Forbidden" } });
  }

  assert.equal(createCalls.length, 0);
});

test("ADMIN creates an INSPECTOR with a hashed password", async () => {
  const password = "InspectorPassword123!";
  const result = await request({
    method: "POST",
    body: {
      email: "  New.Inspector@Property-Findings.Local  ",
      password,
    },
  });

  assert.equal(result.response.status, 201);
  assert.deepEqual(result.body.inspector, {
    id: "created-user-1",
    email: "new.inspector@property-findings.local",
    role: UserRole.INSPECTOR,
  });
  assert.equal(createCalls[0].data.role, UserRole.INSPECTOR);
  assert.notEqual(createCalls[0].data.passwordHash, password);
  assert.equal(await verifyPassword(password, createCalls[0].data.passwordHash), true);
  assert.equal("password" in createCalls[0].data, false);
  assert.equal(JSON.stringify(result.body).includes("password"), false);
});

test("inspector creation rejects missing, invalid, unknown, and role fields", async () => {
  const invalidBodies = [
    undefined,
    {},
    { email: "invalid", password: "Password123!" },
    { email: "inspector@example.com", password: "" },
    { email: "inspector@example.com", password: "Password123!", name: "Name" },
    {
      email: "inspector@example.com",
      password: "Password123!",
      role: UserRole.ADMIN,
    },
  ];

  for (const body of invalidBodies) {
    const result = await request({ method: "POST", body });

    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, {
      error: { message: "Invalid inspector input" },
    });
  }

  assert.equal(createCalls.length, 0);
});

test("duplicate inspector email returns a clean conflict response", async () => {
  const result = await request({
    method: "POST",
    body: {
      email: "ALPHA.INSPECTOR@property-findings.local",
      password: "InspectorPassword123!",
    },
  });

  assert.equal(result.response.status, 409);
  assert.deepEqual(result.body, {
    error: { message: "A user with this email already exists" },
  });
  assert.equal(JSON.stringify(result.body).includes("P2002"), false);
});
