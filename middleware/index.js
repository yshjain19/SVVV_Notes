const rateLimit = require("express-rate-limit");
const Note = require("../models/note");

// Sends unauthenticated visitors to login and returns them to their original page.
exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl;
    req.flash("error", "Please sign in to continue.");
    return res.redirect("/login");
  }
  next();
};

// Prevents users from editing or deleting notes owned by another student.
exports.isNoteOwner = async (req, res, next) => {
  const note = await Note.findById(req.params.id);
  if (!note || !note.uploadedBy.equals(req.user._id)) {
    req.flash("error", "You can only manage notes you uploaded.");
    return res.redirect("/notes");
  }
  // Reuse the already-fetched note in the controller, avoiding another query.
  res.locals.note = note;
  next();
};

// Prevents users from editing profile page of another student.
exports.isProfileOwner = (req, res, next) => {
  if (req.params.id !== req.user._id.toString()) {
    req.flash("error", "You can only edit your own profile.");
    return res.redirect(`/users/${req.params.id}`);
  }
  next();
};

// Restricts route access to administrators only.
exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  req.flash("error", "Access denied. Admin authorization required.");
  res.redirect("/");
};

// ============ RATE LIMITERS FOR AUTH & SENSITIVE ACTIONS ============

// Limit OTP send/resend attempts (5 requests per 15 minutes per IP)
exports.sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const email = req.body?.email || req.query?.email || "";
    req.flash("error", "Too many OTP requests from this IP. Please wait 15 minutes before requesting another code.");
    res.redirect(email ? `/verify-otp?email=${encodeURIComponent(email)}` : "/register");
  },
});

// Limit OTP verification attempts to prevent brute-forcing 6-digit codes (10 attempts per 15 minutes per IP)
exports.verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const email = req.body?.email || req.query?.email || "";
    req.flash("error", "Too many OTP verification attempts. Please wait 15 minutes or request a new code.");
    res.redirect(email ? `/verify-otp?email=${encodeURIComponent(email)}` : "/verify-otp");
  },
});

// Limit password reset email requests (5 requests per 15 minutes per IP)
exports.passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    req.flash("error", "Too many password reset requests from this IP. Please wait 15 minutes before trying again.");
    res.redirect("/forgot-password");
  },
});

// Limit password reset form submission attempts (10 attempts per 15 minutes per IP)
exports.passwordResetSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const token = req.params?.token || "";
    req.flash("error", "Too many password reset attempts. Please wait 15 minutes before trying again.");
    res.redirect(token ? `/reset-password/${token}` : "/forgot-password");
  },
});


