const assert = require("node:assert/strict");
const test = require("node:test");
const { UserRole } = require("@prisma/client");
const express = require("express");

const { authenticate } = require("../src/middleware/authenticate");
const { authorizeRoles } = require("../src/middleware/authorizeRoles");
const {
  authorizeFindingAccess,
  authorizeInspectionAccess,
  authorizePropertyAccess,
} = require("../src/middleware/authorizeResourceAccess");
const { generateToken } = require("../src/utils/jwt");

const assignments = [
  { propertyId: "property-a", inspectorId: "inspector-a" },
  { propertyId: "property-b", inspectorId: "inspector-b" },
];
const inspections = [
  { id: "inspection-a", propertyId: "property-a", inspectorId: "inspector-a" },
  { id: "inspection-b", propertyId: "property-b", inspectorId: "inspector-b" },
];
const findings = [
  { id: "finding-a", inspectionId: "inspection-a" },
  { id: "finding-b", inspectionId: "inspection-b" },
];

const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;
let authorization;
let baseUrl;
let server;

function isAssigned(propertyId, inspectorId) {
  return assignments.some(
    (assignment) =>
      assignment.propertyId === propertyId &&
      assignment.inspectorId === inspectorId,
  );
}

const prisma = {
  propertyInspector: {
    findUnique: async ({ where }) => {
      const assignment = where.propertyId_inspectorId;
      return isAssigned(assignment.propertyId, assignment.inspectorId)
        ? { propertyId: assignment.propertyId }
        : null;
    },
  },
  inspection: {
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
  },
  finding: {
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
  },
};

test.before(async () => {
  process.env.JWT_SECRET = "resource-authorization-test-secret";
  process.env.JWT_EXPIRES_IN = "1h";

  const app = express();

  app.get(
    "/properties/:propertyId",
    authenticate,
    authorizeRoles(UserRole.INSPECTOR),
    authorizePropertyAccess({ prisma }),
    (_req, res) => res.json({ allowed: true }),
  );
  app.get(
    "/inspections/:inspectionId",
    authenticate,
    authorizeRoles(UserRole.INSPECTOR),
    authorizeInspectionAccess({ prisma }),
    (_req, res) => res.json({ allowed: true }),
  );
  app.get(
    "/findings/:findingId",
    authenticate,
    authorizeRoles(UserRole.INSPECTOR),
    authorizeFindingAccess({ prisma }),
    (_req, res) => res.json({ allowed: true }),
  );

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  authorization = `Bearer ${generateToken({
    id: "inspector-a",
    role: UserRole.INSPECTOR,
  })}`;
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

async function request(resourcePath) {
  return fetch(`${baseUrl}${resourcePath}`, {
    headers: { authorization },
  });
}

async function assertForbidden(resourcePath) {
  const response = await request(
    `${resourcePath}?inspectorId=inspector-b&userId=inspector-b`,
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: { message: "Forbidden" },
  });
}

test("Inspector A can access their assigned property", async () => {
  const response = await request("/properties/property-a");

  assert.equal(response.status, 200);
});

test("Inspector A cannot access Inspector B's property by changing IDs", async () => {
  await assertForbidden("/properties/property-b");
});

test("Inspector A can access their authorized inspection", async () => {
  const response = await request("/inspections/inspection-a");

  assert.equal(response.status, 200);
});

test("Inspector A cannot access Inspector B's inspection by changing IDs", async () => {
  await assertForbidden("/inspections/inspection-b");
});

test("Inspector A can access their authorized finding", async () => {
  const response = await request("/findings/finding-a");

  assert.equal(response.status, 200);
});

test("Inspector A cannot access Inspector B's finding by changing IDs", async () => {
  await assertForbidden("/findings/finding-b");
});
