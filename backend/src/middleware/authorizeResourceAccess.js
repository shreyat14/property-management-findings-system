function rejectResourceAccess(res) {
  return res.status(403).json({
    error: {
      message: "Forbidden",
    },
  });
}

function createResourceAuthorizer({ resourceIdParam, findAccessibleResource }) {
  return async function authorizeResourceAccess(req, res, next) {
    const inspectorId = req.auth && req.auth.userId;
    const resourceId = req.params[resourceIdParam];

    if (!inspectorId || !resourceId) {
      return rejectResourceAccess(res);
    }

    try {
      const resource = await findAccessibleResource({ inspectorId, resourceId });

      if (!resource) {
        return rejectResourceAccess(res);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function authorizePropertyAccess({ prisma, resourceIdParam = "propertyId" }) {
  return createResourceAuthorizer({
    resourceIdParam,
    findAccessibleResource: ({ inspectorId, resourceId: propertyId }) =>
      prisma.propertyInspector.findUnique({
        where: {
          propertyId_inspectorId: {
            propertyId,
            inspectorId,
          },
        },
        select: { propertyId: true },
      }),
  });
}

function authorizeInspectionAccess({ prisma, resourceIdParam = "inspectionId" }) {
  return createResourceAuthorizer({
    resourceIdParam,
    findAccessibleResource: ({ inspectorId, resourceId: inspectionId }) =>
      prisma.inspection.findFirst({
        where: {
          id: inspectionId,
          inspectorId,
          property: {
            inspectorAssignments: {
              some: { inspectorId },
            },
          },
        },
        select: { id: true },
      }),
  });
}

function authorizeFindingAccess({ prisma, resourceIdParam = "findingId" }) {
  return createResourceAuthorizer({
    resourceIdParam,
    findAccessibleResource: ({ inspectorId, resourceId: findingId }) =>
      prisma.finding.findFirst({
        where: {
          id: findingId,
          inspection: {
            inspectorId,
            property: {
              inspectorAssignments: {
                some: { inspectorId },
              },
            },
          },
        },
        select: { id: true },
      }),
  });
}

module.exports = {
  authorizeFindingAccess,
  authorizeInspectionAccess,
  authorizePropertyAccess,
};
