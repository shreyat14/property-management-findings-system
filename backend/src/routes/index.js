const { Router } = require("express");

const { aiRouter } = require("./ai");
const { authRouter } = require("./auth");
const {
  findingsRouter,
  inspectionFindingsRouter,
} = require("./findings");
const { healthRouter } = require("./health");
const { inspectionsRouter } = require("./inspections");
const { propertiesRouter } = require("./properties");
const { usersRouter } = require("./users");

function apiRouter({
  aiService,
  checkDatabase,
  prisma,
  findingPhotoUploadDirectory,
}) {
  const router = Router();

  router.use("/ai", aiRouter({ aiService }));
  router.use("/auth", authRouter({ prisma }));
  router.use("/health", healthRouter({ checkDatabase }));
  router.use(
    "/inspections/:id/findings",
    inspectionFindingsRouter({ prisma }),
  );
  router.use("/inspections", inspectionsRouter({ prisma }));
  router.use(
    "/findings",
    findingsRouter({ prisma, uploadDirectory: findingPhotoUploadDirectory }),
  );
  router.use("/properties", propertiesRouter({ prisma }));
  router.use("/users", usersRouter({ prisma }));

  return router;
}

module.exports = { apiRouter };
