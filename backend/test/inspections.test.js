const assert = require("node:assert/strict");
const test = require("node:test");
const {
  InspectionStatus,
  UserRole,
} = require("@prisma/client");

const { createApp } = require("../src/app");
const { generateToken } = require("../src/utils/jwt");

const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;
const properties = [
  { id: "property-a" },
  { id: "property-b" },
  { id: "property-unassigned" },
];
const assignments = [
  { propertyId: "property-a", inspectorId: "inspector-a" },
  { propertyId: "property-b", inspectorId: "inspector-b" },
];

let baseUrl;
let createCalls;
let inspections;
let lastFindManyWhere;
let lastUpdateMany;
let server;

function inspectionRecord(overrides) {
  return {
    id: overrides.id,
    propertyId: overrides.propertyId,
    inspectorId: overrides.inspectorId,
    status: overrides.status || InspectionStatus.IN_PROGRESS,
    completedAt: overrides.completedAt || null,
    inspectedAt: "2026-08-31T10:00:00.000Z",
    createdAt: "2026-08-31T10:00:00.000Z",
    updatedAt: "2026-08-31T10:00:00.000Z",
  };
}

function resetData() {
  inspections = [
    inspectionRecord({
      id: "inspection-a",
      propertyId: "property-a",
      inspectorId: "inspector-a",
    }),
    inspectionRecord({
      id: "inspection-a-completed",
      propertyId: "property-a",
      inspectorId: "inspector-a",
      status: InspectionStatus.COMPLETED,
      completedAt: "2026-08-31T11:00:00.000Z",
    }),
    inspectionRecord({
      id: "inspection-b",
      propertyId: "property-b",
      inspectorId: "inspector-b",
    }),
    inspectionRecord({
      id: "inspection-a-unassigned",
      propertyId: "property-unassigned",
      inspectorId: "inspector-a",
    }),
  ];
  createCalls = [];
  lastFindManyWhere = undefined;
  lastUpdateMany = undefined;
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
    findUnique: async ({ where }) =>
      properties.find((property) => property.id === where.id) || null,
  },
  propertyInspector: {
    findUnique: async ({ where }) => {
      const key = where.propertyId_inspectorId;
      return isAssigned(key.propertyId, key.inspectorId)
        ? { propertyId: key.propertyId }
        : null;
    },
  },
  inspection: {
    findMany: async ({ where }) => {
      lastFindManyWhere = where;
      const assignedInspectorId =
        where.property.inspectorAssignments.some.inspectorId;

      return inspections.filter(
        (inspection) =>
          inspection.inspectorId === where.inspectorId &&
          isAssigned(inspection.propertyId, assignedInspectorId),
      );
    },
    findUnique: async ({ where }) =>
      inspections.find((inspection) => inspection.id === where.id) || null,
    findFirst: async ({ where }) => {
      const inspection = inspections.find((item) => item.id === where.id);
      const assignedInspectorId =
        where.property.inspectorAssignments.some.inspectorId;

      return inspection &&
        inspection.inspectorId === where.inspectorId &&
        isAssigned(inspection.propertyId, assignedInspectorId)
        ? { id: inspection.id }
        : null;
    },
    create: async ({ data }) => {
      createCalls.push(data);
      const inspection = inspectionRecord({
        id: `inspection-created-${createCalls.length}`,
        ...data,
      });
      inspections.push(inspection);
      return inspection;
    },
    updateMany: async ({ where, data }) => {
      lastUpdateMany = { where, data };
      const inspection = inspections.find(
        (item) => item.id === where.id && item.status === where.status,
      );

      if (!inspection) {
        return { count: 0 };
      }

      Object.assign(inspection, data, {
        updatedAt: "2026-08-31T12:00:00.000Z",
      });
      return { count: 1 };
    },
  },
};

