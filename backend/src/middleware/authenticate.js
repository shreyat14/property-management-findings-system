const { verifyToken } = require("../utils/jwt");

const AUTHENTICATION_ERROR = "Authentication required";

function rejectAuthentication(res) {
  return res.status(401).json({
    error: {
      message: AUTHENTICATION_ERROR,
    },
  });
}

function authenticate(req, res, next) {
  const authorization = req.get("authorization");
  const match =
    typeof authorization === "string"
      ? authorization.match(/^Bearer ([^\s]+)$/)
      : null;

  if (!match) {
    return rejectAuthentication(res);
  }

  try {
    const payload = verifyToken(match[1]);

    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      typeof payload.role !== "string" ||
      payload.role.length === 0
    ) {
      return rejectAuthentication(res);
    }

    req.auth = {
      userId: payload.sub,
      role: payload.role,
    };

    return next();
  } catch {
    return rejectAuthentication(res);
  }
}

module.exports = { authenticate };
