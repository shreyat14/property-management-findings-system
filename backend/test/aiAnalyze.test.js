const assert = require("node:assert/strict");
const test = require("node:test");
const { UserRole } = require("@prisma/client");

const { createApp } = require("../src/app");
const { generateToken } = require("../src/utils/jwt");

const FIVE_MB = 5 * 1024 * 1024;
const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;
const suggestion = {
  area: "EXTERIOR",
  category: "STRUCTURAL",
  issue: "Crack near exterior window",
  severity: "MEDIUM",
  description: "A visible crack extends from the corner of the window opening.",
  recommendedAction: "Have the area evaluated and repair it as appropriate.",
};

let analysisCalls;
let baseUrl;
let findings;
let prismaCalls;
let server;

const aiService = {
  analyzeInspection: async (input) => {
    analysisCalls.push(input);
    return { ...suggestion };
  },
};
const prisma = new Proxy(
  {},
  {
    get() {
      prismaCalls += 1;
      throw new Error("AI analysis must not access Prisma");
    },
  },
);

test.before(async () => {
  process.env.JWT_SECRET = "ai-analyze-test-secret-not-used-outside-tests";
  process.env.JWT_EXPIRES_IN = "1h";

  const app = createApp({
    aiService,
    checkDatabase: async () => {},
    prisma,
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/ai/analyze-finding`;
});

test.beforeEach(() => {
  analysisCalls = [];
  findings = [
    {
      id: "known-finding",
      inspectionId: "inspection-a",
      issue: "Existing issue",
      status: "DRAFT",
      photoPath: null,
    },
  ];
  prismaCalls = 0;
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

async function analyze({
  authenticated = true,
  bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  includePhoto = true,
  mimeType = "image/jpeg",
  observation,
  role = UserRole.INSPECTOR,
  extraFields = {},
} = {}) {
  const form = new FormData();

  if (observation !== undefined) {
    form.append("observation", observation);
  }

  for (const [name, value] of Object.entries(extraFields)) {
    form.append(name, value);
  }

  if (includePhoto) {
    form.append("photo", new Blob([bytes], { type: mimeType }), "client-photo");
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: authenticated
      ? authorizationHeader(role, `${role.toLowerCase()}-user`)
      : {},
    body: form,
  });
  const responseText = await response.text();

  return {
    response,
    body: responseText ? JSON.parse(responseText) : undefined,
  };
}

test("authenticated INSPECTOR receives a Finding-shaped AI suggestion", async () => {
  const result = await analyze({ observation: "Crack beside window" });

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { suggestion });
  assert.equal(analysisCalls.length, 1);
  assert.equal(analysisCalls[0].observation, "Crack beside window");
  assert.equal(analysisCalls[0].photo.mimeType, "image/jpeg");
  assert.deepEqual(
    analysisCalls[0].photo.data,
    Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  );
  assert.equal(prismaCalls, 0);
});

test("AI analysis leaves the existing Finding collection unchanged", async () => {
  const before = structuredClone(findings);
  const result = await analyze({ observation: "Crack beside window" });

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { suggestion });
  assert.deepEqual(findings, before);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].status, "DRAFT");
  assert.equal(findings[0].photoPath, null);
  assert.equal(prismaCalls, 0);
});

test("AI analysis requires authentication", async () => {
  const result = await analyze({ authenticated: false });

  assert.equal(result.response.status, 401);
  assert.deepEqual(result.body, {
    error: { message: "Authentication required" },
  });
  assert.equal(analysisCalls.length, 0);
});

test("ADMIN and REVIEWER cannot analyze a finding photo", async () => {
  for (const role of [UserRole.ADMIN, UserRole.REVIEWER]) {
    const result = await analyze({ role });

    assert.equal(result.response.status, 403);
    assert.deepEqual(result.body, { error: { message: "Forbidden" } });
  }

  assert.equal(analysisCalls.length, 0);
});

test("missing photo is rejected", async () => {
  const result = await analyze({ includePhoto: false });

  assert.equal(result.response.status, 400);
  assert.deepEqual(result.body, {
    error: { message: "Invalid AI analysis input" },
  });
  assert.equal(analysisCalls.length, 0);
});

test("unsupported photo type is rejected", async () => {
  const result = await analyze({
    bytes: Buffer.from("not an image"),
    mimeType: "application/pdf",
  });

  assert.equal(result.response.status, 415);
  assert.deepEqual(result.body, {
    error: { message: "Unsupported photo type" },
  });
  assert.equal(analysisCalls.length, 0);
});

test("JPEG, PNG, and WebP photos are passed to the AI service in memory", async () => {
  for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
    const result = await analyze({ mimeType });

    assert.equal(result.response.status, 200);
    assert.equal(analysisCalls.at(-1).photo.mimeType, mimeType);
    assert.equal(Buffer.isBuffer(analysisCalls.at(-1).photo.data), true);
  }

  assert.equal(prismaCalls, 0);
});

test("photo without observation is accepted", async () => {
  const result = await analyze();

  assert.equal(result.response.status, 200);
  assert.equal(analysisCalls[0].observation, undefined);
  assert.deepEqual(result.body, { suggestion });
});

test("oversized photos and unexpected fields are rejected", async () => {
  const oversized = await analyze({ bytes: Buffer.alloc(FIVE_MB + 1) });
  const unexpected = await analyze({ extraFields: { findingId: "finding-a" } });

  assert.equal(oversized.response.status, 413);
  assert.deepEqual(oversized.body, {
    error: { message: "Photo exceeds the 5 MB limit" },
  });
  assert.equal(unexpected.response.status, 400);
  assert.equal(analysisCalls.length, 0);
});
