const jwt = require("jsonwebtoken");

const DEFAULT_EXPIRATION = "1h";
const ALGORITHM = "HS256";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return secret;
}

function generateToken(user) {
  if (
    !user ||
    typeof user.id !== "string" ||
    user.id.length === 0 ||
    typeof user.role !== "string" ||
    user.role.length === 0
  ) {
    throw new TypeError("An authenticated user ID and role are required.");
  }

  return jwt.sign({ role: user.role }, getJwtSecret(), {
    algorithm: ALGORITHM,
    subject: user.id,
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRATION,
  });
}

function verifyToken(token) {
  if (typeof token !== "string" || token.length === 0) {
    throw new TypeError("JWT must be a non-empty string.");
  }

  return jwt.verify(token, getJwtSecret(), {
    algorithms: [ALGORITHM],
  });
}

module.exports = {
  generateToken,
  verifyToken,
};
