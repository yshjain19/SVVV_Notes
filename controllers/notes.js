const fs = require("fs");
const path = require("path");
const Note = require("../models/note");
const Subject = require("../models/subject");
const {
  cloudinary,
  hasCloudinary,
  uploadToCloudinary,
  saveFileLocally,
} = require("../config/cloudinary");

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

async function buildFileFromFile(file) {
  if (hasCloudinary) {
    const uploaded = await uploadToCloudinary(file);
    return {
      url: uploaded.secure_url || uploaded.url,
      filename: uploaded.public_id,
      contentType: file.mimetype,
    };
  }
  const saved = await saveFileLocally(file);
  return {
    url: saved.url,
    filename: saved.filename,
    contentType: file.mimetype,
  };
}

exports.removeStoredFile = async function removeStoredFile(fileUrl) {
  if (!fileUrl) return;
  if (hasCloudinary) {
    const parsed = parseCloudinaryUrl(fileUrl);
    if (parsed) {
      await cloudinary.uploader.destroy(parsed.publicId, {
        resource_type: parsed.resourceType,
      });
    }
    return;
  }
  const filename = path.basename(fileUrl);
  const filePath = path.join(__dirname, "../public/uploads", filename);
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

exports.index = async (req, res) => {
  const { q = "", semester = "" } = req.query;
  const filter = {};
  
  if (semester) filter.semester = semester;

  if (q) {
    const Subject = require("../models/subject");
    // Find subjects matching the query case-insensitively
    const matchingSubjects = await Subject.find({
      name: { $regex: q, $options: 'i' }
    });
    const matchingSubjectIds = matchingSubjects.map(s => s._id);

    // Search by title/description matching query OR subject ID matching matchingSubjectIds
    filter.$or = [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { subject: { $in: matchingSubjectIds } }
    ];
  }

  const notes = await Note.find(filter)
    .populate("uploadedBy")
    .populate("subject")
    .sort({ createdAt: -1 });
  const queryDesc = q ? `matching "${q}"` : "";
  const semDesc = semester ? `for Semester ${semester}` : "";
  const filterDesc = [queryDesc, semDesc].filter(Boolean).join(" ");
  const metaDescription = filterDesc
    ? `Explore peer-shared SVVV CSE study notes ${filterDesc}. Download PDFs and lecture materials.`
    : "Browse student-shared study notes, previous year question papers (PYQs), and lecture summaries for SVVV CSE.";

  res.render("notes/index", {
    pageTitle: "Browse Notes | SVVV_Notes",
    metaDescription,
    notes,
    q,
    semester,
  });
};

exports.renderNewForm = (req, res) =>
  res.render("notes/new", {
    pageTitle: "Upload a Note | SVVV_Notes",
    metaDescription: "Share your handwritten study notes, lecture summaries, or PYQ solutions with fellow SVVV students.",
  });

exports.create = async (req, res) => {
  if (!req.file) {
    req.flash("error", "Please upload a file.");
    return res.redirect("/notes/new");
  }

  const subjectName = req.body.note.subject.trim();
  let subjectDoc = await Subject.findOne({ name: subjectName }).collation({ locale: "en", strength: 2 });
  if (!subjectDoc) {
    subjectDoc = new Subject({ name: subjectName });
    await subjectDoc.save();
  }

  const uploadedFile = await buildFileFromFile(req.file);

  const { title, description, course, semester } = req.body.note;

  const note = new Note({
    title,
    description,
    course,
    semester,
    subject: subjectDoc._id,
    fileUrl: uploadedFile.url,
    uploadedBy: req.user._id,
  });
  await note.save();
  req.flash("success", "Your note is live and ready to help classmates.");
  res.redirect(`/notes/${note._id}`);
};

exports.show = async (req, res) => {
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

exports.update = async (req, res) => {
  const note = res.locals.note;
  
  const subjectName = req.body.note.subject.trim();
  let subjectDoc = await Subject.findOne({ name: subjectName }).collation({ locale: "en", strength: 2 });
  if (!subjectDoc) {
    subjectDoc = new Subject({ name: subjectName });
    await subjectDoc.save();
  }

  const { title, description, course, semester } = req.body.note;
  note.title = title;
  note.description = description;
  note.course = course;
  note.semester = semester;
  note.subject = subjectDoc._id;

  if (req.file) {
    await removeStoredFile(note.fileUrl);
    const uploadedFile = await buildFileFromFile(req.file);
    note.fileUrl = uploadedFile.url;
  }
  
  await note.save();
  req.flash("success", "Note updated successfully.");
  res.redirect(`/notes/${note._id}`);
};

exports.destroy = async (req, res) => {
  const note = res.locals.note;
  await removeStoredFile(note.fileUrl);
  await note.deleteOne();
  req.flash("success", "Note deleted.");
  res.redirect("/notes");
};

exports.download = async (req, res, next) => {
  try {
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