test.before(async () => {
  process.env.JWT_SECRET = "inspection-api-test-secret-not-used-outside-tests";
  process.env.JWT_EXPIRES_IN = "1h";

  const app = createApp({
    checkDatabase: async () => {},
    prisma,
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/inspections`;
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

function authorizationHeader(
  role = UserRole.INSPECTOR,
  userId = "inspector-a",
) {
  const token = generateToken({ id: userId, role });
  return { authorization: `Bearer ${token}` };
}

async function request(
  path = "",
  {
    role = UserRole.INSPECTOR,
    userId = "inspector-a",
    method = "GET",
    body,
    authenticated = true,
  } = {},
) {
  const headers = authenticated ? authorizationHeader(role, userId) : {};

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

test("authenticated inspector creates an IN_PROGRESS inspection for an assigned property", async () => {
  const result = await request("", {
    method: "POST",
    body: { propertyId: "property-a" },
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.body.inspection.inspectorId, "inspector-a");
  assert.equal(result.body.inspection.propertyId, "property-a");
  assert.equal(result.body.inspection.status, InspectionStatus.IN_PROGRESS);
  assert.equal(result.body.inspection.completedAt, null);
  assert.deepEqual(createCalls, [
    {
      propertyId: "property-a",
      inspectorId: "inspector-a",
      status: InspectionStatus.IN_PROGRESS,
      completedAt: null,
    },
  ]);
});

test("inspector cannot create an inspection for an unassigned property", async () => {
  const result = await request("", {
    method: "POST",
    body: { propertyId: "property-unassigned" },
  });

  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: { message: "Forbidden" } });
  assert.equal(createCalls.length, 0);
});

test("ADMIN and REVIEWER cannot create inspections", async () => {
  for (const role of [UserRole.ADMIN, UserRole.REVIEWER]) {
    const result = await request("", {
      role,
      userId: `${role.toLowerCase()}-user`,
      method: "POST",
      body: { propertyId: "property-a" },
    });

    assert.equal(result.response.status, 403);
  }

  assert.equal(createCalls.length, 0);
});

test("inspection creation requires authentication", async () => {
  const result = await request("", {
    authenticated: false,
    method: "POST",
    body: { propertyId: "property-a" },
  });

  assert.equal(result.response.status, 401);
});

test("invalid, missing, or client-controlled creation fields are rejected", async () => {
  const invalidBodies = [
    {},
    { propertyId: "" },
    { propertyId: 123 },
    { propertyId: "property-a", inspectorId: "inspector-b" },
    {
      propertyId: "property-a",
      status: InspectionStatus.COMPLETED,
      completedAt: "2026-08-31T11:00:00.000Z",
    },
  ];

  for (const body of invalidBodies) {
    const result = await request("", { method: "POST", body });

    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, {
      error: { message: "Invalid inspection input" },
    });
  }

  assert.equal(createCalls.length, 0);
});

test("creation returns 404 when the property does not exist", async () => {
  const result = await request("", {
    method: "POST",
    body: { propertyId: "missing-property" },
  });

  assert.equal(result.response.status, 404);
  assert.deepEqual(result.body, {
    error: { message: "Property not found" },
  });
});

test("inspector retrieves only their authorized inspections", async () => {
  const result = await request(
    "?inspectorId=inspector-b&userId=inspector-b",
  );

  assert.equal(result.response.status, 200);
  assert.deepEqual(
    result.body.inspections.map((inspection) => inspection.id),
    ["inspection-a", "inspection-a-completed"],
  );
  assert.deepEqual(lastFindManyWhere, {
    inspectorId: "inspector-a",
    property: {
      inspectorAssignments: { some: { inspectorId: "inspector-a" } },
    },
  });
});

test("inspector retrieves an authorized inspection", async () => {
  const result = await request("/inspection-a");

  assert.equal(result.response.status, 200);
  assert.equal(result.body.inspection.id, "inspection-a");
});

test("inspector cannot retrieve another inspector's inspection", async () => {
  const result = await request(
    "/inspection-b?inspectorId=inspector-b&userId=inspector-b",
  );

  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: { message: "Forbidden" } });
});

test("inspection access requires authentication", async () => {
  const list = await request("", { authenticated: false });
  const detail = await request("/inspection-a", { authenticated: false });

  assert.equal(list.response.status, 401);
  assert.equal(detail.response.status, 401);
});

test("nonexistent inspection returns 404", async () => {
  const result = await request("/missing-inspection");

  assert.equal(result.response.status, 404);
  assert.deepEqual(result.body, {
    error: { message: "Inspection not found" },
  });
});

test("authorized inspector completes an IN_PROGRESS inspection", async () => {
  const result = await request("/inspection-a/complete", {
    method: "POST",
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.body.inspection.status, InspectionStatus.COMPLETED);
  assert.ok(result.body.inspection.completedAt);
  assert.equal(
    Number.isNaN(Date.parse(result.body.inspection.completedAt)),
    false,
  );
  assert.deepEqual(lastUpdateMany.where, {
    id: "inspection-a",
    status: InspectionStatus.IN_PROGRESS,
  });
  assert.equal(lastUpdateMany.data.status, InspectionStatus.COMPLETED);
  assert.ok(lastUpdateMany.data.completedAt instanceof Date);
});

test("already completed inspection returns 409", async () => {
  const result = await request("/inspection-a-completed/complete", {
    method: "POST",
  });

  assert.equal(result.response.status, 409);
  assert.deepEqual(result.body, {
    error: { message: "Inspection is already completed" },
  });
  assert.equal(lastUpdateMany, undefined);
});

test("inspector cannot complete another inspector's inspection", async () => {
  const result = await request("/inspection-b/complete", {
    method: "POST",
    body: {},
  });

  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: { message: "Forbidden" } });
  assert.equal(lastUpdateMany, undefined);
});

test("REVIEWER cannot complete an inspection", async () => {
  const result = await request("/inspection-a/complete", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
    method: "POST",
  });

  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: { message: "Forbidden" } });
  assert.equal(lastUpdateMany, undefined);
});

test("inspection completion requires authentication", async () => {
  const result = await request("/inspection-a/complete", {
    authenticated: false,
    method: "POST",
  });

  assert.equal(result.response.status, 401);
  assert.equal(lastUpdateMany, undefined);
});

test("inspection completion rejects client-controlled lifecycle fields", async () => {
  const result = await request("/inspection-a/complete", {
    method: "POST",
    body: { status: InspectionStatus.COMPLETED },
  });

  assert.equal(result.response.status, 400);
  assert.deepEqual(result.body, {
    error: { message: "Invalid inspection input" },
  });
  assert.equal(lastUpdateMany, undefined);
});
