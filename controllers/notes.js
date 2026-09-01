const path = require("path");
const mongoose = require("mongoose");
const Note = require("../models/note");
const Subject = require("../models/subject");
const { cloudinary } = require("../config/cloudinary");

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

exports.index = async (req, res) => {
  const rawQ = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const rawSemester = typeof req.query.semester === "string" ? req.query.semester.trim() : "";
  
  const filter = {};
  
  if (rawSemester) filter.semester = rawSemester;

  if (rawQ) {
    const Subject = require("../models/subject");
    // Escape all regex special characters to prevent ReDoS and regex injection
    const escapedQ = rawQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    // Find subjects matching the escaped query case-insensitively
    const matchingSubjects = await Subject.find({
      name: { $regex: escapedQ, $options: "i" }
    });
    const matchingSubjectIds = matchingSubjects.map(s => s._id);

    // Search by title/description matching query OR subject ID matching matchingSubjectIds
    filter.$or = [
      { title: { $regex: escapedQ, $options: "i" } },
      { description: { $regex: escapedQ, $options: "i" } },
      { subject: { $in: matchingSubjectIds } }
    ];
  }

  const notes = await Note.find(filter)
    .populate("uploadedBy")
    .populate("subject")
    .sort({ createdAt: -1 });
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
  });
};

exports.renderNewForm = (req, res) =>
  res.render("notes/new", {
    pageTitle: "Upload a Note | SVVV_Notes",
    metaDescription: "Share your handwritten study notes, lecture summaries, or PYQ solutions with fellow SVVV students.",
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

  const isVerified = Boolean(req.user && req.user.isAdmin);

  const note = new Note({
    title,
    description,
    course,
    semester,
    subject: subjectDoc._id,
    fileUrl: uploadedFile.url,
    uploadedBy: req.user._id,
    isVerified,
  });

  try {
    await note.save();
    req.flash("success", "Your note is live and ready to help classmates.");
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
    .populate("uploadedBy")
    .populate("subject");
  if (!note) {
    req.flash("error", "That note no longer exists.");
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
  });
};

exports.renderEditForm = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    req.flash("error", "That note could not be found.");
    return res.redirect("/notes");
  }

  const note = await Note.findById(req.params.id).populate("subject");
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

  let uploadedFile = null;
  if (req.file) {
    uploadedFile = await buildFileFromFile(req.file);
    const oldUrl = note.fileUrl;
    note.fileUrl = uploadedFile.url;
    await exports.removeStoredFile(oldUrl);
  }
  
  try {
    await note.save();
    req.flash("success", "Note updated successfully.");
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
  req.flash("success", "Note deleted.");
  res.redirect("/notes");
};

exports.download = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      req.flash("error", "Note not found.");
      return res.redirect("/notes");
    }
    const note = await Note.findById(req.params.id);
    if (!note) {
      req.flash("error", "Note not found.");
      return res.redirect("/notes");
    }
    note.downloadCount = (note.downloadCount || 0) + 1;
    await note.save();
    res.redirect(note.fileUrl);
  } catch (error) {
    next(error);
  }
};

