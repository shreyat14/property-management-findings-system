const { Router } = require("express");

function healthRouter({ checkDatabase }) {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      await checkDatabase();

      res.json({
        status: "ok",
        api: "running",
        database: "connected",
      });
    } catch (error) {
      error.statusCode = 503;
      error.message = "API is running, but the database is unavailable";
      next(error);
    }
  });

  return router;
}

module.exports = { healthRouter };
