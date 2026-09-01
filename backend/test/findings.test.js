const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FindingArea,
  FindingCategory,
  FindingSeverity,
  FindingStatus,
  InspectionStatus,
  UserRole,
} = require("@prisma/client");

const { createApp } = require("../src/app");
const { generateToken } = require("../src/utils/jwt");

const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;
const assignments = [
  { propertyId: "property-a", inspectorId: "inspector-a" },
  { propertyId: "property-b", inspectorId: "inspector-b" },
];
const inspections = [
  { id: "inspection-a", propertyId: "property-a", inspectorId: "inspector-a", status: InspectionStatus.IN_PROGRESS },
  { id: "inspection-b", propertyId: "property-b", inspectorId: "inspector-b", status: InspectionStatus.IN_PROGRESS },
  { id: "inspection-completed", propertyId: "property-a", inspectorId: "inspector-a", status: InspectionStatus.COMPLETED },
];

let baseUrl;
let createCalls;
let findings;
let lastUpdateMany;
let server;

function findingRecord(overrides) {
  return {
    id: overrides.id,
    inspectionId: overrides.inspectionId,
    area: FindingArea.KITCHEN,
    category: FindingCategory.PLUMBING,
    issue: "Leaking faucet",
    severity: FindingSeverity.MEDIUM,
    description: "The kitchen faucet leaks continuously.",
    recommendedAction: "Replace the faucet cartridge.",
    status: overrides.status || FindingStatus.DRAFT,
    photoPath: null,
    createdAt: "2026-08-31T10:00:00.000Z",
    updatedAt: "2026-08-31T10:00:00.000Z",
  };
}

function resetData() {
  findings = [
    findingRecord({ id: "finding-a", inspectionId: "inspection-a" }),
    findingRecord({
      id: "finding-a-submitted",
      inspectionId: "inspection-a",
      status: FindingStatus.SUBMITTED,
    }),
    findingRecord({
      id: "finding-a-approved",
      inspectionId: "inspection-a",
      status: FindingStatus.APPROVED,
    }),
    findingRecord({
      id: "finding-a-rejected",
      inspectionId: "inspection-a",
      status: FindingStatus.REJECTED,
    }),
    findingRecord({ id: "finding-b", inspectionId: "inspection-b" }),
    findingRecord({ id: "finding-completed", inspectionId: "inspection-completed" }),
  ];
  createCalls = [];
  lastUpdateMany = undefined;
}

function isAssigned(propertyId, inspectorId) {
  return assignments.some(
    (assignment) =>
      assignment.propertyId === propertyId &&
      assignment.inspectorId === inspectorId,
  );
}

function findAuthorizedInspection(where) {
  const inspection = inspections.find((item) => item.id === where.id);
  const assignedInspectorId =
    where.property.inspectorAssignments.some.inspectorId;

  return inspection &&
    inspection.inspectorId === where.inspectorId &&
    isAssigned(inspection.propertyId, assignedInspectorId)
    ? inspection
    : null;
}

function findAuthorizedFinding(where) {
  const finding = findings.find((item) => item.id === where.id);
  const inspection = finding
    ? inspections.find((item) => item.id === finding.inspectionId)
    : null;
  const inspectorId = where.inspection.inspectorId;
  const assignedInspectorId =
    where.inspection.property.inspectorAssignments.some.inspectorId;

  return inspection &&
    inspection.inspectorId === inspectorId &&
    isAssigned(inspection.propertyId, assignedInspectorId)
    ? finding
    : null;
}

const prisma = {
  inspection: {
    findUnique: async ({ where }) =>
      inspections.find((inspection) => inspection.id === where.id) || null,
    findFirst: async ({ where }) => findAuthorizedInspection(where),
  },
  finding: {
    findUnique: async ({ where }) =>
      findings.find((finding) => finding.id === where.id) || null,
    findFirst: async ({ where }) => findAuthorizedFinding(where),
    findMany: async ({ where }) =>
      findings.filter((finding) => finding.inspectionId === where.inspectionId),
    create: async ({ data }) => {
      createCalls.push(data);
      const finding = findingRecord({
        ...data,
        id: `finding-created-${createCalls.length}`,
      });
      Object.assign(finding, data);
      findings.push(finding);
      return finding;
    },
    updateMany: async ({ where, data }) => {
      lastUpdateMany = { where, data };
      const finding = findings.find(
        (item) => item.id === where.id && item.status === where.status,
      );

      if (!finding) {
        return { count: 0 };
      }

      Object.assign(finding, data, {
        updatedAt: "2026-08-31T11:00:00.000Z",
      });
      return { count: 1 };
    },
  },
};

