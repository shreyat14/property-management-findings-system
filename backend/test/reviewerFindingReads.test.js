const assert = require("node:assert/strict");
const test = require("node:test");
const { FindingStatus, UserRole } = require("@prisma/client");

const { createApp } = require("../src/app");
const { generateToken } = require("../src/utils/jwt");

const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;
const properties = [
  { id: "property-a", name: "Maple Court", address: "1 Main Street" },
];
const users = [
  {
    id: "inspector-a",
    email: "inspector@example.com",
    passwordHash: "must-never-be-returned",
    role: UserRole.INSPECTOR,
  },
];
const inspections = [
  {
    id: "inspection-a",
    propertyId: "property-a",
    inspectorId: "inspector-a",
    status: "COMPLETED",
    completedAt: "2026-08-31T12:00:00.000Z",
    inspectedAt: "2026-08-31T09:00:00.000Z",
    createdAt: "2026-08-31T09:00:00.000Z",
  },
];

let baseUrl;
let findings;
let lastFindManyQuery;
let lastReviewerSelect;
let server;

function findingRecord(id, status, updatedAt) {
  return {
    id,
    inspectionId: "inspection-a",
    area: "KITCHEN",
    category: "PLUMBING",
    issue: `Issue ${id}`,
    severity: "MEDIUM",
    description: "A visible condition requires review.",
    recommendedAction: "Evaluate the condition and repair as appropriate.",
    status,
    photoPath: "uploads/findings/photo-a.jpg",
    createdAt: "2026-08-31T10:00:00.000Z",
    updatedAt,
  };
}

function resetData() {
  findings = [
    findingRecord("draft-a", FindingStatus.DRAFT, "2026-08-31T10:00:00.000Z"),
    findingRecord("submitted-b", FindingStatus.SUBMITTED, "2026-08-31T11:00:00.000Z"),
    findingRecord("submitted-a", FindingStatus.SUBMITTED, "2026-08-31T11:00:00.000Z"),
    findingRecord("approved-a", FindingStatus.APPROVED, "2026-08-31T12:00:00.000Z"),
    findingRecord("rejected-a", FindingStatus.REJECTED, "2026-08-31T13:00:00.000Z"),
  ];
  lastFindManyQuery = undefined;
  lastReviewerSelect = undefined;
}

function reviewerView(finding) {
  const inspection = inspections.find((item) => item.id === finding.inspectionId);
  const property = properties.find((item) => item.id === inspection.propertyId);
  const inspector = users.find((item) => item.id === inspection.inspectorId);

  return {
    ...finding,
    inspection: {
      ...inspection,
      property: { ...property },
      inspector: { id: inspector.id, email: inspector.email },
    },
  };
}

const prisma = {
  finding: {
    findMany: async (query) => {
      lastFindManyQuery = query;
      return findings
        .filter((finding) => finding.status === query.where.status)
        .sort((left, right) =>
          left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id),
        )
        .map(reviewerView);
    },
    findUnique: async ({ where, select }) => {
      const finding = findings.find((item) => item.id === where.id);

      if (!finding) return null;
      if (select && select.inspection) {
        lastReviewerSelect = select;
        return reviewerView(finding);
      }
      return finding;
    },
    findFirst: async ({ where }) => {
      const finding = findings.find((item) => item.id === where.id);
      return finding && where.inspection.inspectorId === "inspector-a"
        ? { id: finding.id }
        : null;
    },
  },
};

