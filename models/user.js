const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

// Keeps profile information separate from password hashing, which is provided
// safely by the Passport plugin below.
const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
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
    branch: { type: String, default: "C.S.E" },
    course: { type: String, default: "Computer Science" },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    semester: { type: Number, min: 1, max: 8 },
    isAdmin: { type: Boolean, default: false },
    // OTP & Email Verification
    otp: {
      code: String,
      expiresAt: Date,
    },
    isEmailVerified: { type: Boolean, default: false },
    hasReceivedWelcomeEmail: { type: Boolean, default: false },
    // Password Reset
    passwordResetToken: String,
    passwordResetExpiresAt: Date,
  },
  { timestamps: true },
);
// Adds email as usernameField, salted password hash, and Passport authentication helpers.
// Supports sign-in with email (and fallback to username).
userSchema.plugin(passportLocalMongoose, {
  usernameField: "email",
  usernameLowerCase: true,
  findByUsername: function (model, queryParameters) {
    const input = queryParameters.email || queryParameters.username;
    if (!input) return model.findOne(queryParameters);
    const cleanInput = String(input).trim();
    return model.findOne({
      $or: [
        { email: cleanInput.toLowerCase() },
        { username: cleanInput },
      ],
    });
  },
});
module.exports = mongoose.model("User", userSchema);
