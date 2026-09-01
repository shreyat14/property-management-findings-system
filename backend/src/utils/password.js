const {
  randomBytes,
  scrypt: scryptCallback,
  timingSafeEqual,
} = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(scryptCallback);

const ALGORITHM = "scrypt";
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const SALT_LENGTH = 16;
const HASH_LENGTH = 64;
const MAX_MEMORY = 32 * 1024 * 1024;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

async function deriveHash(password, salt) {
  return scrypt(password, salt, HASH_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });
}

async function hashPassword(password) {
  if (typeof password !== "string") {
    throw new TypeError("Password must be a string.");
  }

  const salt = randomBytes(SALT_LENGTH);
  const hash = await deriveHash(password, salt);

  return [
    ALGORITHM,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

async function verifyPassword(password, storedHash) {
  if (typeof password !== "string" || typeof storedHash !== "string") {
    return false;
  }

  try {
    const parts = storedHash.split("$");

    if (
      parts.length !== 6 ||
      parts[0] !== ALGORITHM ||
      parts[1] !== String(COST) ||
      parts[2] !== String(BLOCK_SIZE) ||
      parts[3] !== String(PARALLELIZATION) ||
      !BASE64URL_PATTERN.test(parts[4]) ||
      !BASE64URL_PATTERN.test(parts[5])
    ) {
      return false;
    }

    const salt = Buffer.from(parts[4], "base64url");
    const expectedHash = Buffer.from(parts[5], "base64url");

    if (salt.length !== SALT_LENGTH || expectedHash.length !== HASH_LENGTH) {
      return false;
    }

    const actualHash = await deriveHash(password, salt);
    return timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
};
