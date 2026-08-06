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
  if (req.user && (req.user.isAdmin || req.user.username === "admin")) {
    return next();
  }
  req.flash("error", "Access denied. Admin authorization required.");
  res.redirect("/");
};


