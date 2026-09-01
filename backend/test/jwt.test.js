const assert = require("node:assert/strict");
const test = require("node:test");

const { generateToken, verifyToken } = require("../src/utils/jwt");

const originalSecret = process.env.JWT_SECRET;
const originalExpiration = process.env.JWT_EXPIRES_IN;

test.beforeEach(() => {
  process.env.JWT_SECRET = "unit-test-secret-that-is-not-used-outside-tests";
  process.env.JWT_EXPIRES_IN = "1h";
});

test.after(() => {
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

test("a generated token verifies with the expected subject and role", () => {
  const token = generateToken({ id: "user-123", role: "INSPECTOR" });
  const payload = verifyToken(token);

  assert.equal(payload.sub, "user-123");
  assert.equal(payload.role, "INSPECTOR");
  assert.equal(typeof payload.iat, "number");
  assert.equal(typeof payload.exp, "number");
});

test("a tampered token is rejected", () => {
  const token = generateToken({ id: "user-123", role: "INSPECTOR" });
  const [header, payload, signature] = token.split(".");
  const replacement = signature[0] === "a" ? "b" : "a";
  const tamperedToken = [
    header,
    payload,
    replacement + signature.slice(1),
  ].join(".");

  assert.throws(() => verifyToken(tamperedToken));
});

test("an expired token is rejected", () => {
  process.env.JWT_EXPIRES_IN = "-1s";
  const token = generateToken({ id: "user-123", role: "INSPECTOR" });

  assert.throws(() => verifyToken(token), /expired/i);
});
