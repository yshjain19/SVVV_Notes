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
  const user = new User({
    username,
    fullName,
    email: (email || "").toLowerCase().trim(),
    course,
    semester,
    gender,
    isEmailVerified: false,
  });

  if (gender === "Male") {
    user.avatar = { url: "/images/avatar-male.svg" };
  } else if (gender === "Female") {
    user.avatar = { url: "/images/avatar-female.svg" };
  }

  try {
    // Generate 6-digit OTP code valid for 10 minutes
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
    };

    // Passport Local Mongoose hashes the password before storing
    await User.register(user, password);

    // Send OTP verification email in background
    console.log(`\n🔑 [OTP CODE for ${user.email}]: ${otp}\n`);
    sendOTPEmail(user.email, user.fullName || user.username, otp).catch((err) => {
      console.error("Failed to send OTP verification email on register:", err);
    });

    req.flash(
      "success",
      `Account created! A 6-digit verification code has been sent to ${user.email}. Please verify your email to continue.`,
    );
    res.redirect(`/verify-otp?email=${encodeURIComponent(user.email)}`);
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
exports.login = async (req, res, next) => {
  // Check if email is verified (allow admin to bypass if needed)
  if (!req.user.isEmailVerified && !req.user.isAdmin && req.user.username !== "admin") {
    const user = req.user;
    const email = user.email;

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.otp = { code: otp, expiresAt: otpExpiry };
    await user.save();

    // Send OTP email
    console.log(`\n🔑 [OTP CODE for ${user.email}]: ${otp}\n`);
    sendOTPEmail(user.email, user.fullName || user.username, otp).catch((err) => {
      console.error("Failed to send OTP email on unverified login attempt:", err);
    });

    // Log the unverified user out of session
    await new Promise((resolve) => req.logout(() => resolve()));

    req.flash(
      "error",
      "Please verify your email before logging in. A new verification code has been sent to your email.",
    );
    return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
  }

  req.flash("success", `Welcome back, ${req.user.username}!`);
  // Continue to notes / dashboard
  const redirectUrl = req.session.returnTo || "/notes";
  delete req.session.returnTo;
  res.redirect(redirectUrl);
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
    const rawEmail = req.body.email || req.query.email || "";
    const email = rawEmail.trim().toLowerCase();

    if (!email) {
      req.flash("error", "Please provide a valid email address.");
      return res.redirect("/verify-otp");
    }

    const user = await User.findOne({ email });
    if (!user) {
      req.flash("error", "No account found with this email. Please register.");
      return res.redirect("/register");
    }

    if (user.isEmailVerified) {
      req.flash("info", "Your email is already verified. Please sign in.");
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
    console.log(`\n🔑 [OTP CODE for ${user.email}]: ${otp}\n`);
    await sendOTPEmail(user.email, user.fullName || user.username, otp);

    req.flash("success", `A new OTP has been sent to ${user.email}. It will expire in 10 minutes.`);
    res.redirect(`/verify-otp?email=${encodeURIComponent(user.email)}`);
  } catch (error) {
    console.error("Error sending OTP:", error);
    next(error);
  }
};

/**
 * Verify OTP and mark email as verified -> Redirect to login
 */
exports.verifyOTP = async (req, res, next) => {
  try {
    const rawEmail = req.body.email || req.query.email || "";
    const email = rawEmail.trim().toLowerCase();
    const otp = (req.body.otp || "").trim();

    if (!email || !otp) {
      req.flash("error", "Email and OTP code are required.");
      return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
    }

    const user = await User.findOne({ email });
    if (!user) {
      req.flash("error", "User account not found. Please register.");
      return res.redirect("/register");
    }

    if (user.isEmailVerified) {
      req.flash("info", "Email is already verified. Please log in.");
      return res.redirect("/login");
    }

    // Check if OTP exists and is not expired
    if (!user.otp || !user.otp.code) {
      req.flash("error", "No verification code found. Please request a new one.");
      return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
    }

    if (new Date() > new Date(user.otp.expiresAt)) {
      req.flash("error", "The verification code has expired. Please request a new one.");
      return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
    }

    // Verify OTP code
    if (user.otp.code !== otp) {
      req.flash("error", "Invalid verification code. Please check and try again.");
      return res.redirect(`/verify-otp?email=${encodeURIComponent(email)}`);
    }

    // Mark email as verified and clear OTP
    user.isEmailVerified = true;
    user.otp = { code: null, expiresAt: null };
    await user.save();

    // Send welcome email after email verification succeeds
    sendWelcomeEmail(user.email, user.fullName || user.username).catch((err) => {
      console.error("Failed to send welcome email after verification:", err);
    });

    req.flash(
      "success",
      "Email verified successfully! Please sign in to access your dashboard.",
    );
    res.redirect("/login");
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
    const rawEmail = req.body.email || "";
    const email = rawEmail.trim().toLowerCase();

    if (!email) {
      req.flash("error", "Email is required.");
      return res.redirect("/forgot-password");
    }

    const user = await User.findOne({ email });
    if (!user) {
      // For security and privacy: show standard confirmation
      req.flash("success", `If an account exists with ${email}, password reset instructions have been sent.`);
      return res.redirect("/login");
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpiresAt = resetExpiry;
    await user.save();

    // Log direct reset URL in console for development/admin convenience
    const baseUrl = (process.env.SITE_URL || process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
    console.log(`\n🔑 [PASSWORD RESET LINK for ${user.email}]: ${baseUrl}/reset-password/${resetToken}\n`);

    // Send reset email in background
    sendPasswordResetEmail(user.email, user.fullName || user.username, resetToken).catch((err) => {
      console.error("Password reset email delivery error:", err);
    });

    req.flash("success", `Password reset instructions have been sent to ${user.email}.`);
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

