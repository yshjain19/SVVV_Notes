const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    course: {
      type: String,
      enum: [
        "B.Tech CSE",
        "B.Tech IT",
        "B.Tech ECE",
        "B.Tech ME",
        "MBA",
        "BBA",
        "MCA",
        "BCA",
      ],
      required: true,
    },
    semester: {
      type: String,
      enum: [
        "I",
        "II",
        "III",
        "IV",
        "V",
        "VI",
        "VII",
        "VIII",
        "IX",
        "X",
      ],
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },

    // ── Moderation status ──────────────────────────────────────────────────────
    // "pending"  → newly uploaded, awaiting admin review — NOT publicly visible
    // "approved" → reviewed and approved by admin — publicly visible
    // "rejected" → reviewed and rejected by admin — NOT publicly visible
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    // ── Legacy field — kept for backward compatibility ─────────────────────────
    // This is now derived from status; do not use isVerified for access control.
    isVerified: {
      type: Boolean,
      default: false,
    },

    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

noteSchema.index({
  title: "text",
  description: "text",
  course: "text",
  semester: "text",
});

// Primary public visibility index — status + course + semester for browsing queries
noteSchema.index({ status: 1, course: 1, semester: 1 });
noteSchema.index({ status: 1, createdAt: -1 });
noteSchema.index({ uploadedBy: 1 });
noteSchema.index({ subject: 1 });

module.exports = mongoose.model("Note", noteSchema);
