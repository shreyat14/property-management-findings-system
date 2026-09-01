const assert = require("node:assert/strict");
const test = require("node:test");

const {
  hashPassword,
  verifyPassword,
} = require("../src/utils/password");

test("a hashed password verifies successfully", async () => {
  const password = "CorrectHorseBatteryStaple!";
  const passwordHash = await hashPassword(password);

  assert.equal(await verifyPassword(password, passwordHash), true);
});

test("an incorrect password fails verification", async () => {
  const passwordHash = await hashPassword("CorrectPassword123!");

  assert.equal(await verifyPassword("IncorrectPassword123!", passwordHash), false);
});

test("the same password produces different salted hashes", async () => {
  const password = "RepeatedPassword123!";
  const [firstHash, secondHash] = await Promise.all([
    hashPassword(password),
    hashPassword(password),
  ]);

  assert.notEqual(firstHash, secondHash);
  assert.equal(await verifyPassword(password, firstHash), true);
  assert.equal(await verifyPassword(password, secondHash), true);
});

test("malformed stored hashes are rejected safely", async () => {
  const malformedHashes = [
    null,
    "",
    "not-a-password-hash",
    "scrypt$16384$8$1$invalid!salt$invalid!hash",
    "scrypt$999999999$8$1$c2FsdA$aGFzaA",
  ];

  for (const storedHash of malformedHashes) {
    assert.equal(await verifyPassword("Password123!", storedHash), false);
  }
});
