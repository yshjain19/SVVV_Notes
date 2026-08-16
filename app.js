require("dotenv").config();


const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const methodOverride = require("method-override");
const flash = require("connect-flash");
const ejsMate = require("ejs-mate");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

if (process.env.NODE_ENV !== "production") {
  try {
    const dns = require("dns");
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
  } catch (e) {
    console.warn("Could not set custom DNS servers for development:", e.message);
  }
}

const User = require("./models/user");
const notesRoutes = require("./routes/notes");
const userRoutes = require("./routes/users");
const adminRoutes = require("./routes/admin");

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many authentication requests from this IP, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/login", authLimiter);
app.use("/register", authLimiter);

// Required for secure cookies when a host terminates HTTPS before Express.
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
// Serve locally stored PDFs when Cloudinary credentials are not configured.
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

const sessionSecret =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production"
    ? undefined
    : "svvv-notes-dev-fallback-session-secret-key");

if (!sessionSecret) {
  throw new Error(
    "SESSION_SECRET is required in production. Add a strong SESSION_SECRET to your environment variables.",
  );
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    // Atlas-backed sessions survive a Render/Railway process restart.
    store: process.env.MONGODB_URI
      ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: "sessions" })
      : undefined,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  }),
);

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Load Passport strategies & session serialization
require("./config/passport");

function escapeXml(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

function getBaseUrl(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/+$/, "");
  }
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/+$/, "");
  }
  const forwardedProto = req.get("x-forwarded-proto");
  const host = req.get("x-forwarded-host") || req.get("host") || "svvvnotes.bitbros.in";
  const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : req.protocol || "https");
  return `${protocol}://${host}`.replace(/\/+$/, "");
}

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.pageTitle = "SVVV_Notes | Study smarter, together";
  const siteUrl = getBaseUrl(req);
  res.locals.siteUrl = siteUrl;
  // Shared template values: authentication, feedback toasts, and SEO canonical URLs.
  res.locals.canonical = `${siteUrl}${req.path === "/" ? "" : req.path}`;
  next();
});

app.use("/", userRoutes);
app.use("/notes", notesRoutes);
app.use("/admin", adminRoutes);

