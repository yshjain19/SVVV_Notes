require("dotenv").config();


const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const LocalStrategy = require("passport-local");
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

app.use(
  session({
    secret: process.env.SESSION_SECRET ,
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

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.pageTitle = "SVVV_Notes";
  // Shared template values: authentication, feedback toasts, and SEO URL.
  res.locals.canonical = `${req.get("x-forwarded-proto") || req.protocol}://${req.get("host")}${req.path}`;
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

    // Fetch only subjects that actually have notes uploaded
    const activeSubjectIds = await Note.distinct("subject");
    const activeSubjects = await Subject.find({ _id: { $in: activeSubjectIds } }).sort({ name: 1 });

    res.render("home", {
      pageTitle: "SVVV_Notes | Study smarter, together",
      latestNotes,
      activeSubjects,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/about", (req, res) =>
  res.render("about", { pageTitle: "About | SVVV_Notes" }),
);

app.get("/contact", (req, res) =>
  res.render("contact", { pageTitle: "Contact | SVVV_Notes" }),
);

app.get("/robots.txt", (req, res) => {
  const protocol = req.get("x-forwarded-proto") || req.protocol;
  const host = `${protocol}://${req.get("host")}`;
  res.type("text/plain").send(`User-agent: *\nAllow: /\nSitemap: ${host}/sitemap.xml`);
});

app.get("/sitemap.xml", async (req, res, next) => {
  try {
    const Note = require("./models/note");
    const notes = await Note.find({}, "_id updatedAt");
    const protocol = req.get("x-forwarded-proto") || req.protocol;
    const host = `${protocol}://${req.get("host")}`;

    // Add dynamic note pages so search engines can discover new uploads.
    const urls = ["/", "/about", "/contact", "/notes"].concat(
      notes.map((note) => `/notes/${note._id}`),
    );

    const xmlUrls = urls.map((url, index) => {
      let xml = `<url><loc>${host}${url}</loc>`;
      if (index > 3 && notes[index - 4]?.updatedAt) {
        xml += `<lastmod>${notes[index - 4].updatedAt.toISOString()}</lastmod>`;
      }
      xml += `</url>`;
      return xml;
    }).join("");

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${xmlUrls}</urlset>`;

    res.type("application/xml").send(sitemap);
  } catch (error) {
    next(error);
  }
});

app.all("/{*any}", (req, res) =>
  res.status(404).render("error", {
    pageTitle: "Page not found | SVVV_Notes",
    status: 404,
    message: "The page you are looking for has moved or does not exist.",
  }),
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).render("error", {
    pageTitle: "Something went wrong | SVVV_Notes",
    status: err.status || 500,
    message: err.message || "Please try again in a moment.",
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
