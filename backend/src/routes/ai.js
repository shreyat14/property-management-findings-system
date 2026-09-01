const { UserRole } = require("@prisma/client");
const { Router } = require("express");

const { authenticate } = require("../middleware/authenticate");
const { authorizeRoles } = require("../middleware/authorizeRoles");
const { createAiPhotoUpload } = require("../middleware/uploadAiPhoto");
const { createAiService } = require("../services/aiService");

function rejectInvalidInput(res) {
  return res.status(400).json({
    error: {
      message: "Invalid AI analysis input",
    },
  });
}

function aiRouter({ aiService = createAiService() } = {}) {
  const router = Router();
  const uploadAiPhoto = createAiPhotoUpload();

  router.post(
    "/analyze-finding",
    authenticate,
    authorizeRoles(UserRole.INSPECTOR),
    uploadAiPhoto,
    async (req, res, next) => {
      if (!req.file) {
        return rejectInvalidInput(res);
      }

      const fields = Object.keys(req.body || {});

      if (
        fields.some((field) => field !== "observation") ||
        (Object.hasOwn(req.body || {}, "observation") &&
          typeof req.body.observation !== "string")
      ) {
        return rejectInvalidInput(res);
      }

      const observation = req.body?.observation?.trim() || undefined;

      try {
        const suggestion = await aiService.analyzeInspection({
          photo: {
            data: req.file.buffer,
            mimeType: req.file.mimetype,
          },
          observation,
        });

        return res.json({ suggestion });
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}

module.exports = { aiRouter };
