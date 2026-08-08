// server_side/config/passport.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const prisma = require("./db");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:4000/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0]?.value;

        if (!email) {
          return done(new Error("No email found from Google profile"), null);
        }

        // Check if user already exists
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          // Register new user
          user = await prisma.user.create({
            data: {
              name: profile.displayName || "Google User",
              email: email,
              password: "", // Google accounts don't store a local password
            },
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Save User ID in session cookie
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Retrieve full User object from session ID
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;