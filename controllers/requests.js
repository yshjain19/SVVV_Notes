const mongoose = require("mongoose");
const NoteRequest = require("../models/noteRequest");
const Note = require("../models/note");
const Subject = require("../models/subject");
const { broadcastNoteRequest } = require("../utils/emailService");

exports.index = async (req, res, next) => {
  try {
    const rawQ = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const rawSemester = typeof req.query.semester === "string" ? req.query.semester.trim() : "";
    const rawCourse = typeof req.query.course === "string" ? req.query.course.trim() : "";
    const rawStatus = typeof req.query.status === "string" ? req.query.status.trim() : "all";

    const filter = {};

    if (rawStatus && rawStatus !== "all") {
      filter.status = rawStatus;
    }
    if (rawSemester) {
      filter.semester = rawSemester;
    }
    if (rawCourse) {
      filter.course = rawCourse;
    }

    if (rawQ) {
      const escapedQ = rawQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: escapedQ, $options: "i" } },
        { subject: { $regex: escapedQ, $options: "i" } },
        { description: { $regex: escapedQ, $options: "i" } },
      ];
    }

    const [requests, totalOpenCount, totalFulfilledCount] = await Promise.all([
      NoteRequest.find(filter)
        .populate("requestedBy", "username fullName avatar")
        .populate("fulfilledWith", "title fileUrl")
        .sort({ createdAt: -1 }),
      NoteRequest.countDocuments({ status: "Open" }),
      NoteRequest.countDocuments({ status: "Fulfilled" }),
    ]);

    const queryDesc = rawQ ? `matching "${rawQ}"` : "";
    const semDesc = rawSemester ? `for Semester ${rawSemester}` : "";
    const filterDesc = [queryDesc, semDesc].filter(Boolean).join(" ");
    const metaDescription = filterDesc
      ? `Browse student note requests ${filterDesc} on SVVV Notes. Help classmates by sharing study materials.`
      : "Need study materials? Browse student requests or request notes from classmates across SVVV CSE semesters.";

    res.render("requests/index", {
      pageTitle: "Request Notes | SVVV_Notes",
      metaDescription,
      requests,
      q: rawQ,
      semester: rawSemester,
      course: rawCourse,
      status: rawStatus,
      totalOpenCount,
      totalFulfilledCount,
    });
  } catch (error) {
    next(error);
  }
};

exports.renderNewForm = (req, res) => {
  const prefillSubject = typeof req.query.subject === "string" ? req.query.subject.trim() : "";
  const prefillCourse = typeof req.query.course === "string" ? req.query.course.trim() : "";
  const prefillSemester = typeof req.query.semester === "string" ? req.query.semester.trim() : "";

  res.render("requests/new", {
    pageTitle: "Request Notes from Classmates | SVVV_Notes",
    metaDescription: "Ask fellow SVVV students for study notes, syllabus units, lecture summaries, or PYQs.",
    prefillSubject,
    prefillCourse,
    prefillSemester,
  });
};

exports.create = async (req, res, next) => {
  try {
    const data = req.body.request || {};
    const title = typeof data.title === "string" ? data.title.trim().slice(0, 150) : "";
    const subject = typeof data.subject === "string" ? data.subject.trim().slice(0, 100) : "";
    const course = typeof data.course === "string" ? data.course.trim() : "";
    const semester = typeof data.semester === "string" ? data.semester.trim() : "";
    const description = typeof data.description === "string" ? data.description.trim().slice(0, 2000) : "";

    if (!title || !subject || !course || !semester) {
      req.flash("error", "Please fill in all required fields (Topic Title, Subject, Course, and Semester).");
      return res.redirect("/requests/new");
    }

    const noteRequest = new NoteRequest({
      title,
      subject,
      course,
      semester,
      description,
      requestedBy: req.user._id,
      status: "Open",
    });

    await noteRequest.save();

    // Trigger community email broadcast asynchronously in background
    broadcastNoteRequest(noteRequest, req.user).catch((err) => {
      console.error("[Broadcast Error in controller]:", err.message);
    });

    req.flash(
      "success",
      "Your note request is now live! An email notification is being sent to classmates so anyone with these notes can share them."
    );
    res.redirect(`/requests/${noteRequest._id}`);
  } catch (error) {
    if (error.name === "ValidationError") {
      req.flash("error", error.message);
      return res.redirect("/requests/new");
    }
    next(error);
  }
};

exports.show = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash("error", "Note request not found.");
      return res.redirect("/requests");
    }

    const request = await NoteRequest.findById(id)
      .populate("requestedBy", "username fullName avatar email createdAt")
      .populate("fulfilledWith", "title fileUrl subject course semester");

    if (!request) {
      req.flash("error", "That note request no longer exists.");
      return res.redirect("/requests");
    }

    // Find any existing notes matching the subject or course/semester to suggest to the requester
    const escapedSubject = request.subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchingSubjects = await Subject.find({
      name: { $regex: escapedSubject, $options: "i" },
    }).select("_id");
    const matchingSubjectIds = matchingSubjects.map((s) => s._id);

    const relatedNotes = await Note.find({
      $or: [
        { subject: { $in: matchingSubjectIds } },
        { course: request.course, semester: request.semester },
      ],
    })
      .populate("uploadedBy", "username fullName")
      .populate("subject", "name")
      .limit(4);

    res.render("requests/show", {
      pageTitle: `Request: ${request.title} | SVVV_Notes`,
      metaDescription: `Student request for ${request.subject} (${request.course} Sem ${request.semester}) on SVVV_Notes.`,
      request,
      relatedNotes,
    });
  } catch (error) {
    next(error);
  }
};

exports.fulfill = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash("error", "Note request not found.");
      return res.redirect("/requests");
    }

    const request = await NoteRequest.findById(id);
    if (!request) {
      req.flash("error", "Note request not found.");
      return res.redirect("/requests");
    }

    const isOwner = req.user && request.requestedBy.equals(req.user._id);
    const isAdmin = req.user && req.user.isAdmin;

    const noteId = req.body.noteId;
    if (noteId && mongoose.Types.ObjectId.isValid(noteId)) {
      const note = await Note.findById(noteId);
      if (note) {
        request.fulfilledWith = note._id;
        request.status = "Fulfilled";
        await request.save();
        req.flash("success", "Awesome! Request marked as fulfilled with the linked note.");
        return res.redirect(`/requests/${request._id}`);
      }
    }

    // Toggle status if owner or admin
    if (isOwner || isAdmin) {
      request.status = request.status === "Fulfilled" ? "Open" : "Fulfilled";
      await request.save();
      req.flash("success", `Request status updated to "${request.status}".`);
    } else {
      req.flash("error", "You do not have permission to change this request status.");
    }

    res.redirect(`/requests/${request._id}`);
  } catch (error) {
    next(error);
  }
};

exports.destroy = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash("error", "Note request not found.");
      return res.redirect("/requests");
    }

    const request = await NoteRequest.findById(id);
    if (!request) {
      req.flash("error", "Note request not found.");
      return res.redirect("/requests");
    }

    const isOwner = req.user && request.requestedBy.equals(req.user._id);
    const isAdmin = req.user && req.user.isAdmin;

    if (!isOwner && !isAdmin) {
      req.flash("error", "You can only delete your own note requests.");
      return res.redirect(`/requests/${id}`);
    }

    await request.deleteOne();
    req.flash("success", "Note request deleted.");
    res.redirect("/requests");
  } catch (error) {
    next(error);
  }
};
