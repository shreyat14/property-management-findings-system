const assert = require("node:assert/strict");
const test = require("node:test");
const { UserRole } = require("@prisma/client");

const { createApp } = require("../src/app");
const { generateToken } = require("../src/utils/jwt");

const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;
const properties = [{ id: "property-a" }, { id: "property-empty" }];
const users = [
  { id: "inspector-a", email: "a.inspector@example.com", role: UserRole.INSPECTOR },
  { id: "inspector-b", email: "b.inspector@example.com", role: UserRole.INSPECTOR },
  { id: "reviewer-target", email: "reviewer@example.com", role: UserRole.REVIEWER },
  { id: "admin-target", email: "admin@example.com", role: UserRole.ADMIN },
];

let assignments;
let baseUrl;
let server;

function resetAssignments() {
  assignments = [
    {
      propertyId: "property-a",
      inspectorId: "inspector-a",
      assignedAt: "2026-08-31T00:00:00.000Z",
    },
  ];
}

function findAssignment(propertyId, inspectorId) {
  return (
    assignments.find(
      (assignment) =>
        assignment.propertyId === propertyId &&
        assignment.inspectorId === inspectorId,
    ) || null
  );
}

const prisma = {
  property: {
    findUnique: async ({ where }) =>
      properties.find((property) => property.id === where.id) || null,
  },
  user: {
    findUnique: async ({ where }) =>
      users.find((user) => user.id === where.id) || null,
  },
  propertyInspector: {
    findMany: async ({ where }) =>
      assignments
        .filter((assignment) => assignment.propertyId === where.propertyId)
        .map((assignment) => ({
          assignedAt: assignment.assignedAt,
          inspector: {
            id: assignment.inspectorId,
            email: users.find((user) => user.id === assignment.inspectorId).email,
          },
        })),
    findUnique: async ({ where }) => {
      const key = where.propertyId_inspectorId;
      return findAssignment(key.propertyId, key.inspectorId);
    },
    create: async ({ data }) => {
      const assignment = {
        ...data,
        assignedAt: "2026-08-31T01:00:00.000Z",
      };
      assignments.push(assignment);
      return assignment;
    },
    delete: async ({ where }) => {
      const key = where.propertyId_inspectorId;
      const index = assignments.findIndex(
        (assignment) =>
          assignment.propertyId === key.propertyId &&
          assignment.inspectorId === key.inspectorId,
      );

      if (index === -1) {
        const error = new Error("Record not found");
        error.code = "P2025";
        throw error;
      }

      return assignments.splice(index, 1)[0];
    },
  },
};

test.before(async () => {
  process.env.JWT_SECRET =
    "property-assignment-test-secret-not-used-outside-tests";
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
  resetAssignments();
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
    id: `${role.toLowerCase()}-caller`,
    role,
  });
  return { authorization: `Bearer ${token}` };
}

async function request(
  path,
  { role = UserRole.ADMIN, method = "POST", body, authenticated = true } = {},
) {
  const headers = authenticated ? authorizationHeader(role) : {};

  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const responseText = await response.text();

  return {
    response,
    body: responseText ? JSON.parse(responseText) : undefined,
  };
}

test("ADMIN can assign an inspector", async () => {
  const result = await request("/property-a/inspectors", {
    body: { inspectorId: "inspector-b" },
  });

  assert.equal(result.response.status, 201);
  assert.deepEqual(result.body.assignment, {
    propertyId: "property-a",
    inspectorId: "inspector-b",
    assignedAt: "2026-08-31T01:00:00.000Z",
  });
  assert.ok(findAssignment("property-a", "inspector-b"));
});

test("ADMIN retrieves inspectors assigned to a property", async () => {
  const result = await request("/property-a/inspectors", { method: "GET" });

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, {
    inspectors: [
      {
        id: "inspector-a",
        email: "a.inspector@example.com",
        assignedAt: "2026-08-31T00:00:00.000Z",
      },
    ],
  });
  assert.equal(JSON.stringify(result.body).includes("password"), false);
});

test("assignment retrieval returns an empty list for an unassigned property", async () => {
  const result = await request("/property-empty/inspectors", { method: "GET" });

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { inspectors: [] });
});

test("assignment retrieval rejects unknown properties", async () => {
  const result = await request("/missing-property/inspectors", { method: "GET" });

  assert.equal(result.response.status, 404);
  assert.deepEqual(result.body, { error: { message: "Property not found" } });
});

