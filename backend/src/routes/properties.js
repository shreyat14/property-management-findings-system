const { UserRole } = require("@prisma/client");
const { Router } = require("express");

const { authenticate } = require("../middleware/authenticate");
const { authorizeRoles } = require("../middleware/authorizeRoles");
const {
  authorizePropertyAccess,
} = require("../middleware/authorizeResourceAccess");

const ALLOWED_PROPERTY_FIELDS = new Set(["name", "address"]);
const PROPERTY_SELECT = {
  id: true,
  name: true,
  address: true,
  createdAt: true,
  updatedAt: true,
};

function rejectInvalidInput(res) {
  return res.status(400).json({
    error: {
      message: "Invalid property input",
    },
  });
}

function rejectNotFound(res) {
  return res.status(404).json({
    error: {
      message: "Property not found",
    },
  });
}

function rejectAssignmentInput(res) {
  return res.status(400).json({
    error: {
      message: "Invalid inspector assignment input",
    },
  });
}

function rejectUserNotFound(res) {
  return res.status(404).json({
    error: {
      message: "User not found",
    },
  });
}

function rejectNonInspector(res) {
  return res.status(400).json({
    error: {
      message: "User must have the INSPECTOR role",
    },
  });
}

function rejectDuplicateAssignment(res) {
  return res.status(409).json({
    error: {
      message: "Inspector is already assigned to this property",
    },
  });
}

function rejectAssignmentNotFound(res) {
  return res.status(404).json({
    error: {
      message: "Inspector assignment not found",
    },
  });
}

function parsePropertyInput(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const fields = Object.keys(body);

  if (
    fields.length === 0 ||
    fields.some((field) => !ALLOWED_PROPERTY_FIELDS.has(field)) ||
    (!partial &&
      [...ALLOWED_PROPERTY_FIELDS].some(
        (field) => !Object.hasOwn(body, field),
      ))
  ) {
    return null;
  }

  const data = {};

  for (const field of fields) {
    if (typeof body[field] !== "string" || body[field].trim().length === 0) {
      return null;
    }

    data[field] = body[field].trim();
  }

  return data;
}

function parseInspectorAssignmentInput(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !Object.hasOwn(body, "inspectorId") ||
    typeof body.inspectorId !== "string" ||
    body.inspectorId.trim().length === 0
  ) {
    return null;
  }

  return { inspectorId: body.inspectorId.trim() };
}

function propertyViewAuthorization({ prisma }) {
  const authorizeInspectorAccess = authorizePropertyAccess({
    prisma,
    resourceIdParam: "id",
  });

  return function authorizePropertyView(req, res, next) {
    if (req.auth.role === UserRole.ADMIN) {
      return next();
    }

    return authorizeInspectorAccess(req, res, next);
  };
}