app.get("/", async (req, res, next) => {
  try {
    const Note = require("./models/note");
    const Subject = require("./models/subject");

    const latestNotes = await Note.find({})
      .populate("uploadedBy")
      .populate("subject")
      .sort({ createdAt: -1 })
      .limit(3);

    // Fetch top 12 active subjects that actually have notes uploaded
    const activeSubjectsData = await Note.aggregate([
      { $group: { _id: "$subject", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 }
    ]);
    const activeSubjectIds = activeSubjectsData.map(s => s._id);
    let activeSubjects = await Subject.find({ _id: { $in: activeSubjectIds } });

    // Sort activeSubjects by note count descending to keep the most popular ones first
    activeSubjects.sort((a, b) => {
      const aCount = activeSubjectsData.find(s => s._id.equals(a._id))?.count || 0;
      const bCount = activeSubjectsData.find(s => s._id.equals(b._id))?.count || 0;
      return bCount - aCount;
    });

    // Fallback 1: Agar kisi subject me notes nahi hain, toh database me available subjects dikhao
    if (activeSubjects.length === 0) {
      activeSubjects = await Subject.find({}).sort({ name: 1 }).limit(12);
    }

    // Fallback 2: Agar database bilkul khali (unseeded) hai, toh default subjects dikhao
    if (activeSubjects.length === 0) {
      const defaultNames = ['Data Structures', 'Operating Systems', 'DBMS', 'Computer Networks', 'Software Engineering', 'Web Development', 'Java', 'Python'];
      activeSubjects = defaultNames.map(name => ({
        _id: null,
        name: name
      }));
    }

    res.render("home", {
      pageTitle: "SVVV_Notes | Study smarter, together",
      metaDescription: "Your ultimate hub for SVVV study materials, lecture notes, syllabus, previous year papers, and more. Upload notes, track your progress on the leaderboard, and more.",
      latestNotes,
      activeSubjects,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/about", (req, res) =>
  res.render("about", {
    pageTitle: "About Us | SVVV_Notes",
    metaDescription: "Learn more about SVVV_Notes, an independent peer-to-peer study platform built by students for Shri Vaishnav Vidyapeeth Vishwavidyalaya CSE learners.",
  }),
);

app.get("/contact", (req, res) =>
  res.render("contact", {
    pageTitle: "Contact Us | SVVV_Notes",
    metaDescription: "Have questions, feedback, or suggestions for SVVV_Notes? Get in touch with our student team.",
  }),
);

app.get("/robots.txt", (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(
    `User-agent: *
Allow: /
Allow: /css/
Allow: /js/
Allow: /images/
Allow: /favicon.ico
Allow: /favicon.png
Allow: /favicon-48x48.png
Allow: /favicon-32x32.png
Allow: /favicon-16x16.png
Allow: /logo.png
Allow: /logo-icon.svg
Allow: /apple-touch-icon.png
Allow: /site.webmanifest
Disallow: /admin/
Disallow: /reset-password/
Disallow: /verify-otp

Sitemap: ${baseUrl}/sitemap.xml
`
  );
});

app.get("/sitemap.xml", async (req, res) => {
  const baseUrl = getBaseUrl(req);
  try {
    const Note = require("./models/note");
    const User = require("./models/user");

    // Fetch notes and active note uploaders
    const notesPromise = Note.find({}, "_id title updatedAt createdAt").sort({ updatedAt: -1 }).lean().catch(() => []);
    const activeUserIdsPromise = Note.distinct("uploadedBy").catch(() => []);

    const [notes, activeUserIds] = await Promise.all([notesPromise, activeUserIdsPromise]);

    let users = [];
    if (activeUserIds && activeUserIds.length > 0) {
      users = await User.find({ _id: { $in: activeUserIds } }, "_id username fullName updatedAt createdAt").lean().catch(() => []);
    }

    const now = new Date().toISOString();

    // Static core pages
    const staticPages = [
      { loc: `${baseUrl}/`, changefreq: "daily", priority: "1.0", lastmod: now, imageTitle: "SVVV_Notes Official Home" },
      { loc: `${baseUrl}/notes`, changefreq: "daily", priority: "0.9", lastmod: now, imageTitle: "SVVV_Notes Study Library" },
      { loc: `${baseUrl}/about`, changefreq: "monthly", priority: "0.6", imageTitle: "About SVVV_Notes" },
      { loc: `${baseUrl}/contact`, changefreq: "monthly", priority: "0.6", imageTitle: "Contact SVVV_Notes" },
    ];

    // Dynamic individual note pages
    const notePages = (notes || []).map((note) => {
      const modDate = note.updatedAt || note.createdAt;
      return {
        loc: `${baseUrl}/notes/${note._id}`,
        changefreq: "weekly",
        priority: "0.8",
        lastmod: modDate ? new Date(modDate).toISOString() : undefined,
        imageTitle: note.title ? `${note.title} - SVVV_Notes` : "SVVV Study Note",
      };
    });

    // Dynamic public author profile pages
    const userPages = (users || []).map((user) => {
      const modDate = user.updatedAt || user.createdAt;
      return {
        loc: `${baseUrl}/users/${user._id}`,
        changefreq: "weekly",
        priority: "0.5",
        lastmod: modDate ? new Date(modDate).toISOString() : undefined,
        imageTitle: `${user.fullName || user.username || 'Student'} Profile - SVVV_Notes`,
      };
    });

    const allPages = [...staticPages, ...notePages, ...userPages];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    for (const page of allPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${escapeXml(page.loc)}</loc>\n`;
      if (page.lastmod) {
        xml += `    <lastmod>${page.lastmod}</lastmod>\n`;
      }
      if (page.changefreq) {
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      }
      if (page.priority) {
        xml += `    <priority>${page.priority}</priority>\n`;
      }
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(baseUrl)}/images/logo.png</image:loc>\n`;
      xml += `      <image:title>${escapeXml(page.imageTitle || "SVVV_Notes")}</image:title>\n`;
      xml += `      <image:caption>SVVV_Notes student study notes platform</image:caption>\n`;
      xml += `    </image:image>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>\n`;

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("X-Robots-Tag", "all");
    res.set("Cache-Control", "public, max-age=1800, s-maxage=3600");
    return res.status(200).send(xml);
  } catch (error) {
    console.error("Failed to generate dynamic sitemap:", error);
    // Fail-safe XML response to guarantee Google Search Console never receives a 500 error
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n  <url>\n    <loc>${escapeXml(baseUrl)}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n    <image:image>\n      <image:loc>${escapeXml(baseUrl)}/images/logo.png</image:loc>\n      <image:title>SVVV_Notes</image:title>\n    </image:image>\n  </url>\n  <url>\n    <loc>${escapeXml(baseUrl)}/notes</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n    <image:image>\n      <image:loc>${escapeXml(baseUrl)}/images/logo.png</image:loc>\n      <image:title>SVVV_Notes Browse</image:title>\n    </image:image>\n  </url>\n  <url>\n    <loc>${escapeXml(baseUrl)}/about</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n  <url>\n    <loc>${escapeXml(baseUrl)}/contact</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n</urlset>\n`;
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("X-Robots-Tag", "all");
    return res.status(200).send(fallbackXml);
  }
});
app.get("/health", (req, res) => {
  res.status(200).send("SVVV Notes is running");
});

app.all("*", (req, res) =>
  res.status(404).render("error", {
    pageTitle: "Page not found | SVVV_Notes",
    metaDescription: "The page you are looking for has moved or does not exist on SVVV_Notes.",
    status: 404,
    message: "The page you are looking for has moved or does not exist.",
  }),
);

app.use((err, req, res, next) => {
  console.error(err);
  let status = err.status || 500;
  let message = err.message || "Please try again in a moment.";

  if (err.name === "CastError") {
    status = 404;
    message = "The requested resource could not be found.";
  } else if (err.name === "ValidationError") {
    status = 400;
  }

  if (process.env.NODE_ENV === "production" && status === 500) {
    message = "An unexpected error occurred. Please try again in a moment.";
  }

  res.status(status).render("error", {
    pageTitle: `${status === 404 ? "Not Found" : "Error"} | SVVV_Notes`,
    metaDescription: "An error occurred while processing your request on SVVV_Notes.",
    status,
    message,
  });
});

const port = process.env.PORT || 3000;

if (!process.env.MONGODB_URI) {
  throw new Error(
    "MONGODB_URI is required. Add your MongoDB Atlas connection string to .env.",
  );
}

mongoose.set("strictQuery", false);

async function main() {
  const isAtlasConnection = process.env.MONGODB_URI?.startsWith("mongodb+srv://");

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    tls: isAtlasConnection,
  });

  app.listen(port, () =>
    console.log(`SVVV_Notes running at http://localhost:${port}`),
  );
}

main()
  .then(() => {
    console.log("Database connection established successfully!");
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    if (
      error?.name === "MongoServerSelectionError" ||
      error?.code === "ECONNREFUSED" ||
      error?.code === "ENOTFOUND" ||
      error?.message?.includes("querySrv")
    ) {
      console.error("\nAtlas troubleshooting:");
      console.error("- Confirm the cluster is running and not paused in MongoDB Atlas.");
      console.error("- Add your current public IP address under Network Access in Atlas.");
      console.error("- Verify the username/password and database name in MONGODB_URI.");
      console.error("- Use the exact SRV connection string copied from Atlas.");
    }
    process.exit(1);
  });
