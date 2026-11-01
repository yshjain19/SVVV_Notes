const path = require("path");
const mongoose = require("mongoose");
const Note = require("../models/note");
const Subject = require("../models/subject");
const DownloadLog = require("../models/downloadLog");
const { cloudinary } = require("../config/cloudinary");
const cache = require("../utils/cache");

function parseCloudinaryUrl(url) {
  if (!url) return null;
  const match = url.match(/res\.cloudinary\.com\/[^/]+\/([^/]+)\/upload\/(?:v\d+\/)?([^?#]+)/);
  if (match) {
    const resourceType = match[1];
    let publicIdWithExt = match[2];
    if (resourceType !== "raw") {
      const lastDotIndex = publicIdWithExt.lastIndexOf(".");
      if (lastDotIndex !== -1) {
        publicIdWithExt = publicIdWithExt.substring(0, lastDotIndex);
      }
    }
    return {
      publicId: decodeURIComponent(publicIdWithExt),
      resourceType: resourceType,
    };
  }
  return null;
}

function buildFileFromFile(file) {
  return {
    url: file.path || file.secure_url || file.url,
    filename: file.filename || file.public_id,
    contentType: file.mimetype,
  };
}

exports.removeStoredFile = async function removeStoredFile(fileUrl) {
  if (!fileUrl) return;
  try {
    const parsed = parseCloudinaryUrl(fileUrl);
    if (parsed && parsed.publicId) {
      await cloudinary.uploader.destroy(parsed.publicId, {
        resource_type: parsed.resourceType || "image",
      });
    }
  } catch (err) {
    console.error("Failed to delete file from Cloudinary:", err);
  }
};

// ── PUBLIC FILTER ──────────────────────────────────────────────────────────────
// All public queries MUST include { status: "approved" }.
// This is enforced at the database level — never rely on frontend-only filtering.
const PUBLIC_FILTER = { status: "approved" };

exports.index = async (req, res, next) => {
  try {
    const rawQ = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const rawSemester = typeof req.query.semester === "string" ? req.query.semester.trim() : "";
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 12;
    const skip = (page - 1) * limit;

    // Always start with the public visibility filter
    const filter = { ...PUBLIC_FILTER };

    if (rawSemester) filter.semester = rawSemester;

    if (rawQ) {
      // Escape all regex special characters to prevent ReDoS and regex injection
      const escapedQ = rawQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Find subjects matching the escaped query case-insensitively using lean & select
      const matchingSubjects = await Subject.find({
        name: { $regex: escapedQ, $options: "i" },
      })
        .select("_id")
        .lean();
      const matchingSubjectIds = matchingSubjects.map((s) => s._id);

      // Search by title/description matching query OR subject ID matching matchingSubjectIds
      filter.$or = [
        { title: { $regex: escapedQ, $options: "i" } },
        { description: { $regex: escapedQ, $options: "i" } },
        { subject: { $in: matchingSubjectIds } },
      ];
    }

    // Execute paginated notes query and total count in parallel
    const [notes, totalNotes] = await Promise.all([
      Note.find(filter)
        .select("title description course semester createdAt downloadCount isVerified subject uploadedBy")
        .populate("uploadedBy", "fullName username isAdmin avatar")
        .populate("subject", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Note.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalNotes / limit) || 1;
    const queryDesc = rawQ ? `matching "${rawQ}"` : "";
    const semDesc = rawSemester ? `for Semester ${rawSemester}` : "";
    const filterDesc = [queryDesc, semDesc].filter(Boolean).join(" ");
    const metaDescription = filterDesc
      ? `Explore peer-shared SVVV CSE study notes ${filterDesc}. Download PDFs and lecture materials.`
      : "Browse student-shared study notes, previous year question papers (PYQs), and lecture summaries for SVVV CSE.";

    res.render("notes/index", {
      pageTitle: "Browse Notes | SVVV_Notes",
      metaDescription,
      notes,
      q: rawQ,
      semester: rawSemester,
      currentPage: page,
      totalPages,
      totalNotes,
    });
  } catch (error) {
    next(error);
  }
};

exports.renderNewForm = (req, res) =>
  res.render("notes/new", {
    pageTitle: "Upload a Note | SVVV_Notes",
    metaDescription: "Share your handwritten study notes, lecture summaries, or PYQ solutions with fellow SVVV students.",
    prefill: {
      title: typeof req.query.title === "string" ? req.query.title.trim() : "",
      subject: typeof req.query.subject === "string" ? req.query.subject.trim() : "",
      course: typeof req.query.course === "string" ? req.query.course.trim() : "",
      semester: typeof req.query.semester === "string" ? req.query.semester.trim() : "",
      requestId: typeof req.query.requestId === "string" ? req.query.requestId.trim() : "",
    },
  });

exports.create = async (req, res, next) => {
  if (!req.file) {
    req.flash("error", "Please upload a file.");
    return res.redirect("/notes/new");
  }

  const noteData = req.body.note || {};
  const rawSubject = typeof noteData.subject === "string" ? noteData.subject.trim() : "General";
  let subjectDoc = await Subject.findOne({ name: rawSubject }).collation({ locale: "en", strength: 2 });
  if (!subjectDoc) {
    subjectDoc = new Subject({ name: rawSubject });
    await subjectDoc.save();
  }

  const uploadedFile = await buildFileFromFile(req.file);

  const title = typeof noteData.title === "string" ? noteData.title.trim().slice(0, 150) : "Study Note";
  const description = typeof noteData.description === "string" ? noteData.description.trim().slice(0, 2000) : "";
  const course = noteData.course;
  const semester = noteData.semester;

  // ALL newly uploaded notes start as "pending" regardless of who uploaded them.
  // An admin must explicitly approve before it becomes publicly visible.
  const note = new Note({
    title,
    description,
    course,
    semester,
    subject: subjectDoc._id,
    fileUrl: uploadedFile.url,
    uploadedBy: req.user._id,
    status: "pending",
    isVerified: false,
  });

  try {
    await note.save();

    // Invalidate cached home and sitemap data
    cache.invalidate("home:*");
    cache.invalidate("sitemap:*");

    // If this note was uploaded in response to a community Note Request, link and fulfill the request
    const requestId = req.body.requestId || req.query.requestId;
    if (requestId && mongoose.Types.ObjectId.isValid(requestId)) {
      try {
        const NoteRequest = require("../models/noteRequest");
        await NoteRequest.findByIdAndUpdate(requestId, {
          status: "Fulfilled",
          fulfilledWith: note._id,
        });
      } catch (err) {
        console.error("Could not link NoteRequest to uploaded Note:", err.message);
      }
    }

    req.flash(
      "success",
      "Note submitted successfully! It is currently under admin review and will become publicly visible after approval."
    );
    res.redirect(`/notes/${note._id}`);
  } catch (error) {
    // Clean up uploaded Cloudinary file if database save fails
    if (uploadedFile.url) {
      await exports.removeStoredFile(uploadedFile.url);
    }
    if (error.code === 11000 || (error.name === "MongoServerError" && error.message.includes("E11000"))) {
      req.flash("error", "A note with this exact title already exists. Please choose a distinctive title.");
      return res.redirect("/notes/new");
    }
    if (error.name === "ValidationError") {
      req.flash("error", error.message);
      return res.redirect("/notes/new");
    }
    next(error);
  }
};

exports.show = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    req.flash("error", "That note could not be found.");
    return res.redirect("/notes");
  }

  const note = await Note.findById(req.params.id)
    .populate("uploadedBy", "fullName username isAdmin avatar email")
    .populate("subject", "name")
    .lean();

  if (!note) {
    req.flash("error", "That note no longer exists.");
    return res.redirect("/notes");
  }

  // Determine if the viewer is the uploader or an admin
  const isOwner =
    req.isAuthenticated() &&
    req.user &&
    note.uploadedBy &&
    (note.uploadedBy._id
      ? note.uploadedBy._id.toString() === req.user._id.toString()
      : note.uploadedBy.toString() === req.user._id.toString());
  const isAdmin = req.isAuthenticated() && req.user && req.user.isAdmin;

  // Non-approved notes are only viewable by the uploader or an admin
  if (note.status !== "approved" && !isOwner && !isAdmin) {
    req.flash("error", "That note could not be found.");
    return res.redirect("/notes");
  }

  const subjectName = note.subject && note.subject.name ? note.subject.name : (note.subject || "Engineering");
  const metaDescription = note.description
    ? `${note.description.substring(0, 155).trim()}...`
    : `Download study notes for ${note.title} (${subjectName}) from the SVVV_Notes library.`;

  res.render("notes/show", {
    pageTitle: `${note.title} | ${subjectName} Notes | SVVV_Notes`,
    note,
    pdfUrl: note.fileUrl,
    metaDescription,
    pageType: "article",
    isOwner,
    isAdmin,
  });
};

exports.renderEditForm = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    req.flash("error", "That note could not be found.");
    return res.redirect("/notes");
  }

  const note = await Note.findById(req.params.id).populate("subject", "name").lean();
  if (!note) {
    req.flash("error", "That note no longer exists.");
    return res.redirect("/notes");
  }
  res.render("notes/edit", {
    pageTitle: `Edit ${note.title} | SVVV_Notes`,
    metaDescription: `Edit and update notes details for ${note.title} on SVVV_Notes.`,
    note,
  });
};

exports.update = async (req, res, next) => {
  const note = res.locals.note;
  const noteData = req.body.note || {};

  const rawSubject = typeof noteData.subject === "string" ? noteData.subject.trim() : "General";
  let subjectDoc = await Subject.findOne({ name: rawSubject }).collation({ locale: "en", strength: 2 });
  if (!subjectDoc) {
    subjectDoc = new Subject({ name: rawSubject });
    await subjectDoc.save();
  }

  const title = typeof noteData.title === "string" ? noteData.title.trim().slice(0, 150) : note.title;
  const description = typeof noteData.description === "string" ? noteData.description.trim().slice(0, 2000) : note.description;
  const course = noteData.course || note.course;
  const semester = noteData.semester || note.semester;

  note.title = title;
  note.description = description;
  note.course = course;
  note.semester = semester;
  note.subject = subjectDoc._id;

  // When a note is edited, reset it to pending so admin can re-review the updated content
  note.status = "pending";
  note.isVerified = false;
  note.verifiedBy = null;
  note.verifiedAt = null;
  note.rejectionReason = null;

  let uploadedFile = null;
  if (req.file) {
    uploadedFile = await buildFileFromFile(req.file);
    const oldUrl = note.fileUrl;
    note.fileUrl = uploadedFile.url;
    await exports.removeStoredFile(oldUrl);
  }

  try {
    await note.save();
    cache.invalidate("home:*");
    cache.invalidate("sitemap:*");
    req.flash("success", "Note updated. It has been re-submitted for admin review and will be visible after approval.");
    res.redirect(`/notes/${note._id}`);
  } catch (error) {
    if (error.code === 11000 || (error.name === "MongoServerError" && error.message.includes("E11000"))) {
      req.flash("error", "A note with this exact title already exists. Please choose a distinctive title.");
      return res.redirect(`/notes/${note._id}/edit`);
    }
    if (error.name === "ValidationError") {
      req.flash("error", error.message);
      return res.redirect(`/notes/${note._id}/edit`);
    }
    next(error);
  }
};

exports.destroy = async (req, res) => {
  const note = res.locals.note;
  await exports.removeStoredFile(note.fileUrl);
  await note.deleteOne();
  cache.invalidate("home:*");
  cache.invalidate("sitemap:*");
  req.flash("success", "Note deleted.");
  res.redirect("/notes");
};

exports.download = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash("error", "Note not found.");
      return res.redirect("/notes");
    }
    const note = await Note.findById(req.params.id).select("uploadedBy status fileUrl downloadCount").lean();
    if (!note) {
      req.flash("error", "Note not found.");
      return res.redirect("/notes");
    }

    // Only approved notes can be downloaded publicly.
    // The uploader and admins can still download their own pending/rejected notes.
    const isOwner =
      req.isAuthenticated() &&
      req.user &&
      note.uploadedBy &&
      note.uploadedBy.toString() === req.user._id.toString();
    const isAdmin = req.isAuthenticated() && req.user && req.user.isAdmin;

    if (note.status !== "approved" && !isOwner && !isAdmin) {
      req.flash("error", "This note is not available for download.");
      return res.redirect("/notes");
    }

    // Atomic increment instead of full document load-validate-save
    await Note.updateOne({ _id: note._id }, { $inc: { downloadCount: 1 } });

    // Log the download event for accurate time-based analytics (7-day delta, etc.)
    try {
      await DownloadLog.create({
        note: note._id,
        user: req.user ? req.user._id : null,
        ip: req.ip || req.headers["x-forwarded-for"] || null,
        downloadedAt: new Date(),
      });
    } catch (logErr) {
      console.error("Failed to record download log:", logErr.message);
    }

    res.redirect(note.fileUrl);
  } catch (error) {
    next(error);
  }
};