test.before(async () => {
  process.env.JWT_SECRET = "finding-api-test-secret-not-used-outside-tests";
  process.env.JWT_EXPIRES_IN = "1h";

  const app = createApp({
    checkDatabase: async () => {},
    prisma,
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
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

function validFindingInput(overrides = {}) {
  return {
    area: FindingArea.KITCHEN,
    category: FindingCategory.PLUMBING,
    issue: "Leaking faucet",
    severity: FindingSeverity.MEDIUM,
    description: "The kitchen faucet leaks continuously.",
    recommendedAction: "Replace the faucet cartridge.",
    ...overrides,
  };
}

function authorizationHeader(
  role = UserRole.INSPECTOR,
  userId = "inspector-a",
) {
  const token = generateToken({ id: userId, role });
  return { authorization: `Bearer ${token}` };
}

async function request(
  path,
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

test("assigned inspector creates a DRAFT finding for an IN_PROGRESS inspection", async () => {
  const result = await request("/inspections/inspection-a/findings", {
    method: "POST",
    body: validFindingInput(),
  });

  assert.equal(result.response.status, 201);
  assert.equal(result.body.finding.inspectionId, "inspection-a");
  assert.equal(result.body.finding.status, FindingStatus.DRAFT);
  assert.equal(result.body.finding.photoPath, null);
  assert.equal(createCalls[0].inspectionId, "inspection-a");
  assert.equal(createCalls[0].status, FindingStatus.DRAFT);
});

test("assigned inspector cannot create a finding for a COMPLETED inspection", async () => {
  const findingsBefore = findings.length;
  const result = await request("/inspections/inspection-completed/findings", {
    method: "POST",
    body: validFindingInput(),
  });

  assert.equal(result.response.status, 409);
  assert.deepEqual(result.body, {
    error: {
      message: "Findings cannot be created for a completed inspection",
    },
  });
  assert.equal(createCalls.length, 0);
  assert.equal(findings.length, findingsBefore);
});

test("existing findings remain readable after their inspection is COMPLETED", async () => {
  const result = await request("/inspections/inspection-completed/findings");

  assert.equal(result.response.status, 200);
  assert.deepEqual(
    result.body.findings.map((finding) => finding.id),
    ["finding-completed"],
  );
});

test("inspector cannot create a finding for another inspector's inspection", async () => {
  const result = await request("/inspections/inspection-b/findings", {
    method: "POST",
    body: validFindingInput(),
  });

  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: { message: "Forbidden" } });
  assert.equal(createCalls.length, 0);
});

test("client-supplied inspector or protected fields cannot override finding ownership or status", async () => {
  const invalidBodies = [
    validFindingInput({ inspectorId: "inspector-b" }),
    validFindingInput({ inspectionId: "inspection-b" }),
    validFindingInput({ status: FindingStatus.APPROVED }),
    validFindingInput({ photoPath: "client/path.jpg" }),
  ];

  for (const body of invalidBodies) {
    const result = await request("/inspections/inspection-a/findings", {
      method: "POST",
      body,
    });

    assert.equal(result.response.status, 400);
  }

  assert.equal(createCalls.length, 0);
});

test("non-inspector roles cannot create findings", async () => {
  for (const role of [UserRole.ADMIN, UserRole.REVIEWER]) {
    const result = await request("/inspections/inspection-a/findings", {
      role,
      userId: `${role.toLowerCase()}-user`,
      method: "POST",
      body: validFindingInput(),
    });

    assert.equal(result.response.status, 403);
  }
});

test("invalid finding content is rejected", async () => {
  const invalidBodies = [
    {},
    validFindingInput({ issue: "" }),
    validFindingInput({ severity: "URGENT" }),
    validFindingInput({ area: "ROOF" }),
    validFindingInput({ category: "COSMETIC" }),
  ];

  for (const body of invalidBodies) {
    const result = await request("/inspections/inspection-a/findings", {
      method: "POST",
      body,
    });

    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, {
      error: { message: "Invalid finding input" },
    });
  }
});

test("authorized inspector gets findings for their inspection", async () => {
  const result = await request("/inspections/inspection-a/findings");

  assert.equal(result.response.status, 200);
  assert.deepEqual(
    result.body.findings.map((finding) => finding.inspectionId),
    ["inspection-a", "inspection-a", "inspection-a", "inspection-a"],
  );
});

test("inspector cannot get another inspector's inspection findings", async () => {
  const result = await request(
    "/inspections/inspection-b/findings?inspectorId=inspector-b",
  );

  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: { message: "Forbidden" } });
});

