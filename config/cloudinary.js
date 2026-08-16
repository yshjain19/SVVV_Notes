const path = require("path");
const fs = require("fs");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
}

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

const hasCloudinary = !!(
  (process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME) &&
  (process.env.CLOUDINARY_KEY || process.env.API_KEY) &&
  (process.env.CLOUDINARY_SECRET || process.env.API_SECRET)
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY || process.env.API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET || process.env.API_SECRET,
  secure: true,
});

let storage;

if (hasCloudinary) {
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "SVVV_Notes",
      resource_type: "auto",
    },
  });
} else {
  storage = multer.memoryStorage();
}

async function uploadToCloudinary(file) {
  // When using multer-storage-cloudinary, the file is already uploaded to Cloudinary
  // and the middleware attaches the response fields to the file object.
  return {
    secure_url: file.secure_url || file.path,
    public_id: file.public_id || file.filename,
    url: file.secure_url || file.path,
  };
}

const crypto = require("crypto");

async function saveFileLocally(file) {
  const allowedExts = [".pdf", ".png", ".jpg", ".jpeg"];
  const rawExt = path.extname(file.originalname || "").toLowerCase();
  const safeExt = allowedExts.includes(rawExt) ? rawExt : ".pdf";

  // Use crypto.randomUUID to guarantee a safe, unique filename immune to path traversal
  const filename = `${Date.now()}-${crypto.randomUUID()}${safeExt}`;
  const uploadDir = path.resolve(__dirname, "../public/uploads");
  const filePath = path.join(uploadDir, filename);

  // Boundary check: ensure the resolved file path cannot escape the upload directory
  if (!filePath.startsWith(uploadDir)) {
    throw new Error("Invalid file destination path.");
  }

  await fs.promises.mkdir(uploadDir, { recursive: true });
  await fs.promises.writeFile(filePath, file.buffer);
  return {
    url: `/uploads/${filename}`,
    filename,
  };
}

module.exports = { storage, cloudinary, hasCloudinary, uploadToCloudinary, saveFileLocally };

