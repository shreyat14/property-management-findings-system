const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_TIMEOUT_MS = 100_000;

const FINDING_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    area: {
      type: "string",
      enum: [
        "KITCHEN",
        "LIVING_ROOM",
        "BEDROOM",
        "BATHROOM",
        "HALLWAY",
        "LAUNDRY",
        "GARAGE",
        "EXTERIOR",
        "OTHER",
      ],
    },
    category: {
      type: "string",
      enum: [
        "PLUMBING",
        "ELECTRICAL",
        "FLOORING",
        "WALLS_CEILINGS",
        "DOORS_WINDOWS",
        "HVAC",
        "APPLIANCES",
        "STRUCTURAL",
        "SAFETY",
        "PEST",
        "CLEANLINESS",
        "OTHER",
      ],
    },
    issue: { type: "string" },
    severity: {
      type: "string",
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    },
    description: { type: "string" },
    recommendedAction: { type: "string" },
  },
  required: [
    "area",
    "category",
    "issue",
    "severity",
    "description",
    "recommendedAction",
  ],
};

class GeminiProviderError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "GeminiProviderError";
  }
}

function buildInspectionPrompt(observation) {
  return `You are an AI assistant helping a professional property inspector document inspection findings.

Analyze the property inspection photo and the inspector's one-line observation.

Inspector observation:
${observation || "No observation provided."}

Use the observation as supporting context, but treat the photo as the primary evidence. Only identify issues reasonably supported by the available evidence. Do not invent measurements, hidden damage, causes, or conditions. Do not present possible causes as confirmed facts. The output is a suggestion for inspector review, not a final determination.

## Allowed values

area:
KITCHEN, LIVING_ROOM, BEDROOM, BATHROOM, HALLWAY, LAUNDRY, GARAGE, EXTERIOR, OTHER

category:
PLUMBING, ELECTRICAL, FLOORING, WALLS_CEILINGS, DOORS_WINDOWS, HVAC, APPLIANCES, STRUCTURAL, SAFETY, PEST, CLEANLINESS, OTHER

Use OTHER when no available category reasonably fits. Do not invent values.

severity:
LOW, MEDIUM, HIGH, CRITICAL

LOW = minor issue with limited impact
MEDIUM = noticeable issue that is not urgent
HIGH = significant issue requiring prompt attention
CRITICAL = severe or potentially dangerous issue requiring urgent attention

Do not automatically classify damage as HIGH or CRITICAL. Base severity only on reasonably supported evidence.

## Output fields

Return exactly:

- area: Most appropriate location.
- category: Most appropriate issue category.
- issue: Concise professional title.
- severity: Appropriate severity based on available evidence.
- description: Detailed professional description, typically 3–4 sentences. Describe visible characteristics, location, and apparent extent when reasonably determinable. Do not include unsupported assumptions.
- recommendedAction: Practical next step, typically 2–3 sentences. Recommend inspection, monitoring, repair, replacement, cleaning, or other appropriate action. Do not diagnose an underlying cause; recommend further evaluation when the cause is uncertain. Do not make definitive claims about the absence of hidden damage or conditions that cannot be reliably assessed from the available evidence.

Write all fields as a professional inspection finding. Do not refer to "the inspector", "the observation", "the photo", or "the image" in the generated fields.

## Response format

Return ONLY valid JSON with exactly these six fields. No Markdown, explanations, reasoning, comments, confidence scores, or additional fields.`;
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }

  if (!Array.isArray(payload?.steps)) {
    return null;
  }

  for (let stepIndex = payload.steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const content = payload.steps[stepIndex]?.content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (let contentIndex = content.length - 1; contentIndex >= 0; contentIndex -= 1) {
      if (
        content[contentIndex]?.type === "text" &&
        typeof content[contentIndex].text === "string"
      ) {
        return content[contentIndex].text;
      }
    }
  }

  return null;
}

function createGeminiProvider({
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  async function analyzeInspection({ photo, observation }) {
    if (!apiKey) {
      throw new GeminiProviderError("GEMINI_API_KEY is not configured");
    }

    if (typeof fetchImpl !== "function") {
      throw new GeminiProviderError("Gemini HTTP client is unavailable");
    }

    const imageData = Buffer.isBuffer(photo?.data)
      ? photo.data
      : Buffer.from(photo?.data || []);

    let response;

    try {
      response = await fetchImpl(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model,
          store: false,
          generation_config: {
            thinking_level: "minimal",
          },
          input: [
            { type: "text", text: buildInspectionPrompt(observation) },
            {
              type: "image",
              data: imageData.toString("base64"),
              mime_type: photo.mimeType,
            },
          ],
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: FINDING_RESPONSE_SCHEMA,
          },
        }),
      });
    } catch (error) {
      throw new GeminiProviderError("Gemini analysis request failed", {
        cause: error,
      });
    }

    if (!response.ok) {
      throw new GeminiProviderError("Gemini analysis request failed");
    }

    let payload;

    try {
      payload = await response.json();
    } catch (error) {
      throw new GeminiProviderError("Gemini returned an invalid response", {
        cause: error,
      });
    }

    const responseText = extractResponseText(payload);

    if (!responseText) {
      throw new GeminiProviderError("Gemini returned an invalid response");
    }

    let suggestion;

    try {
      suggestion = JSON.parse(responseText);
    } catch (error) {
      throw new GeminiProviderError("Gemini returned an invalid response", {
        cause: error,
      });
    }

    return suggestion;
  }

  return { analyzeInspection };
}

module.exports = {
  GeminiProviderError,
  buildInspectionPrompt,
  createGeminiProvider,
};
