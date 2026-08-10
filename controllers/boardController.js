const prisma = require("../config/db"); // Your Prisma Client instance
const { redisClient } = require("../config/redis"); // Your Redis client instance
const { pushStrokeToBuffer } = require("../services/boardBuffer");

/**
 * POST /api/boards
 * Create a new board for the logged-in user
 */
const createBoard = async (req, res) => {
  const { title } = req.body;
  const userId = req.user?.id || req.user?._id; // Extracted from Passport session

  try {
    const newBoard = await prisma.board.create({
      data: {
        title: title || "Untitled Board",
        userId: userId, // Ensure your Prisma schema links board to user
        data: [], // Initialize with empty stroke array
      },
    });

    return res.status(201).json(newBoard);
  } catch (error) {
    console.error("Error creating board:", error);
    return res.status(500).json({ message: "Failed to create board" });
  }
};

/**
 * GET /api/boards
 * Fetch all boards created by the logged-in user
 */
const getUserBoards = async (req, res) => {
  const userId = req.user?.id || req.user?._id;

  try {
    const boards = await prisma.board.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        boardId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        // Exclude 'data' array here to keep list payload light
      },
    });

    return res.status(200).json(boards);
  } catch (error) {
    console.error("Error fetching user boards:", error);
    return res.status(500).json({ message: "Failed to fetch user boards" });
  }
};

/**
 * GET /api/boards/:id
 * Fetch a single board by ID (Merges PostgreSQL DB + pending Redis buffer)
 */
const getBoardById = async (req, res) => {
  const { id: boardId } = req.params;

  try {
    // 1. Fetch persistent board data from Postgres via Prisma
    const board = await prisma.board.findUnique({
      where: { boardId },
    });

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    const persistedStrokes = Array.isArray(board.data) ? board.data : [];

    // 2. Read any pending strokes sitting in the Redis buffer (not yet flushed to Postgres)
    const rawBuffer = await redisClient.lRange(
      `board:${boardId}:pending_strokes`,
      0,
      -1
    );
    const bufferedStrokes = rawBuffer.map((stroke) => JSON.parse(stroke));

    // 3. Return board metadata and merged stroke array
    return res.status(200).json({
      boardId: board.boardId,
      title: board.title,
      data: [...persistedStrokes, ...bufferedStrokes],
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching board:", error);
    return res.status(500).json({ message: "Server error while fetching board" });
  }
};

/**
 * PUT /api/boards/:id
 * Save or update canvas elements / board title
 */
const saveBoardElements = async (req, res) => {
  const { id: boardId } = req.params;
  const { title, data } = req.body;

  try {
    // Update board title if provided
    if (title) {
      await prisma.board.update({
        where: { boardId },
        data: { title },
      });
    }

    // Queue drawing strokes in Redis buffer
    if (Array.isArray(data) && data.length > 0) {
      for (const stroke of data) {
        await pushStrokeToBuffer(boardId, stroke);
      }
    }

    return res.status(200).json({ message: "Board changes queued successfully" });
  } catch (error) {
    console.error("Error saving board elements:", error);
    return res.status(500).json({ message: "Failed to save board elements" });
  }
};

/**
 * DELETE /api/boards/:id
 * Delete a board and clean up its Redis buffer
 */
const deleteBoard = async (req, res) => {
  const { id: boardId } = req.params;

  try {
    // 1. Delete from PostgreSQL
    await prisma.board.delete({
      where: { boardId },
    });

    // 2. Remove any leftover Redis pending strokes buffer
    await redisClient.del(`board:${boardId}:pending_strokes`);

    return res.status(200).json({ message: "Board deleted successfully" });
  } catch (error) {
    console.error("Error deleting board:", error);
    return res.status(500).json({ message: "Failed to delete board" });
  }
};

// Explicitly export ALL five handlers expected by boardRoutes.js
module.exports = {
  createBoard,
  getUserBoards,
  getBoardById,
  saveBoardElements,
  deleteBoard,
};