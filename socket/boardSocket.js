// server_side/socket/boardSocket.js

/**
 * Attaches whiteboard event listeners to the Socket.IO instance
 * @param {import('socket.io').Server} io 
 */
module.exports = function registerBoardSocket(io) {
  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Track room joined by this socket connection
    let currentBoardId = null;
    let currentUserId = null;

    // 1. Join Board Room
    socket.on("join-board", ({ boardId, userId, name }) => {
      if (!boardId) return;

      currentBoardId = boardId;
      currentUserId = userId || socket.id;

      socket.join(boardId);
      console.log(`[Socket] User ${name || currentUserId} joined room: ${boardId}`);

      // Calculate active users count in room
      const roomClients = io.sockets.adapter.rooms.get(boardId);
      const userCount = roomClients ? roomClients.size : 1;

      // Broadcast room count update to everyone in the room
      io.to(boardId).emit("room-users-count", userCount);
    });

    // 2. Broadcast Live Drawing Stroke
    socket.on("draw-stroke", ({ boardId, stroke }) => {
      if (!boardId || !stroke) return;
      // Send drawing data to all clients in the room EXCEPT the sender
      socket.to(boardId).emit("draw-stroke", stroke);
    });

    // 3. Broadcast Real-time Cursor Movement
    socket.on("mouse-move", ({ boardId, userId, name, x, y }) => {
      if (!boardId) return;
      socket.to(boardId).emit("cursor-moved", {
        userId: userId || socket.id,
        name: name || "Anonymous",
        x,
        y,
      });
    });

    // 4. Handle Clear Canvas Event
    socket.on("clear-board", ({ boardId }) => {
      if (!boardId) return;
      socket.to(boardId).emit("board-cleared");
    });

    // 5. Explicit Room Leave
    socket.on("leave-board", ({ boardId, userId }) => {
      if (!boardId) return;

      socket.leave(boardId);
      console.log(`[Socket] User ${userId || socket.id} left room: ${boardId}`);

      const roomClients = io.sockets.adapter.rooms.get(boardId);
      const userCount = roomClients ? roomClients.size : 0;

      io.to(boardId).emit("room-users-count", userCount);
      socket.to(boardId).emit("user-left", userId || socket.id);
    });

    // 6. Handle Disconnect
    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      if (currentBoardId) {
        const roomClients = io.sockets.adapter.rooms.get(currentBoardId);
        const userCount = roomClients ? roomClients.size : 0;

        io.to(currentBoardId).emit("room-users-count", userCount);
        socket.to(currentBoardId).emit("user-left", currentUserId);
      }
    });
  });
};