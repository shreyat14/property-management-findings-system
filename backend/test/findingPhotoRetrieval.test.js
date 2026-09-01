const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
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
const photoFiles = {
  "photo-a.jpg": Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  "photo-a.png": Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]),
  "photo-a.webp": Buffer.from("RIFF0000WEBP"),
  "photo-b.jpg": Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
};

let baseUrl;
let findings;
let outsideFilePath;
let server;
let temporaryRoot;
let uploadDirectory;

function findingRecord(
  id,
  inspectionId,
  photoPath,
  status = FindingStatus.SUBMITTED,
) {
  return { id, inspectionId, photoPath, status };
}

function resetData() {
  findings = [
    findingRecord(
      "jpeg-a",
      "inspection-a",
      "uploads/findings/photo-a.jpg",
    ),
    findingRecord(
      "png-a",
      "inspection-a",
      "uploads/findings/photo-a.png",
    ),
    findingRecord(
      "webp-a",
      "inspection-a",
      "uploads/findings/photo-a.webp",
    ),
    findingRecord("no-photo-a", "inspection-a", null),
    findingRecord(
      "missing-file-a",
      "inspection-a",
      "uploads/findings/missing.jpg",
    ),
    findingRecord(
      "directory-a",
      "inspection-a",
      "uploads/findings/not-a-file.jpg",
    ),
    findingRecord(
      "traversal-a",
      "inspection-a",
      "uploads/findings/../outside.jpg",
    ),
    findingRecord("absolute-a", "inspection-a", outsideFilePath),
    findingRecord(
      "jpeg-b",
      "inspection-b",
      "uploads/findings/photo-b.jpg",
    ),
    findingRecord(
      "draft-photo-a",
      "inspection-a",
      "uploads/findings/photo-a.jpg",
      FindingStatus.DRAFT,
    ),
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
  },
};

test.before(async () => {
  process.env.JWT_SECRET =
    "finding-photo-retrieval-secret-not-used-outside-tests";
  process.env.JWT_EXPIRES_IN = "1h";
  temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "finding-photo-retrieval-test-"),
  );
  uploadDirectory = path.join(temporaryRoot, "uploads", "findings");
  outsideFilePath = path.join(temporaryRoot, "outside.jpg");

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
  await fs.mkdir(uploadDirectory, { recursive: true });

  for (const [filename, bytes] of Object.entries(photoFiles)) {
    await fs.writeFile(path.join(uploadDirectory, filename), bytes);
  }

  await fs.mkdir(path.join(uploadDirectory, "not-a-file.jpg"));
  await fs.writeFile(outsideFilePath, Buffer.from("outside upload directory"));
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

async function getPhoto(
  findingId,
  {
    authenticated = true,
    role = UserRole.INSPECTOR,
    userId = "inspector-a",
  } = {},
) {
  const headers = authenticated ? authorizationHeader(role, userId) : {};
  return fetch(`${baseUrl}/${findingId}/photo`, { headers });
}

async function errorBody(response) {
  return response.json();
}

test("photo retrieval requires authentication", async () => {
  const response = await getPhoto("jpeg-a", { authenticated: false });

  assert.equal(response.status, 401);
  assert.deepEqual(await errorBody(response), {
    error: { message: "Authentication required" },
  });
});

test("authorized inspector receives JPEG, PNG, and WebP content", async () => {
  for (const [findingId, filename, contentType] of [
    ["jpeg-a", "photo-a.jpg", "image/jpeg"],
    ["png-a", "photo-a.png", "image/png"],
    ["webp-a", "photo-a.webp", "image/webp"],
  ]) {
    const response = await getPhoto(findingId);
    const body = Buffer.from(await response.arrayBuffer());

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), contentType);
    assert.deepEqual(body, photoFiles[filename]);
  }
});

test("unauthorized inspector and ADMIN receive 403", async () => {
  const otherInspector = await getPhoto(
    "jpeg-b?inspectorId=inspector-b&userId=inspector-b",
  );
  const admin = await getPhoto("jpeg-a", {
    role: UserRole.ADMIN,
    userId: "admin-user",
  });

  assert.equal(otherInspector.status, 403);
  assert.equal(admin.status, 403);
});

test("REVIEWER retrieves a submitted Finding photo but cannot retrieve a DRAFT photo", async () => {
  const submitted = await getPhoto("jpeg-a", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });
  const draft = await getPhoto("draft-photo-a", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });

  assert.equal(submitted.status, 200);
  assert.equal(submitted.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(
    Buffer.from(await submitted.arrayBuffer()),
    photoFiles["photo-a.jpg"],
  );
  assert.equal(draft.status, 403);
});

test("nonexistent finding returns 404", async () => {
  const response = await getPhoto("missing-finding");

  assert.equal(response.status, 404);
  assert.deepEqual(await errorBody(response), {
    error: { message: "Finding not found" },
  });
});

test("finding without a photo returns 404", async () => {
  const inspectorResponse = await getPhoto("no-photo-a");
  const reviewerResponse = await getPhoto("no-photo-a", {
    role: UserRole.REVIEWER,
    userId: "reviewer-user",
  });

  for (const response of [inspectorResponse, reviewerResponse]) {
    assert.equal(response.status, 404);
    assert.deepEqual(await errorBody(response), {
      error: { message: "Finding photo not found" },
    });
  }
});

test("missing or non-file photo references return 404", async () => {
  for (const findingId of ["missing-file-a", "directory-a"]) {
    const response = await getPhoto(findingId);

    assert.equal(response.status, 404);
    assert.deepEqual(await errorBody(response), {
      error: { message: "Finding photo not found" },
    });
  }
});

test("stored traversal and absolute paths cannot escape the upload directory", async () => {
  for (const findingId of ["traversal-a", "absolute-a"]) {
    const response = await getPhoto(findingId);

    assert.equal(response.status, 404);
    assert.deepEqual(await errorBody(response), {
      error: { message: "Finding photo not found" },
    });
  }

  assert.equal(
    (await fs.readFile(outsideFilePath, "utf8")),
    "outside upload directory",
  );
});
