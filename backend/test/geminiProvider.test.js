const assert = require("node:assert/strict");
const test = require("node:test");

const {
  GeminiProviderError,
  createGeminiProvider,
} = require("../src/providers/geminiProvider");

const suggestion = {
  area: "BATHROOM",
  category: "PLUMBING",
  issue: "Leaking Supply Connection",
  severity: "MEDIUM",
  description: "Moisture is visible below the sink supply connection.",
  recommendedAction: "Have the connection evaluated and repaired.",
};

function jsonResponse(payload, { ok = true } = {}) {
  return {
    ok,
    json: async () => payload,
  };
}

test("Gemini provider sends photo, observation, API key, and structured schema", async () => {
  let request;
  const provider = createGeminiProvider({
    apiKey: "test-gemini-key",
    model: "test-gemini-model",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return jsonResponse({ output_text: JSON.stringify(suggestion) });
    },
  });

  const result = await provider.analyzeInspection({
    photo: { data: Buffer.from([0xff, 0xd8, 0xff]), mimeType: "image/jpeg" },
    observation: "Water staining beneath the vanity",
  });
  const requestBody = JSON.parse(request.options.body);

  assert.equal(
    request.url,
    "https://generativelanguage.googleapis.com/v1beta/interactions",
  );
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers["x-goog-api-key"], "test-gemini-key");
  assert.equal(requestBody.model, "test-gemini-model");
  assert.equal(requestBody.store, false);
  assert.match(
    requestBody.input[0].text,
    /Water staining beneath the vanity/,
  );
  assert.match(requestBody.input[0].text, /photo as the primary evidence/);
  assert.deepEqual(requestBody.input[1], {
    type: "image",
    data: Buffer.from([0xff, 0xd8, 0xff]).toString("base64"),
    mime_type: "image/jpeg",
  });
  assert.equal(requestBody.response_format.mime_type, "application/json");
  assert.deepEqual(requestBody.response_format.schema.required, [
    "area",
    "category",
    "issue",
    "severity",
    "description",
    "recommendedAction",
  ]);
  assert.equal(requestBody.response_format.schema.additionalProperties, false);
  assert.deepEqual(result, suggestion);
});

test("Gemini provider reads GEMINI_API_KEY and GEMINI_MODEL from the environment", async () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;
  let requestBody;
  let requestHeaders;

  try {
    process.env.GEMINI_API_KEY = "environment-gemini-key";
    process.env.GEMINI_MODEL = "environment-gemini-model";

    const provider = createGeminiProvider({
      fetchImpl: async (_url, options) => {
        requestBody = JSON.parse(options.body);
        requestHeaders = options.headers;
        return jsonResponse({
          steps: [
            {
              type: "model_output",
              content: [{ type: "text", text: JSON.stringify(suggestion) }],
            },
          ],
        });
      },
    });

    assert.deepEqual(
      await provider.analyzeInspection({
        photo: { data: Buffer.from([1]), mimeType: "image/png" },
        observation: "Cracked tile",
      }),
      suggestion,
    );
    assert.equal(requestHeaders["x-goog-api-key"], "environment-gemini-key");
    assert.equal(requestBody.model, "environment-gemini-model");
  } finally {
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }

    if (originalModel === undefined) {
      delete process.env.GEMINI_MODEL;
    } else {
      process.env.GEMINI_MODEL = originalModel;
    }
  }
});

test("Gemini provider fails safely for configuration, API, and response errors", async () => {
  const input = {
    photo: { data: Buffer.from([1]), mimeType: "image/webp" },
    observation: "Damaged surface",
  };

  await assert.rejects(
    createGeminiProvider({ apiKey: "", fetchImpl: async () => {} })
      .analyzeInspection(input),
    (error) =>
      error instanceof GeminiProviderError &&
      error.message === "GEMINI_API_KEY is not configured",
  );
  await assert.rejects(
    createGeminiProvider({
      apiKey: "key",
      fetchImpl: async () => jsonResponse({}, { ok: false }),
    }).analyzeInspection(input),
    /Gemini analysis request failed/,
  );
  await assert.rejects(
    createGeminiProvider({
      apiKey: "key",
      fetchImpl: async () => jsonResponse({ output_text: "not-json" }),
    }).analyzeInspection(input),
    /Gemini returned an invalid response/,
  );
  await assert.rejects(
    createGeminiProvider({
      apiKey: "key",
      fetchImpl: async () => jsonResponse({ steps: [] }),
    }).analyzeInspection(input),
    /Gemini returned an invalid response/,
  );
});

test("Gemini provider aborts a timed-out request with a controlled error", async () => {
  const provider = createGeminiProvider({
    apiKey: "test-key-must-not-appear-in-errors",
    timeoutMs: 1,
    fetchImpl: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        const keepAlive = setTimeout(
          () => reject(new Error("mock fetch did not receive an abort signal")),
          100,
        );
        const rejectTimeout = () => {
          clearTimeout(keepAlive);
          reject(new Error("sensitive socket timeout details"));
        };

        if (signal.aborted) {
          rejectTimeout();
          return;
        }

        signal.addEventListener("abort", rejectTimeout, { once: true });
      }),
  });

  await assert.rejects(
    provider.analyzeInspection({
      photo: { data: Buffer.from([1]), mimeType: "image/jpeg" },
      observation: "Crack near window",
    }),
    (error) =>
      error instanceof GeminiProviderError &&
      error.message === "Gemini analysis request failed" &&
      !error.message.includes("test-key") &&
      !error.message.includes("socket"),
  );
});
