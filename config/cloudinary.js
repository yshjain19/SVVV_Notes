const path = require("path");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
}

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY || process.env.API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET || process.env.API_SECRET,
  secure: true,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: process.env.CLOUDINARY_FOLDER || "SVVV_Notes",
    resource_type: "auto",
    allowed_formats: ["pdf", "png", "jpg", "jpeg"],
  },
});

module.exports = { cloudinary, storage };

