// server_side/controllers/boardController.js
const prisma = require("../config/db");

/**
 * 1. Create a new Whiteboard
 * Route: POST /api/boards
 * Protected: Yes (Passport Session)
 */
const normalizeBoardPriority = (priority) => {
  const normalizedPriority = String(priority || "medium").trim().toLowerCase();
  return ["low", "medium", "high"].includes(normalizedPriority)
    ? normalizedPriority
    : "medium";
};

exports.createBoard = async (req, res) => {
  try {
    const { title, details, priority } = req.body;
    const ownerId = req.user.id; // Set by Passport deserializer

    const board = await prisma.board.create({
      data: {
        title: title || "Untitled Board",
        details: details?.trim() || null,
        priority: normalizeBoardPriority(priority),
        ownerId,
        elements: [], // Initializes with an empty canvas stroke/element list
      },
    });

    res.status(201).json({
      ...board,
      data: board.elements ?? [],
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
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        details: true,
        priority: true,
        pinned: true,
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

exports.toggleBoardPin = async (req, res) => {
  try {
    const { id } = req.params;
    const board = await prisma.board.findUnique({ where: { id } });

    if (!board) return res.status(404).json({ message: "Board not found" });
    if (board.ownerId !== req.user.id) {
      return res.status(403).json({ message: "You can only pin boards you own" });
    }

    const updatedBoard = await prisma.board.update({
      where: { id },
      data: { pinned: !board.pinned },
      select: { id: true, pinned: true },
    });

    res.status(200).json(updatedBoard);
  } catch (error) {
    console.error("Toggle Board Pin Error:", error);
    res.status(500).json({ message: "Failed to update board pin" });
  }
};

exports.getSharedBoards = async (req, res) => {
  try {
    const userId = req.user.id;

    const boardShares = await prisma.boardShare.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        board: {
          select: {
            id: true,
            title: true,
            details: true,
            priority: true,
            createdAt: true,
            updatedAt: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    const boards = boardShares.map(({ board }) => ({
      ...board,
      ownerName: board.owner?.name,
    }));

    res.status(200).json(boards);
  } catch (error) {
    console.error("Get Shared Boards Error:", error);
    res.status(500).json({ message: "Failed to retrieve shared boards" });
  }
};

exports.shareBoardWithUser = async (req, res) => {
  try {
    const { id: boardId } = req.params;
    const { email } = req.body;
    const currentUserId = req.user.id;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    if (board.ownerId !== currentUserId) {
      return res.status(403).json({ message: "You can only share boards you own" });
    }

    const targetUser = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!targetUser) {
      return res.status(404).json({ message: "User not found with that email" });
    }

    if (targetUser.id === currentUserId) {
      return res.status(400).json({ message: "You cannot share a board with yourself" });
    }

    const share = await prisma.boardShare.upsert({
      where: {
        boardId_userId: {
          boardId,
          userId: targetUser.id,
        },
      },
      update: {},
      create: {
        boardId,
        userId: targetUser.id,
      },
    });

    res.status(200).json({
      message: "Board shared successfully",
      share,
      recipient: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
      },
    });
  } catch (error) {
    console.error("Share Board Error:", error);
    res.status(500).json({ message: "Failed to share board" });
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

    res.status(200).json({
      ...board,
      elements: board.elements ?? [],
      data: board.elements ?? [],
    });
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
    const { elements, data, title, details, priority } = req.body;
    const incomingElements = elements ?? data ?? [];

    const existingBoard = await prisma.board.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!existingBoard) {
      return res.status(404).json({ message: "Board not found" });
    }

    if (priority !== undefined && existingBoard.ownerId !== req.user.id) {
      return res.status(403).json({ message: "Only the board creator can change its priority" });
    }

    const updateData = {};
    if (elements !== undefined || data !== undefined) updateData.elements = incomingElements;
    if (title !== undefined) updateData.title = title;
    if (details !== undefined) updateData.details = details?.trim() || null;
    if (priority !== undefined) updateData.priority = normalizeBoardPriority(priority);

    const board = await prisma.board.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      message: "Board updated successfully",
      ...board,
      elements: board.elements ?? [],
      data: board.elements ?? [],
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