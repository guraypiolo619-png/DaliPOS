import multer from "multer";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const singleImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error("Choose a JPEG, PNG, or WebP product image.");
      error.status = 400;
      return callback(error);
    }

    callback(null, true);
  },
}).single("image");

const multipleImages = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 20,
    fields: 1,
    fieldSize: 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error("Choose JPEG, PNG, or WebP product images.");
      error.status = 400;
      return callback(error);
    }

    callback(null, true);
  },
}).any();

export const uploadProductImage = (req, res, next) => {
  singleImage(req, res, (error) => {
    if (error && !error.status) {
      error.status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    }
    next(error);
  });
};

export const uploadProductImages = (req, res, next) => {
  multipleImages(req, res, (error) => {
    if (error && !error.status) {
      error.status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    }
    next(error);
  });
};
