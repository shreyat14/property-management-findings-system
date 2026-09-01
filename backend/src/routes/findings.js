const {
  FindingArea,
  FindingCategory,
  FindingSeverity,
  FindingStatus,
  InspectionStatus,
  UserRole,
} = require("@prisma/client");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Router } = require("express");

const { authenticate } = require("../middleware/authenticate");
const { authorizeRoles } = require("../middleware/authorizeRoles");
const {
  createFindingPhotoUpload,
  DEFAULT_FINDING_UPLOAD_DIRECTORY,
} = require("../middleware/uploadFindingPhoto");
const {
  authorizeFindingAccess,
  authorizeInspectionAccess,
} = require("../middleware/authorizeResourceAccess");

const FINDING_CONTENT_FIELDS = [
  "area",
  "category",
  "issue",
  "severity",
  "description",
  "recommendedAction",
];
const FINDING_CONTENT_FIELD_SET = new Set(FINDING_CONTENT_FIELDS);
const FINDING_AREA_SET = new Set(Object.values(FindingArea));
const FINDING_CATEGORY_SET = new Set(Object.values(FindingCategory));
const FINDING_SEVERITY_SET = new Set(Object.values(FindingSeverity));
const FINDING_PHOTO_REFERENCE_PREFIX = "uploads/findings/";
const PHOTO_CONTENT_TYPES = Object.freeze({
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
});
const FINDING_SELECT = {
  id: true,
  inspectionId: true,
  area: true,
  category: true,
  issue: true,
  severity: true,
  description: true,
  recommendedAction: true,
  status: true,
  photoPath: true,
  createdAt: true,
  updatedAt: true,
};
const REVIEWER_FINDING_SELECT = {
  ...FINDING_SELECT,
  inspection: {
    select: {
      id: true,
      propertyId: true,
      inspectorId: true,
      status: true,
      completedAt: true,
      inspectedAt: true,
      createdAt: true,
      property: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
      inspector: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  },
};
const REVIEWER_READABLE_FINDING_STATUSES = new Set([
  FindingStatus.SUBMITTED,
  FindingStatus.APPROVED,
  FindingStatus.REJECTED,
]);

function rejectInvalidInput(res) {
  return res.status(400).json({
    error: {
      message: "Invalid finding input",
    },
  });
}

function rejectNotFound(res, resource) {
  return res.status(404).json({
    error: {
      message: `${resource} not found`,
    },
  });
}

function rejectForbidden(res) {
  return res.status(403).json({
    error: {
      message: "Forbidden",
    },
  });
}

function rejectInvalidStatus(res) {
  return res.status(409).json({
    error: {
      message: "Finding cannot be edited in its current status",
    },
  });
}

function rejectCompletedInspection(res) {
  return res.status(409).json({
    error: {
      message: "Findings cannot be created for a completed inspection",
    },
  });
}

function rejectInvalidTransition(res) {
  return res.status(409).json({
    error: {
      message: "Invalid finding status transition",
    },
  });
}

function rejectPhotoRequired(res) {
  return res.status(400).json({
    error: {
      message: "A photo file is required",
    },
  });
}

function rejectPhotoExists(res) {
  return res.status(409).json({
    error: {
      message: "Finding already has a photo",
    },
  });
}

function rejectPhotoNotFound(res) {
  return res.status(404).json({
    error: {
      message: "Finding photo not found",
    },
  });
}

function resolveFindingPhoto(photoPath, uploadDirectory) {
  if (
    typeof photoPath !== "string" ||
    photoPath.includes("\\") ||
    path.posix.isAbsolute(photoPath) ||
    !photoPath.startsWith(FINDING_PHOTO_REFERENCE_PREFIX)
  ) {
    return null;
  }

  const filename = photoPath.slice(FINDING_PHOTO_REFERENCE_PREFIX.length);

  if (!filename || filename !== path.posix.basename(filename)) {
    return null;
  }

  const contentType = PHOTO_CONTENT_TYPES[path.posix.extname(filename)];

  if (!contentType) {
    return null;
  }

  const uploadRoot = path.resolve(uploadDirectory);
  const filePath = path.resolve(uploadRoot, filename);
  const relativePath = path.relative(uploadRoot, filePath);

  if (
    !relativePath ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }

  return { contentType, filePath };
}

function isMissingFileError(error) {
  return error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

function parseFindingInput(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const fields = Object.keys(body);

  if (
    fields.length === 0 ||
    fields.some((field) => !FINDING_CONTENT_FIELD_SET.has(field)) ||
    (!partial &&
      FINDING_CONTENT_FIELDS.some((field) => !Object.hasOwn(body, field)))
  ) {
    return null;
  }

  const data = {};

  for (const field of fields) {
    const value = body[field];

    if (field === "area") {
      if (!FINDING_AREA_SET.has(value)) {
        return null;
      }
      data.area = value;
      continue;
    }

    if (field === "category") {
      if (!FINDING_CATEGORY_SET.has(value)) {
        return null;
      }
      data.category = value;
      continue;
    }

    if (field === "severity") {
      if (!FINDING_SEVERITY_SET.has(value)) {
        return null;
      }
      data.severity = value;
      continue;
    }

    if (typeof value !== "string" || value.trim().length === 0) {
      return null;
    }

    data[field] = value.trim();
  }

  return data;
}

function hasTransitionInput(body) {
  if (body === undefined) {
    return false;
  }

  return (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length > 0
  );
}

function requireInspectionExists({ prisma }) {
  return async function checkInspectionExists(req, res, next) {
    try {
      const inspection = await prisma.inspection.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      });

      if (!inspection) {
        return rejectNotFound(res, "Inspection");
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireFindingExists({ prisma }) {
  return async function checkFindingExists(req, res, next) {
    try {
      const finding = await prisma.finding.findUnique({
        where: { id: req.params.id },
        select: { id: true, status: true },
      });

      if (!finding) {
        return rejectNotFound(res, "Finding");
      }

      req.findingStatus = finding.status;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function authorizeFindingRead({ authorizeInspectorFinding }) {
  return function authorizeFindingReadAccess(req, res, next) {
    if (req.auth.role === UserRole.REVIEWER) {
      return REVIEWER_READABLE_FINDING_STATUSES.has(req.findingStatus)
        ? next()
        : rejectForbidden(res);
    }

    return authorizeInspectorFinding(req, res, next);
  };
}

function requireDraftFindingWithoutPhoto({ prisma }) {
  return async function checkFindingPhotoState(req, res, next) {
    try {
      const finding = await prisma.finding.findUnique({
        where: { id: req.params.id },
        select: { status: true, photoPath: true },
      });

      if (!finding) {
        return rejectNotFound(res, "Finding");
      }

      if (finding.status !== FindingStatus.DRAFT) {
        return rejectInvalidStatus(res);
      }

      if (finding.photoPath !== null) {
        return rejectPhotoExists(res);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

async function removeUploadedFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function transitionFinding({ prisma, fromStatus, toStatus }) {
  return async function transitionFindingStatus(req, res, next) {
    if (hasTransitionInput(req.body)) {
      return rejectInvalidInput(res);
    }

    try {
      const currentFinding = await prisma.finding.findUnique({
        where: { id: req.params.id },
        select: { id: true, status: true },
      });

      if (!currentFinding) {
        return rejectNotFound(res, "Finding");
      }

      if (currentFinding.status !== fromStatus) {
        return rejectInvalidTransition(res);
      }

      const result = await prisma.finding.updateMany({
        where: {
          id: currentFinding.id,
          status: fromStatus,
        },
        data: { status: toStatus },
      });

      if (result.count !== 1) {
        return rejectInvalidTransition(res);
      }

      const finding = await prisma.finding.findUnique({
        where: { id: currentFinding.id },
        select: FINDING_SELECT,
      });

      if (!finding) {
        return rejectNotFound(res, "Finding");
      }

      return res.json({ finding });
    } catch (error) {
      return next(error);
    }
  };
}

function inspectionFindingsRouter({ prisma }) {
  const router = Router({ mergeParams: true });
  const requireExistingInspection = requireInspectionExists({ prisma });
  const authorizeInspection = authorizeInspectionAccess({
    prisma,
    resourceIdParam: "id",
  });

  router.use(authenticate);
  router.use(authorizeRoles(UserRole.INSPECTOR));
  router.use(requireExistingInspection);
  router.use(authorizeInspection);

  router.post("/", async (req, res, next) => {
    const data = parseFindingInput(req.body);

    if (!data) {
      return rejectInvalidInput(res);
    }

    try {
      const inspection = await prisma.inspection.findUnique({
        where: { id: req.params.id },
        select: { status: true },
      });

      if (!inspection) {
        return rejectNotFound(res, "Inspection");
      }

      if (inspection.status === InspectionStatus.COMPLETED) {
        return rejectCompletedInspection(res);
      }

      const finding = await prisma.finding.create({
        data: {
          ...data,
          inspectionId: req.params.id,
          status: FindingStatus.DRAFT,
        },
        select: FINDING_SELECT,
      });

      return res.status(201).json({ finding });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const findings = await prisma.finding.findMany({
        where: { inspectionId: req.params.id },
        select: FINDING_SELECT,
      });

      return res.json({ findings });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

function findingsRouter({ prisma, uploadDirectory }) {
  const router = Router();
  const findingUploadDirectory =
    uploadDirectory || DEFAULT_FINDING_UPLOAD_DIRECTORY;
  const requireExistingFinding = requireFindingExists({ prisma });
  const authorizeFinding = authorizeFindingAccess({
    prisma,
    resourceIdParam: "id",
  });
  const authorizeRead = authorizeFindingRead({
    authorizeInspectorFinding: authorizeFinding,
  });
  const findingReadAccess = [
    authorizeRoles(UserRole.INSPECTOR, UserRole.REVIEWER),
    requireExistingFinding,
    authorizeRead,
  ];
  const inspectorFindingAccess = [
    authorizeRoles(UserRole.INSPECTOR),
    requireExistingFinding,
    authorizeFinding,
  ];
  const reviewerFindingAccess = [
    authorizeRoles(UserRole.REVIEWER),
    requireExistingFinding,
  ];
  const requirePhotoUploadState = requireDraftFindingWithoutPhoto({ prisma });
  const uploadFindingPhoto = createFindingPhotoUpload({ uploadDirectory });

  router.use(authenticate);

  router.get(
    "/",
    authorizeRoles(UserRole.REVIEWER),
    async (_req, res, next) => {
      try {
        const findings = await prisma.finding.findMany({
          where: { status: FindingStatus.SUBMITTED },
          select: REVIEWER_FINDING_SELECT,
          orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
        });

        return res.json({ findings });
      } catch (error) {
        return next(error);
      }
    },
  );

  router.get("/:id", ...findingReadAccess, async (req, res, next) => {
    try {
      const finding = await prisma.finding.findUnique({
        where: { id: req.params.id },
        select:
          req.auth.role === UserRole.REVIEWER
            ? REVIEWER_FINDING_SELECT
            : FINDING_SELECT,
      });

      if (!finding) {
        return rejectNotFound(res, "Finding");
      }

      return res.json({ finding });
    } catch (error) {
      return next(error);
    }
  });

  router.get(
    "/:id/photo",
    ...findingReadAccess,
    async (req, res, next) => {
      try {
        const finding = await prisma.finding.findUnique({
          where: { id: req.params.id },
          select: { photoPath: true },
        });

        if (!finding) {
          return rejectNotFound(res, "Finding");
        }

        const storedPhoto = resolveFindingPhoto(
          finding.photoPath,
          findingUploadDirectory,
        );

        if (!storedPhoto) {
          return rejectPhotoNotFound(res);
        }

        const stats = await fs.stat(storedPhoto.filePath);

        if (!stats.isFile()) {
          return rejectPhotoNotFound(res);
        }

        res.set("Content-Type", storedPhoto.contentType);
        return res.sendFile(storedPhoto.filePath, (error) => {
          if (!error) {
            return;
          }

          if (!res.headersSent && isMissingFileError(error)) {
            rejectPhotoNotFound(res);
            return;
          }

          next(error);
        });
      } catch (error) {
        if (isMissingFileError(error)) {
          return rejectPhotoNotFound(res);
        }

        return next(error);
      }
    },
  );

  router.patch("/:id", ...inspectorFindingAccess, async (req, res, next) => {
    const data = parseFindingInput(req.body, { partial: true });

    if (!data) {
      return rejectInvalidInput(res);
    }

    try {
      const currentFinding = await prisma.finding.findUnique({
        where: { id: req.params.id },
        select: { id: true, status: true },
      });

      if (!currentFinding) {
        return rejectNotFound(res, "Finding");
      }

      if (currentFinding.status !== FindingStatus.DRAFT) {
        return rejectInvalidStatus(res);
      }

      const result = await prisma.finding.updateMany({
        where: {
          id: currentFinding.id,
          status: FindingStatus.DRAFT,
        },
        data,
      });

      if (result.count !== 1) {
        return rejectInvalidStatus(res);
      }

      const finding = await prisma.finding.findUnique({
        where: { id: currentFinding.id },
        select: FINDING_SELECT,
      });

      if (!finding) {
        return rejectNotFound(res, "Finding");
      }

      return res.json({ finding });
    } catch (error) {
      return next(error);
    }
  });

  router.post(
    "/:id/photo",
    ...inspectorFindingAccess,
    requirePhotoUploadState,
    uploadFindingPhoto,
    async (req, res, next) => {
      if (!req.file) {
        return rejectPhotoRequired(res);
      }

      const photoPath = path.posix.join(
        "uploads",
        "findings",
        req.file.filename,
      );
      let databaseUpdated = false;

      try {
        const result = await prisma.finding.updateMany({
          where: {
            id: req.params.id,
            status: FindingStatus.DRAFT,
            photoPath: null,
          },
          data: { photoPath },
        });

        if (result.count !== 1) {
          await removeUploadedFile(req.file.path);
          return rejectInvalidStatus(res);
        }

        databaseUpdated = true;

        const finding = await prisma.finding.findUnique({
          where: { id: req.params.id },
          select: FINDING_SELECT,
        });

        if (!finding) {
          await removeUploadedFile(req.file.path);
          return rejectNotFound(res, "Finding");
        }

        return res.json({ finding });
      } catch (error) {
        if (!databaseUpdated) {
          try {
            await removeUploadedFile(req.file.path);
          } catch {
            // Preserve the original database error for centralized handling.
          }
        }

        return next(error);
      }
    },
  );

  router.post(
    "/:id/submit",
    ...inspectorFindingAccess,
    transitionFinding({
      prisma,
      fromStatus: FindingStatus.DRAFT,
      toStatus: FindingStatus.SUBMITTED,
    }),
  );

  router.post(
    "/:id/approve",
    ...reviewerFindingAccess,
    transitionFinding({
      prisma,
      fromStatus: FindingStatus.SUBMITTED,
      toStatus: FindingStatus.APPROVED,
    }),
  );

  router.post(
    "/:id/reject",
    ...reviewerFindingAccess,
    transitionFinding({
      prisma,
      fromStatus: FindingStatus.SUBMITTED,
      toStatus: FindingStatus.DRAFT,
    }),
  );

  router.post(
    "/:id/reopen",
    ...inspectorFindingAccess,
    transitionFinding({
      prisma,
      fromStatus: FindingStatus.REJECTED,
      toStatus: FindingStatus.DRAFT,
    }),
  );

  return router;
}

module.exports = {
  findingsRouter,
  inspectionFindingsRouter,
};
