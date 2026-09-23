// server_side/routes/authRoutes.js
const express = require("express");
const passport = require("passport");
const router = express.Router();

// Trigger Google OAuth Login Redirect
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth Callback Handler
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "http://localhost:5173/login?error=auth_failed",
    successRedirect: "http://localhost:5173/dashboard", // Frontend redirect after successful login
  })
);

// Get Currently Logged In User
router.get("/current-user", (req, res) => {
  if (req.isAuthenticated()) {
    res.status(200).json({ user: req.user });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});

router.put("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    return res.status(400).json({ message: "Display name is required" });
  }

  try {
    const prisma = require("../config/db");
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name },
      select: { id: true, name: true, email: true },
    });

    res.status(200).json({ user });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Unable to update profile" });
  }
});

// Logout Handler
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.status(200).json({ message: "Logged out successfully" });
    });
  });
});

module.exports = router;