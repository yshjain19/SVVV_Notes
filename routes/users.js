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
const { isLoggedIn, isProfileOwner } = require("../middleware");

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
// Public profile page showing a student's uploaded notes.
router.get("/users/:id", catchAsync(users.profile));
router.get("/users/:id/edit", isLoggedIn, isProfileOwner, catchAsync(users.renderEditForm));
router.put("/users/:id", isLoggedIn, isProfileOwner, catchAsync(users.updateProfile));

module.exports = router;