test.before(async () => {
  process.env.JWT_SECRET = "reviewer-read-test-secret-not-used-outside-tests";
  process.env.JWT_EXPIRES_IN = "1h";

  const app = createApp({ checkDatabase: async () => {}, prisma });
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/findings`;
});

test.beforeEach(resetData);

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;

  if (originalExpiration === undefined) delete process.env.JWT_EXPIRES_IN;
  else process.env.JWT_EXPIRES_IN = originalExpiration;
});

function authorizationHeader(role = UserRole.REVIEWER, userId = "reviewer-user") {
  return { authorization: `Bearer ${generateToken({ id: userId, role })}` };
}

async function request(
  path = "",
  { authenticated = true, role = UserRole.REVIEWER, userId } = {},
) {
  const authenticatedUserId =
    userId ||
    (role === UserRole.INSPECTOR ? "inspector-a" : `${role.toLowerCase()}-user`);
  const headers = authenticated
    ? authorizationHeader(role, authenticatedUserId)
    : {};
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const responseText = await response.text();
  return {
    response,
    body: responseText ? JSON.parse(responseText) : undefined,
  };
}

test("REVIEWER lists only SUBMITTED findings in deterministic queue order", async () => {
  const result = await request();

  assert.equal(result.response.status, 200);
  assert.deepEqual(
    result.body.findings.map((finding) => finding.id),
    ["submitted-a", "submitted-b"],
  );
  assert.deepEqual(lastFindManyQuery.where, { status: FindingStatus.SUBMITTED });
  assert.deepEqual(lastFindManyQuery.orderBy, [
    { updatedAt: "asc" },
    { id: "asc" },
  ]);
  assert.deepEqual(
    lastFindManyQuery.select.inspection.select.inspector.select,
    { id: true, email: true },
  );
  assert.equal(
    lastFindManyQuery.select.inspection.select.inspector.select.passwordHash,
    undefined,
  );
});

test("REVIEWER receives an empty queue when no findings are SUBMITTED", async () => {
  findings = findings.filter((finding) => finding.status !== FindingStatus.SUBMITTED);
  const result = await request();

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { findings: [] });
});

test("finding review queue requires authentication and the REVIEWER role", async () => {
  const unauthenticated = await request("", { authenticated: false });
  const invalidToken = await fetch(baseUrl, {
    headers: { authorization: "Bearer invalid-token" },
  });
  const inspector = await request("", { role: UserRole.INSPECTOR });
  const admin = await request("", { role: UserRole.ADMIN });

  assert.equal(unauthenticated.response.status, 401);
  assert.equal(invalidToken.status, 401);
  assert.equal(inspector.response.status, 403);
  assert.equal(admin.response.status, 403);
});

test("REVIEWER retrieves a submitted Finding with safe inspection and property context", async () => {
  const result = await request("/submitted-a");

  assert.equal(result.response.status, 200);
  assert.equal(result.body.finding.id, "submitted-a");
  assert.equal(result.body.finding.inspection.id, "inspection-a");
  assert.deepEqual(result.body.finding.inspection.property, properties[0]);
  assert.deepEqual(result.body.finding.inspection.inspector, {
    id: "inspector-a",
    email: "inspector@example.com",
  });
  assert.deepEqual(lastReviewerSelect.inspection.select.inspector.select, {
    id: true,
    email: true,
  });
  assert.equal(JSON.stringify(result.body).includes("passwordHash"), false);
  assert.equal(lastFindManyQuery, undefined);
});

test("REVIEWER cannot retrieve DRAFT details but can revisit terminal review states", async () => {
  const draft = await request("/draft-a");
  const approved = await request("/approved-a");
  const rejected = await request("/rejected-a");

  assert.equal(draft.response.status, 403);
  assert.equal(approved.response.status, 200);
  assert.equal(approved.body.finding.status, FindingStatus.APPROVED);
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.finding.status, FindingStatus.REJECTED);
});

test("unknown Finding returns 404 and ADMIN cannot use Reviewer details", async () => {
  const unknown = await request("/missing");
  const admin = await request("/submitted-a", { role: UserRole.ADMIN });

  assert.equal(unknown.response.status, 404);
  assert.deepEqual(unknown.body, { error: { message: "Finding not found" } });
  assert.equal(admin.response.status, 403);
});

test("existing Inspector detail access remains ownership-scoped", async () => {
  const owner = await request("/draft-a", { role: UserRole.INSPECTOR });
  const nonOwner = await request("/draft-a", {
    role: UserRole.INSPECTOR,
    userId: "inspector-b",
  });

  assert.equal(owner.response.status, 200);
  assert.equal(owner.body.finding.id, "draft-a");
  assert.equal(owner.body.finding.inspection, undefined);
  assert.equal(nonOwner.response.status, 403);
});
