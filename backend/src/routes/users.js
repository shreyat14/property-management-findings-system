const { UserRole } = require("@prisma/client");
const { Router } = require("express");

const { authenticate } = require("../middleware/authenticate");
const { authorizeRoles } = require("../middleware/authorizeRoles");
const { hashPassword } = require("../utils/password");

const ALLOWED_INSPECTOR_FIELDS = new Set(["email", "password"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSPECTOR_SELECT = {
  id: true,
  email: true,
  role: true,
};

function rejectInvalidInput(res) {
  return res.status(400).json({
    error: {
      message: "Invalid inspector input",
    },
  });
}

function rejectDuplicateEmail(res) {
  return res.status(409).json({
    error: {
      message: "A user with this email already exists",
    },
  });
}

function parseInspectorInput(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== ALLOWED_INSPECTOR_FIELDS.size ||
    [...ALLOWED_INSPECTOR_FIELDS].some((field) => !Object.hasOwn(body, field))
  ) {
    return null;
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!EMAIL_PATTERN.test(email) || password.length === 0) {
    return null;
  }

  return { email, password };
}

function usersRouter({ prisma }) {
  const router = Router();

  router.use(authenticate);
  router.use(authorizeRoles(UserRole.ADMIN));

  router.get("/inspectors", async (_req, res, next) => {
    try {
      const inspectors = await prisma.user.findMany({
        where: { role: UserRole.INSPECTOR },
        orderBy: { email: "asc" },
        select: INSPECTOR_SELECT,
      });

      return res.json({ inspectors });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/inspectors", async (req, res, next) => {
    const data = parseInspectorInput(req.body);

    if (!data) {
      return rejectInvalidInput(res);
    }

    try {
      const passwordHash = await hashPassword(data.password);
      const inspector = await prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: UserRole.INSPECTOR,
        },
        select: INSPECTOR_SELECT,
      });

      return res.status(201).json({ inspector });
    } catch (error) {
      if (error && error.code === "P2002") {
        return rejectDuplicateEmail(res);
      }

      return next(error);
    }
  });

  return router;
}

module.exports = { usersRouter };
