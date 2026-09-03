const mongoose = require("mongoose");

const downloadLogSchema = new mongoose.Schema(
  {
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    downloadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

downloadLogSchema.index({ createdAt: 1 });
downloadLogSchema.index({ note: 1, createdAt: 1 });

module.exports = mongoose.model("DownloadLog", downloadLogSchema);
