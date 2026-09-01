const multer = require("multer");

const {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_SIZE,
  normalizePhotoUploadError,
} = require("./uploadFindingPhoto");

const ALLOWED_PHOTO_MIME_TYPE_SET = new Set(ALLOWED_PHOTO_MIME_TYPES);

function createAiPhotoUpload() {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fieldNameSize: 100,
      fields: 1,
      // Match the existing Finding photo contract: exactly 5 MB is valid.
      fileSize: MAX_PHOTO_SIZE + 1,
      files: 1,
      parts: 3,
    },
    fileFilter: (_req, file, callback) => {
      if (!ALLOWED_PHOTO_MIME_TYPE_SET.has(file.mimetype)) {
        const error = new Error("Unsupported photo type");
        error.statusCode = 415;
        callback(error);
        return;
      }

      callback(null, true);
    },
  }).single("photo");

  return function uploadAiPhoto(req, res, next) {
    upload(req, res, (error) => {
      if (!error) {
        return next();
      }

      return next(normalizePhotoUploadError(error));
    });
  };
}

module.exports = { createAiPhotoUpload };
