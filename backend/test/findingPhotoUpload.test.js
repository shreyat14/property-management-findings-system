const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { FindingStatus, UserRole } = require("@prisma/client");

const { createApp } = require("../src/app");
const { generateToken } = require("../src/utils/jwt");

const FIVE_MB = 5 * 1024 * 1024;
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
let failDatabaseUpdate;
let findings;
let server;
let temporaryRoot;
let uploadDirectory;

function findingRecord(id, inspectionId, status = FindingStatus.DRAFT) {
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
    findingRecord("draft-jpeg", "inspection-a"),
    findingRecord("draft-png", "inspection-a"),
    findingRecord("draft-webp", "inspection-a"),
    findingRecord("draft-size", "inspection-a"),
    findingRecord("draft-oversize", "inspection-a"),
    findingRecord("draft-security", "inspection-a"),
    findingRecord("draft-invalid", "inspection-a"),
    findingRecord("draft-db-failure", "inspection-a"),
    findingRecord("submitted-a", "inspection-a", FindingStatus.SUBMITTED),
    findingRecord("approved-a", "inspection-a", FindingStatus.APPROVED),
    findingRecord("rejected-a", "inspection-a", FindingStatus.REJECTED),
    findingRecord("draft-b", "inspection-b"),
  ];
  failDatabaseUpdate = false;
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
      if (failDatabaseUpdate) {
        throw new Error("Raw database failure that must not be exposed");
      }

      const finding = findings.find(
        (item) =>
          item.id === where.id &&
          item.status === where.status &&
          item.photoPath === where.photoPath,
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
    "finding-photo-test-secret-not-used-outside-tests";
  process.env.JWT_EXPIRES_IN = "1h";
  temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "finding-photo-upload-test-"),
  );
  uploadDirectory = path.join(temporaryRoot, "uploads", "findings");

  const app = createApp({
    checkDatabase: async () => {},
    prisma,
    findingPhotoUploadDirectory: uploadDirectory,
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/findings`;
});

test.beforeEach(async () => {
  resetData();
  await fs.rm(uploadDirectory, { recursive: true, force: true });
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await fs.rm(temporaryRoot, { recursive: true, force: true });

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

function imageBytes(mimeType, size) {
  if (size !== undefined) {
    return Buffer.alloc(size, 0x61);
  }

  if (mimeType === "image/jpeg") {
    return Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  }
  if (mimeType === "image/png") {
    return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  return Buffer.from("RIFF0000WEBP");
}

async function uploadPhoto(
  findingId,
  {
    mimeType = "image/jpeg",
    filename = "photo.jpg",
    bytes = imageBytes(mimeType),
    fieldName = "photo",
    fields = {},
    role = UserRole.INSPECTOR,
    userId = "inspector-a",
    authenticated = true,
    includeFile = true,
  } = {},
) {
  const form = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value);
  }

  if (includeFile) {
    form.append(fieldName, new Blob([bytes], { type: mimeType }), filename);
  }

  const headers = authenticated ? authorizationHeader(role, userId) : {};
  const response = await fetch(`${baseUrl}/${findingId}/photo`, {
    method: "POST",
    headers,
    body: form,
  });
  const responseText = await response.text();

  return {
    response,
    body: responseText ? JSON.parse(responseText) : undefined,
  };
}

async function storedFiles() {
  try {
    return await fs.readdir(uploadDirectory);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

test("authorized inspector uploads JPEG, PNG, and WebP photos", async () => {
  const cases = [
    ["draft-jpeg", "image/jpeg", ".jpg"],
    ["draft-png", "image/png", ".png"],
    ["draft-webp", "image/webp", ".webp"],
  ];

  for (const [findingId, mimeType, extension] of cases) {
    const result = await uploadPhoto(findingId, {
      mimeType,
      filename: `client-name${extension}`,
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.body.finding.status, FindingStatus.DRAFT);
    assert.match(
      result.body.finding.photoPath,
      new RegExp(
        `^uploads/findings/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\${extension}$`,
      ),
    );

    const absolutePath = path.join(
      uploadDirectory,
      path.basename(result.body.finding.photoPath),
    );
    const stats = await fs.stat(absolutePath);
    assert.equal(stats.isFile(), true);
  }
});

test("upload requires authentication", async () => {
  const result = await uploadPhoto("draft-jpeg", { authenticated: false });

  assert.equal(result.response.status, 401);
  assert.deepEqual(await storedFiles(), []);
});

test("another inspector and REVIEWER cannot upload a finding photo", async () => {
  const otherInspector = await uploadPhoto("draft-b", {
    fields: { inspectorId: "inspector-b" },
  });
  const reviewer = await uploadPhoto("draft-jpeg", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });

  assert.equal(otherInspector.response.status, 403);
  assert.equal(reviewer.response.status, 403);
  assert.deepEqual(await storedFiles(), []);
});

test("SUBMITTED, APPROVED, and REJECTED findings reject photo uploads", async () => {
  for (const findingId of ["submitted-a", "approved-a", "rejected-a"]) {
    const result = await uploadPhoto(findingId);

    assert.equal(result.response.status, 409);
    assert.deepEqual(result.body, {
      error: { message: "Finding cannot be edited in its current status" },
    });
  }

  assert.deepEqual(await storedFiles(), []);
});

test("PDF, text, and JavaScript files are rejected", async () => {
  for (const [mimeType, filename] of [
    ["application/pdf", "document.pdf"],
    ["text/plain", "notes.txt"],
    ["application/javascript", "payload.js"],
  ]) {
    const result = await uploadPhoto("draft-invalid", {
      mimeType,
      filename,
      bytes: Buffer.from("not an image"),
    });

    assert.equal(result.response.status, 415);
    assert.deepEqual(result.body, {
      error: { message: "Unsupported photo type" },
    });
  }

  assert.deepEqual(await storedFiles(), []);
});

test("5 MB photo is accepted and a larger photo is rejected", async () => {
  const atLimit = await uploadPhoto("draft-size", {
    bytes: imageBytes("image/jpeg", FIVE_MB),
  });
  const overLimit = await uploadPhoto("draft-oversize", {
    bytes: imageBytes("image/jpeg", FIVE_MB + 1),
  });

  assert.equal(atLimit.response.status, 200);
  assert.equal(overLimit.response.status, 413);
  assert.deepEqual(overLimit.body, {
    error: { message: "Photo exceeds the 5 MB limit" },
  });
  assert.equal((await storedFiles()).length, 1);
});

test("stored filename is server-generated and remains in the upload directory", async () => {
  const originalFilename = "../../malicious.jpg";
  const result = await uploadPhoto("draft-security", {
    filename: originalFilename,
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.body.finding.photoPath.includes("malicious"), false);
  assert.equal(result.body.finding.photoPath.includes(".."), false);
  assert.equal(
    findings.find((finding) => finding.id === "draft-security").photoPath,
    result.body.finding.photoPath,
  );

  const filename = path.basename(result.body.finding.photoPath);
  const storedPath = path.resolve(uploadDirectory, filename);
  assert.equal(path.dirname(storedPath), path.resolve(uploadDirectory));
  await fs.access(storedPath);
});

test("missing file, extra fields, and unexpected file fields are rejected", async () => {
  const missing = await uploadPhoto("draft-invalid", { includeFile: false });
  const extraField = await uploadPhoto("draft-invalid", {
    fields: { inspectorId: "inspector-b" },
  });
  const wrongFileField = await uploadPhoto("draft-invalid", {
    fieldName: "image",
  });

  assert.equal(missing.response.status, 400);
  assert.deepEqual(missing.body, {
    error: { message: "A photo file is required" },
  });
  assert.equal(extraField.response.status, 400);
  assert.equal(wrongFileField.response.status, 400);
  assert.deepEqual(await storedFiles(), []);
});

test("database failure removes the stored file and remains sanitized", async () => {
  failDatabaseUpdate = true;
  const result = await uploadPhoto("draft-db-failure");

  assert.equal(result.response.status, 500);
  assert.deepEqual(result.body, {
    error: { message: "Internal server error" },
  });
  assert.equal(
    findings.find((finding) => finding.id === "draft-db-failure").photoPath,
    null,
  );
  assert.deepEqual(await storedFiles(), []);
});
