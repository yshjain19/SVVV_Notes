const mongoose = require("mongoose");

const noteRequestSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please provide a title or topic name for your note request"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },
    subject: {
      type: String,
      required: [true, "Please specify the subject name"],
      trim: true,
      maxlength: [100, "Subject cannot exceed 100 characters"],
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
      required: [true, "Please select your course"],
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
      required: [true, "Please select the semester"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["Open", "Fulfilled", "Closed"],
      default: "Open",
    },
    fulfilledWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
    },
  },
  {
    timestamps: true,
  }
);

noteRequestSchema.index({
  title: "text",
  subject: "text",
  description: "text",
});

noteRequestSchema.index({ status: 1, createdAt: -1 });
noteRequestSchema.index({ course: 1, semester: 1 });
noteRequestSchema.index({ requestedBy: 1 });

module.exports = mongoose.model("NoteRequest", noteRequestSchema);
