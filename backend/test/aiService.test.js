const assert = require("node:assert/strict");
const test = require("node:test");

const { createAiService } = require("../src/services/aiService");

const validSuggestion = {
  area: "BATHROOM",
  category: "PLUMBING",
  issue: "Leaking Supply Connection",
  severity: "MEDIUM",
  description: "Moisture is visible below the sink supply connection.",
  recommendedAction: "Have the connection evaluated and repaired.",
};

test("AI service passes normalized photo and observation to its provider", async () => {
  let providerInput;
  const service = createAiService({
    provider: {
      analyzeInspection: async (input) => {
        providerInput = input;
        return { ...validSuggestion };
      },
    },
  });

  const result = await service.analyzeInspection({
    photo: { data: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" },
    observation: "  Drip beneath bathroom sink  ",
  });

  assert.deepEqual(providerInput, {
    photo: { data: Buffer.from([1, 2, 3]), mimeType: "image/jpeg" },
    observation: "Drip beneath bathroom sink",
  });
  assert.deepEqual(result, validSuggestion);
});

test("AI service rejects invalid input before calling the provider", async () => {
  let callCount = 0;
  const service = createAiService({
    provider: {
      analyzeInspection: async () => {
        callCount += 1;
        return validSuggestion;
      },
    },
  });

  await assert.rejects(
    service.analyzeInspection({
      photo: { data: Buffer.alloc(0), mimeType: "image/jpeg" },
      observation: "Leak",
    }),
    /photo is required/,
  );
  await assert.rejects(
    service.analyzeInspection({
      photo: { data: Buffer.from([1]), mimeType: "application/pdf" },
      observation: "Leak",
    }),
    /photo is required/,
  );
  await assert.rejects(
    service.analyzeInspection({
      photo: { data: Buffer.from([1]), mimeType: "image/png" },
      observation: { text: "Leak" },
    }),
    /Observation must be a string/,
  );
  assert.equal(callCount, 0);
});

test("AI service accepts an omitted observation", async () => {
  let providerInput;
  const service = createAiService({
    provider: {
      analyzeInspection: async (input) => {
        providerInput = input;
        return { ...validSuggestion };
      },
    },
  });

  const result = await service.analyzeInspection({
    photo: { data: Buffer.from([1]), mimeType: "image/png" },
  });

  assert.equal(providerInput.observation, "");
  assert.deepEqual(result, validSuggestion);
});

test("AI service rejects provider output outside the finding contract", async () => {
  const missingFields = Object.keys(validSuggestion).map((field) => {
    const result = { ...validSuggestion };
    delete result[field];
    return result;
  });
  const invalidSuggestions = [
    "malformed response",
    ...missingFields,
    { ...validSuggestion, area: "ROOF" },
    { ...validSuggestion, category: "COSMETIC" },
    { ...validSuggestion, severity: "URGENT" },
    { ...validSuggestion, issue: "" },
    { ...validSuggestion, confidence: 0.9 },
    { ...validSuggestion, recommendedAction: undefined },
  ];

  for (const invalidSuggestion of invalidSuggestions) {
    const service = createAiService({
      provider: { analyzeInspection: async () => invalidSuggestion },
    });

    await assert.rejects(
      service.analyzeInspection({
        photo: { data: Buffer.from([1]), mimeType: "image/webp" },
        observation: "Visible damage",
      }),
      /invalid finding suggestion/,
    );
  }
});
