const passport = require("passport");
const LocalStrategy = require("passport-local");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user");

// Helper to generate a unique username from display name or email prefix
async function generateUniqueUsername(base) {
  let cleanBase = (base || "student")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  if (!cleanBase) cleanBase = "student";

  let username = cleanBase;
  let counter = 1;
  while (await User.findOne({ username })) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    username = `${cleanBase.slice(0, 15)}_${suffix}`;
    counter++;
    if (counter > 20) {
      username = `user_${Date.now()}`;
      break;
    }
  }
  return username;
}

// 1. Configure Local Strategy (passport-local-mongoose)
passport.use(new LocalStrategy(User.authenticate()));

// 2. Configure Google OAuth 2.0 Strategy
const callbackURL =
  process.env.GOOGLE_CALLBACK_URL ||
  "https://svvv-notes.onrender.com/auth/google/callback";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_PLACEHOLDER",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "GOOGLE_CLIENT_SECRET_PLACEHOLDER",
      callbackURL: callbackURL,
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails && profile.emails[0]
            ? profile.emails[0].value.toLowerCase().trim()
            : null;
        const photoUrl =
          profile.photos && profile.photos[0] ? profile.photos[0].value : null;
        const displayName =
          profile.displayName ||
          (profile.name
            ? `${profile.name.givenName || ""} ${profile.name.familyName || ""}`.trim()
            : "Student");

        // Step A: Find existing user with matching googleId
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          if (!user.isEmailVerified) {
            user.isEmailVerified = true;
            await user.save();
          }
          return done(null, user);
        }

        // Step B: Find existing user with matching email (link Google ID)
        if (email) {
          user = await User.findOne({ email });
          if (user) {
            user.googleId = profile.id;
            user.isEmailVerified = true;
            if (
              photoUrl &&
              (!user.avatar ||
                !user.avatar.url ||
                user.avatar.url.includes("dicebear") ||
                user.avatar.url.includes("avatar-"))
            ) {
              user.avatar = { url: photoUrl };
            }
            await user.save();
            return done(null, user);
          }
        }

        // Step C: Create new student user for first-time Google sign in
        const baseUsername = email ? email.split("@")[0] : displayName;
        const username = await generateUniqueUsername(baseUsername);

        const newUser = new User({
          googleId: profile.id,
          email: email || `${profile.id}@google.oauth`,
          username: username,
          fullName: displayName,
          avatar: {
            url:
              photoUrl ||
              `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
          },
          isEmailVerified: true,
          branch: "C.S.E",
          course: "Computer Science",
        });

        await newUser.save();
        return done(null, newUser);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

// 3. Configure Passport serialization
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

module.exports = passport;
