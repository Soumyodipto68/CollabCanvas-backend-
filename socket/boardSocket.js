// server_side/socket/boardSocket.js
module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a specific whiteboard room
    socket.on("join-room", ({ roomId, user }) => {
      socket.join(roomId);
      socket.to(roomId).emit("user-joined", { userId: socket.id, user });
    });

    // Broadcast drawing segments to everyone else in the room
    socket.on("draw-step", ({ roomId, stroke }) => {
      socket.to(roomId).emit("draw-step", stroke);
    });

    // Broadcast user cursor position
    socket.on("cursor-move", ({ roomId, cursor }) => {
      socket.to(roomId).emit("cursor-move", {
        userId: socket.id,
        cursor,
      });
    });

    // Clear board for everyone
    socket.on("clear-board", (roomId) => {
      socket.to(roomId).emit("clear-board");
    });

    // Handle user disconnect
    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit("user-left", { userId: socket.id });
        }
      }
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};