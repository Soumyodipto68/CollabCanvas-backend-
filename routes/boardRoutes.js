// server_side/routes/boardRoutes.js
const express = require("express");
const router = express.Router();
const {
  createBoard,
  getUserBoards,
  getBoardById,
  saveBoardElements,
  deleteBoard,
} = require("../controllers/boardController");

// Authentication middleware for Passport Sessions
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized. Please log in first." });
};

// --- BOARD ROUTES ---

// Create a new board (Protected)
router.post("/", isAuthenticated, createBoard);

// Get all boards belonging to the logged-in user (Protected)
router.get("/", isAuthenticated, getUserBoards);

// Get a single board by ID (Public so shared room links work, or add isAuthenticated if private)
router.get("/:id", getBoardById);

// Save or update canvas drawing elements for a board (Protected)
router.put("/:id", isAuthenticated, saveBoardElements);

// Delete a board (Protected)
router.delete("/:id", isAuthenticated, deleteBoard);

module.exports = router;