const assert = require("node:assert/strict");
const test = require("node:test");
const { UserRole } = require("@prisma/client");

const { createApp } = require("../src/app");
const { generateToken } = require("../src/utils/jwt");

const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;
const assignments = [
  { propertyId: "property-a", inspectorId: "inspector-a" },
  { propertyId: "property-b", inspectorId: "inspector-b" },
];

let baseUrl;
let createCalls;
let lastFindManyWhere;
let properties;
let server;

function resetData() {
  properties = [
    {
      id: "property-a",
      name: "Property A",
      address: "100 A Street",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    {
      id: "property-b",
      name: "Property B",
      address: "200 B Street",
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
    },
  ];
  createCalls = [];
  lastFindManyWhere = undefined;
}

function isAssigned(propertyId, inspectorId) {
  return assignments.some(
    (assignment) =>
      assignment.propertyId === propertyId &&
      assignment.inspectorId === inspectorId,
  );
}

const prisma = {
  property: {
    findMany: async ({ where } = {}) => {
      lastFindManyWhere = where;

      if (!where) {
        return properties;
      }

      const inspectorId = where.inspectorAssignments.some.inspectorId;
      return properties.filter((property) =>
        isAssigned(property.id, inspectorId),
      );
    },
    findUnique: async ({ where }) =>
      properties.find((property) => property.id === where.id) || null,
    create: async ({ data }) => {
      createCalls.push(data);
      const property = {
        id: `property-created-${createCalls.length}`,
        ...data,
        createdAt: "2026-08-31T00:00:00.000Z",
        updatedAt: "2026-08-31T00:00:00.000Z",
      };
      properties.push(property);
      return property;
    },
    update: async ({ where, data }) => {
      const property = properties.find((item) => item.id === where.id);
      Object.assign(property, data, {
        updatedAt: "2026-08-31T01:00:00.000Z",
      });
      return property;
    },
  },
  propertyInspector: {
    findUnique: async ({ where }) => {
      const assignment = where.propertyId_inspectorId;
      return isAssigned(assignment.propertyId, assignment.inspectorId)
        ? { propertyId: assignment.propertyId }
        : null;
    },
  },
};

test.before(async () => {
  process.env.JWT_SECRET = "property-api-test-secret-not-used-outside-tests";
  process.env.JWT_EXPIRES_IN = "1h";

  const app = createApp({
    checkDatabase: async () => {},
    prisma,
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/properties`;
});

test.beforeEach(() => {
  resetData();
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

function authorizationHeader(role, userId = `${role.toLowerCase()}-user`) {
  const token = generateToken({ id: userId, role });
  return { authorization: `Bearer ${token}` };
}

async function request(
  path = "",
  { role = UserRole.ADMIN, userId, method = "GET", body } = {},
) {
  const headers = authorizationHeader(role, userId);

  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { response, body: await response.json() };
}

test("ADMIN creates a property", async () => {
  const result = await request("", {
    method: "POST",
    body: { name: "  New Property  ", address: " 300 New Street " },
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.body.property.name, "New Property");
  assert.equal(result.body.property.address, "300 New Street");
  assert.deepEqual(createCalls, [
    { name: "New Property", address: "300 New Street" },
  ]);
});

test("INSPECTOR and REVIEWER cannot create properties", async () => {
  for (const role of [UserRole.INSPECTOR, UserRole.REVIEWER]) {
    const result = await request("", {
      role,
      method: "POST",
      body: { name: "Forbidden", address: "No Access" },
    });

    assert.equal(result.response.status, 403);
    assert.deepEqual(result.body, { error: { message: "Forbidden" } });
  }

  assert.equal(createCalls.length, 0);
});

test("ADMIN partially updates a property", async () => {
  const result = await request("/property-a", {
    method: "PATCH",
    body: { name: "Updated Property A" },
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.body.property.name, "Updated Property A");
  assert.equal(result.body.property.address, "100 A Street");
});

test("INSPECTOR and REVIEWER cannot update properties", async () => {
  for (const role of [UserRole.INSPECTOR, UserRole.REVIEWER]) {
    const result = await request("/property-a", {
      role,
      method: "PATCH",
      body: { name: "Forbidden update" },
    });

    assert.equal(result.response.status, 403);
    assert.deepEqual(result.body, { error: { message: "Forbidden" } });
  }
});

test("ADMIN lists and retrieves properties", async () => {
  const list = await request();
  const detail = await request("/property-b");

  assert.equal(list.response.status, 200);
  assert.deepEqual(
    list.body.properties.map((property) => property.id),
    ["property-a", "property-b"],
  );
  assert.equal(lastFindManyWhere, undefined);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.property.id, "property-b");
});

test("INSPECTOR gets an assigned property", async () => {
  const result = await request("/property-a", {
    role: UserRole.INSPECTOR,
    userId: "inspector-a",
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.body.property.id, "property-a");
});

test("INSPECTOR cannot get another inspector's property", async () => {
  const result = await request(
    "/property-b?inspectorId=inspector-b&userId=inspector-b",
    {
      role: UserRole.INSPECTOR,
      userId: "inspector-a",
    },
  );

  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: { message: "Forbidden" } });
});

test("INSPECTOR property list contains only assigned properties", async () => {
  const result = await request("?inspectorId=inspector-b&userId=inspector-b", {
    role: UserRole.INSPECTOR,
    userId: "inspector-a",
  });

  assert.equal(result.response.status, 200);
  assert.deepEqual(
    result.body.properties.map((property) => property.id),
    ["property-a"],
  );
  assert.deepEqual(lastFindManyWhere, {
    inspectorAssignments: { some: { inspectorId: "inspector-a" } },
  });
});

test("invalid or internal property fields are rejected", async () => {
  const invalidRequests = [
    { name: "Missing address" },
    { name: "Valid", address: "Valid", id: "client-selected-id" },
    { name: "   ", address: "Valid" },
  ];

  for (const body of invalidRequests) {
    const result = await request("", { method: "POST", body });

    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, {
      error: { message: "Invalid property input" },
    });
  }

  assert.equal(createCalls.length, 0);

  const invalidPatch = await request("/property-a", {
    method: "PATCH",
    body: { updatedAt: "2026-08-31T00:00:00.000Z" },
  });

  assert.equal(invalidPatch.response.status, 400);
  assert.deepEqual(invalidPatch.body, {
    error: { message: "Invalid property input" },
  });
});

test("nonexistent property returns 404 to ADMIN", async () => {
  const result = await request("/missing-property");

  assert.equal(result.response.status, 404);
  assert.deepEqual(result.body, {
    error: { message: "Property not found" },
  });
});

test("property routes require authentication and an allowed view role", async () => {
  const unauthenticated = await fetch(baseUrl);
  const reviewer = await request("", { role: UserRole.REVIEWER });

  assert.equal(unauthenticated.status, 401);
  assert.equal(reviewer.response.status, 403);
});
