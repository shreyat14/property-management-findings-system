const assert = require("node:assert/strict");
const test = require("node:test");
const { FindingStatus, UserRole } = require("@prisma/client");

const { createApp } = require("../src/app");
const { generateToken } = require("../src/utils/jwt");

const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;
const assignments = [
  { propertyId: "property-a", inspectorId: "inspector-a" },
  { propertyId: "property-b", inspectorId: "inspector-b" },
];
const inspections = [
  { id: "inspection-a", propertyId: "property-a", inspectorId: "inspector-a" },
  { id: "inspection-b", propertyId: "property-b", inspectorId: "inspector-b" },
];

let baseUrl;
let findings;
let server;

function findingRecord(id, inspectionId, status) {
  return {
    id,
    inspectionId,
    area: "KITCHEN",
    category: "PLUMBING",
    issue: "Leaking faucet",
    severity: "MEDIUM",
    description: "The kitchen faucet leaks continuously.",
    recommendedAction: "Replace the faucet cartridge.",
    status,
    photoPath: null,
    createdAt: "2026-08-31T10:00:00.000Z",
    updatedAt: "2026-08-31T10:00:00.000Z",
  };
}

function resetData() {
  findings = [
    findingRecord("draft-a", "inspection-a", FindingStatus.DRAFT),
    findingRecord("submitted-a", "inspection-a", FindingStatus.SUBMITTED),
    findingRecord("rejected-a", "inspection-a", FindingStatus.REJECTED),
    findingRecord("approved-a", "inspection-a", FindingStatus.APPROVED),
    findingRecord("draft-b", "inspection-b", FindingStatus.DRAFT),
    findingRecord("rejected-b", "inspection-b", FindingStatus.REJECTED),
  ];
}

function isAssigned(propertyId, inspectorId) {
  return assignments.some(
    (assignment) =>
      assignment.propertyId === propertyId &&
      assignment.inspectorId === inspectorId,
  );
}

