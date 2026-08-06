const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

// Keeps profile information separate from password hashing, which is provided
// safely by the Passport plugin below.
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    avatar: {
      url: {
        type: String,
        default: "https://api.dicebear.com/9.x/initials/svg?seed=Student",
      },
      filename: String,
    },
    branch: { type: String, default: "Computer Science" },
    course: { type: String, default: "Computer Science" },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    semester: { type: Number, min: 1, max: 8 },
    isAdmin: { type: Boolean, default: false },
  },
  { timestamps: true },
);
// Adds username, salted password hash, and Passport authentication helpers.
userSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("User", userSchema);