test("authorized inspector gets an individual finding", async () => {
  const result = await request("/findings/finding-a");

  assert.equal(result.response.status, 200);
  assert.equal(result.body.finding.id, "finding-a");
});

test("inspector cannot get another inspector's finding", async () => {
  const result = await request(
    "/findings/finding-b?inspectorId=inspector-b&userId=inspector-b",
  );

  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: { message: "Forbidden" } });
});

test("nonexistent inspection and finding return 404", async () => {
  const inspection = await request("/inspections/missing/findings");
  const finding = await request("/findings/missing");

  assert.equal(inspection.response.status, 404);
  assert.deepEqual(inspection.body, {
    error: { message: "Inspection not found" },
  });
  assert.equal(finding.response.status, 404);
  assert.deepEqual(finding.body, {
    error: { message: "Finding not found" },
  });
});

test("authorized inspector updates a DRAFT finding", async () => {
  const result = await request("/findings/finding-a", {
    method: "PATCH",
    body: { issue: "  Replaced issue text  ", severity: FindingSeverity.HIGH },
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.body.finding.issue, "Replaced issue text");
  assert.equal(result.body.finding.severity, FindingSeverity.HIGH);
  assert.deepEqual(lastUpdateMany, {
    where: { id: "finding-a", status: FindingStatus.DRAFT },
    data: { issue: "Replaced issue text", severity: FindingSeverity.HIGH },
  });
});

test("inspector cannot update another inspector's finding", async () => {
  const result = await request("/findings/finding-b", {
    method: "PATCH",
    body: { issue: "Unauthorized update" },
  });

  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: { message: "Forbidden" } });
  assert.equal(lastUpdateMany, undefined);
});

test("REVIEWER cannot modify an inspector's finding content", async () => {
  const result = await request("/findings/finding-a", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
    method: "PATCH",
    body: { issue: "Reviewer update" },
  });

  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: { message: "Forbidden" } });
  assert.equal(lastUpdateMany, undefined);
  assert.equal(
    findings.find((finding) => finding.id === "finding-a").issue,
    "Leaking faucet",
  );
});

test("PATCH rejects unknown and protected fields", async () => {
  const invalidBodies = [
    { unknown: "value" },
    { status: FindingStatus.APPROVED },
    { status: FindingStatus.SUBMITTED },
    { inspectionId: "inspection-b" },
    { photoPath: "client/path.jpg" },
  ];

  for (const body of invalidBodies) {
    const result = await request("/findings/finding-a", {
      method: "PATCH",
      body,
    });

    assert.equal(result.response.status, 400);
    assert.deepEqual(result.body, {
      error: { message: "Invalid finding input" },
    });
  }

  assert.equal(lastUpdateMany, undefined);
});

test("SUBMITTED, APPROVED, and REJECTED findings cannot be edited", async () => {
  for (const id of [
    "finding-a-submitted",
    "finding-a-approved",
    "finding-a-rejected",
  ]) {
    const result = await request(`/findings/${id}`, {
      method: "PATCH",
      body: { issue: "Disallowed edit" },
    });

    assert.equal(result.response.status, 409);
    assert.deepEqual(result.body, {
      error: { message: "Finding cannot be edited in its current status" },
    });
  }

  assert.equal(lastUpdateMany, undefined);
});

test("finding routes require authentication", async () => {
  const create = await request("/inspections/inspection-a/findings", {
    authenticated: false,
    method: "POST",
    body: validFindingInput(),
  });
  const detail = await request("/findings/finding-a", {
    authenticated: false,
  });

  assert.equal(create.response.status, 401);
  assert.equal(detail.response.status, 401);
});
