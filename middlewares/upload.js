import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

// Cloudinary configuration applied
cloudinary.config({
  cloud_name: process.env.CLD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true,
});

// Storage configuration with random UUIDs for public_id
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "users_ecommerce",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    resource_type: "image",
    public_id: (req, file) => `avatar_${crypto.randomUUID()}`,
  },
});

const buildFileFilter = ({ allowedMimeTypes, allowedExtensions, message }) => {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = `${file.mimetype || ""}`.toLowerCase();
    const isAllowedMime = allowedMimeTypes.includes(mime);
    const isAllowedExt = allowedExtensions.includes(ext);

    if (!isAllowedMime && !isAllowedExt) {
      const error = new Error(message);
      error.status = 400;
      return cb(error, false);
    }

    cb(null, true);
  };
};

const defaultFileFilter = buildFileFilter({
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  message: "Invalid file type. Only JPEG, PNG, and WEBP images are allowed.",
});

const settingsAssetFileFilter = buildFileFilter({
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
    "image/x-icon",
    "image/vnd.microsoft.icon",
  ],
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".svg", ".ico"],
  message: "Invalid file type. Allowed formats: JPG, PNG, WEBP, SVG, and ICO.",
});

// Multer configuration
const upload = multer({
  storage: storage,
  fileFilter: defaultFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
});

export default upload;

// ── Logo-specific uploader for Site Settings ──────────────────
const logoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "settings_logos",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "svg", "ico"],
    resource_type: "image",
    public_id: (req, file) => `logo_${crypto.randomUUID()}`,
    transformation: [{ width: 800, crop: "limit" }],
  },
});

export const logoUpload = multer({
  storage: logoStorage,
  fileFilter: settingsAssetFileFilter,
  limits: { fileSize: 1024 * 1024 }, // 1 MB max for settings brand assets
});
