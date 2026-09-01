const { InspectionStatus, UserRole } = require("@prisma/client");
const { Router } = require("express");

const { authenticate } = require("../middleware/authenticate");
const { authorizeRoles } = require("../middleware/authorizeRoles");
const {
  authorizeInspectionAccess,
} = require("../middleware/authorizeResourceAccess");

const INSPECTION_SELECT = {
  id: true,
  propertyId: true,
  inspectorId: true,
  status: true,
  completedAt: true,
  inspectedAt: true,
  createdAt: true,
  updatedAt: true,
};

function rejectInvalidInput(res) {
  return res.status(400).json({
    error: {
      message: "Invalid inspection input",
    },
  });
}

function rejectNotFound(res) {
  return res.status(404).json({
    error: {
      message: "Inspection not found",
    },
  });
}

function rejectPropertyNotFound(res) {
  return res.status(404).json({
    error: {
      message: "Property not found",
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

function rejectAlreadyCompleted(res) {
  return res.status(409).json({
    error: {
      message: "Inspection is already completed",
    },
  });
}

function parseCreateInput(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !Object.hasOwn(body, "propertyId") ||
    typeof body.propertyId !== "string" ||
    body.propertyId.trim().length === 0
  ) {
    return null;
  }

  return { propertyId: body.propertyId.trim() };
}

function hasCompletionInput(body) {
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
        return rejectNotFound(res);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function inspectionsRouter({ prisma }) {
  const router = Router();
  const requireExistingInspection = requireInspectionExists({ prisma });
  const authorizeInspection = authorizeInspectionAccess({
    prisma,
    resourceIdParam: "id",
  });

  router.use(authenticate);

  router.get(
    "/",
    authorizeRoles(UserRole.INSPECTOR),
    async (req, res, next) => {
      try {
        const inspectorId = req.auth.userId;
        const inspections = await prisma.inspection.findMany({
          where: {
            inspectorId,
            property: {
              inspectorAssignments: {
                some: { inspectorId },
              },
            },
          },
          select: INSPECTION_SELECT,
        });

        return res.json({ inspections });
      } catch (error) {
        return next(error);
      }
    },
  );

  router.get(
    "/:id",
    authorizeRoles(UserRole.INSPECTOR),
    requireExistingInspection,
    authorizeInspection,
    async (req, res, next) => {
      try {
        const inspection = await prisma.inspection.findUnique({
          where: { id: req.params.id },
          select: INSPECTION_SELECT,
        });

        if (!inspection) {
          return rejectNotFound(res);
        }

        return res.json({ inspection });
      } catch (error) {
        return next(error);
      }
    },
  );

  router.post(
    "/",
    authorizeRoles(UserRole.INSPECTOR),
    async (req, res, next) => {
      const data = parseCreateInput(req.body);

      if (!data) {
        return rejectInvalidInput(res);
      }

      try {
        const property = await prisma.property.findUnique({
          where: { id: data.propertyId },
          select: { id: true },
        });

        if (!property) {
          return rejectPropertyNotFound(res);
        }

        const inspectorId = req.auth.userId;
        const assignment = await prisma.propertyInspector.findUnique({
          where: {
            propertyId_inspectorId: {
              propertyId: property.id,
              inspectorId,
            },
          },
          select: { propertyId: true },
        });

        if (!assignment) {
          return rejectForbidden(res);
        }

        const inspection = await prisma.inspection.create({
          data: {
            propertyId: property.id,
            inspectorId,
            status: InspectionStatus.IN_PROGRESS,
            completedAt: null,
          },
          select: INSPECTION_SELECT,
        });

        return res.status(201).json({ inspection });
      } catch (error) {
        return next(error);
      }
    },
  );

  router.post(
    "/:id/complete",
    authorizeRoles(UserRole.INSPECTOR),
    requireExistingInspection,
    authorizeInspection,
    async (req, res, next) => {
      if (hasCompletionInput(req.body)) {
        return rejectInvalidInput(res);
      }

      try {
        const currentInspection = await prisma.inspection.findUnique({
          where: { id: req.params.id },
          select: { id: true, status: true },
        });

        if (!currentInspection) {
          return rejectNotFound(res);
        }

        if (currentInspection.status === InspectionStatus.COMPLETED) {
          return rejectAlreadyCompleted(res);
        }

        const completedAt = new Date();
        const result = await prisma.inspection.updateMany({
          where: {
            id: currentInspection.id,
            status: InspectionStatus.IN_PROGRESS,
          },
          data: {
            status: InspectionStatus.COMPLETED,
            completedAt,
          },
        });

        if (result.count !== 1) {
          return rejectAlreadyCompleted(res);
        }

        const inspection = await prisma.inspection.findUnique({
          where: { id: currentInspection.id },
          select: INSPECTION_SELECT,
        });

        if (!inspection) {
          return rejectNotFound(res);
        }

        return res.json({ inspection });
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}

module.exports = { inspectionsRouter };