const prisma = {
  finding: {
    findMany: async ({ where }) =>
      findings.filter((finding) => finding.status === where.status),
    findUnique: async ({ where }) =>
      findings.find((finding) => finding.id === where.id) || null,
    findFirst: async ({ where }) => {
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
        ? { id: finding.id }
        : null;
    },
    updateMany: async ({ where, data }) => {
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
  process.env.JWT_SECRET =
    "finding-workflow-test-secret-not-used-outside-tests";
  process.env.JWT_EXPIRES_IN = "1h";

  const app = createApp({
    checkDatabase: async () => {},
    prisma,
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/findings`;
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

function authorizationHeader(role, userId) {
  const token = generateToken({ id: userId, role });
  return { authorization: `Bearer ${token}` };
}

async function request(
  path,
  {
    method = "POST",
    role = UserRole.INSPECTOR,
    userId = "inspector-a",
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

async function assertConflict(path, options) {
  const result = await request(path, options);

  assert.equal(result.response.status, 409);
  assert.deepEqual(result.body, {
    error: { message: "Invalid finding status transition" },
  });
}

async function assertForbidden(path, options) {
  const result = await request(path, options);

  assert.equal(result.response.status, 403);
  assert.deepEqual(result.body, { error: { message: "Forbidden" } });
}

test("authorized inspector submits DRAFT finding", async () => {
  const result = await request("/draft-a/submit");

  assert.equal(result.response.status, 200);
  assert.equal(result.body.finding.status, FindingStatus.SUBMITTED);
});

test("inspector cannot submit SUBMITTED, APPROVED, or REJECTED findings", async () => {
  for (const id of ["submitted-a", "approved-a", "rejected-a"]) {
    await assertConflict(`/${id}/submit`);
  }
});

test("REVIEWER and ADMIN cannot submit findings", async () => {
  for (const role of [UserRole.REVIEWER, UserRole.ADMIN]) {
    await assertForbidden("/draft-a/submit", {
      role,
      userId: `${role.toLowerCase()}-user`,
    });
  }
});

test("inspector cannot submit another inspector's finding or override identity", async () => {
  await assertForbidden(
    "/draft-b/submit?inspectorId=inspector-b&userId=inspector-b",
    { body: { inspectorId: "inspector-b" } },
  );

  const protectedBody = await request("/draft-a/submit", {
    body: { inspectorId: "inspector-b" },
  });
  assert.equal(protectedBody.response.status, 400);
});

test("REVIEWER approves SUBMITTED finding", async () => {
  const result = await request("/submitted-a/approve", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.body.finding.status, FindingStatus.APPROVED);
});

test("REVIEWER cannot approve DRAFT, REJECTED, or APPROVED findings", async () => {
  for (const id of ["draft-a", "rejected-a", "approved-a"]) {
    await assertConflict(`/${id}/approve`, {
      role: UserRole.REVIEWER,
      userId: "reviewer-user",
    });
  }
});

test("INSPECTOR and ADMIN cannot approve findings", async () => {
  await assertForbidden("/submitted-a/approve");
  await assertForbidden("/submitted-a/approve", {
    role: UserRole.ADMIN,
    userId: "admin-user",
  });
});

test("REVIEWER returns a SUBMITTED finding to DRAFT", async () => {
  findings.find((finding) => finding.id === "submitted-a").photoPath =
    "uploads/findings/existing-photo.jpg";
  const result = await request("/submitted-a/reject", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.body.finding.status, FindingStatus.DRAFT);
  assert.equal(
    result.body.finding.photoPath,
    "uploads/findings/existing-photo.jpg",
  );
});

test("REVIEWER cannot reject DRAFT, REJECTED, or APPROVED findings", async () => {
  for (const id of ["draft-a", "rejected-a", "approved-a"]) {
    await assertConflict(`/${id}/reject`, {
      role: UserRole.REVIEWER,
      userId: "reviewer-user",
    });
  }
});

test("INSPECTOR and ADMIN cannot reject findings", async () => {
  await assertForbidden("/submitted-a/reject");
  await assertForbidden("/submitted-a/reject", {
    role: UserRole.ADMIN,
    userId: "admin-user",
  });
});

test("authorized inspector reopens REJECTED finding", async () => {
  const result = await request("/rejected-a/reopen");

  assert.equal(result.response.status, 200);
  assert.equal(result.body.finding.status, FindingStatus.DRAFT);
});

test("inspector cannot reopen DRAFT, SUBMITTED, or APPROVED findings", async () => {
  for (const id of ["draft-a", "submitted-a", "approved-a"]) {
    await assertConflict(`/${id}/reopen`);
  }
});

test("REVIEWER and ADMIN cannot reopen findings", async () => {
  for (const role of [UserRole.REVIEWER, UserRole.ADMIN]) {
    await assertForbidden("/rejected-a/reopen", {
      role,
      userId: `${role.toLowerCase()}-user`,
    });
  }
});

test("inspector cannot reopen another inspector's finding", async () => {
  await assertForbidden(
    "/rejected-b/reopen?inspectorId=inspector-b&userId=inspector-b",
  );
});

test("workflow endpoints require authentication", async () => {
  for (const path of [
    "/draft-a/submit",
    "/submitted-a/approve",
    "/submitted-a/reject",
    "/rejected-a/reopen",
  ]) {
    const result = await request(path, { authenticated: false });
    assert.equal(result.response.status, 401);
  }
});

test("nonexistent finding returns 404 to an allowed role", async () => {
  const result = await request("/missing/approve", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });

  assert.equal(result.response.status, 404);
  assert.deepEqual(result.body, {
    error: { message: "Finding not found" },
  });
});

test("complete workflow reaches terminal APPROVED status", async () => {
  let result = await request("/draft-a/submit");
  assert.equal(result.body.finding.status, FindingStatus.SUBMITTED);

  result = await request("", {
    method: "GET",
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });
  assert.equal(
    result.body.findings.some((finding) => finding.id === "draft-a"),
    true,
  );

  result = await request("/draft-a/reject", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });
  assert.equal(result.body.finding.status, FindingStatus.DRAFT);

  result = await request("", {
    method: "GET",
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });
  assert.equal(
    result.body.findings.some((finding) => finding.id === "draft-a"),
    false,
  );

  result = await request("/draft-a", {
    method: "PATCH",
    body: {
      issue: "Inspector-edited issue after review",
      description: "Updated after Reviewer feedback.",
    },
  });
  assert.equal(result.body.finding.status, FindingStatus.DRAFT);
  assert.equal(result.body.finding.issue, "Inspector-edited issue after review");

  result = await request("/draft-a/submit");
  assert.equal(result.body.finding.status, FindingStatus.SUBMITTED);

  result = await request("", {
    method: "GET",
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });
  assert.equal(
    result.body.findings.some((finding) => finding.id === "draft-a"),
    true,
  );

  result = await request("/draft-a/approve", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });
  assert.equal(result.body.finding.status, FindingStatus.APPROVED);

  result = await request("/draft-a", {
    method: "PATCH",
    body: { issue: "Disallowed approved edit" },
  });
  assert.equal(result.response.status, 409);
  assert.deepEqual(result.body, {
    error: { message: "Finding cannot be edited in its current status" },
  });

  await assertConflict("/draft-a/submit");
  await assertConflict("/draft-a/reopen");
  await assertConflict("/draft-a/approve", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });
  await assertConflict("/draft-a/reject", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });
});
