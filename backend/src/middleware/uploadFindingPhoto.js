const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const multer = require("multer");

const DEFAULT_FINDING_UPLOAD_DIRECTORY = path.resolve(
  __dirname,
  "../../uploads/findings",
);
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const MIME_EXTENSIONS = Object.freeze({
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
});
const ALLOWED_PHOTO_MIME_TYPES = Object.freeze(Object.keys(MIME_EXTENSIONS));

function normalizePhotoUploadError(error) {
  if (error instanceof multer.MulterError) {
    error.statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    error.message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Photo exceeds the 5 MB limit"
        : "Invalid photo upload";
  }

  return error;
}

function createFindingPhotoUpload({
  uploadDirectory = DEFAULT_FINDING_UPLOAD_DIRECTORY,
} = {}) {
  const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdir(uploadDirectory, { recursive: true }).then(
        () => callback(null, uploadDirectory),
        (error) => callback(error),
      );
    },
    filename: (_req, file, callback) => {
      const extension = MIME_EXTENSIONS[file.mimetype];
      callback(null, `${randomUUID()}${extension}`);
    },
  });
  const upload = multer({
    storage,
    limits: {
      fieldNameSize: 100,
      fields: 0,
      // Busboy emits its limit event when size equals the configured value.
      // One extra byte preserves the API contract that exactly 5 MB is valid.
      fileSize: MAX_PHOTO_SIZE + 1,
      files: 1,
      parts: 2,
    },
    fileFilter: (_req, file, callback) => {
      if (!Object.hasOwn(MIME_EXTENSIONS, file.mimetype)) {
        const error = new Error("Unsupported photo type");
        error.statusCode = 415;
        callback(error);
        return;
      }

      callback(null, true);
    },
  }).single("photo");

  return function uploadFindingPhoto(req, res, next) {
    upload(req, res, (error) => {
      if (!error) {
        return next();
      }

      return next(normalizePhotoUploadError(error));
    });
  };
}

module.exports = {
  ALLOWED_PHOTO_MIME_TYPES,
  createFindingPhotoUpload,
  DEFAULT_FINDING_UPLOAD_DIRECTORY,
  MAX_PHOTO_SIZE,
  normalizePhotoUploadError,
};
