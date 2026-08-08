const router = require("express").Router();
const admin = require("../controllers/admin");
const { isLoggedIn, isAdmin } = require("../middleware");

const catchAsync = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error);
  }
  
};

// Require authentication and administrator role for all routes in this router
router.use(isLoggedIn, isAdmin);

router.get("/dashboard", catchAsync(admin.dashboard));
router.post("/users/:id/toggle-admin", catchAsync(admin.toggleAdmin));
router.post("/users/:id/delete", catchAsync(admin.deleteUser));
router.post("/notes/:id/toggle-verify", catchAsync(admin.toggleVerifyNote));
router.post("/notes/:id/delete", catchAsync(admin.deleteNote));

module.exports = router;
