const { createGeminiProvider } = require("../providers/geminiProvider");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_AREAS = new Set([
  "KITCHEN",
  "LIVING_ROOM",
  "BEDROOM",
  "BATHROOM",
  "HALLWAY",
  "LAUNDRY",
  "GARAGE",
  "EXTERIOR",
  "OTHER",
]);
const ALLOWED_CATEGORIES = new Set([
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
]);
const ALLOWED_SEVERITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const SUGGESTION_FIELDS = [
  "area",
  "category",
  "issue",
  "severity",
  "description",
  "recommendedAction",
];

function normalizePhoto(photo) {
  if (
    !photo ||
    !ALLOWED_MIME_TYPES.has(photo.mimeType) ||
    (!Buffer.isBuffer(photo.data) && !(photo.data instanceof Uint8Array)) ||
    photo.data.length === 0
  ) {
    throw new TypeError("A JPEG, PNG, or WebP photo is required");
  }

  return {
    data: Buffer.from(photo.data),
    mimeType: photo.mimeType,
  };
}

function normalizeObservation(observation) {
  if (observation === undefined || observation === null) {
    return "";
  }

  if (typeof observation !== "string") {
    throw new TypeError("Observation must be a string");
  }

  return observation.trim();
}

function validateSuggestion(suggestion) {
  if (
    !suggestion ||
    typeof suggestion !== "object" ||
    Array.isArray(suggestion) ||
    Object.keys(suggestion).length !== SUGGESTION_FIELDS.length ||
    !SUGGESTION_FIELDS.every((field) =>
      Object.prototype.hasOwnProperty.call(suggestion, field),
    ) ||
    !ALLOWED_AREAS.has(suggestion.area) ||
    !ALLOWED_CATEGORIES.has(suggestion.category) ||
    !ALLOWED_SEVERITIES.has(suggestion.severity) ||
    !["issue", "description", "recommendedAction"].every(
      (field) =>
        typeof suggestion[field] === "string" && suggestion[field].trim(),
    )
  ) {
    throw new Error("AI provider returned an invalid finding suggestion");
  }

  return {
    area: suggestion.area,
    category: suggestion.category,
    issue: suggestion.issue.trim(),
    severity: suggestion.severity,
    description: suggestion.description.trim(),
    recommendedAction: suggestion.recommendedAction.trim(),
  };
}

function createAiService({ provider = createGeminiProvider() } = {}) {
  if (!provider || typeof provider.analyzeInspection !== "function") {
    throw new TypeError("An AI provider is required");
  }

  async function analyzeInspection({ photo, observation } = {}) {
    const suggestion = await provider.analyzeInspection({
      photo: normalizePhoto(photo),
      observation: normalizeObservation(observation),
    });
    return validateSuggestion(suggestion);
  }

  return { analyzeInspection };
}

module.exports = { createAiService };
