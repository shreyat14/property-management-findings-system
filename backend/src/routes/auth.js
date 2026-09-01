const { Router } = require("express");

const { authenticate } = require("../middleware/authenticate");
const { generateToken } = require("../utils/jwt");
const { verifyPassword } = require("../utils/password");

const INVALID_CREDENTIALS = "Invalid email or password";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authRouter({ prisma }) {
  const router = Router();

  router.post("/login", async (req, res, next) => {
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!EMAIL_PATTERN.test(email) || password.length === 0) {
      return res.status(400).json({
        error: {
          message: "A valid email and password are required",
        },
      });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          role: true,
        },
      });
      const passwordIsValid = user
        ? await verifyPassword(password, user.passwordHash)
        : false;

      if (!user || !passwordIsValid) {
        return res.status(401).json({
          error: {
            message: INVALID_CREDENTIALS,
          },
        });
      }

      const token = generateToken(user);

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/me", authenticate, async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.auth.userId },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      if (!user) {
        return res.status(401).json({
          error: {
            message: "Authentication required",
          },
        });
      }

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { authRouter };
