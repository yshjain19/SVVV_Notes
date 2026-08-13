const User = require("../models/user");
const Note = require("../models/note");
const { sendWelcomeEmail, sendOTPEmail, sendPasswordResetEmail } = require("../config/mail");
const crypto = require("crypto");

// Authentication views are deliberately kept thin; business logic is below.
exports.renderRegister = (req, res) =>
  res.render("users/register", {
    pageTitle: "Create Account | SVVV_Notes",
    metaDescription: "Join SVVV_Notes - the student community for SVVV CSE notes sharing, previous year questions, and semester resources.",
  });
exports.register = async (req, res, next) => {
  const { username, fullName, email, password, course, semester, gender } = req.body;
  const user = new User({ username, fullName, email, course, semester, gender });

  if (gender === "Male") {
    user.avatar = { url: "/images/avatar-male.svg" };
  } else if (gender === "Female") {
    user.avatar = { url: "/images/avatar-female.svg" };
  }

  try {
    // Passport Local Mongoose hashes the password before it is stored.
    await User.register(user, password);
    await new Promise((resolve, reject) => {
      req.login(user, (err) => (err ? reject(err) : resolve()));
    });

    req.flash("success", `Welcome to SVVV_Notes, ${user.username}!`);
    
    // Send welcome email in background
    sendWelcomeEmail(user.email, user.fullName || user.username).catch(err => {
      console.error("Failed to send welcome email in register background:", err);
    });

    res.redirect("/notes");
  } catch (error) {
    if (error.code === 11000 || (error.name === "MongoServerError" && error.message.includes("E11000"))) {
      const field = Object.keys(error.keyValue || {})[0];
      req.flash("error", `A user with that ${field || "email"} already registered.`);
      return res.redirect("/register");
    }
    if (error.name === "UserExistsError" || error.name === "ValidationError") {
      req.flash("error", error.message);
      return res.redirect("/register");
    }
    next(error);
  }
};
exports.renderLogin = (req, res) =>
  res.render("users/login", {
    pageTitle: "Sign In | SVVV_Notes",
    metaDescription: "Sign in to your SVVV_Notes account to upload notes, rate study materials, and access campus academic resources.",
  });
exports.login = (req, res) => {
  req.flash("success", `Welcome back, ${req.user.username}.`);
  // Continue the action that originally prompted the visitor to sign in.
  res.redirect(req.session.returnTo || "/notes");
  delete req.session.returnTo;
};
exports.logout = async (req, res, next) => {
  try {
    await new Promise((resolve, reject) => {
      req.logout((err) => (err ? reject(err) : resolve()));
    });

    req.flash("success", "You have been signed out. See you soon.");
    res.redirect("/");
  } catch (error) {
    next(error);
  }
};
exports.profile = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user)
    return res
      .status(404)
      .render("error", {
        pageTitle: "User Not Found | SVVV_Notes",
        status: 404,
        message: "This student profile could not be found.",
      });
  // Profile contributions newest-first gives the user a useful public timeline.
  const notes = await Note.find({ uploadedBy: user._id })
    .populate("uploadedBy")
    .populate("subject")
    .sort({ createdAt: -1 });
  res.render("users/profile", {
    pageTitle: `${user.fullName || user.username} (@${user.username}) | SVVV_Notes`,
    metaDescription: `View study notes and academic contributions shared by ${user.fullName || user.username} on SVVV_Notes.`,
    user,
    notes,
  });
};

exports.renderEditForm = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    req.flash("error", "Student profile could not be found.");
    return res.redirect("/notes");
  }
  res.render("users/edit", {
    pageTitle: "Edit Profile | SVVV_Notes",
    metaDescription: "Update your SVVV student profile information on SVVV_Notes.",
    user,
  });
};

exports.updateProfile = async (req, res, next) => {
  const { id } = req.params;
  const { user: userData } = req.body;
  try {
    const existingUser = await User.findById(id);
    if (existingUser && userData.gender && userData.gender !== existingUser.gender) {
      const isDefaultAvatar = !existingUser.avatar?.url || 
        existingUser.avatar.url.includes("avatar-male.svg") || 
        existingUser.avatar.url.includes("avatar-female.svg") || 
        existingUser.avatar.url.includes("api.dicebear.com");

      if (isDefaultAvatar) {
        if (userData.gender === "Male") {
          userData.avatar = { url: "/images/avatar-male.svg" };
        } else if (userData.gender === "Female") {
          userData.avatar = { url: "/images/avatar-female.svg" };
        }
      }
    }

    const user = await User.findByIdAndUpdate(id, { ...userData }, { new: true, runValidators: true });
    if (!user) {
      req.flash("error", "Student profile could not be updated.");
      return res.redirect("/notes");
    }
    req.flash("success", "Profile updated successfully.");
    res.redirect(`/users/${user._id}`);
  } catch (error) {
    if (error.code === 11000 || (error.name === "MongoServerError" && error.message.includes("E11000"))) {
      const field = Object.keys(error.keyValue || {})[0];
      req.flash("error", `A user with that ${field || "email"} already exists.`);
      return res.redirect(`/users/${id}/edit`);
    }
    if (error.name === "ValidationError") {
      req.flash("error", error.message);
      return res.redirect(`/users/${id}/edit`);
    }
    next(error);
  }
};