test("assignment retrieval is ADMIN-only", async () => {
  for (const role of [UserRole.INSPECTOR, UserRole.REVIEWER]) {
    const result = await request("/property-a/inspectors", {
      method: "GET",
      role,
    });

    assert.equal(result.response.status, 403);
    assert.deepEqual(result.body, { error: { message: "Forbidden" } });
  }

  const unauthenticated = await request("/property-a/inspectors", {
    method: "GET",
    authenticated: false,
  });
  assert.equal(unauthenticated.response.status, 401);
  assert.deepEqual(unauthenticated.body, {
    error: { message: "Authentication required" },
  });
});

test("INSPECTOR and REVIEWER cannot assign an inspector", async () => {
  for (const role of [UserRole.INSPECTOR, UserRole.REVIEWER]) {
    const result = await request("/property-a/inspectors", {
      role,
      body: { inspectorId: "inspector-b" },
    });

    assert.equal(result.response.status, 403);
    assert.deepEqual(result.body, { error: { message: "Forbidden" } });
  }

  assert.equal(findAssignment("property-a", "inspector-b"), null);
});

test("a user without the INSPECTOR role cannot be assigned", async () => {
  for (const inspectorId of ["reviewer-target", "admin-target"]) {
    const result = await request("/property-a/inspectors", {
      body: { inspectorId },
    });

    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, {
      error: { message: "User must have the INSPECTOR role" },
    });
  }
});

test("duplicate assignment returns a clean conflict response", async () => {
  const result = await request("/property-a/inspectors", {
    body: { inspectorId: "inspector-a" },
  });

  assert.equal(result.response.status, 409);
  assert.deepEqual(result.body, {
    error: { message: "Inspector is already assigned to this property" },
  });
});

test("ADMIN can remove an existing assignment", async () => {
  const result = await request("/property-a/inspectors/inspector-a", {
    method: "DELETE",
  });

  assert.equal(result.response.status, 204);
  assert.equal(result.body, undefined);
  assert.equal(findAssignment("property-a", "inspector-a"), null);
});

test("INSPECTOR and REVIEWER cannot remove an assignment", async () => {
  for (const role of [UserRole.INSPECTOR, UserRole.REVIEWER]) {
    const result = await request("/property-a/inspectors/inspector-a", {
      role,
      method: "DELETE",
    });

    assert.equal(result.response.status, 403);
    assert.deepEqual(result.body, { error: { message: "Forbidden" } });
  }

  assert.ok(findAssignment("property-a", "inspector-a"));
});

test("invalid assignment input is rejected", async () => {
  const invalidBodies = [
    {},
    { inspectorId: "" },
    { inspectorId: "inspector-b", role: UserRole.INSPECTOR },
    { inspectorId: 123 },
  ];

  for (const body of invalidBodies) {
    const result = await request("/property-a/inspectors", { body });

    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, {
      error: { message: "Invalid inspector assignment input" },
    });
  }
});

test("missing property, user, and assignment return 404", async () => {
  const missingProperty = await request("/missing-property/inspectors", {
    body: { inspectorId: "inspector-b" },
  });
  const missingUser = await request("/property-a/inspectors", {
    body: { inspectorId: "missing-user" },
  });
  const missingDeleteProperty = await request(
    "/missing-property/inspectors/inspector-a",
    { method: "DELETE" },
  );
  const missingAssignment = await request(
    "/property-a/inspectors/inspector-b",
    { method: "DELETE" },
  );

  assert.equal(missingProperty.response.status, 404);
  assert.deepEqual(missingProperty.body, {
    error: { message: "Property not found" },
  });
  assert.equal(missingUser.response.status, 404);
  assert.deepEqual(missingUser.body, {
    error: { message: "User not found" },
  });
  assert.equal(missingDeleteProperty.response.status, 404);
  assert.deepEqual(missingDeleteProperty.body, {
    error: { message: "Property not found" },
  });
  assert.equal(missingAssignment.response.status, 404);
  assert.deepEqual(missingAssignment.body, {
    error: { message: "Inspector assignment not found" },
  });
});

test("assignment endpoints return 401 when unauthenticated", async () => {
  const post = await request("/property-a/inspectors", {
    authenticated: false,
    body: { inspectorId: "inspector-b" },
  });
  const remove = await request("/property-a/inspectors/inspector-a", {
    authenticated: false,
    method: "DELETE",
  });

  assert.equal(post.response.status, 401);
  assert.equal(remove.response.status, 401);
});
