const router = require("express").Router();
const admin = require("../controllers/admin");
const { isLoggedIn, isAdmin, adminActionLimiter } = require("../middleware");

const catchAsync = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error);
  }
};

// All admin routes require authentication AND admin role, verified server-side.
// isAdmin returns 403 Forbidden for non-admin users — not a client-side check.
router.use(isLoggedIn, isAdmin);

// ── Admin Dashboard ──────────────────────────────────────────────────────────
router.get("/dashboard", catchAsync(admin.dashboard));

// ── Moderation Queue ─────────────────────────────────────────────────────────
// GET  /admin/notes              → pending/approved/rejected queue
// POST /admin/notes/:id/approve  → approve a note (rate-limited)
// POST /admin/notes/:id/reject   → reject a note with reason (rate-limited)
// POST /admin/notes/:id/delete   → permanently delete a note (rate-limited)
router.get("/notes", catchAsync(admin.moderationQueue));
router.post("/notes/:id/approve", adminActionLimiter, catchAsync(admin.approveNote));
router.post("/notes/:id/reject", adminActionLimiter, catchAsync(admin.rejectNote));
router.post("/notes/:id/delete", adminActionLimiter, catchAsync(admin.deleteNote));

// Legacy toggle-verify route — kept for backward compat with existing dashboard buttons
router.post("/notes/:id/toggle-verify", adminActionLimiter, catchAsync(admin.toggleVerifyNote));

// ── User Management ──────────────────────────────────────────────────────────
router.post("/users/:id/toggle-admin", adminActionLimiter, catchAsync(admin.toggleAdmin));
router.post("/users/:id/delete", adminActionLimiter, catchAsync(admin.deleteUser));

module.exports = router;
