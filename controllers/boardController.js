// server_side/controllers/boardController.js
const prisma = require("../config/db");

/**
 * 1. Create a new Whiteboard
 * Route: POST /api/boards
 * Protected: Yes (Passport Session)
 */
exports.createBoard = async (req, res) => {
  try {
    const { title } = req.body;
    const ownerId = req.user.id; // Set by Passport deserializer

    const board = await prisma.board.create({
      data: {
        title: title || "Untitled Board",
        ownerId,
        elements: [], // Initializes with an empty canvas stroke/element list
      },
    });

    res.status(201).json({
      message: "Board created successfully",
      board,
    });
  } catch (error) {
    console.error("Create Board Error:", error);
    res.status(500).json({ message: "Failed to create board" });
  }
};

/**
 * 2. Fetch all Boards belonging to the current user
 * Route: GET /api/boards
 * Protected: Yes
 */
exports.getUserBoards = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const boards = await prisma.board.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json(boards);
  } catch (error) {
    console.error("Get User Boards Error:", error);
    res.status(500).json({ message: "Failed to retrieve boards" });
  }
};

/**
 * 3. Fetch a single Board by ID
 * Route: GET /api/boards/:id
 * Protected: Optional / Public for shared room links
 */
exports.getBoardById = async (req, res) => {
  try {
    const { id } = req.params;

    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    res.status(200).json(board);
  } catch (error) {
    console.error("Get Board By ID Error:", error);
    res.status(500).json({ message: "Failed to retrieve board" });
  }
};

/**
 * 4. Save / Update Canvas Elements or Title
 * Route: PUT /api/boards/:id
 * Protected: Yes
 */
exports.saveBoardElements = async (req, res) => {
  try {
    const { id } = req.params;
    const { elements, title } = req.body;

    const updateData = {};
    if (elements !== undefined) updateData.elements = elements;
    if (title !== undefined) updateData.title = title;

    const board = await prisma.board.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      message: "Board updated successfully",
      board,
    });
  } catch (error) {
    console.error("Save Board Elements Error:", error);
    res.status(500).json({ message: "Failed to save board" });
  }
};

/**
 * 5. Delete a Board
 * Route: DELETE /api/boards/:id
 * Protected: Yes
 */
exports.deleteBoard = async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.id;

    // Check if board exists
    const board = await prisma.board.findUnique({ where: { id } });

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Ensure the requester owns the board
    if (board.ownerId !== ownerId) {
      return res.status(403).json({ message: "Not authorized to delete this board" });
    }

    await prisma.board.delete({ where: { id } });

    res.status(200).json({ message: "Board deleted successfully" });
  } catch (error) {
    console.error("Delete Board Error:", error);
    res.status(500).json({ message: "Failed to delete board" });
  }
};