function propertiesRouter({ prisma }) {
  const router = Router();

  router.use(authenticate);

  router.get(
    "/",
    authorizeRoles(UserRole.ADMIN, UserRole.INSPECTOR),
    async (req, res, next) => {
      try {
        const query = { select: PROPERTY_SELECT };

        if (req.auth.role === UserRole.INSPECTOR) {
          query.where = {
            inspectorAssignments: {
              some: { inspectorId: req.auth.userId },
            },
          };
        }

        const properties = await prisma.property.findMany(query);

        return res.json({ properties });
      } catch (error) {
        return next(error);
      }
    },
  );

  router.get(
    "/:id",
    authorizeRoles(UserRole.ADMIN, UserRole.INSPECTOR),
    propertyViewAuthorization({ prisma }),
    async (req, res, next) => {
      try {
        const property = await prisma.property.findUnique({
          where: { id: req.params.id },
          select: PROPERTY_SELECT,
        });

        if (!property) {
          return rejectNotFound(res);
        }

        return res.json({ property });
      } catch (error) {
        return next(error);
      }
    },
  );

  router.post(
    "/",
    authorizeRoles(UserRole.ADMIN),
    async (req, res, next) => {
      const data = parsePropertyInput(req.body);

      if (!data) {
        return rejectInvalidInput(res);
      }

      try {
        const property = await prisma.property.create({
          data,
          select: PROPERTY_SELECT,
        });

        return res.status(201).json({ property });
      } catch (error) {
        return next(error);
      }
    },
  );

  router.patch(
    "/:id",
    authorizeRoles(UserRole.ADMIN),
    async (req, res, next) => {
      const data = parsePropertyInput(req.body, { partial: true });

      if (!data) {
        return rejectInvalidInput(res);
      }

      try {
        const existingProperty = await prisma.property.findUnique({
          where: { id: req.params.id },
          select: { id: true },
        });

        if (!existingProperty) {
          return rejectNotFound(res);
        }

        const property = await prisma.property.update({
          where: { id: req.params.id },
          data,
          select: PROPERTY_SELECT,
        });

        return res.json({ property });
      } catch (error) {
        return next(error);
      }
    },
  );

  router.get(
    "/:id/inspectors",
    authorizeRoles(UserRole.ADMIN),
    async (req, res, next) => {
      try {
        const property = await prisma.property.findUnique({
          where: { id: req.params.id },
          select: { id: true },
        });

        if (!property) {
          return rejectNotFound(res);
        }

        const assignments = await prisma.propertyInspector.findMany({
          where: { propertyId: property.id },
          orderBy: { assignedAt: "asc" },
          select: {
            assignedAt: true,
            inspector: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        });
        const inspectors = assignments.map(({ assignedAt, inspector }) => ({
          ...inspector,
          assignedAt,
        }));

        return res.json({ inspectors });
      } catch (error) {
        return next(error);
      }
    },
  );

  router.post(
    "/:id/inspectors",
    authorizeRoles(UserRole.ADMIN),
    async (req, res, next) => {
      const data = parseInspectorAssignmentInput(req.body);

      if (!data) {
        return rejectAssignmentInput(res);
      }

      try {
        const property = await prisma.property.findUnique({
          where: { id: req.params.id },
          select: { id: true },
        });

        if (!property) {
          return rejectNotFound(res);
        }

        const inspector = await prisma.user.findUnique({
          where: { id: data.inspectorId },
          select: { id: true, role: true },
        });

        if (!inspector) {
          return rejectUserNotFound(res);
        }

        if (inspector.role !== UserRole.INSPECTOR) {
          return rejectNonInspector(res);
        }

        const assignmentKey = {
          propertyId: property.id,
          inspectorId: inspector.id,
        };
        const existingAssignment = await prisma.propertyInspector.findUnique({
          where: { propertyId_inspectorId: assignmentKey },
          select: { propertyId: true },
        });

        if (existingAssignment) {
          return rejectDuplicateAssignment(res);
        }

        const assignment = await prisma.propertyInspector.create({
          data: assignmentKey,
          select: {
            propertyId: true,
            inspectorId: true,
            assignedAt: true,
          },
        });

        return res.status(201).json({ assignment });
      } catch (error) {
        if (error && error.code === "P2002") {
          return rejectDuplicateAssignment(res);
        }

        return next(error);
      }
    },
  );

  router.delete(
    "/:id/inspectors/:inspectorId",
    authorizeRoles(UserRole.ADMIN),
    async (req, res, next) => {
      try {
        const property = await prisma.property.findUnique({
          where: { id: req.params.id },
          select: { id: true },
        });

        if (!property) {
          return rejectNotFound(res);
        }

        const assignmentKey = {
          propertyId: property.id,
          inspectorId: req.params.inspectorId,
        };
        const assignment = await prisma.propertyInspector.findUnique({
          where: { propertyId_inspectorId: assignmentKey },
          select: { propertyId: true },
        });

        if (!assignment) {
          return rejectAssignmentNotFound(res);
        }

        await prisma.propertyInspector.delete({
          where: { propertyId_inspectorId: assignmentKey },
        });

        return res.status(204).end();
      } catch (error) {
        if (error && error.code === "P2025") {
          return rejectAssignmentNotFound(res);
        }

        return next(error);
      }
    },
  );

  return router;
}

module.exports = { propertiesRouter };
