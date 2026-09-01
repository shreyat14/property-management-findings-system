const cors = require("cors");
const express = require("express");
const helmet = require("helmet");

const { checkDatabaseConnection, prisma: databaseClient } = require("./db");
const { apiRouter } = require("./routes");

function createApp({
  aiService,
  checkDatabase = checkDatabaseConnection,
  prisma = databaseClient,
  findingPhotoUploadDirectory,
  logger = console,
} = {}) {
  const app = express();
  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

  app.use(helmet());
  app.use(cors({ origin: clientOrigin }));
  app.use(express.json());

  app.use(
    "/api/v1",
    apiRouter({
      aiService,
      checkDatabase,
      prisma,
      findingPhotoUploadDirectory,
    }),
  );

  app.use((req, _res, next) => {
    const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
  });

  app.use((err, req, res, _next) => {
    const statusCode = err.statusCode || 500;

    if (statusCode >= 500) {
      logger.error(
        `Request failed: ${req.method} ${req.originalUrl}`,
        err,
      );
    }

    res.status(statusCode).json({
      error: {
        message: statusCode === 500 ? "Internal server error" : err.message,
      },
    });
  });

  return app;
}

module.exports = { createApp };
