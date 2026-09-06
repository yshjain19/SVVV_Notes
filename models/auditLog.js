const mongoose = require("mongoose");

/**
 * AuditLog — records every admin moderation action for accountability.
 *
 * Actions:
 *  ADMIN_APPROVED_NOTE   — Admin approved a pending note
 *  ADMIN_REJECTED_NOTE   — Admin rejected a pending/approved note
 *  ADMIN_DELETED_NOTE    — Admin permanently deleted a note
 *  ADMIN_DELETED_USER    — Admin deleted a user account
 *  ADMIN_TOGGLED_ADMIN   — Admin changed another user's admin role
 */
const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    noteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    action: {
      type: String,
      enum: [
        "ADMIN_APPROVED_NOTE",
        "ADMIN_REJECTED_NOTE",
        "ADMIN_DELETED_NOTE",
        "ADMIN_DELETED_USER",
        "ADMIN_TOGGLED_ADMIN",
      ],
      required: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    noteTitle: {
      type: String,
      trim: true,
      default: null,
    },
    targetUsername: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for efficient admin activity queries
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ noteId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
