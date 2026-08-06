const User = require("../models/user");
const Note = require("../models/note");

// Authentication views are deliberately kept thin; business logic is below.
exports.renderRegister = (req, res) =>
  res.render("users/register", { pageTitle: "Create account | SVVV_Notes" });
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
  res.render("users/login", { pageTitle: "Sign in | SVVV_Notes" });
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
        pageTitle: "User not found | SVVV_Notes",
        status: 404,
        message: "This student profile could not be found.",
      });
  // Profile contributions newest-first gives the user a useful public timeline.
  const notes = await Note.find({ uploadedBy: user._id })
    .populate("uploadedBy")
    .populate("subject")
    .sort({ createdAt: -1 });
  res.render("users/profile", {
    pageTitle: `${user.username} | SVVV_Notes`,
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

