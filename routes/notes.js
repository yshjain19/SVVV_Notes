const path = require("path");
const router = require("express").Router();
const multer = require("multer");
const { storage } = require("../config/cloudinary");
const catchAsync = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    next(error);
  }
};
const notes = require("../controllers/notes");
const { isLoggedIn, isNoteOwner } = require("../middleware");

// Multer keeps uploads in memory so the app can forward them to Cloudinary
// or save them locally on-demand.
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = [".pdf", ".png", ".jpg", ".jpeg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) {
      return cb(new Error("Only PDFs and images (.png, .jpg, .jpeg) are allowed."));
    }
    cb(null, true);
  }
});

// Wrap multer so that its errors (too large, upload failure) flow through
// Express error handling and produce a friendly flash message instead of a crash.
function uploadFile(field) {
  const mw = upload.single(field);
  return (req, res, next) => {
    mw(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        req.flash("error", "File must be under 15 MB.");
        return res.redirect("back");
      }
      if (err) {
        req.flash("error", err.message || "File upload failed.");
        return res.redirect("back");
      }
    });
  };
}

// Collection routes: browse all notes or upload a new one.
router
  .route("/")
  .get(catchAsync(notes.index))
  .post(isLoggedIn, uploadFile("pdf"), catchAsync(notes.create));
router.get("/new", isLoggedIn, notes.renderNewForm);
// Item routes: public detail view, with owner-only update and deletion actions.
router
  .route("/:id")
  .get(catchAsync(notes.show))
  .put(isLoggedIn, isNoteOwner, uploadFile("pdf"), catchAsync(notes.update))
  .delete(isLoggedIn, isNoteOwner, catchAsync(notes.destroy));
router.get(
  "/:id/edit",
  isLoggedIn,
  isNoteOwner,
  catchAsync(notes.renderEditForm),
);
router.get("/:id/download", catchAsync(notes.download));
module.exports = router;
