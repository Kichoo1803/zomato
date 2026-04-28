import crypto from "node:crypto";
import path from "node:path";
import multer from "multer";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../../utils/app-error.js";
import { ensureUploadSubdirectory } from "../../lib/uploads.js";

const uploadsDirectory = ensureUploadSubdirectory("registration-applications");
const allowedDocumentMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const imageOnlyFields = new Set(["restaurantImages", "profilePhoto"]);
const documentOnlyFields = new Set([
  "fssaiCertificate",
  "idProof",
  "drivingLicense",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDirectory);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase() || ".bin";
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, callback) => {
  if (!allowedDocumentMimeTypes.has(file.mimetype)) {
    callback(
      new AppError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        "Only PDF, JPG, PNG, and WEBP files are allowed",
        "INVALID_UPLOAD_TYPE",
      ),
    );
    return;
  }

  if (imageOnlyFields.has(file.fieldname) && !file.mimetype.startsWith("image/")) {
    callback(
      new AppError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        "This upload field only accepts image files",
        "INVALID_UPLOAD_TYPE",
      ),
    );
    return;
  }

  if (documentOnlyFields.has(file.fieldname) && !allowedDocumentMimeTypes.has(file.mimetype)) {
    callback(
      new AppError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        "This upload field only accepts PDF or image files",
        "INVALID_UPLOAD_TYPE",
      ),
    );
    return;
  }

  callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 8,
  },
});

export const registrationApplicationUploadFields = upload.fields([
  { name: "fssaiCertificate", maxCount: 1 },
  { name: "idProof", maxCount: 1 },
  { name: "restaurantImages", maxCount: 4 },
  { name: "drivingLicense", maxCount: 1 },
  { name: "profilePhoto", maxCount: 1 },
]);
