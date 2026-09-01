const { UserRole } = require("@prisma/client");

const VALID_ROLES = new Set(Object.values(UserRole));

function authorizeRoles(...allowedRoles) {
  if (
    allowedRoles.length === 0 ||
    allowedRoles.some((role) => !VALID_ROLES.has(role))
  ) {
    throw new TypeError("At least one valid user role is required.");
  }

  const allowedRoleSet = new Set(allowedRoles);

  return function authorizeRole(req, res, next) {
    if (req.auth && allowedRoleSet.has(req.auth.role)) {
      return next();
    }

    return res.status(403).json({
      error: {
        message: "Forbidden",
      },
    });
  };
}

module.exports = { authorizeRoles };
