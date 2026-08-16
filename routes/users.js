const router = require("express").Router();
const passport = require("passport");
// Converts rejected async controller promises into Express error-handler calls.
const catchAsync = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error);
  }
};
const users = require("../controllers/users");
const {
  isLoggedIn,
  isProfileOwner,
  sendOtpLimiter,
  verifyOtpLimiter,
  passwordResetRequestLimiter,
  passwordResetSubmissionLimiter,
} = require("../middleware");

// Registration creates a user; Passport manages the login session afterwards.
router
  .route("/register")
  .get(users.renderRegister)
  .post(catchAsync(users.register));

  
const regenerateSession = (req, res, next) => {
  const returnTo = req.session.returnTo;
  req.session.regenerate((err) => {
    if (err) return next(err);
    if (returnTo) req.session.returnTo = returnTo;
    next();
  });
};

router
  .route("/login")
  .get(users.renderLogin)
  .post(
    regenerateSession,
    // Invalid passwords redirect back with a friendly flash message.
    passport.authenticate("local", {
      failureFlash: true,
      failureRedirect: "/login",
    }),
    users.login,
  );
router.post("/logout", users.logout);

// ============ GOOGLE OAUTH ============
router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  }),
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  catchAsync(users.googleCallback),
);

// ============ OTP & EMAIL VERIFICATION ============
router
  .route("/send-otp")
  .get(sendOtpLimiter, catchAsync(users.sendOTP))
  .post(sendOtpLimiter, catchAsync(users.sendOTP));

router
  .route("/verify-otp")
  .get((req, res) =>
    res.render("users/verify-otp", {
      pageTitle: "Verify Email | SVVV_Notes",
      metaDescription: "Verify your email address to access your SVVV_Notes account and resources.",
      email: req.query.email || "",
    }),
  )
  .post(verifyOtpLimiter, catchAsync(users.verifyOTP));

// ============ PASSWORD RESET ============
router
  .route("/forgot-password")
  .get(users.renderForgotPassword)
  .post(passwordResetRequestLimiter, catchAsync(users.sendPasswordReset));

router
  .route("/reset-password/:token")
  .get(catchAsync(users.renderResetPassword))
  .post(passwordResetSubmissionLimiter, catchAsync(users.resetPassword));

// Public profile page showing a student's uploaded notes.
router.get("/users/:id", catchAsync(users.profile));
router.get("/users/:id/edit", isLoggedIn, isProfileOwner, catchAsync(users.renderEditForm));
router.put("/users/:id", isLoggedIn, isProfileOwner, catchAsync(users.updateProfile));

module.exports = router;
