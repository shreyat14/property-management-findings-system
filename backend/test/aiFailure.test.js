const assert = require("node:assert/strict");
const test = require("node:test");
const { UserRole } = require("@prisma/client");

const { createApp } = require("../src/app");
const { GeminiProviderError } = require("../src/providers/geminiProvider");
const { createAiService } = require("../src/services/aiService");
const { generateToken } = require("../src/utils/jwt");

const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;
const validSuggestion = {
  area: "EXTERIOR",
  category: "STRUCTURAL",
  issue: "Crack near exterior window",
  severity: "MEDIUM",
  description: "A visible crack extends from the corner of the window opening.",
  recommendedAction: "Have the area evaluated and repair it as appropriate.",
};

let baseUrl;
let loggedErrors;
let providerBehavior;
let prismaCalls;
let server;

const provider = {
  analyzeInspection: async (input) => providerBehavior(input),
};
const aiService = createAiService({ provider });
const logger = {
  error: (...args) => loggedErrors.push(args),
};
const prisma = new Proxy(
  {},
  {
    get() {
      prismaCalls += 1;
      throw new Error("AI failure handling must not access Prisma");
    },
  },
);

test.before(async () => {
  process.env.JWT_SECRET = "ai-failure-test-secret-not-used-outside-tests";
  process.env.JWT_EXPIRES_IN = "1h";

  const app = createApp({
    aiService,
    checkDatabase: async () => {},
    logger,
    prisma,
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/ai/analyze-finding`;
});

test.beforeEach(() => {
  loggedErrors = [];
  providerBehavior = async () => ({ ...validSuggestion });
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

async function analyze() {
  const token = generateToken({ id: "inspector-a", role: UserRole.INSPECTOR });
  const form = new FormData();
  form.append(
    "photo",
    new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], {
      type: "image/jpeg",
    }),
    "inspection.jpg",
  );

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  const responseText = await response.text();

  return {
    response,
    responseText,
    body: responseText ? JSON.parse(responseText) : undefined,
  };
}

function assertControlledFailure(result) {
  assert.equal(result.response.status, 500);
  assert.deepEqual(result.body, {
    error: { message: "Internal server error" },
  });
  assert.equal(result.responseText.includes("Gemini"), false);
  assert.equal(result.responseText.includes("api-key"), false);
  assert.equal(result.responseText.includes("stack"), false);
  assert.equal(loggedErrors.length > 0, true);
  assert.match(loggedErrors.at(-1)[0], /POST \/api\/v1\/ai\/analyze-finding/);
  assert.equal(loggedErrors.at(-1)[1] instanceof Error, true);
  assert.equal(prismaCalls, 0);
}

test("malformed and invalid AI suggestions return a controlled error", async () => {
  const missingFields = Object.keys(validSuggestion).map((field) => {
    const result = { ...validSuggestion };
    delete result[field];
    return result;
  });
  const invalidSuggestions = [
    "not an object",
    ...missingFields,
    { ...validSuggestion, area: "ROOF" },
    { ...validSuggestion, category: "COSMETIC" },
    { ...validSuggestion, severity: "URGENT" },
  ];

  for (const invalidSuggestion of invalidSuggestions) {
    providerBehavior = async () => invalidSuggestion;
    assertControlledFailure(await analyze());
  }
});

test("Gemini API failure and timeout return controlled errors", async () => {
  for (const providerError of [
    new GeminiProviderError(
      "Gemini rejected api-key=secret-key with raw upstream payload",
    ),
    new GeminiProviderError("Gemini analysis request failed", {
      cause: new Error("internal socket timeout"),
    }),
  ]) {
    providerBehavior = async () => {
      throw providerError;
    };

    assertControlledFailure(await analyze());
  }
});

test("the AI endpoint remains usable after provider failures", async () => {
  providerBehavior = async () => {
    throw new GeminiProviderError("temporary Gemini outage");
  };
  assertControlledFailure(await analyze());

  providerBehavior = async () => ({ ...validSuggestion });
  const recovery = await analyze();

  assert.equal(recovery.response.status, 200);
  assert.deepEqual(recovery.body, { suggestion: validSuggestion });
  assert.equal(prismaCalls, 0);
});