// ============ OTP & EMAIL VERIFICATION ============

/**
 * Generate and send OTP to user's email
 */
exports.sendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      req.flash("error", "Email is required.");
      return res.redirect("/login");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      req.flash("error", "No account found with this email.");
      return res.redirect("/login");
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
    };

    await user.save();

    // Send OTP via email
    await sendOTPEmail(user.email, user.fullName || user.username, otp);

    req.flash("success", `OTP sent to ${user.email}. It will expire in 10 minutes.`);
    res.redirect(`/verify-otp?email=${encodeURIComponent(user.email)}`);
  } catch (error) {
    console.error("Error sending OTP:", error);
    next(error);
  }
};

/**
 * Verify OTP and mark email as verified
 */
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      req.flash("error", "Email and OTP are required.");
      return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/login");
    }

    // Check if OTP exists and is not expired
    if (!user.otp || !user.otp.code) {
      req.flash("error", "No OTP found. Request a new one.");
      return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
    }

    if (new Date() > user.otp.expiresAt) {
      req.flash("error", "OTP has expired. Request a new one.");
      return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
    }

    // Verify OTP
    if (user.otp.code !== otp) {
      req.flash("error", "Invalid OTP. Please try again.");
      return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
    }

    // Mark email as verified and clear OTP
    user.isEmailVerified = true;
    user.otp = { code: null, expiresAt: null };
    await user.save();

    req.flash("success", "Email verified successfully!");
    res.redirect("/notes");
  } catch (error) {
    console.error("Error verifying OTP:", error);
    next(error);
  }
};

// ============ PASSWORD RESET ============

/**
 * Render forgot password form
 */
exports.renderForgotPassword = (req, res) => {
  res.render("users/forgot-password", {
    pageTitle: "Forgot Password | SVVV_Notes",
    metaDescription: "Reset your SVVV_Notes account password to regain access to study notes and resources.",
  });
};

/**
 * Send password reset email
 */
exports.sendPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      req.flash("error", "Email is required.");
      return res.redirect("/forgot-password");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // For security: don't reveal if email exists
      req.flash("success", `If an account exists with ${email}, you will receive password reset instructions.`);
      return res.redirect("/login");
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpiresAt = resetExpiry;
    await user.save();

    // Send reset email
    const emailSent = await sendPasswordResetEmail(user.email, user.fullName || user.username, resetToken);

    if (emailSent) {
      req.flash("success", `Password reset instructions sent to ${user.email}`);
    } else {
      console.warn(`Password reset email failed to deliver to ${user.email}. Check mail credentials in Render Environment variables.`);
      req.flash("error", "Unable to send password reset email at this moment. Please verify email credentials or contact support.");
      return res.redirect("/forgot-password");
    }

    res.redirect("/login");
  } catch (error) {
    console.error("Error sending password reset:", error);
    next(error);
  }
};

/**
 * Render password reset form
 */
exports.renderResetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;

    // Hash the token to compare with stored hash
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      req.flash("error", "Password reset link is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    res.render("users/reset-password", {
      pageTitle: "Reset Password | SVVV_Notes",
      metaDescription: "Enter a new secure password for your SVVV_Notes account.",
      token,
    });
  } catch (error) {
    console.error("Error rendering reset password:", error);
    next(error);
  }
};

/**
 * Reset user password
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      req.flash("error", "Please fill in all fields.");
      return res.redirect(`/reset-password/${token}`);
    }

    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match.");
      return res.redirect(`/reset-password/${token}`);
    }

    if (password.length < 6) {
      req.flash("error", "Password must be at least 6 characters.");
      return res.redirect(`/reset-password/${token}`);
    }

    // Hash the token to compare with stored hash
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      req.flash("error", "Password reset link is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    // Use setPassword (provided by Passport Local Mongoose - returns a Promise)
    await user.setPassword(password);
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    req.flash("success", "Password reset successfully! Please login with your new password.");
    res.redirect("/login");
  } catch (error) {
    console.error("Error resetting password:", error);
    next(error);
  }
};

